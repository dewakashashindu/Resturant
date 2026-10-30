import { OperationalColors } from '../../constants/operationalTheme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { apiClient } from '../../services/api';
import { useKdsLayout } from '../../services/kdsLayout';

// ─── Day-end historical KPI report ──────────────────────────────────────────
// This is NOT the live board. It reads one finished (or in-progress) POS
// business day and answers four questions about how the kitchen did:
//   1. how many orders went AMBER,
//   2. how many went RED,
//   3. of the flagged ones, how many were still completed (and how late),
//   4. how many ran through with no warning at all.
// Every number comes from Tbl_KOTBOTHeder for that day only, classified with
// the same thresholds the live board uses (To Do minutes, In Progress %).

const COLORS = {
  background: OperationalColors.canvas,
  navy: OperationalColors.primary,
  text: OperationalColors.primary,
  textMuted: OperationalColors.muted,
  border: OperationalColors.border,
  amber: '#E8A93F',
  red: '#D85A52',
  green: '#2B9662',
  white: OperationalColors.onPrimary,
};

/** One phase (To Do or In Progress) of the day, split by severity. */
type PhaseKpi = {
  amberOrders: number;
  amberPercent: number;
  redOrders: number;
  redPercent: number;
  normalOrders: number;
  normalPercent: number;
};

type ReportKpi = {
  todo: PhaseKpi;
  inProgress: PhaseKpi;
  // Day context, still shown under the four cards.
  escalatedOrders: number;
  escalatedPercent: number;
  completedUnderAlert: number;
  completedUnderAlertPercent: number;
  avgOverdueMinutes: number;
};

type ReportTotals = {
  orders: number;
  lines: number;
  completedOrders: number;
  completedNotDone: number;
};

type WorstOrder = {
  orderNo: string;
  tableNo: string;
  level: 'amber' | 'red';
  todoLevel?: 'normal' | 'amber' | 'red';
  progressLevel?: 'normal' | 'amber' | 'red';
  completed: boolean;
  waitMinutes: number;
  prepMinutes: number;
  overdueMinutes: number;
};

type WaitingConfig = {
  toDoAmberMinutes: number;
  toDoRedMinutes: number;
  inProgressAmberPercent: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** `2026-10-29` -> `29 OCT 2026` (the same shape the board header prints). */
const formatDayKey = (key: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? '').trim());
  if (!match) return '—';
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? ''} ${match[1]}`;
};

/** Date -> `YYYY-MM-DD` in local (device) calendar terms. */
const toDayKey = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const dayKeyToDate = (key: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? '').trim());
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
};

const shiftDay = (key: string, days: number) => {
  const base = dayKeyToDate(key);
  base.setDate(base.getDate() + days);
  return toDayKey(base);
};

const EMPTY_PHASE: PhaseKpi = {
  amberOrders: 0,
  amberPercent: 0,
  redOrders: 0,
  redPercent: 0,
  normalOrders: 0,
  normalPercent: 0,
};

const EMPTY_KPI: ReportKpi = {
  todo: EMPTY_PHASE,
  inProgress: EMPTY_PHASE,
  escalatedOrders: 0,
  escalatedPercent: 0,
  completedUnderAlert: 0,
  completedUnderAlertPercent: 0,
  avgOverdueMinutes: 0,
};

// ─── KPI card ───────────────────────────────────────────────────────────────
type KpiTone = 'amber' | 'red' | 'green' | 'navy';

type KpiCardProps = {
  label: string;
  /** "TO DO" | "IN PROGRESS" — printed under the percentage. */
  phase: string;
  percent: number;
  count: number;
  caption: string;
  tone: KpiTone;
  width: `${number}%`;
  /** Cards without data print an em dash instead of a misleading 0 %. */
  empty: boolean;
  subtle?: boolean;
};

function KpiCard({ label, phase, percent, count, caption, tone, width, empty, subtle }: KpiCardProps) {
  const toneStyle = tone === 'amber'
    ? styles.cardAmber
    : tone === 'red' ? styles.cardRed : tone === 'green' ? styles.cardGreen : styles.cardNavy;
  const textStyle = tone === 'amber'
    ? styles.textAmber
    : tone === 'red' ? styles.textRed : tone === 'green' ? styles.textGreen : styles.textNavy;
  const hot = !subtle && percent >= 50; // half the day was late → stronger tint

  return (
    <View
      style={[styles.card, toneStyle, width, hot && styles.cardHot]}
      accessibilityRole="text"
      accessibilityLabel={`${label} ${phase} ${empty ? 'no data' : `${percent} percent, ${count} orders`}`}
    >
      <Text style={[styles.cardLabel, textStyle]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.cardValue, textStyle, subtle && styles.cardValueSubtle]}>
        {empty ? '—' : `${percent}%`}
      </Text>
      <Text style={[styles.cardPhase, textStyle]} numberOfLines={1}>{phase}</Text>
      <Text style={styles.cardCount}>{empty ? 'no orders' : `${count} order${count === 1 ? '' : 's'}`}</Text>
      <Text style={styles.cardCaption} numberOfLines={2}>{caption}</Text>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function KdsDayReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; date?: string }>();
  const layout = useKdsLayout();

  const type: 'K' | 'B' = String(params.type ?? 'K').toUpperCase().startsWith('B') ? 'B' : 'K';
  const stationName = type === 'K' ? 'Kitchen' : 'Bar';

  const [dayKey, setDayKey] = useState<string>(() => {
    const requested = String(params.date ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : toDayKey(new Date());
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [kpi, setKpi] = useState<ReportKpi>(EMPTY_KPI);
  const [totals, setTotals] = useState<ReportTotals>({ orders: 0, lines: 0, completedOrders: 0, completedNotDone: 0 });
  const [waitingConfig, setWaitingConfig] = useState<WaitingConfig | null>(null);
  const [worstOrders, setWorstOrders] = useState<WorstOrder[]>([]);
  const [serverDate, setServerDate] = useState('');

  // Two cards per row on a portrait phone keeps the type legible; landscape
  // and TV fit all four in one row, which also saves vertical space.
  const cardWidth: `${number}%` = layout.compactChrome ? '24.2%' : '48.6%';

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    const response = await apiClient.getKdsDayReport(type, dayKey);
    const data = response.data as any;

    if (!response.ok || !data?.ok) {
      setErrorMessage(String(data?.message ?? 'Could not load the report for this day.'));
      setKpi(EMPTY_KPI);
      setTotals({ orders: 0, lines: 0, completedOrders: 0, completedNotDone: 0 });
      setWorstOrders([]);
      setIsLoading(false);
      return;
    }

    setKpi({
      todo: { ...EMPTY_PHASE, ...(data.kpi?.todo ?? {}) },
      inProgress: { ...EMPTY_PHASE, ...(data.kpi?.inProgress ?? {}) },
      escalatedOrders: Number(data.kpi?.escalatedOrders ?? 0),
      escalatedPercent: Number(data.kpi?.escalatedPercent ?? 0),
      completedUnderAlert: Number(data.kpi?.completedUnderAlert ?? 0),
      completedUnderAlertPercent: Number(data.kpi?.completedUnderAlertPercent ?? 0),
      avgOverdueMinutes: Number(data.kpi?.avgOverdueMinutes ?? 0),
    });
    setTotals({ orders: 0, lines: 0, completedOrders: 0, completedNotDone: 0, ...(data.totals ?? {}) });
    setWaitingConfig(data.waitingConfig ?? null);
    setWorstOrders(Array.isArray(data.worstOrders) ? data.worstOrders : []);
    setServerDate(String(data.date ?? ''));
    setIsLoading(false);
  }, [type, dayKey]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const onPickDate = (event: DateTimePickerEvent, selected?: Date) => {
    // Android closes the dialog itself; iOS keeps it open until "Done".
    if (Platform.OS !== 'ios') setPickerVisible(false);
    if (event.type === 'dismissed' || !selected) return;
    setDayKey(toDayKey(selected));
  };

  const hasDay = totals.orders > 0;
  const thresholdText = useMemo(() => {
    if (!waitingConfig) return 'Thresholds unavailable';
    return `To Do: amber ≥ ${waitingConfig.toDoAmberMinutes} min · red ≥ ${waitingConfig.toDoRedMinutes} min   ·   `
      + `In Progress: amber ≥ ${waitingConfig.inProgressAmberPercent}% of prep time · red ≥ 100%`;
  }, [waitingConfig]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: layout.headerPaddingTop,
            paddingBottom: layout.headerPaddingBottom,
            paddingLeft: Math.max(layout.paddingLeft, 12),
            paddingRight: Math.max(layout.paddingRight, 12),
            minHeight: layout.compactChrome ? layout.headerMinHeight : 96,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back to the board"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          {!layout.compactChrome ? (
            <Text style={styles.headerEyebrow}>{stationName.toUpperCase()} · DAY END</Text>
          ) : null}
          <Text style={styles.headerTitle} numberOfLines={1}>Day Report</Text>
          <Text style={styles.headerDate} numberOfLines={1}>
            BUSINESS DATE {formatDayKey(serverDate || dayKey)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => void loadReport()}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Reload this day"
        >
          {isLoading
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Ionicons name="refresh" size={20} color={COLORS.white} />}
        </TouchableOpacity>
      </View>

      {/* ── Date filter ── */}
      <View
        style={[
          styles.dateBar,
          { paddingLeft: Math.max(layout.paddingLeft, 10), paddingRight: Math.max(layout.paddingRight, 10) },
        ]}
      >
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => setDayKey((current) => shiftDay(current, -1))}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.navy} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateChip}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Business date ${formatDayKey(dayKey)}, tap to change`}
        >
          <Ionicons name="calendar-outline" size={16} color={COLORS.navy} />
          <Text style={styles.dateChipText}>{formatDayKey(dayKey)}</Text>
          <Ionicons name="chevron-down" size={14} color={COLORS.navy} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => setDayKey((current) => shiftDay(current, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Ionicons name="chevron-forward" size={18} color={COLORS.navy} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.todayButton}
          onPress={() => setDayKey(toDayKey(new Date()))}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
        >
          <Text style={styles.todayButtonText}>TODAY</Text>
        </TouchableOpacity>
      </View>

      {pickerVisible ? (
        <DateTimePicker
          value={dayKeyToDate(dayKey)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={onPickDate}
        />
      ) : null}

      {/* ── Body ── */}
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingHorizontal: Math.max(layout.paddingLeft, 10), paddingRight: Math.max(layout.paddingRight, 10) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.red} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* KPI row — amber and red, split by phase (To Do / In Progress) */}
        <View style={styles.cardGrid}>
          <KpiCard
            label="AMBER"
            phase="TO DO"
            percent={kpi.todo.amberPercent}
            count={kpi.todo.amberOrders}
            caption="Waited too long for a start"
            tone="amber"
            width={cardWidth}
            empty={!hasDay}
          />
          <KpiCard
            label="AMBER"
            phase="IN PROGRESS"
            percent={kpi.inProgress.amberPercent}
            count={kpi.inProgress.amberOrders}
            caption={`Ran past ${waitingConfig?.inProgressAmberPercent ?? 80}% of prep time`}
            tone="amber"
            width={cardWidth}
            empty={!hasDay}
          />
          <KpiCard
            label="RED"
            phase="TO DO"
            percent={kpi.todo.redPercent}
            count={kpi.todo.redOrders}
            caption="Critically late to start"
            tone="red"
            width={cardWidth}
            empty={!hasDay}
          />
          <KpiCard
            label="RED"
            phase="IN PROGRESS"
            percent={kpi.inProgress.redPercent}
            count={kpi.inProgress.redOrders}
            caption="Ran past 100% of prep time"
            tone="red"
            width={cardWidth}
            empty={!hasDay}
          />
        </View>

        {/* Day totals */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totals.orders}</Text>
            <Text style={styles.summaryLabel}>ORDERS</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totals.lines}</Text>
            <Text style={styles.summaryLabel}>ITEM LINES</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totals.completedOrders}</Text>
            <Text style={styles.summaryLabel}>COMPLETED</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totals.completedNotDone}</Text>
            <Text style={styles.summaryLabel}>NOT FINISHED</Text>
          </View>
        </View>

        {/* Slowest flagged orders */}
        <Text style={styles.sectionLabel}>MOST DELAYED ORDERS</Text>
        {worstOrders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.green} />
            <Text style={styles.emptyText}>
              {hasDay ? 'No order went amber or red on this day.' : 'No orders recorded for this day.'}
            </Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text style={[styles.th, styles.colOrder]}>ORDER</Text>
              <Text style={[styles.th, styles.colTable]}>TABLE</Text>
              <Text style={[styles.th, styles.colLevel]}>LEVEL</Text>
              <Text style={[styles.th, styles.colNum]}>WAIT</Text>
              <Text style={[styles.th, styles.colNum]}>PREP</Text>
              <Text style={[styles.th, styles.colNum]}>OVER</Text>
            </View>
            {worstOrders.map((order, index) => (
              <View
                key={`${order.orderNo}-${order.tableNo}-${index}`}
                style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
              >
                <Text style={[styles.td, styles.colOrder, styles.tdStrong]}>#{order.orderNo}</Text>
                <Text style={[styles.td, styles.colTable]} numberOfLines={1}>{order.tableNo || '—'}</Text>
                <Text
                  style={[
                    styles.td, styles.colLevel, styles.levelChip,
                    order.level === 'red' ? styles.levelRed : styles.levelAmber,
                  ]}
                  numberOfLines={1}
                >
                  {order.level.toUpperCase()}
                </Text>
                <Text style={[styles.td, styles.colNum]}>{order.waitMinutes}m</Text>
                <Text style={[styles.td, styles.colNum]}>{order.prepMinutes}m</Text>
                <Text style={[styles.td, styles.colNum, styles.tdStrong]}>+{order.overdueMinutes}m</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footnote}>{thresholdText}</Text>
        <Text style={styles.footnote}>
          Source: Tbl_KOTBOTHeder for {formatDayKey(serverDate || dayKey)} · order level uses the worst line of the order.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.navy },
  headerCopy: { flex: 1, minWidth: 0 },
  headerEyebrow: { color: OperationalColors.border, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '900', marginTop: 2 },
  headerDate: { color: OperationalColors.accentSoft, fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 3 },
  headerButton: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(248,247,245,0.13)', borderWidth: 1, borderColor: 'rgba(248,247,245,0.16)',
  },

  dateBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dateArrow: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: OperationalColors.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  dateChip: {
    flex: 1, minWidth: 0, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: OperationalColors.surfaceAlt,
  },
  dateChipText: { color: COLORS.navy, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  todayButton: {
    height: 32, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.navy,
  },
  todayButtonText: { color: COLORS.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  body: { paddingTop: 8, paddingBottom: 24, gap: 8 },

  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { paddingVertical: 9, paddingHorizontal: 9, borderRadius: 12, borderWidth: 1, gap: 1 },
  cardHot: { borderWidth: 2 },
  cardAmber: { backgroundColor: '#FFF8E7', borderColor: COLORS.amber },
  cardRed: { backgroundColor: '#FFF2F1', borderColor: COLORS.red },
  cardGreen: { backgroundColor: '#EDF8F1', borderColor: COLORS.green },
  cardNavy: { backgroundColor: OperationalColors.surfaceAlt, borderColor: COLORS.navy },
  cardLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 },
  cardValue: { fontSize: 24, fontWeight: '900', lineHeight: 27 },
  cardValueSubtle: { fontSize: 20, lineHeight: 24 },
  cardPhase: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5, marginBottom: 1 },
  cardCount: { fontSize: 9, fontWeight: '800', color: COLORS.text },
  cardCaption: { fontSize: 7.5, color: COLORS.textMuted, lineHeight: 10, marginTop: 1 },
  textAmber: { color: '#B87A16' },
  textRed: { color: COLORS.red },
  textGreen: { color: COLORS.green },
  textNavy: { color: COLORS.navy },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderRadius: 12,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 1 },
  summaryDivider: { width: 1, height: 26, backgroundColor: COLORS.border },
  summaryValue: { fontSize: 16, fontWeight: '900', color: COLORS.navy },
  summaryLabel: { fontSize: 7, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 0.5 },

  sectionLabel: {
    fontSize: 9, fontWeight: '900', letterSpacing: 0.7, color: COLORS.textMuted,
    textTransform: 'uppercase', marginTop: 4, marginLeft: 2,
  },
  table: {
    borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#F2ECE1' },
  tableHead: { backgroundColor: OperationalColors.surfaceAlt, borderTopWidth: 0 },
  tableRowAlt: { backgroundColor: '#FDFBF7' },
  th: { fontSize: 7.5, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 0.4 },
  td: { fontSize: 10, color: COLORS.text },
  tdStrong: { fontWeight: '900', color: COLORS.navy },
  colOrder: { flex: 1.1, minWidth: 0 },
  colTable: { flex: 1, minWidth: 0 },
  colLevel: { flex: 1, textAlign: 'center' },
  colNum: { flex: 0.9, textAlign: 'right' },
  levelChip: { fontSize: 8, fontWeight: '900', borderRadius: 6, paddingVertical: 1, overflow: 'hidden' },
  levelAmber: { color: '#B87A16', backgroundColor: '#FFF1D6' },
  levelRed: { color: COLORS.red, backgroundColor: '#FFE3E1' },

  emptyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12, borderRadius: 12,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  emptyText: { flex: 1, fontSize: 10, color: COLORS.textMuted },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 10,
    backgroundColor: '#FFF2F1', borderWidth: 1, borderColor: COLORS.red,
  },
  errorText: { flex: 1, fontSize: 10, color: COLORS.red, fontWeight: '700' },

  footnote: { fontSize: 8, color: COLORS.textMuted, lineHeight: 12, marginTop: 2, marginLeft: 2 },
});
