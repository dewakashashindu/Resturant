// Standalone test of the /api/kds/dashboard aggregation logic.
// Mirrors the exact code path from backend/server.js (mssql rows → payload).
'use strict';

const normalizeKdsProStatus = (value) => {
  const status = String(value ?? '').trim().toUpperCase();
  return status === 'P' || status === 'D' ? status : 'S';
};

function aggregate(rows) {
  const orderKeyOf = (row) => `${String(row.OrderNo ?? '').trim()}|${String(row.TableNo ?? '').trim()}|${String(row.InvoiceNo ?? '').trim()}`;

  // Real OrderMode values in production data: TAKEAWAY, DIMING (legacy
  // spelling of DINING), PICK UP and DELEVERY (legacy spelling of DELIVERY).
  const modeCategoryOf = (rawMode, tableNo) => {
    const value = String(rawMode ?? '').replace(/[\s-]+/g, '').toUpperCase();
    const table = String(tableNo ?? '').trim().toUpperCase();
    if (value.includes('TAKE') || value === 'TA' || value === 'T' || table.startsWith('TA-')) return 'takeaway';
    if (value.includes('PICK') || value === 'PU' || value === 'PK' || table.startsWith('PU-')) return 'pickup';
    if (value.includes('DEL') || value === 'DL' || value === 'DLY' || table.startsWith('DL-')) return 'delivery';
    if (value.includes('DIN') || value.includes('DIM') || value === 'DI' || value === 'D' || value === 'DN' || /^T\d/.test(table)) return 'dineIn';
    return 'other';
  };

  const toMillis = (value) => {
    if (value == null) return null;
    const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  };

  const orders = new Map();
  const itemTotals = new Map();
  const rawModeCounts = new Map();
  let itemPrepMinutesTotal = 0;
  let itemPrepSamples = 0;

  for (const row of rows) {
    const orderNo = String(row.OrderNo ?? '').trim();
    const itemCode = String(row.ItemCode ?? '').trim();
    if (!orderNo || !itemCode) continue;

    const key = orderKeyOf(row);
    let order = orders.get(key);
    if (!order) {
      order = {
        mode: modeCategoryOf(row.OrderMode, row.TableNo),
        rawMode: String(row.OrderMode ?? '').trim() || '(blank)',
        placedTime: null,
        doneTime: null,
        pendingCount: 0,
        inProgressCount: 0,
        doneCount: 0,
      };
      orders.set(key, order);
      if (order.mode === 'other') {
        rawModeCounts.set(order.rawMode, (rawModeCounts.get(order.rawMode) ?? 0) + 1);
      }
    }

    const status = normalizeKdsProStatus(row.ProStatus);
    if (status === 'S') order.pendingCount += 1;
    else if (status === 'P') order.inProgressCount += 1;
    else order.doneCount += 1;

    const placedMs = toMillis(row.PlacedTime) ?? toMillis(row.KBDate);
    const doneMs = toMillis(row.ProDone);
    if (placedMs != null && (order.placedTime == null || placedMs < order.placedTime)) order.placedTime = placedMs;
    if (doneMs != null && (order.doneTime == null || doneMs > order.doneTime)) order.doneTime = doneMs;

    if (status === 'D' && placedMs != null && doneMs != null) {
      const minutes = (doneMs - placedMs) / 60000;
      if (minutes >= 0 && minutes <= 24 * 60) {
        itemPrepMinutesTotal += minutes;
        itemPrepSamples += 1;
      }
    }

    const quantity = Number(row.ItmQty ?? 0) || 0;
    let item = itemTotals.get(itemCode);
    if (!item) {
      item = { itemCode, itemName: String(row.ItemName ?? itemCode).trim() || itemCode, quantity: 0, orderKeys: new Set() };
      itemTotals.set(itemCode, item);
    }
    item.quantity += quantity;
    item.orderKeys.add(key);
  }

  const statusCounts = { pending: 0, inProgress: 0, done: 0 };
  const modeCounts = { dineIn: 0, takeaway: 0, pickup: 0, delivery: 0, other: 0 };
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  let prepMinutesTotal = 0;
  let prepMinutesSamples = 0;

  for (const order of orders.values()) {
    if (order.doneCount > 0 && order.pendingCount === 0 && order.inProgressCount === 0) statusCounts.done += 1;
    else if (order.pendingCount > 0 && order.inProgressCount === 0 && order.doneCount === 0) statusCounts.pending += 1;
    else statusCounts.inProgress += 1;

    if (order.mode === 'dineIn') modeCounts.dineIn += 1;
    else if (order.mode === 'takeaway') modeCounts.takeaway += 1;
    else if (order.mode === 'pickup') modeCounts.pickup += 1;
    else if (order.mode === 'delivery') modeCounts.delivery += 1;
    else modeCounts.other += 1;

    if (order.placedTime != null) {
      const hour = new Date(order.placedTime).getHours();
      if (hour >= 0 && hour < 24) hourly[hour].count += 1;
    }

    if (order.doneCount > 0 && order.pendingCount === 0 && order.inProgressCount === 0
      && order.placedTime != null && order.doneTime != null) {
      const minutes = (order.doneTime - order.placedTime) / 60000;
      if (minutes >= 0 && minutes <= 24 * 60) {
        prepMinutesTotal += minutes;
        prepMinutesSamples += 1;
      }
    }
  }

  const topItems = [...itemTotals.values()]
    .sort((left, right) => right.quantity - left.quantity || left.itemName.localeCompare(right.itemName))
    .slice(0, 8)
    .map((item) => ({ itemCode: item.itemCode, itemName: item.itemName, quantity: Math.round(item.quantity * 100) / 100, orderCount: item.orderKeys.size }));

  const totalItems = [...itemTotals.values()].reduce((sum, item) => sum + item.quantity, 0);
  const round1 = (value) => Math.round(value * 10) / 10;

  return {
    totals: { orders: orders.size, items: Math.round(totalItems * 100) / 100, lines: rows.length },
    statusCounts,
    modeCounts,
    otherModes: [...rawModeCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 10)
      .map(([mode, count]) => ({ mode, count })),
    averagePrepMinutes: prepMinutesSamples > 0 ? round1(prepMinutesTotal / prepMinutesSamples) : null,
    averagePrepOrderCount: prepMinutesSamples,
    averageItemPrepMinutes: itemPrepSamples > 0 ? round1(itemPrepMinutesTotal / itemPrepSamples) : null,
    topItems,
    hourlyOrders: hourly,
  };
}

// ─── Mirrors of the strategy-3 JS filter and the dedupe step ─────────────────
function filterQueueRows(rows, fromDate, toDate) {
  const toMs = (value) => {
    if (value == null) return null;
    const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  };
  const localDateKey = (value) => {
    const ms = toMs(value);
    if (ms == null) return null;
    const date = new Date(ms);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  return rows.filter((row) => {
    const placedKey = localDateKey(row.PlacedTime);
    if (placedKey && placedKey >= fromDate && placedKey <= toDate) return true;
    const kbKey = localDateKey(row.KBDate);
    if (kbKey && kbKey >= fromDate && kbKey <= toDate) return true;
    return normalizeKdsProStatus(row.ProStatus) !== 'D';
  });
}

function dedupeRows(rows) {
  const orderKeyOf = (row) => `${String(row.OrderNo ?? '').trim()}|${String(row.TableNo ?? '').trim()}|${String(row.InvoiceNo ?? '').trim()}`;
  const seenLines = new Set();
  return rows.filter((row) => {
    const orderNo = String(row.OrderNo ?? '').trim();
    const itemCode = String(row.ItemCode ?? '').trim();
    if (!orderNo || !itemCode) return false;
    const lineKey = `${orderKeyOf(row)}|${itemCode}|${String(row.KOTBOTType ?? '').trim()}`;
    if (seenLines.has(lineKey)) return false;
    seenLines.add(lineKey);
    return true;
  });
}

// ─── Test data: production-realistic values (legacy spellings included) ───────
const T = (h, m) => new Date(`2026-10-20T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);

const rows = [
  // Order 1 (DIMING — legacy spelling of DINING, table T5): done, 11:00→11:14 = 14 min.
  { OrderNo: 'ORD001', OrderMode: 'DIMING', TableNo: 'T5', InvoiceNo: 'INV1', ItemCode: 'F001', ItemName: 'Fried Rice', ItmQty: 2, ProStatus: 'D', PlacedTime: T(11, 0), ProStarted: T(11, 2), ProDone: T(11, 14) },
  { OrderNo: 'ORD001', OrderMode: 'DIMING', TableNo: 'T5', InvoiceNo: 'INV1', ItemCode: 'F002', ItemName: 'Noodles', ItmQty: 1, ProStatus: 'D', PlacedTime: T(11, 0), ProStarted: T(11, 2), ProDone: T(11, 10) },
  // Order 2 (TAKEAWAY, TA-41): done, 12:05→12:11 = 6 min.
  { OrderNo: 'ORD002', OrderMode: 'TAKEAWAY', TableNo: 'TA-41', InvoiceNo: 'INV2', ItemCode: 'F001', ItemName: 'Fried Rice', ItmQty: 1, ProStatus: 'D', PlacedTime: T(12, 5), ProStarted: T(12, 6), ProDone: T(12, 11) },
  // Order 3 (DINING, T2): one item P, one S → in-progress order.
  { OrderNo: 'ORD003', OrderMode: 'DINING', TableNo: 'T2', InvoiceNo: 'INV3', ItemCode: 'F003', ItemName: 'Deviled Chicken', ItmQty: 3, ProStatus: 'P', PlacedTime: T(13, 30), ProStarted: T(13, 31), ProDone: null },
  { OrderNo: 'ORD003', OrderMode: 'DINING', TableNo: 'T2', InvoiceNo: 'INV3', ItemCode: 'F004', ItemName: 'Salad', ItmQty: 1, ProStatus: 'S', PlacedTime: T(13, 30), ProStarted: null, ProDone: null },
  // Order 4 (TAKE AWAY with a space, TA-42): all pending.
  { OrderNo: 'ORD004', OrderMode: 'TAKE AWAY', TableNo: 'TA-42', InvoiceNo: 'INV4', ItemCode: 'F002', ItemName: 'Noodles', ItmQty: 4, ProStatus: 'S', PlacedTime: T(13, 50), ProStarted: null, ProDone: null },
  // Order 5 (PICK UP, PU-1): done, 19:00→19:25 = 25 min. PlacedTime NULL —
  // arrival must fall back to the KBDate timestamp.
  { OrderNo: 'ORD005', OrderMode: 'PICK UP', TableNo: 'PU-1', InvoiceNo: 'INV5', ItemCode: 'F003', ItemName: 'Deviled Chicken', ItmQty: 2, ProStatus: 'D', PlacedTime: null, KBDate: T(19, 0), ProStarted: T(19, 1), ProDone: T(19, 25) },
  // Order 6 (unrecognised mode) → other + listed in otherModes; 19:05→19:15 = 10 min.
  { OrderNo: 'ORD006', OrderMode: '???', TableNo: 'X9', InvoiceNo: 'INV6', ItemCode: 'F005', ItemName: 'Soup', ItmQty: 1, ProStatus: 'D', PlacedTime: T(19, 5), ProStarted: T(19, 6), ProDone: T(19, 15) },
  // Order 7 (DELEVERY — legacy spelling of DELIVERY, DL-1): done, 19:10→19:40 = 30 min.
  { OrderNo: 'ORD007', OrderMode: 'DELEVERY', TableNo: 'DL-1', InvoiceNo: 'INV7', ItemCode: 'F001', ItemName: 'Fried Rice', ItmQty: 5, ProStatus: 'D', PlacedTime: T(19, 10), ProStarted: T(19, 11), ProDone: T(19, 40) },
  // Garbage rows that must be skipped.
  { OrderNo: '', OrderMode: 'DIMING', TableNo: 'T1', InvoiceNo: 'INVX', ItemCode: 'F001', ItemName: 'Fried Rice', ItmQty: 9, ProStatus: 'D', PlacedTime: T(10, 0), ProStarted: T(10, 1), ProDone: T(10, 5) },
];

const result = aggregate(rows);

// ─── Assertions ───────────────────────────────────────────────────────────────
const assert = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? '✅' : '❌'} ${label}${pass ? '' : `\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`}`);
  if (!pass) process.exitCode = 1;
};

assert('statusCounts', result.statusCounts, { pending: 1, inProgress: 1, done: 5 });
// DIMING + DINING → dineIn; TAKEAWAY + TAKE AWAY → takeaway; PICK UP → pickup; DELEVERY → delivery.
assert('modeCounts (legacy spellings + pickup/delivery split)', result.modeCounts, { dineIn: 2, takeaway: 2, pickup: 1, delivery: 1, other: 1 });
assert('otherModes lists only unmatched values', result.otherModes, [{ mode: '???', count: 1 }]);
assert('totals', result.totals, { orders: 7, items: 20, lines: 10 });
// Order-level prep: 14 + 6 + 25 (KBDate fallback) + 10 + 30 = 85 → avg 17.
assert('averagePrepMinutes (with KBDate fallback)', result.averagePrepMinutes, 17);
assert('averagePrepOrderCount', result.averagePrepOrderCount, 5);
// Item-level prep: 14 + 10 + 6 + 25 + 10 + 30 = 95 → avg 15.8.
assert('averageItemPrepMinutes', result.averageItemPrepMinutes, 15.8);
assert('top item (Fried Rice, qty 8, 3 orders)', result.topItems[0], { itemCode: 'F001', itemName: 'Fried Rice', quantity: 8, orderCount: 3 });
assert('hourly 11:00', result.hourlyOrders[11], { hour: 11, count: 1 });
assert('hourly 12:00', result.hourlyOrders[12], { hour: 12, count: 1 });
assert('hourly 13:00', result.hourlyOrders[13], { hour: 13, count: 2 });
// ORD005 has PlacedTime NULL — its 19:00 KBDate must feed the 7 PM bucket.
assert('hourly 19:00 (peak, KBDate fallback)', result.hourlyOrders[19], { hour: 19, count: 3 });
assert('hourly 09:00 empty', result.hourlyOrders[9], { hour: 9, count: 0 });

// Empty-day edge case
const empty = aggregate([]);
assert('empty day statusCounts', empty.statusCounts, { pending: 0, inProgress: 0, done: 0 });
assert('empty day avg prep', empty.averagePrepMinutes, null);
assert('empty day totals', empty.totals, { orders: 0, items: 0, lines: 0 });

// ─── Strategy-3 queue filter: keeps rows inside the window + active lines ────
const queueRows = [
  // Placed today, done → keep.
  { OrderNo: 'A1', TableNo: 'T1', InvoiceNo: 'I1', ItemCode: 'F1', ProStatus: 'D', PlacedTime: new Date('2026-10-20T11:00:00'), KBDate: null },
  // Placed 7 days ago, still pending → keep (still active in the queue).
  { OrderNo: 'A2', TableNo: 'T2', InvoiceNo: 'I2', ItemCode: 'F1', ProStatus: 'S', PlacedTime: new Date('2026-10-13T05:00:00'), KBDate: null },
  // Placed 7 days ago and done → drop.
  { OrderNo: 'A3', TableNo: 'T3', InvoiceNo: 'I3', ItemCode: 'F2', ProStatus: 'D', PlacedTime: new Date('2026-10-13T05:00:00'), KBDate: null },
  // No timestamps, in progress → keep.
  { OrderNo: 'A4', TableNo: 'T4', InvoiceNo: 'I4', ItemCode: 'F3', ProStatus: 'P', PlacedTime: null, KBDate: null },
  // No timestamps, done → drop.
  { OrderNo: 'A5', TableNo: 'T5', InvoiceNo: 'I5', ItemCode: 'F4', ProStatus: 'D', PlacedTime: null, KBDate: null },
  // KBDate says 2026-09-05 (POS clock drift) and the window is 2026-09-05 → keep.
  { OrderNo: 'A6', TableNo: 'TA-61', InvoiceNo: 'I6', ItemCode: 'F5', ProStatus: 'D', PlacedTime: null, KBDate: new Date('2026-09-05T10:36:00') },
];
const filtered = filterQueueRows(queueRows, '2026-09-05', '2026-09-05');
assert('queue filter (window 2026-09-05)', filtered.map((r) => r.OrderNo), ['A2', 'A4', 'A6']);

// ─── Dedupe: the view can repeat a source line ────────────────────────────────
const dupes = [
  { OrderNo: 'B1', TableNo: 'T1', InvoiceNo: 'I1', ItemCode: 'F1', KOTBOTType: 'KOT', ItmQty: 2 },
  { OrderNo: 'B1', TableNo: 'T1', InvoiceNo: 'I1', ItemCode: 'F1', KOTBOTType: 'KOT', ItmQty: 2 }, // exact dup
  { OrderNo: 'B1', TableNo: 'T1', InvoiceNo: 'I1', ItemCode: 'F2', KOTBOTType: 'KOT', ItmQty: 1 }, // same order, other item
  { OrderNo: '', TableNo: 'T9', InvoiceNo: 'I9', ItemCode: 'F9', KOTBOTType: 'KOT', ItmQty: 5 }, // garbage
];
const deduped = dedupeRows(dupes);
assert('dedupe removes repeats + garbage', deduped.map((r) => r.ItemCode), ['F1', 'F2']);

console.log('\nDone.');
