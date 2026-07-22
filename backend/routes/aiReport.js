// routes/aiReport.js — Token Optimized

const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');
const sql     = require('mssql');

let _getPool;
let _groq;

function setPool(fn)    { _getPool = fn; }
function setConfig(cfg) { 
    if (cfg?.GROQ_API_KEY) _groq = new Groq({ apiKey: cfg.GROQ_API_KEY }); 
}

// ════════════════════════════════════════════════════════
// SECTION 0 — RETRY WRAPPER (unchanged)
// ════════════════════════════════════════════════════════
async function callGroqWithRetry(groqCallFn, retries = 3, delay = 1000) {
    let attempt = 0;
    while (true) {
        try {
            return await groqCallFn();
        } catch (err) {
            const isRateLimit =
                err.status === 429 ||
                (err.message && err.message.includes('rate_limit_exceeded'));
            if (isRateLimit && attempt < retries) {
                attempt++;
                const backoff = delay * Math.pow(2, attempt - 1);
                console.warn(`[Retry] ${attempt}/${retries}, wait ${backoff}ms`);
                await new Promise(r => setTimeout(r, backoff));
            } else {
                throw err;
            }
        }
    }
}

// ════════════════════════════════════════════════════════
// SECTION 1 — INTENT DETECTION (compressed keywords)
// ════════════════════════════════════════════════════════
const INTENT_KEYWORDS = {
    status:     ['status','how','overall','performance','summary','overview','kohomada','kedeida'],
    revenue:    ['revenue','sales','income','money','total','laba','bikunu','vikunu'],
    items:      ['item','food','menu','best','popular','selling','kema','kaema'],
    trend:      ['trend','hourly','busy','peak','hour','pattern','welawa','velawa'],
    comparison: ['compare','vs','yesterday','last week','difference','iye','pera','venas'],
    ordertype:  ['dine','takeaway','ta','di','order type','delivery'],
    customers:  ['customer','guest','pax','local','foreign','table','minissu'],
    payment:    ['payment','pay','cash','card','tender','method','ganda'],
    bills:      ['bill','closed','settled','net total','service charge','vat','discount'],
};

function detectIntent(question) {
    const q = question.toLowerCase();
    const scores = {};
    for (const [intent, kws] of Object.entries(INTENT_KEYWORDS)) {
        scores[intent] = kws.filter(k => q.includes(k)).length;
    }
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return top[1] > 0 ? top[0] : 'general';
}

function detectDateScope(question) {
    const q = question.toLowerCase();
    if (['today','ada','meada','adath'].some(w => q.includes(w)))           return 'today';
    if (['yesterday','iye','iyet'].some(w => q.includes(w)))                return 'yesterday';
    if (['this month','me mase','me masa'].some(w => q.includes(w)))        return 'this_month';
    if (['last month','pera mase','pera masa'].some(w => q.includes(w)))    return 'last_month';
    if (['last week','pera satiyen'].some(w => q.includes(w)))              return 'last_week';
    return 'unspecified';
}

// ════════════════════════════════════════════════════════
// SECTION 2 — DATE HELPERS (unchanged)
// ════════════════════════════════════════════════════════
function nextDay(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const daysInMonth = (year, month) => {
        if (month === 2) {
            const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
            return leap ? 29 : 28;
        }
        return [31,28,31,30,31,30,31,31,30,31,30,31][month - 1];
    };
    let ny = y, nm = m, nd = d + 1;
    if (nd > daysInMonth(y, m)) {
        nd = 1; nm += 1;
        if (nm > 12) { nm = 1; ny += 1; }
    }
    return `${ny}-${String(nm).padStart(2,'0')}-${String(nd).padStart(2,'0')}`;
}

function firstDayOfNextMonth(ymStr) {
    let [y, m] = ymStr.split('-').map(Number);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    return `${y}-${String(m).padStart(2,'0')}-01`;
}

// ════════════════════════════════════════════════════════
// SECTION 3 — DATE RESOLVER (unchanged)
// ════════════════════════════════════════════════════════
async function resolveDataDates(db, requestedDate) {
    const res = await db.request().query(`
        SELECT TOP 35
            DATEADD(day, DATEDIFF(day,0,[Txndate]),0) AS d,
            COUNT(DISTINCT [BillNo]) AS bills,
            SUM([NetTotal])          AS revenue
        FROM dbo.Tbl_BillHeader
        WHERE ([DoNotShowInSales]=0 OR [DoNotShowInSales] IS NULL)
        GROUP BY DATEADD(day, DATEDIFF(day,0,[Txndate]),0)
        ORDER BY d DESC`);

    const rows = res.recordset.map(r => ({
        date:    r.d instanceof Date ? r.d.toISOString().slice(0,10) : String(r.d).slice(0,10),
        bills:   r.bills,
        revenue: r.revenue,
    }));

    if (rows.length === 0) return null;

    const latestDate = rows[0].date;
    const prevDate   = rows[1]?.date || latestDate;

    const monthMap = {};
    for (const r of rows) {
        const ym = r.date.slice(0,7);
        if (!monthMap[ym]) monthMap[ym] = { revenue: 0, bills: 0 };
        monthMap[ym].revenue += r.revenue;
        monthMap[ym].bills   += r.bills;
    }
    const months = Object.entries(monthMap).sort((a,b) => b[0].localeCompare(a[0]));

    const last30Start = rows[rows.length - 1]?.date || latestDate;
    const last30End   = latestDate;

    return {
        latestDate,
        prevDate,
        currentMonth:        months[0]?.[0],
        currentMonthStart:   months[0] ? `${months[0][0]}-01` : latestDate,
        currentMonthNextDay: months[0] ? firstDayOfNextMonth(months[0][0]) : nextDay(latestDate),
        prevMonth:           months[1]?.[0],
        prevMonthStart:      months[1] ? `${months[1][0]}-01` : latestDate,
        prevMonthNextDay:    months[1] ? firstDayOfNextMonth(months[1][0]) : nextDay(latestDate),
        last30Start,
        last30NextDay:       nextDay(last30End),
        last30End,
        recentDays:          rows.slice(0,7).map(r => r.date),
        requestedDate,
        hasDataOnRequested:  rows.some(r => r.date === requestedDate),
        allAvailableDates:   rows,
    };
}

// ════════════════════════════════════════════════════════
// SECTION 4 — DIRECT SQL BUILD (replaces Groq Call #1)
// ════════════════════════════════════════════════════════
function buildSQLDirect(intent, dates, dateScope) {

    const safe = `([DoNotShowInSales]=0 OR [DoNotShowInSales] IS NULL)`;

    // Date filter select
    const trendIntents = ['trend','items','comparison','general'];
    const scope = dateScope === 'unspecified'
        ? (trendIntents.includes(intent) ? 'last_30' : 'today')
        : dateScope;

    const filterMap = {
        today:      `[Txndate] >= '${dates.latestDate}' AND [Txndate] < '${nextDay(dates.latestDate)}'`,
        yesterday:  `[Txndate] >= '${dates.prevDate}' AND [Txndate] < '${nextDay(dates.prevDate)}'`,
        this_month: `[Txndate] >= '${dates.currentMonthStart}' AND [Txndate] < '${dates.currentMonthNextDay}'`,
        last_month: `[Txndate] >= '${dates.prevMonthStart}' AND [Txndate] < '${dates.prevMonthNextDay}'`,
        last_week:  `[Txndate] >= '${dates.prevDate}' AND [Txndate] < '${nextDay(dates.prevDate)}'`,
        last_30:    `[Txndate] >= '${dates.last30Start}' AND [Txndate] < '${dates.last30NextDay}'`,
    };

    const f  = filterMap[scope] || filterMap.today;
    const fH = f.replace(/\[Txndate\]/g, 'h.[Txndate]');

    const chartMap = {
        status:     { chartType: 'NONE', x: '',          y: '' },
        revenue:    { chartType: 'NONE', x: '',          y: '' },
        items:      { chartType: 'BAR',  x: 'itemName',  y: 'totalRevenue' },
        trend:      { chartType: 'LINE', x: 'hr',        y: 'revenue' },
        comparison: { chartType: 'LINE', x: 'txnDay',    y: 'revenue' },
        ordertype:  { chartType: 'PIE',  x: 'orderMode', y: 'revenue' },
        customers:  { chartType: 'NONE', x: '',          y: '' },
        payment:    { chartType: 'PIE',  x: 'payMethod', y: 'totalAmt' },
        bills:      { chartType: 'NONE', x: '',          y: '' },
        general:    { chartType: 'NONE', x: '',          y: '' },
    };

    const sqlMap = {
        status: `
            SELECT
                SUM([NetTotal])   AS totalRevenue,
                COUNT(DISTINCT [BillNo]) AS txnCount,
                AVG([NetTotal])   AS avgBillValue,
                COUNT(DISTINCT [TableNo]) AS totalTables,
                SUM([NOPax])      AS totalPax,
                SUM(CASE WHEN [OrderMode]='DI' THEN [NetTotal] ELSE 0 END) AS dineInRevenue,
                SUM(CASE WHEN [OrderMode]='TA' THEN [NetTotal] ELSE 0 END) AS takeawayRevenue,
                SUM([DisVal])     AS totalDiscount,
                SUM([SerChg])     AS totalSerChg,
                SUM([VAT])        AS totalVAT,
                SUM([Gross])      AS totalGross
            FROM dbo.Tbl_BillHeader
            WHERE ${f} AND ${safe}`,

        revenue: `
            SELECT
                SUM([NetTotal])          AS totalRevenue,
                COUNT(DISTINCT [BillNo]) AS txnCount,
                AVG([NetTotal])          AS avgBill,
                SUM([VAT])               AS totalVAT,
                SUM([DisVal])            AS totalDiscount,
                SUM([SerChg])            AS totalSerChg,
                SUM([Gross])             AS totalGross
            FROM dbo.Tbl_BillHeader
            WHERE ${f} AND ${safe}`,

        items: `
            SELECT TOP 10
                m.[MenuItmDes]          AS itemName,
                SUM(d.[Qty])            AS totalQty,
                SUM(d.[TotalItmPrice])  AS totalRevenue,
                AVG(d.[SalesPrice])     AS avgPrice
            FROM dbo.Tbl_BillDetails d
            JOIN dbo.Tbl_BillHeader h ON h.[BillNo] = d.[BillNo]
            JOIN dbo.Tbl_MenuItems m  ON m.[MenuItmId] = d.[SubItmId]
            WHERE ${fH} AND (h.[DoNotShowInSales]=0 OR h.[DoNotShowInSales] IS NULL)
            GROUP BY d.[SubItmId], m.[MenuItmDes]
            ORDER BY totalRevenue DESC`,

        trend: `
            SELECT
                DATEPART(HOUR,[Txndate]) AS hr,
                COUNT(DISTINCT [BillNo]) AS txnCount,
                SUM([NetTotal])          AS revenue,
                AVG([NetTotal])          AS avgBill
            FROM dbo.Tbl_BillHeader
            WHERE ${f} AND ${safe}
            GROUP BY DATEPART(HOUR,[Txndate])
            ORDER BY hr ASC`,

        comparison: `
            SELECT
                DATEADD(day,DATEDIFF(day,0,[Txndate]),0) AS txnDay,
                SUM([NetTotal])          AS revenue,
                COUNT(DISTINCT [BillNo]) AS billCount,
                AVG([NetTotal])          AS avgBill
            FROM dbo.Tbl_BillHeader
            WHERE ${f} AND ${safe}
            GROUP BY DATEADD(day,DATEDIFF(day,0,[Txndate]),0)
            ORDER BY txnDay DESC`,

        ordertype: `
            SELECT
                [OrderMode]              AS orderMode,
                COUNT(DISTINCT [BillNo]) AS billCount,
                SUM([NetTotal])          AS revenue,
                AVG([NetTotal])          AS avgBill,
                SUM([NOPax])             AS totalPax
            FROM dbo.Tbl_BillHeader
            WHERE ${f} AND ${safe}
            GROUP BY [OrderMode]
            ORDER BY revenue DESC`,

        customers: `
            SELECT
                SUM([NOPax])             AS totalPax,
                SUM([LocalPax])          AS localPax,
                SUM([ForiegnPax])        AS foreignPax,
                COUNT(DISTINCT [TableNo]) AS tableCount,
                COUNT(DISTINCT [BillNo]) AS billCount,
                AVG([NOPax])             AS avgPaxPerBill
            FROM dbo.Tbl_BillHeader
            WHERE ${f} AND ${safe}`,

        payment: `
            SELECT
                p.[PayCode]              AS payMethod,
                SUM(p.[ActAmt])          AS totalAmt,
                COUNT(DISTINCT p.[BillNo]) AS txnCount
            FROM dbo.Tbl_BillPayTxn p
            JOIN dbo.Tbl_BillHeader h ON h.[BillNo] = p.[BillNo]
            WHERE ${fH} AND (h.[DoNotShowInSales]=0 OR h.[DoNotShowInSales] IS NULL)
            GROUP BY p.[PayCode]
            ORDER BY totalAmt DESC`,

        bills: `
            SELECT
                COUNT(DISTINCT [BillNo]) AS billCount,
                SUM([NetTotal])          AS totalNet,
                AVG([NetTotal])          AS avgNet,
                SUM([SerChg])            AS totalSerChg,
                SUM([VAT])               AS totalVAT,
                SUM([DisVal])            AS totalDiscount,
                AVG([BillDuration])      AS avgDuration,
                SUM([NOPax])             AS totalPax
            FROM dbo.Tbl_BillHeader
            WHERE ${f} AND ${safe}`,

        general: `
            SELECT
                SUM([NetTotal])          AS totalRevenue,
                COUNT(DISTINCT [BillNo]) AS txnCount,
                AVG([NetTotal])          AS avgBill,
                COUNT(DISTINCT [TableNo]) AS tableCount,
                SUM([NOPax])             AS totalPax,
                SUM(CASE WHEN [OrderMode]='DI' THEN [NetTotal] ELSE 0 END) AS dineInRevenue,
                SUM(CASE WHEN [OrderMode]='TA' THEN [NetTotal] ELSE 0 END) AS takeawayRevenue
            FROM dbo.Tbl_BillHeader
            WHERE ${f} AND ${safe}`,
    };

    const chart = chartMap[intent] || chartMap.general;

    return {
        sql:              (sqlMap[intent] || sqlMap.general).trim(),
        chartType:        chart.chartType,
        xAxisKey:         chart.x,
        yAxisKey:         chart.y,
        queryDescription: `${intent} — ${scope}`,
    };
}

// ════════════════════════════════════════════════════════
// SECTION 5 — RICH CONTEXT (with cache)
// ════════════════════════════════════════════════════════
let _richCache     = null;
let _richCacheTime = 0;
const CACHE_TTL    = 5 * 60 * 1000; // 5 minutes

async function loadRichContext(db, dates) {
    const now = Date.now();
    if (_richCache && (now - _richCacheTime) < CACHE_TTL) {
        console.log('[RichContext] from cache');
        return _richCache;
    }

    try {
        const [topItems, paymentMix, orderMix, recentTrend] = await Promise.all([

            db.request()
              .input('s', sql.VarChar(10), dates.last30Start)
              .input('e', sql.VarChar(10), dates.last30NextDay)
              .query(`
                SELECT TOP 5
                    m.[MenuItmDes] AS itemName,
                    SUM(d.[Qty])   AS qty,
                    SUM(d.[TotalItmPrice]) AS revenue
                FROM dbo.Tbl_BillDetails d
                JOIN dbo.Tbl_BillHeader h ON h.[BillNo]=d.[BillNo]
                JOIN dbo.Tbl_MenuItems m  ON m.[MenuItmId]=d.[SubItmId]
                WHERE h.[Txndate] >= @s AND h.[Txndate] < @e
                  AND (h.[DoNotShowInSales]=0 OR h.[DoNotShowInSales] IS NULL)
                GROUP BY d.[SubItmId],m.[MenuItmDes]
                ORDER BY revenue DESC`),

            db.request()
              .input('s', sql.VarChar(10), dates.last30Start)
              .input('e', sql.VarChar(10), dates.last30NextDay)
              .query(`
                SELECT p.[PayCode] AS method, SUM(p.[ActAmt]) AS total
                FROM dbo.Tbl_BillPayTxn p
                JOIN dbo.Tbl_BillHeader h ON h.[BillNo]=p.[BillNo]
                WHERE h.[Txndate] >= @s AND h.[Txndate] < @e
                  AND (h.[DoNotShowInSales]=0 OR h.[DoNotShowInSales] IS NULL)
                GROUP BY p.[PayCode]
                ORDER BY total DESC`),

            db.request()
              .input('s', sql.VarChar(10), dates.last30Start)
              .input('e', sql.VarChar(10), dates.last30NextDay)
              .query(`
                SELECT [OrderMode], SUM([NetTotal]) AS revenue, COUNT(DISTINCT [BillNo]) AS bills
                FROM dbo.Tbl_BillHeader
                WHERE [Txndate] >= @s AND [Txndate] < @e
                  AND ([DoNotShowInSales]=0 OR [DoNotShowInSales] IS NULL)
                GROUP BY [OrderMode]`),

            db.request().query(`
                SELECT TOP 7
                    DATEADD(day,DATEDIFF(day,0,[Txndate]),0) AS d,
                    SUM([NetTotal])          AS revenue,
                    COUNT(DISTINCT [BillNo]) AS bills
                FROM dbo.Tbl_BillHeader
                WHERE ([DoNotShowInSales]=0 OR [DoNotShowInSales] IS NULL)
                GROUP BY DATEADD(day,DATEDIFF(day,0,[Txndate]),0)
                ORDER BY d DESC`),
        ]);

        _richCache = {
            topItems:    topItems.recordset,
            paymentMix:  paymentMix.recordset,
            orderMix:    orderMix.recordset,
            recentTrend: recentTrend.recordset,
        };
        _richCacheTime = now;
        return _richCache;

    } catch (e) {
        console.warn('[RichContext] Failed:', e.message);
        return _richCache || null;
    }
}

// ════════════════════════════════════════════════════════
// SECTION 6 — DATA PRE-PROCESSOR (unchanged)
// ════════════════════════════════════════════════════════
function preprocessData(rawData, intent) {
    if (!rawData || rawData.length === 0) 
        return { summary: 'No data.', rows: [], derived: {} };

    const rows = rawData.slice(0, 60);
    let derived = {};

    if (intent === 'status' && rows.length === 1) {
        const r = rows[0];
        const discountRate = r.totalGross > 0 ? ((r.totalDiscount/r.totalGross)*100).toFixed(1) : 0;
        const diShare      = r.totalRevenue > 0 ? ((r.dineInRevenue/r.totalRevenue)*100).toFixed(1) : 0;
        const taShare      = r.totalRevenue > 0 ? ((r.takeawayRevenue/r.totalRevenue)*100).toFixed(1) : 0;
        derived = { discountRate, diShare, taShare };
        return {
            summary: `Revenue:Rs.${r.totalRevenue?.toFixed(0)},Bills:${r.txnCount},AvgBill:Rs.${r.avgBillValue?.toFixed(0)},Tables:${r.totalTables},Pax:${r.totalPax},DI:Rs.${r.dineInRevenue?.toFixed(0)}(${diShare}%),TA:Rs.${r.takeawayRevenue?.toFixed(0)}(${taShare}%),Disc:Rs.${r.totalDiscount?.toFixed(0)}(${discountRate}%),SerChg:Rs.${r.totalSerChg?.toFixed(0)},VAT:Rs.${r.totalVAT?.toFixed(0)}`,
            rows, derived,
        };
    }

    if (intent === 'items' && rows.length > 0) {
        const totalRev  = rows.reduce((s,r) => s+(r.totalRevenue||0), 0);
        const top3Share = rows.slice(0,3).reduce((s,r) => s+(r.totalRevenue||0), 0);
        derived = { totalRevenue: totalRev, top3RevenueShare: totalRev>0?((top3Share/totalRev)*100).toFixed(1):0 };
        return {
            summary: `${rows.length} items.Total:Rs.${totalRev.toFixed(0)}.#1:${rows[0].itemName}-${rows[0].totalQty}units/Rs.${rows[0].totalRevenue?.toFixed(0)}.Top3=${derived.top3RevenueShare}%`,
            rows, derived,
        };
    }

    if (intent === 'trend' && rows.length > 0) {
        const peak  = rows.reduce((a,b) => b.revenue>a.revenue?b:a, rows[0]);
        const dead  = rows.reduce((a,b) => b.revenue<a.revenue?b:a, rows[0]);
        const total = rows.reduce((s,r) => s+(r.revenue||0), 0);
        derived = { peakHour: peak.hr, deadHour: dead.hr, totalRevenue: total };
        return {
            summary: `${rows.length}hrs.Total:Rs.${total.toFixed(0)}.Peak:${peak.hr}:00(Rs.${peak.revenue?.toFixed(0)},${peak.txnCount}bills).Dead:${dead.hr}:00(Rs.${dead.revenue?.toFixed(0)})`,
            rows, derived,
        };
    }

    if (intent === 'payment' && rows.length > 0) {
        const total  = rows.reduce((s,r) => s+(r.totalAmt||0), 0);
        const top    = rows[0];
        derived = { grandTotal: total, topMethodPct: total>0?((top.totalAmt/total)*100).toFixed(1):0 };
        return {
            summary: `${rows.length} methods.Total:Rs.${total.toFixed(0)}.Top:${top.payMethod}=Rs.${top.totalAmt?.toFixed(0)}(${derived.topMethodPct}%)`,
            rows, derived,
        };
    }

    if (intent === 'ordertype' && rows.length > 0) {
        const total = rows.reduce((s,r) => s+(r.revenue||0), 0);
        derived = { grandTotal: total };
        return {
            summary: rows.map(r => `${r.orderMode}:Rs.${r.revenue?.toFixed(0)}(${total>0?((r.revenue/total)*100).toFixed(1):0}%,${r.billCount}bills)`).join('|'),
            rows: rows.map(r => ({ ...r, share: total>0?((r.revenue/total)*100).toFixed(1):0 })),
            derived,
        };
    }

    if (intent === 'customers' && rows.length === 1) {
        const r = rows[0];
        derived = { foreignPct: r.totalPax>0?((r.foreignPax/r.totalPax)*100).toFixed(1):0 };
        return {
            summary: `Pax:${r.totalPax},Local:${r.localPax},Foreign:${r.foreignPax}(${derived.foreignPct}%),Tables:${r.tableCount},AvgPax/bill:${r.avgPaxPerBill?.toFixed(1)},Bills:${r.billCount}`,
            rows, derived,
        };
    }

    if (intent === 'comparison' && rows.length > 0) {
        const sorted  = [...rows].sort((a,b) => String(b.txnDay).localeCompare(String(a.txnDay)));
        const latest  = sorted[0];
        const prev    = sorted[1];
        const change  = prev?.revenue>0?(((latest.revenue-prev.revenue)/prev.revenue)*100).toFixed(1):null;
        derived = { latestDay: latest.txnDay, prevDay: prev?.txnDay, revenueChange: change };
        return {
            summary: `${rows.length}days.Latest(${latest.txnDay}):Rs.${latest.revenue?.toFixed(0)},${latest.billCount}bills.Prev(${prev?.txnDay}):Rs.${prev?.revenue?.toFixed(0)}.Change:${change!==null?change+'%':'N/A'}`,
            rows: sorted.slice(0,14), derived,
        };
    }

    return {
        summary: `${rows.length} rows.First:${JSON.stringify(rows[0]).slice(0,150)}`,
        rows, derived,
    };
}

// ════════════════════════════════════════════════════════
// SECTION 7 — COMPRESSED ANALYSIS PROMPT
// (~2,000 tokens → ~800 tokens)
// ════════════════════════════════════════════════════════

// Compressed system prompt (~150 tokens vs ~600)
const SYSTEM = `Sri Lankan restaurant BI analyst. Rules:
- Currency: Rs. X,XXX (never $,LKR,USD)
- All numbers must come from provided data only
- Peaks: 12-14:00 lunch, 19-22:00 dinner. Dead: 14-18:00
- Benchmarks: avgBill>Rs.2000, DI/TA≈60/40, disc<10%, SerChg≈10%, VAT≈8-12%
- BCG: Star=high rev+qty, PlowHorse=high qty+low rev(underpriced), Puzzle=high rev+low qty, Dog=low both
- Score 90-100=Exceptional,75-89=Strong,55-74=Moderate,35-54=BelowAverage,0-34=NeedsAttention
- Output valid JSON only. No markdown, no text outside JSON.`;

// Compressed intent frameworks (~50 tokens each vs ~250)
const FRAMEWORKS = {
    status:     `Check: avgBill>Rs.2000, DI/TA≈60/40, disc<10%, SerChg≈10%, VAT≈8-12%. Score + flag top risk/opportunity.`,
    revenue:    `Check: avgBill level, discount rate(DisVal/Gross), VAT yield, SerChg contribution. Flag anomalies.`,
    items:      `BCG classify each item. Revenue concentration top-3. Spot underpriced(PlowHorse) items.`,
    trend:      `Compare to 12-14:00/19-22:00 expected peaks. Quantify dead hours. Staffing implication.`,
    comparison: `Absolute + % change. Bills vs revenue direction. One hypothesis for change.`,
    ordertype:  `DI/TA benchmark 60/40. AvgBill DI should be 20-40% higher than TA. Flag if skewed.`,
    customers:  `AvgPartySize=pax/bills. Foreign%>20 needs card+English menu. HighPax+lowRev=upsell gap.`,
    payment:    `Cash>70%=reconciliation risk. Card<15%=terminal issue. Promo share=margin risk.`,
    bills:      `AvgNet Rs.1500-4000 normal. SerChg/(Net-SerChg)≈10%. Duration<30=fast casual,45-90=sitdown.`,
    general:    `State value, assess health, explain. Find single most important cross-dimension insight.`,
};

function buildAnalysisPrompt(question, intent, processedData, richContext, queryDesc, dates) {
    const dataStr    = JSON.stringify(processedData.rows).slice(0, 2000);
    const isFallback = dates.requestedDate !== dates.latestDate;

    const dateNote = isFallback
        ? `⚠️ No data for "${dates.requestedDate}". Using latest: ${dates.latestDate}. Start directAnswer: "As of ${dates.latestDate} (most recent):"`
        : `Data: ${dates.latestDate}`;

    let ctx = '';
    if (richContext) {
        ctx = `\nCONTEXT(30d): items=${richContext.topItems.map(i=>`${i.itemName}:${i.qty}u/Rs.${i.revenue?.toFixed(0)}`).join(',')} | pay=${richContext.paymentMix.map(p=>`${p.method}:Rs.${p.total?.toFixed(0)}`).join(',')} | mode=${richContext.orderMix.map(o=>`${o.OrderMode}:Rs.${o.revenue?.toFixed(0)}`).join(',')} | trend=${richContext.recentTrend.map(t=>`${String(t.d).slice(0,10)}:Rs.${t.revenue?.toFixed(0)}`).join(',')}`;
    }

    return `Q: "${question}" | Intent: ${intent} | ${dateNote}
SUMMARY: ${processedData.summary}
DERIVED: ${JSON.stringify(processedData.derived)}
DATA(${processedData.rows.length}rows): ${dataStr}${ctx}
FRAMEWORK: ${FRAMEWORKS[intent] || FRAMEWORKS.general}

Return JSON:
{"directAnswer":"","performanceScore":null,"scoreLabel":null,"keyMetrics":[{"label":"","value":"","trend":"up|down|neutral","trendNote":""}],"chartData":{"type":"BAR|LINE|PIE|NONE","title":"","data":[{"label":"","value":0}]},"highlights":[{"type":"positive|warning|critical","icon":"✅|⚠️|🔴","title":"","detail":""}],"suggestions":[{"priority":"HIGH|MEDIUM|LOW","action":"","why":"","impact":""}],"nextActions":["","",""]}

Rules: keyMetrics 3-5, highlights 2-4(min 1 positive+1 warning), suggestions 2-3, nextActions exactly 3 strings under 10 words each, chartData.data from real data only.`;
}

// ════════════════════════════════════════════════════════
// SECTION 8 — JSON PARSER (unchanged)
// ════════════════════════════════════════════════════════
function parseLLMJson(raw) {
    const cleaned = raw.trim().replace(/```json/gi,'').replace(/```/g,'').trim();
    try { return JSON.parse(cleaned); } catch(_) {}
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch(_) {} }
    try {
        const reflow = cleaned.replace(/"((?:[^"\\]|\\.)*)"/gs,
            (_,inner) => '"'+inner.replace(/\r?\n\s*/g,' ').replace(/\t/g,' ').trim()+'"');
        return JSON.parse(reflow);
    } catch(_) {}
    throw new Error(`Invalid JSON from AI: ${raw.slice(0,200)}`);
}

// ════════════════════════════════════════════════════════
// SECTION 9 — MAIN ENDPOINT
// Total Groq calls: 1 only
// ════════════════════════════════════════════════════════
router.post('/generate-report', async (req, res) => {
    const { userQuestion, clientDate } = req.body;
    if (!userQuestion) return res.status(400).json({ error: 'Question required.' });

    if (!_groq) {
        const key = process.env.GROQ_API_KEY;
        if (key) _groq = new Groq({ apiKey: key });
        else return res.status(500).json({ error: 'GROQ_API_KEY not configured.' });
    }

    const requestedDate = clientDate
        ? new Date(clientDate).toISOString().slice(0,10)
        : new Date().toISOString().slice(0,10);

    try {
        // STAGE 1: Intent + date scope
        const intent    = detectIntent(userQuestion);
        const dateScope = detectDateScope(userQuestion);
        console.log(`[Intent] ${intent} | [Scope] ${dateScope}`);

        // STAGE 2: DB connect
        const db = await _getPool();

        // STAGE 3: Resolve dates
        const dates = await resolveDataDates(db, requestedDate);
        if (!dates) {
            return res.json({
                success: true, intent, dataDate: 'none', isFallbackDate: true,
                sqlExecuted: '', rowCount: 0, data: [],
                analysis: {
                    directAnswer: 'No sales data found. Check POS system.',
                    performanceScore: null, scoreLabel: null, keyMetrics: [],
                    chartData: { type:'NONE', title:'', data:[] },
                    highlights: [{ type:'critical', icon:'🔴', title:'No Data', detail:'No records in Tbl_BillHeader.' }],
                    suggestions: [{ priority:'HIGH', action:'Check POS connectivity', why:'No data found', impact:'No reporting possible' }],
                    nextActions: ['Is POS system connected?','When was last bill closed?','Check DB connection.'],
                },
            });
        }

        // STAGE 4: Rich context (parallel, cached)
        const richContextPromise = loadRichContext(db, dates);

        // STAGE 5: Build SQL directly — NO Groq call
        const llmConfig = buildSQLDirect(intent, dates, dateScope);
        console.log(`[SQL] ${llmConfig.sql}`);

        // STAGE 6: Execute SQL
        let rawData;
        let sqlExecuted = llmConfig.sql;

        try {
            const dbResult = await db.request().query(llmConfig.sql);
            rawData = dbResult.recordset;
            console.log(`[DB] ${rawData.length} rows`);
        } catch (sqlErr) {
            console.error('[SQL Error]:', sqlErr.message);

            // Parameterized fallback
            const fbStart = dates.latestDate;
            const fbEnd   = nextDay(dates.latestDate);
            const fbResult = await db.request()
                .input('s', sql.VarChar(10), fbStart)
                .input('e', sql.VarChar(10), fbEnd)
                .query(`
                    SELECT
                        SUM([NetTotal])   AS totalRevenue,
                        COUNT(DISTINCT [BillNo]) AS txnCount,
                        AVG([NetTotal])   AS avgBillValue,
                        COUNT(DISTINCT [TableNo]) AS totalTables,
                        SUM([NOPax])      AS totalPax,
                        SUM(CASE WHEN [OrderMode]='DI' THEN [NetTotal] ELSE 0 END) AS dineInRevenue,
                        SUM(CASE WHEN [OrderMode]='TA' THEN [NetTotal] ELSE 0 END) AS takeawayRevenue,
                        SUM([DisVal])     AS totalDiscount,
                        SUM([SerChg])     AS totalSerChg,
                        SUM([VAT])        AS totalVAT
                    FROM dbo.Tbl_BillHeader
                    WHERE [Txndate] >= @s AND [Txndate] < @e
                      AND ([DoNotShowInSales]=0 OR [DoNotShowInSales] IS NULL)`);

            rawData     = fbResult.recordset;
            sqlExecuted = `[FALLBACK] ${fbStart} (original failed: ${sqlErr.message.slice(0,80)})`;
            llmConfig.queryDescription = `Fallback status — ${fbStart}`;
        }

        // STAGE 7: Await rich context
        const richContext = await richContextPromise;

        // STAGE 8: Preprocess
        const processedData = preprocessData(rawData, intent);

        // STAGE 9: Deep Analysis — ONLY Groq call
        const analysisResult = await callGroqWithRetry(() =>
            _groq.chat.completions.create({
                model:           'llama-3.3-70b-versatile',
                temperature:     0.15,
                max_tokens:      1800,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM },
                    { role: 'user',   content: buildAnalysisPrompt(
                        userQuestion, intent, processedData,
                        richContext, llmConfig.queryDescription, dates
                    )},
                ],
            })
        );

        // Log actual token usage
        console.log('[Tokens]', analysisResult.usage);

        const analysis = parseLLMJson(analysisResult.choices[0].message.content);

        if (!Array.isArray(analysis.nextActions) || analysis.nextActions.length === 0) {
            analysis.nextActions = [
                "Show today's revenue breakdown.",
                "Which items sold most this week?",
                "Compare this week vs last week.",
            ];
        } else {
            analysis.nextActions = analysis.nextActions.slice(0, 3);
        }

        // STAGE 10: Respond
        res.json({
            success:        true,
            intent,
            dataDate:       dates.latestDate,
            requestedDate,
            isFallbackDate: dates.requestedDate !== dates.latestDate,
            sqlExecuted,
            rowCount:       rawData.length,
            data:           rawData,
            analysis,
        });

    } catch (error) {
        console.error('[Error]', error.message);
        if (error.status === 429 || error.message?.includes('rate_limit_exceeded')) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit reached. Please wait and retry.',
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = { router, setPool, setConfig };