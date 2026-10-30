import { OperationalColors } from '../../constants/operationalTheme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';

import { apiClient } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type KdsDashboardStatusCounts = { pending: number; inProgress: number; done: number };
type KdsDashboardModeCounts = { dineIn: number; takeaway: number; pickup: number; delivery: number; other: number };
type KdsDashboardTopItem = { itemCode: string; itemName: string; quantity: number; orderCount: number };

type DateRange = { from: string; to: string; all: boolean };

/**
 * What HAPPENED during the selected day — not what is sitting on the board now.
 * `completed` = orders that are fully done and stayed at this level all day;
 * `open` = the same level but with at least one line still unfinished.
 */
type KdsAlertBucket = { completed: number; open: number; total: number; percent: number };

type KdsAlertHistory = {
  totalOrders: number;
  completedOrders: number;
  openOrders: number;
  thresholds?: { toDoAmberMinutes: number; toDoRedMinutes: number; inProgressAmberPercent: number };
  todo?: { amber?: KdsAlertBucket; red?: KdsAlertBucket };
  inProgress?: { amber?: KdsAlertBucket; red?: KdsAlertBucket };
};


type KdsDashboardPayload = {
  ok?: boolean;
  stationType?: string;
  source?: string;
  from?: string | null;
  to?: string | null;
  includeAll?: boolean;
  date?: string;
  generatedAt?: string;
  totals?: { orders?: number; items?: number; lines?: number };
  statusCounts?: KdsDashboardStatusCounts;
  alertHistory?: KdsAlertHistory;
  modeCounts?: KdsDashboardModeCounts;
  otherModes?: { mode: string; count: number }[];
  averagePrepMinutes?: number | null;
  averagePrepOrderCount?: number;
  averageItemPrepMinutes?: number | null;
  topItems?: KdsDashboardTopItem[];
  hourlyOrders?: { hour: number; count: number }[];
  availableDates?: { date: string; lines: number }[];
  message?: string;
};

const COLORS = {
  navy: OperationalColors.primary,
  canvas: OperationalColors.canvas,
  surface: OperationalColors.surface,
  surfaceAlt: OperationalColors.surfaceAlt,
  white: OperationalColors.onPrimary,
  text: OperationalColors.text,
  heading: OperationalColors.primary,
  muted: OperationalColors.muted,
  border: OperationalColors.border,
  todo: '#E9963C',
  todoSoft: '#FBF0E1',
  done: '#2B9662',
  doneSoft: '#E8F3EC',
  inProSoft: '#EFEBE4',
  dineIn: '#4E7A6B',
  dineInSoft: '#E7EFEA',
  takeaway: '#A8763E',
  takeawaySoft: '#F5ECE0',
  pickup: '#7A6477',
  pickupSoft: '#EFE9EF',
  delivery: '#9E5E4E',
  deliverySoft: '#F7EAE7',
  other: '#B4A591',
  accent: OperationalColors.accent,
  amber: '#E8A93F',
  amberText: '#B87A16',
  amberSoft: '#FFF6E3',
  red: '#D85A52',
  redSoft: '#FFF2F1',
};

const AUTO_REFRESH_SECONDS = 30;
const AUTO_REFRESH_MS = AUTO_REFRESH_SECONDS * 1000;

const STATUS_CARDS: { key: keyof KdsDashboardStatusCounts; label: string; caption: string; icon: keyof typeof Ionicons.glyphMap; color: string; soft: string }[] = [
  { key: 'pending', label: 'PENDING', caption: 'Not started', icon: 'time-outline', color: COLORS.todo, soft: COLORS.todoSoft },
  { key: 'inProgress', label: 'IN PROGRESS', caption: 'Preparing now', icon: 'flame-outline', color: COLORS.navy, soft: COLORS.inProSoft },
  { key: 'done', label: 'DONE', caption: 'Completed', icon: 'checkmark-circle-outline', color: COLORS.done, soft: COLORS.doneSoft },
];

const MODE_CARDS: { key: keyof Omit<KdsDashboardModeCounts, 'other'>; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; soft: string }[] = [
  { key: 'dineIn', label: 'DINE-IN', icon: 'restaurant-outline', color: COLORS.dineIn, soft: COLORS.dineInSoft },
  { key: 'takeaway', label: 'TAKEAWAY', icon: 'bag-handle-outline', color: COLORS.takeaway, soft: COLORS.takeawaySoft },
  { key: 'pickup', label: 'PICK UP', icon: 'storefront-outline', color: COLORS.pickup, soft: COLORS.pickupSoft },
  { key: 'delivery', label: 'DELIVERY', icon: 'bicycle-outline', color: COLORS.delivery, soft: COLORS.deliverySoft },
];

const MODE_LEGEND: { key: keyof KdsDashboardModeCounts; label: string; color: string }[] = [
  { key: 'dineIn', label: 'Dine-In', color: COLORS.dineIn },
  { key: 'takeaway', label: 'Takeaway', color: COLORS.takeaway },
  { key: 'pickup', label: 'Pick Up', color: COLORS.pickup },
  { key: 'delivery', label: 'Delivery', color: COLORS.delivery },
  { key: 'other', label: 'Other', color: COLORS.other },
];

// ─── Date helpers (device-local calendar days, 'YYYY-MM-DD') ──────────────────
const pad2 = (value: number) => String(value).padStart(2, '0');
const toKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const fromKey = (key: string) => new Date(`${key}T00:00:00`);
const todayKey = () => toKey(new Date());
const addDays = (key: string, days: number) => toKey(new Date(fromKey(key).getTime() + days * 86_400_000));

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentYear = () => new Date().getFullYear();

const formatShortDate = (key: string) => {
  const date = fromKey(key);
  if (!Number.isFinite(date.getTime())) return key;
  const yearSuffix = date.getFullYear() === currentYear() ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${yearSuffix}`;
};

const describeRange = (range: DateRange) => {
  if (range.all) return 'All days';
  const today = todayKey();
  if (range.from === today && range.to === today) return 'Today';
  const yesterday = addDays(today, -1);
  if (range.from === yesterday && range.to === yesterday) return 'Yesterday';
  if (range.from === range.to) return formatShortDate(range.from);
  return `${formatShortDate(range.from)} – ${formatShortDate(range.to)}`;
};

const hourLabel = (hour: number) => {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
};

const hourLabelLong = (hour: number) => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
};

const formatCount = (value: number) => (Number.isFinite(value) ? String(Math.round(value)) : '0');

const formatQty = (value: number) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100));

const formatMinutes = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const minutes = Number(value);
  if (minutes < 1) return '< 1 min';
  return `${Math.round(minutes * 10) / 10} min`;
};

const formatClockTime = (iso: string | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ─── Shared card blocks (module level so refreshes never remount the charts) ──
// A tablet draws the same card on a much wider canvas — the fixed phone font
// sizes then look tiny from a metre away. Every text size on this screen is
// multiplied by this factor instead (1 on a phone, up to 1.7 on a tablet).
const TextScaleContext = React.createContext(1);
const useTextScale = () => React.useContext(TextScaleContext);
function SectionCard({ title, hint, accessory, children }: {
  title: string;
  hint?: string;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  const f = useTextScale();
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={[styles.sectionTitle, { fontSize: 12 * f }]}>{title}</Text>
          {hint ? <Text style={[styles.sectionHint, { fontSize: 9 * f }]}>{hint}</Text> : null}
        </View>
        {accessory}
      </View>
      {children}
    </View>
  );
}

function StatCard({ value, label, caption, icon, color, soft }: {
  value: string;
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  soft: string;
}) {
  const f = useTextScale();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  return (
    <View style={[styles.statCard, { backgroundColor: soft, paddingVertical: 11 * f }]} accessibilityLabel={`${label}: ${value}`}>
      <View
        style={[
          styles.statIconChip,
          { backgroundColor: color, width: 27 * f, height: 27 * f, borderRadius: 9 * f },
        ]}
      >
        <Ionicons name={icon} size={isTablet ? 17 * f : 14} color={COLORS.white} />
      </View>
      <Text style={[styles.statValue, { color, fontSize: 26 * f, lineHeight: 30 * f }]} allowFontScaling={false}>{value}</Text>
      <Text style={[styles.statLabel, { fontSize: 8.5 * f }]}>{label}</Text>
      <Text style={[styles.statCaption, { fontSize: 8 * f }]}>{caption}</Text>
    </View>
  );
}

/**
 * One amber/red KPI. The PERCENTAGE is the headline (share of that day's
 * orders), with the raw count and the still-open split underneath.
 */
function SeverityCard({ label, phase, tone, bucket, totalOrders }: {
  label: string;
  phase: string;
  tone: 'amber' | 'red';
  bucket: KdsAlertBucket;
  totalOrders: number;
}) {
  const f = useTextScale();
  const { width, height } = useWindowDimensions();
  // Tablet: all four cards on one row. Phone (any orientation): 2 × 2.
  const isWide = Math.min(width, height) >= 600;
  const color = tone === 'amber' ? COLORS.amberText : COLORS.red;
  const soft = tone === 'amber' ? COLORS.amberSoft : COLORS.redSoft;
  const border = tone === 'amber' ? COLORS.amber : COLORS.red;
  const empty = bucket.total === 0;
  return (
    <View
      style={[
        styles.severityCard,
        {
          backgroundColor: soft,
          borderColor: empty ? COLORS.border : border,
          flexBasis: isWide ? 0 : '47%',
          paddingVertical: 10 * f,
          paddingHorizontal: 10 * f,
          gap: 2 * f,
        },
      ]}
      accessibilityLabel={`${label} ${phase}: ${bucket.percent} percent, ${bucket.total} orders, ${bucket.open} still open`}
    >
      <View style={styles.severityTopRow}>
        <Text style={[styles.severityLabel, { color, fontSize: 8 * f }]} numberOfLines={1}>{label}</Text>
        <View style={[styles.severityDot, { backgroundColor: color, width: 7 * f, height: 7 * f }]} />
      </View>
      <Text style={[styles.severityValue, { color, fontSize: 26 * f, lineHeight: 30 * f }]} allowFontScaling={false}>
        {empty ? '—' : `${bucket.percent}%`}
      </Text>
      <Text style={[styles.severityPhase, { fontSize: 8.5 * f }]} numberOfLines={1}>{phase}</Text>
      <Text style={[styles.severityCount, { color, fontSize: 8.5 * f }]} numberOfLines={1}>
        {empty
          ? 'no orders'
          : `${formatCount(bucket.total)} of ${formatCount(totalOrders)} orders`}
      </Text>
      <Text style={[styles.severitySplit, { fontSize: 8 * f }]} numberOfLines={1}>
        {empty ? '' : `${formatCount(bucket.open)} still open`}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function KdsDashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const stationType = String(params.type ?? 'K').trim().toUpperCase().startsWith('B') ? 'B' : 'K';
  const isKitchen = stationType === 'K';
  const stationName = isKitchen ? 'Kitchen' : 'Bar';
  const displayName = isKitchen ? 'KDS' : 'BDS';

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isTablet = width >= 600;   // unchanged: drives icon / bar sizing only
  const contentWidth = Math.min(width - 24, 900);

  // Readable from a distance on a tablet without touching the phone layout.
  // Keyed on the SHORTER side, so a phone in landscape keeps phone-sized text
  // (it is only 360-430 dp tall) while a real tablet scales up, capped at 1.7.
  const uiScale = useMemo(
    () => Math.min(1.7, Math.max(1, Math.round((shortSide / 460) * 100) / 100)),
    [shortSide],
  );
  const f = uiScale;

  const isFocused = useIsFocused();
  const requestSequence = useRef(0);
  const hasLoadedRef = useRef(false);
  const [range, setRange] = useState<DateRange>({ from: todayKey(), to: todayKey(), all: false });
  const [data, setData] = useState<KdsDashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | undefined>(undefined);

  // Custom date-range picker (From first, then To).
  const [pickerStage, setPickerStage] = useState<'closed' | 'from' | 'to'>('closed');
  const [pickerValue, setPickerValue] = useState<Date>(new Date());
  const draftFromRef = useRef<string>(todayKey());

  const rangeLabel = describeRange(range);

  const applyRange = useCallback((from: string, to: string, all = false) => {
    let safeFrom = from;
    let safeTo = to;
    if (!all) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(safeFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(safeTo)) return;
      if (safeFrom > safeTo) {
        const swap = safeFrom;
        safeFrom = safeTo;
        safeTo = swap;
      }
    }
    setData(null);
    setIsLoading(true);
    setError(null);
    setRange({ from: all ? '' : safeFrom, to: all ? '' : safeTo, all });
  }, []);

  const loadDashboard = useCallback(async (mode: 'auto' | 'manual') => {
    const sequence = ++requestSequence.current;
    if (mode === 'manual') setIsRefreshing(true);

    try {
      const response = await apiClient.getKdsDashboard(
        stationType,
        range.all ? { all: true } : { from: range.from, to: range.to },
      );
      if (sequence !== requestSequence.current) return;
      if (response.ok && response.data && response.data.ok !== false) {
        setData(response.data as KdsDashboardPayload);
        setLastUpdatedAt((response.data as KdsDashboardPayload).generatedAt ?? new Date().toISOString());
        setError(null);
        hasLoadedRef.current = true;
      } else {
        if (!hasLoadedRef.current) setIsLoading(false);
        setError(String((response.data as KdsDashboardPayload | null)?.message ?? `Unable to load the ${stationName.toLowerCase()} dashboard.`));
      }
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      if (!hasLoadedRef.current) setIsLoading(false);
      setError(caught instanceof Error ? caught.message : 'Please check the connection and try again.');
    } finally {
      if (sequence === requestSequence.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [stationType, stationName, range]);

  // Load on focus / range change and keep the numbers live while open.
  useEffect(() => {
    if (!isFocused) return;
    void loadDashboard('auto');
    const interval = setInterval(() => void loadDashboard('auto'), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [isFocused, loadDashboard]);

  const openDatePicker = useCallback(() => {
    draftFromRef.current = range.from || todayKey();
    setPickerValue(range.all ? new Date() : fromKey(range.from || todayKey()));
    setPickerStage('from');
  }, [range.from, range.all]);

  const handlePickerChange = useCallback((_event: any, selected?: Date) => {
    if (!selected || _event?.type === 'dismissed') {
      setPickerStage('closed');
      return;
    }
    const key = toKey(selected);
    if (pickerStage === 'from') {
      draftFromRef.current = key;
      setPickerValue(fromKey(range.to && range.to >= key ? range.to : key));
      setPickerStage('to');
    } else if (pickerStage === 'to') {
      setPickerStage('closed');
      applyRange(draftFromRef.current, key);
    }
  }, [pickerStage, range.to, applyRange]);

  // ── Derived numbers ────────────────────────────────────────────────────────
  // Amber / Red as an EVENT of the selected day: how many of that day's orders
  // went amber / red while they were being handled, split by phase.
  const alertHistory = data?.alertHistory;
  const severityCards = useMemo(() => {
    const empty = { completed: 0, open: 0, total: 0, percent: 0 };
    const todoAmber = alertHistory?.todo?.amber ?? empty;
    const todoRed = alertHistory?.todo?.red ?? empty;
    const progressAmber = alertHistory?.inProgress?.amber ?? empty;
    const progressRed = alertHistory?.inProgress?.red ?? empty;
    return {
      todoAmber,
      todoRed,
      progressAmber,
      progressRed,
      todoTotal: todoAmber.total + todoRed.total,
      progressTotal: progressAmber.total + progressRed.total,
      alerts: todoAmber.total + todoRed.total + progressAmber.total + progressRed.total,
      totalOrders: alertHistory?.totalOrders ?? 0,
      completedOrders: alertHistory?.completedOrders ?? 0,
      openOrders: alertHistory?.openOrders ?? 0,
      thresholds: alertHistory?.thresholds ?? { toDoAmberMinutes: 0, toDoRedMinutes: 0, inProgressAmberPercent: 80 },
    };
  }, [alertHistory]);

  const statusCounts = useMemo<KdsDashboardStatusCounts>(() => ({
    pending: Number(data?.statusCounts?.pending ?? 0) || 0,
    inProgress: Number(data?.statusCounts?.inProgress ?? 0) || 0,
    done: Number(data?.statusCounts?.done ?? 0) || 0,
  }), [data]);

  const modeCounts = useMemo<KdsDashboardModeCounts>(() => ({
    dineIn: Number(data?.modeCounts?.dineIn ?? 0) || 0,
    takeaway: Number(data?.modeCounts?.takeaway ?? 0) || 0,
    pickup: Number(data?.modeCounts?.pickup ?? 0) || 0,
    delivery: Number(data?.modeCounts?.delivery ?? 0) || 0,
    other: Number(data?.modeCounts?.other ?? 0) || 0,
  }), [data]);

  const modeTotal = modeCounts.dineIn + modeCounts.takeaway + modeCounts.pickup + modeCounts.delivery + modeCounts.other;

  const pieData = useMemo(() => MODE_LEGEND
    .map((entry) => ({ ...entry, value: modeCounts[entry.key] }))
    .filter((entry) => entry.value > 0)
    .map((entry) => {
      const pct = modeTotal > 0 ? Math.round((entry.value / modeTotal) * 100) : 0;
      return {
        value: entry.value,
        color: entry.color,
        label: entry.label,
        pct,
        text: pct >= 5 ? `${pct}%` : '',
        textColor: COLORS.white,
        textSize: 9,
        fontWeight: 'bold',
      };
    }), [modeCounts, modeTotal]);

  const otherModesSummary = useMemo(() => {
    const list = Array.isArray(data?.otherModes) ? data!.otherModes! : [];
    return list.slice(0, 4).map((entry) => `${entry.mode || '(blank)'} (${entry.count})`).join(', ');
  }, [data]);

  const topItems = useMemo(() => {
    const source = Array.isArray(data?.topItems) ? data!.topItems! : [];
    return source
      .filter((item) => item && String(item.itemCode ?? '').trim())
      .slice(0, 8)
      .map((item) => ({
        itemCode: String(item.itemCode),
        itemName: String(item.itemName ?? item.itemCode).trim(),
        quantity: Math.max(0, Number(item.quantity ?? 0) || 0),
        orderCount: Math.max(0, Number(item.orderCount ?? 0) || 0),
      }));
  }, [data]);

  const hourly = useMemo(() => {
    const source = Array.isArray(data?.hourlyOrders) ? data!.hourlyOrders! : [];
    const counts = Array.from({ length: 24 }, (_, hour) => {
      const match = source.find((entry) => Number(entry?.hour) === hour);
      return Math.max(0, Number(match?.count ?? 0) || 0);
    });
    const currentHour = new Date().getHours();
    const rangeCoversToday = range.all || (range.from <= todayKey() && range.to >= todayKey());
    const firstActive = counts.findIndex((count) => count > 0);
    if (firstActive === -1) return { bars: [] as { hour: number; count: number }[], peak: null as { hour: number; count: number } | null };

    let lastActive = 23;
    for (let hour = 23; hour >= 0; hour -= 1) {
      if (counts[hour] > 0) { lastActive = hour; break; }
    }
    const start = rangeCoversToday ? Math.max(0, Math.min(firstActive, currentHour)) : firstActive;
    const end = rangeCoversToday ? Math.max(lastActive, currentHour, start) : lastActive;

    const bars: { hour: number; count: number }[] = [];
    for (let hour = start; hour <= end; hour += 1) bars.push({ hour, count: counts[hour] });
    const peak = bars.reduce((best, bar) => (bar.count > best.count ? bar : best), bars[0]);
    return { bars, peak: peak.count > 0 ? peak : null };
  }, [data, range]);

  const availableDates = useMemo(() => {
    const source = Array.isArray(data?.availableDates) ? data!.availableDates! : [];
    return source.filter((entry) => entry && /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date ?? '')));
  }, [data]);

  const totalOrders = Number(data?.totals?.orders ?? 0) || 0;
  const totalItems = Number(data?.totals?.items ?? 0) || 0;

  // ── Chart sizing ───────────────────────────────────────────────────────────
  const barWidth = isTablet ? 16 : 12;
  const barSpacing = isTablet ? 10 : 6;
  const labelStride = hourly.bars.length > 14 ? 2 : 1;
  const chartInnerWidth = hourly.bars.length * (barWidth + barSpacing) + 20;
  const chartWidth = Math.max(contentWidth - 36, chartInnerWidth);
  const maxHourly = hourly.bars.reduce((max, bar) => Math.max(max, bar.count), 0);
  const chartMaxValue = Math.max(4, Math.ceil((maxHourly * 1.15) / 4) * 4);

  const hourlyBarData = useMemo(() => hourly.bars.map((bar) => ({
    value: bar.count,
    label: bar.hour % labelStride === 0 ? hourLabel(bar.hour) : '',
    frontColor: hourly.peak && bar.hour === hourly.peak.hour ? COLORS.accent : COLORS.navy,
    barBorderRadius: 3,
  })), [hourly, labelStride]);

  const maxTopQty = topItems.reduce((max, item) => Math.max(max, item.quantity), 0);

  // Quick range chips: TODAY / YESTERDAY / LAST 7 DAYS / LAST 14 DAYS / THIS MONTH / ALL DAYS.
  const quickRanges = useMemo(() => {
    const today = todayKey();
    return [
      { id: 'today', label: 'TODAY', from: today, to: today, all: false },
      { id: 'yesterday', label: 'YESTERDAY', from: addDays(today, -1), to: addDays(today, -1), all: false },
      { id: 'last7', label: 'LAST 7 DAYS', from: addDays(today, -6), to: today, all: false },
      { id: 'last14', label: 'LAST 14 DAYS', from: addDays(today, -13), to: today, all: false },
      { id: 'month', label: 'THIS MONTH', from: `${today.slice(0, 7)}-01`, to: today, all: false },
      { id: 'all', label: 'ALL DAYS', from: '', to: '', all: true },
    ];
  }, []);

  const activeQuickId = useMemo(() => (
    quickRanges.find((quick) => quick.all === range.all
      && (quick.all || (quick.from === range.from && quick.to === range.to)))?.id ?? null
  ), [quickRanges, range]);

  // ── Body states ────────────────────────────────────────────────────────────
  const renderBody = () => {
    if (isLoading && !data) {
      return (
        <View style={styles.stateBlock}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={[styles.stateText, { fontSize: 11 * f }]}>Loading {stationName.toLowerCase()} performance · {rangeLabel}…</Text>
        </View>
      );
    }

    if (error && !data) {
      return (
        <View style={styles.stateBlock}>
          <Ionicons name="cloud-offline-outline" size={isTablet ? 40 : 32} color={COLORS.muted} />
          <Text style={[styles.stateTitle, { fontSize: 14 * f }]}>{stationName} dashboard unavailable</Text>
          <Text style={[styles.stateText, { fontSize: 11 * f }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadDashboard('manual')} accessibilityRole="button" accessibilityLabel="Retry loading the dashboard">
            <Ionicons name="refresh" size={16} color={COLORS.white} />
            <Text style={[styles.retryButtonText, { fontSize: 11 * f }]}>RETRY</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[styles.bodyContent, { width: contentWidth, paddingBottom: Math.max(insets.bottom + 18, 26) }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.staleNotice}>
            <Ionicons name="warning-outline" size={13} color={COLORS.todo} />
            <Text style={[styles.staleNoticeText, { fontSize: 10 * f }]}>Showing last loaded numbers — {error}</Text>
          </View>
        ) : null}

        {/* A. Order status */}
        <SectionCard
          title="ORDER STATUS"
          hint={`Order count by preparation state · ${rangeLabel}`}
          accessory={(
            <View style={styles.totalChip}>
              <Text style={[styles.totalChipText, { fontSize: 9 * f }]}>{formatCount(totalOrders)} ORDERS</Text>
            </View>
          )}
        >
          <View style={styles.cardRow}>
            {STATUS_CARDS.map((card) => (
              <StatCard
                key={card.key}
                value={formatCount(statusCounts[card.key])}
                label={card.label}
                caption={card.caption}
                icon={card.icon}
                color={card.color}
                soft={card.soft}
              />
            ))}
          </View>
        </SectionCard>

        {/* A2. Amber / Red as a day event — what happened, not what is on the board */}
        <SectionCard
          title="AMBER / RED ALERTS"
          hint={`Orders that went amber / red that day · ${rangeLabel}`}
          accessory={(
            <View style={styles.totalChip}>
              <Text style={[styles.totalChipText, { fontSize: 9 * f }]}>
                {formatCount(severityCards.alerts)} ALERTS
              </Text>
            </View>
          )}
        >
          <View style={styles.severityRow}>
            <SeverityCard
              label="AMBER"
              phase="TO DO"
              tone="amber"
              bucket={severityCards.todoAmber}
              totalOrders={severityCards.totalOrders}
            />
            <SeverityCard
              label="AMBER"
              phase="IN PROGRESS"
              tone="amber"
              bucket={severityCards.progressAmber}
              totalOrders={severityCards.totalOrders}
            />
            <SeverityCard
              label="RED"
              phase="TO DO"
              tone="red"
              bucket={severityCards.todoRed}
              totalOrders={severityCards.totalOrders}
            />
            <SeverityCard
              label="RED"
              phase="IN PROGRESS"
              tone="red"
              bucket={severityCards.progressRed}
              totalOrders={severityCards.totalOrders}
            />
          </View>

          {/* How the alerts ended: finished that day, or still unfinished. */}
          <View style={styles.severityOutcomeRow}>
            <View style={styles.severityOutcomeItem}>
              <Text style={[styles.severityOutcomeTitle, { color: COLORS.amberText, fontSize: 7.5 * f }]}>
                TO DO ALERTS
              </Text>
              <Text style={[styles.severityOutcomeValue, { fontSize: 9.5 * f }]} numberOfLines={1}>
                {formatCount(severityCards.todoTotal)} orders · {formatCount(severityCards.todoAmber.completed + severityCards.todoRed.completed)} done
              </Text>
            </View>
            <View style={styles.severityOutcomeDivider} />
            <View style={styles.severityOutcomeItem}>
              <Text style={[styles.severityOutcomeTitle, { color: COLORS.red, fontSize: 7.5 * f }]}>
                IN PROGRESS ALERTS
              </Text>
              <Text style={[styles.severityOutcomeValue, { fontSize: 9.5 * f }]} numberOfLines={1}>
                {formatCount(severityCards.progressTotal)} orders · {formatCount(severityCards.progressAmber.completed + severityCards.progressRed.completed)} done
              </Text>
            </View>
          </View>

          <Text style={[styles.severityFootnote, { fontSize: 7.5 * f, lineHeight: 11.5 * f }]}>
            To Do: amber ≥ {formatCount(severityCards.thresholds.toDoAmberMinutes)} min · red ≥ {formatCount(severityCards.thresholds.toDoRedMinutes)} min
            {'   ·   '}In Progress: amber ≥ {formatCount(severityCards.thresholds.inProgressAmberPercent)}% of prep time · red ≥ 100%
            {'   ·   '}{formatCount(severityCards.completedOrders)} done · {formatCount(severityCards.openOrders)} still open of {formatCount(severityCards.totalOrders)} orders
          </Text>
        </SectionCard>

        {/* B. Order modes + pie chart */}
        <SectionCard title="ORDER MODES" hint={`Order count by order type · ${rangeLabel}`}>
          <View style={styles.cardRow}>
            {(isTablet ? MODE_CARDS : MODE_CARDS.slice(0, 2)).map((card) => (
              <StatCard
                key={card.key}
                value={formatCount(modeCounts[card.key])}
                label={card.label}
                caption="Orders"
                icon={card.icon}
                color={card.color}
                soft={card.soft}
              />
            ))}
          </View>
          {!isTablet ? (
            <View style={styles.cardRow}>
              {MODE_CARDS.slice(2).map((card) => (
                <StatCard
                  key={card.key}
                  value={formatCount(modeCounts[card.key])}
                  label={card.label}
                  caption="Orders"
                  icon={card.icon}
                  color={card.color}
                  soft={card.soft}
                />
              ))}
            </View>
          ) : null}

          {modeTotal > 0 ? (
            <View style={styles.pieRow}>
              <View style={styles.pieWrap}>
                <PieChart
                  donut
                  data={pieData}
                  radius={isTablet ? 86 : 68}
                  innerRadius={isTablet ? 54 : 43}
                  innerCircleColor={COLORS.surface}
                  showText
                  textBackgroundRadius={0}
                  isAnimated
                  animationDuration={600}
                  strokeWidth={2}
                  strokeColor={COLORS.surface}
                />
                <View style={styles.pieCenter} pointerEvents="none">
                  <Text style={[styles.pieCenterValue, { fontSize: 20 * f, lineHeight: 22 * f }]} allowFontScaling={false}>{formatCount(modeTotal)}</Text>
                  <Text style={[styles.pieCenterLabel, { fontSize: 7.5 * f }]}>ORDERS</Text>
                </View>
              </View>
              <View style={styles.pieLegend}>
                {MODE_LEGEND.map((entry) => {
                  const value = modeCounts[entry.key];
                  const pct = modeTotal > 0 ? Math.round((value / modeTotal) * 100) : 0;
                  return (
                    <View key={entry.key} style={styles.pieLegendItem}>
                      <View style={[styles.pieLegendSquare, { backgroundColor: entry.color }]} />
                      <Text style={[styles.pieLegendLabel, { fontSize: 10 * f }]}>{entry.label}</Text>
                      <Text style={[styles.pieLegendValue, { fontSize: 10 * f }]}>{formatCount(value)} · {pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.chartEmpty}>
              <Ionicons name="pie-chart-outline" size={isTablet ? 30 : 24} color={COLORS.muted} />
              <Text style={[styles.chartEmptyText, { fontSize: 10 * f }]}>No orders with a recognisable mode in this period.</Text>
            </View>
          )}

          {modeCounts.other > 0 && otherModesSummary ? (
            <Text style={[styles.modeOtherNote, { fontSize: 9 * f }]}>Unmatched modes: {otherModesSummary}</Text>
          ) : null}
        </SectionCard>

        {/* C. Average prep time */}
        <SectionCard title="AVERAGE PREP TIME" hint="Station arrival → every item ready">
          <View style={styles.avgRow}>
            <View style={styles.avgIconChip}>
              <Ionicons name="timer-outline" size={isTablet ? 26 : 22} color={COLORS.white} />
            </View>
            <View style={styles.avgCopy}>
              <Text style={[styles.avgValue, { fontSize: 30 * f, lineHeight: 34 * f }]} allowFontScaling={false}>{formatMinutes(data?.averagePrepMinutes)}</Text>
              <Text style={[styles.avgCaption, { fontSize: 10 * f }]}>
                Average across {formatCount(data?.averagePrepOrderCount ?? 0)} completed order(s) · {rangeLabel}
              </Text>
              <Text style={[styles.avgSub, { fontSize: 9 * f }]}>
                Per item average: {formatMinutes(data?.averageItemPrepMinutes)} · Total items: {formatQty(totalItems)}
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* D. Top items */}
        <SectionCard title="TOP ITEMS" hint={`Most prepared items by quantity · ${rangeLabel}`}>
          {topItems.length === 0 ? (
            <View style={styles.chartEmpty}>
              <Ionicons name="list-outline" size={isTablet ? 30 : 24} color={COLORS.muted} />
              <Text style={[styles.chartEmptyText, { fontSize: 10 * f }]}>No {stationName.toLowerCase()} items prepared in this period.</Text>
            </View>
          ) : (
            <View style={styles.topItemList}>
              {topItems.map((item, index) => {
                const ratio = maxTopQty > 0 ? Math.max(0.05, item.quantity / maxTopQty) : 0;
                return (
                  <View key={`${item.itemCode}-${index}`} style={styles.topItemRow}>
                    <View style={[styles.topItemRank, index === 0 && styles.topItemRankFirst]}>
                      <Text style={[styles.topItemRankText, { fontSize: 10 * f }, index === 0 && styles.topItemRankTextFirst]} allowFontScaling={false}>{index + 1}</Text>
                    </View>
                    <View style={styles.topItemCopy}>
                      <Text style={[styles.topItemName, { fontSize: 10.5 * f }]} numberOfLines={1}>{item.itemName || item.itemCode}</Text>
                      <View style={styles.topItemBarTrack}>
                        <View style={[styles.topItemBarFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: index === 0 ? COLORS.accent : COLORS.navy }]} />
                      </View>
                    </View>
                    <View style={styles.topItemQty}>
                      <Text style={[styles.topItemQtyText, { fontSize: 13 * f }]} allowFontScaling={false}>{formatQty(item.quantity)}</Text>
                      <Text style={[styles.topItemQtyCaption, { fontSize: 8 * f }]}>{item.orderCount} ord.</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>

        {/* E. Hourly order trend */}
        <SectionCard
          title="HOURLY ORDER TREND"
          hint={`Orders received per hour of day · ${rangeLabel}`}
          accessory={hourly.peak ? (
            <View style={styles.peakChip}>
              <Ionicons name="trending-up" size={12} color={COLORS.white} />
              <Text style={[styles.peakChipText, { fontSize: 8 * f }]}>PEAK {hourLabelLong(hourly.peak.hour)} · {formatCount(hourly.peak.count)}</Text>
            </View>
          ) : undefined}
        >
          {hourly.bars.length === 0 ? (
            <View style={styles.chartEmpty}>
              <Ionicons name="bar-chart-outline" size={isTablet ? 30 : 24} color={COLORS.muted} />
              <Text style={[styles.chartEmptyText, { fontSize: 10 * f }]}>No orders received in this period.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
              <BarChart
                data={hourlyBarData}
                width={chartWidth}
                height={isTablet ? 190 : 150}
                barWidth={barWidth}
                spacing={barSpacing}
                initialSpacing={10}
                endSpacing={10}
                noOfSections={4}
                maxValue={chartMaxValue}
                yAxisThickness={1}
                yAxisColor={COLORS.border}
                yAxisTextStyle={{ color: COLORS.muted, fontSize: 9 }}
                yAxisLabelWidth={28}
                xAxisThickness={1}
                xAxisColor={COLORS.border}
                xAxisLabelTextStyle={{ color: COLORS.muted, fontSize: 8, width: barWidth + barSpacing, textAlign: 'center' }}
                rulesType="solid"
                rulesColor={OperationalColors.surfaceAlt}
                showGradient={false}
                isAnimated
                animationDuration={500}
                disableScroll
              />
            </ScrollView>
          )}
          <Text style={[styles.trendNote, { fontSize: 9 * f }]}>
            {hourly.peak
              ? `Busiest hour is ${hourLabelLong(hourly.peak.hour)} with ${formatCount(hourly.peak.count)} order(s). Bars update every ${AUTO_REFRESH_SECONDS} seconds.`
              : `Bars update every ${AUTO_REFRESH_SECONDS} seconds.`}
          </Text>
        </SectionCard>

        <Text style={[styles.footerNote, { fontSize: 9 * f, lineHeight: 13 * f }]}>
          {stationName} performance · {rangeLabel} · {displayName} station · Data refreshes automatically while this screen is open.
        </Text>
      </ScrollView>
    );
  };

  return (
    <TextScaleContext.Provider value={uiScale}>
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to the station display"
        >
          <Ionicons name="arrow-back" size={isTablet ? 24 : 22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerEyebrow, { fontSize: 9 * f }]}>STATION PERFORMANCE</Text>
          <Text style={[styles.headerTitle, { fontSize: 19 * f }]}>{stationName} Dashboard</Text>
          <Text style={[styles.headerSub, { fontSize: 9 * f }]}>
            {displayName} station · {rangeLabel} · auto refresh {AUTO_REFRESH_SECONDS}s{lastUpdatedAt ? ` · ${formatClockTime(lastUpdatedAt)}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadDashboard('manual')}
          disabled={isRefreshing}
          accessibilityRole="button"
          accessibilityLabel={`Refresh the ${stationName.toLowerCase()} performance dashboard`}
        >
          {isRefreshing
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Ionicons name="refresh" size={isTablet ? 24 : 20} color={COLORS.white} />}
        </TouchableOpacity>
      </View>

      {/* Date selection bar */}
      <View style={styles.dateBar}>
        <View style={styles.dateBarHead}>
          <View style={styles.dateBarLabel}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.navy} />
            <Text style={[styles.dateBarText, { fontSize: 12 * f }]} numberOfLines={1}>{rangeLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.datePickButton}
            onPress={openDatePicker}
            accessibilityRole="button"
            accessibilityLabel="Pick a custom date or date range"
          >
            <Ionicons name="swap-vertical" size={12} color={COLORS.white} />
            <Text style={[styles.datePickButtonText, { fontSize: 8.5 * f }]}>PICK DATES</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {quickRanges.map((quick) => (
            <TouchableOpacity
              key={quick.id}
              style={[styles.chip, activeQuickId === quick.id && styles.chipActive]}
              onPress={() => applyRange(quick.from, quick.to, quick.all)}
              accessibilityRole="button"
              accessibilityState={{ selected: activeQuickId === quick.id }}
              accessibilityLabel={quick.label}
            >
              <Text style={[styles.chipText, { fontSize: 8.5 * f }, activeQuickId === quick.id && styles.chipTextActive]}>{quick.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {availableDates.length > 0 ? (
          <View>
            <Text style={[styles.dateGroupLabel, { fontSize: 7.5 * f }]}>DAYS WITH DATA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {availableDates.map((entry) => {
                const selected = !range.all && range.from === entry.date && range.to === entry.date;
                return (
                  <TouchableOpacity
                    key={entry.date}
                    style={[styles.chip, styles.chipSmall, selected && styles.chipActive]}
                    onPress={() => applyRange(entry.date, entry.date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Show ${formatShortDate(entry.date)}`}
                  >
                    <Text style={[styles.chipText, styles.chipTextSmall, { fontSize: 8 * f }, selected && styles.chipTextActive]}>{formatShortDate(entry.date)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>{renderBody()}</View>

      {pickerStage !== 'closed' ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handlePickerChange}
        />
      ) : null}
    </SafeAreaView>
    </TextScaleContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  header: { minHeight: 92, paddingHorizontal: 14, paddingBottom: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy },
  backButton: { width: 42, height: 42, marginRight: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: 'rgba(248,247,245,0.13)', borderWidth: 1, borderColor: 'rgba(248,247,245,0.16)' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerEyebrow: { color: 'rgba(248,247,245,0.75)', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  headerTitle: { color: COLORS.white, fontSize: 19, fontWeight: '900', marginTop: 2, letterSpacing: 0.3 },
  headerSub: { color: 'rgba(248,247,245,0.65)', fontSize: 9, fontWeight: '700', marginTop: 3, letterSpacing: 0.3 },
  refreshButton: { width: 42, height: 42, marginLeft: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: 'rgba(248,247,245,0.13)', borderWidth: 1, borderColor: 'rgba(248,247,245,0.16)' },
  body: { flex: 1 },
  bodyScroll: { flex: 1 },
  bodyContent: { flexGrow: 1, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 12, gap: 11 },

  // Date bar
  dateBar: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  dateBarHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dateBarLabel: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateBarText: { color: COLORS.navy, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  datePickButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: COLORS.navy },
  datePickButtonText: { color: COLORS.white, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  chipRow: { gap: 6, paddingRight: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: 'rgba(107,80,56,0.14)' },
  chipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipText: { color: COLORS.navy, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  chipTextActive: { color: COLORS.white },
  chipSmall: { paddingVertical: 5, paddingHorizontal: 8 },
  chipTextSmall: { fontSize: 8 },
  dateGroupLabel: { color: COLORS.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8, marginBottom: 5 },

  staleNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: COLORS.todoSoft, borderWidth: 1, borderColor: 'rgba(233,150,60,0.35)' },
  staleNoticeText: { flex: 1, color: '#8A5A20', fontSize: 10, fontWeight: '700' },

  sectionCard: { backgroundColor: COLORS.surface, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, padding: 12, gap: 11 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: COLORS.heading, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  sectionHint: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  totalChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: COLORS.navy, marginTop: 2 },
  totalChipText: { color: COLORS.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  peakChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: COLORS.accent, marginTop: 2 },
  peakChipText: { color: COLORS.white, fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },

  cardRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, minWidth: 0, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(107,80,56,0.10)', paddingVertical: 11, paddingHorizontal: 7, alignItems: 'center', gap: 3 },
  // Amber / Red severity cards: two per row on a phone, four on a tablet.
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  severityCard: { flexGrow: 1, flexShrink: 1, flexBasis: '47%', minWidth: 0, borderRadius: 13, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 9, gap: 1 },
  severityTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  severityLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  severityDot: { width: 7, height: 7, borderRadius: 4 },
  severityValue: { fontSize: 24, fontWeight: '900', lineHeight: 27, letterSpacing: 0.2 },
  severityPhase: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, color: COLORS.text },
  severityCount: { fontSize: 8.5, fontWeight: '800' },
  severitySplit: { fontSize: 7.5, fontWeight: '700', color: COLORS.muted, marginTop: 1 },
  severityOutcomeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9, borderRadius: 11, backgroundColor: COLORS.surfaceAlt, paddingVertical: 7, paddingHorizontal: 9 },
  severityOutcomeItem: { flex: 1, minWidth: 0, gap: 1 },
  severityOutcomeDivider: { width: 1, alignSelf: 'stretch', backgroundColor: COLORS.border, marginHorizontal: 8 },
  severityOutcomeTitle: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 },
  severityOutcomeValue: { fontSize: 9, fontWeight: '700', color: COLORS.text },
  severityFootnote: { fontSize: 7.5, lineHeight: 11, color: COLORS.muted, marginTop: 7 },
  statIconChip: { width: 27, height: 27, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', lineHeight: 30, letterSpacing: 0.3 },
  statLabel: { color: COLORS.text, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  statCaption: { color: COLORS.muted, fontSize: 8, fontWeight: '600', textAlign: 'center' },
  modeOtherNote: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },

  // Pie chart
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 },
  pieWrap: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  pieCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pieCenterValue: { color: COLORS.navy, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  pieCenterLabel: { color: COLORS.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8, marginTop: 1 },
  pieLegend: { flex: 1, minWidth: 0, gap: 7 },
  pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pieLegendSquare: { width: 11, height: 11, borderRadius: 3 },
  pieLegendLabel: { color: COLORS.text, fontSize: 10, fontWeight: '800', minWidth: 62 },
  pieLegendValue: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },

  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avgIconChip: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.navy, justifyContent: 'center', alignItems: 'center' },
  avgCopy: { flex: 1, minWidth: 0 },
  avgValue: { color: COLORS.navy, fontSize: 30, fontWeight: '900', lineHeight: 34, letterSpacing: 0.3 },
  avgCaption: { color: COLORS.text, fontSize: 10, fontWeight: '800', marginTop: 3 },
  avgSub: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },

  topItemList: { gap: 9 },
  topItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topItemRank: { width: 21, height: 21, borderRadius: 7, justifyContent: 'center', alignItems: 'center', backgroundColor: OperationalColors.surfaceAlt },
  topItemRankFirst: { backgroundColor: COLORS.accent },
  topItemRankText: { color: COLORS.navy, fontSize: 10, fontWeight: '900' },
  topItemRankTextFirst: { color: COLORS.white },
  topItemCopy: { flex: 1, minWidth: 0, gap: 4 },
  topItemName: { color: COLORS.text, fontSize: 10.5, fontWeight: '800' },
  topItemBarTrack: { height: 9, borderRadius: 5, backgroundColor: OperationalColors.surfaceAlt, overflow: 'hidden' },
  topItemBarFill: { height: '100%', borderRadius: 5 },
  topItemQty: { minWidth: 44, alignItems: 'flex-end' },
  topItemQtyText: { color: COLORS.navy, fontSize: 13, fontWeight: '900' },
  topItemQtyCaption: { color: COLORS.muted, fontSize: 8, fontWeight: '700', marginTop: 1 },

  chartEmpty: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  chartEmptyText: { color: COLORS.muted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  trendNote: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },

  footerNote: { color: COLORS.muted, fontSize: 9, fontWeight: '700', textAlign: 'center', paddingHorizontal: 14, lineHeight: 13 },

  stateBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 26 },
  stateTitle: { color: COLORS.heading, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  stateText: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.navy, marginTop: 6 },
  retryButtonText: { color: COLORS.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
});
