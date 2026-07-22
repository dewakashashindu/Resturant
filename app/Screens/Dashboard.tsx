import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

// ── Responsive foundation ──────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');

const isTablet = SW >= 600;
const isSmall  = SH < 680;

const BASE_W = 393;
const BASE_H = 852;

const sw = (n: number) => (SW / BASE_W) * n;
const sh = (n: number) => (SH / BASE_H) * n;
const sc = (n: number, min: number, max: number) => Math.min(max, Math.max(min, sw(n)));

const CARD_WIDTH    = SW - sw(32);
const HEADER_SIDE_W = isTablet ? sw(46) : sw(40);
const DRAWER_WIDTH  = Math.min(SW * 0.82, sw(340));

const ITEM_H  = sh(44);
const VISIBLE = 5;
const PAD     = Math.floor(VISIBLE / 2);

// ── Typography scale ───────────────────────────────────────────────────────────
const FS = {
  xl:  sc(24, 18, 32),
  lg:  sc(16, 12, 22),
  md:  sc(14, 11, 18),
  sm:  sc(12, 9,  15),
  xs:  sc(10, 8,  13),
  xxs: sc(9,  7,  11),
  kpi: isTablet ? sc(22, 18, 28) : isSmall ? sc(16, 14, 20) : sc(19, 16, 24),
};

// ── Spacing scale ──────────────────────────────────────────────────────────────
const SP = {
  xxs: sw(4),
  xs:  sw(6),
  sm:  sw(8),
  md:  sw(12),
  lg:  sw(16),
  xl:  sw(24),
  xxl: sw(32),
};

// ── Icon / element sizes ───────────────────────────────────────────────────────
const SZ = {
  icon:         sc(20, 16, 26),
  iconBox:      sc(32, 26, 42),
  avatar:       sc(40, 32, 52),
  avatarRing:   sc(40, 32, 52),
  checkbox:     sc(22, 18, 28),
  checkboxSm:   sc(20, 16, 24),
  legendDot:    sc(10, 8,  13),
  legendSquare: sc(14, 11, 18),
  starSize:     sc(14, 11, 17),
  tabIconBox:   sc(32, 26, 38),
  drawerAvatar: sc(48, 38, 58),
  expandBtn:    sc(30, 24, 36),
  closeBtn:     sc(28, 22, 34),
  moreBtn:      { paddingH: sw(12), paddingV: sw(5) },
  hamLineW:     sc(20, 16, 26),
  hamLineH:     sw(2),
  aiFab:        sc(56, 48, 68),
};

// ── Border-radius scale ────────────────────────────────────────────────────────
const BR = {
  xs:  sw(4),
  sm:  sw(6),
  md:  sw(8),
  lg:  sw(12),
  xl:  sw(16),
  xxl: sw(20),
  pill:sw(99),
};

// ── Date helpers ───────────────────────────────────────────────────────────────
const toDateObj = (str: string): Date => {
  if (!str) return new Date();
  const [y, m, d] = str.split('/').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return isNaN(dt.getTime()) ? new Date() : dt;
};
const toDateStr = (d: Date) =>
  `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate()
  ).padStart(2, '0')}`;
const daysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEAR_MIN = 1970;
const YEAR_MAX = new Date().getFullYear() + 10;
const YEARS    = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

// ── Types ──────────────────────────────────────────────────────────────────────
type DateRange             = { from: string; to: string };
type CheckboxProps         = { checked: boolean };
type LocationModalProps    = { visible: boolean; onClose: () => void; selected: string[]; onConfirm: (s: string[]) => void };
type DateRangeModalProps   = { visible: boolean; onClose: () => void; dateRange: DateRange; onConfirm: (r: DateRange) => void };
type SalesVolumeModalProps = { visible: boolean; onClose: () => void };
type FilterRowProps        = { dateLabel: string; locationLabel: string; onDatePress: () => void; onLocationPress: () => void };
type KPICardsProps         = { onSalesVolumePress: () => void };

// ── Shared dataset ─────────────────────────────────────────────────────────────
const ORDER_MODE_RAW_DATA = [
  { label: '06/05', dineIn: 120, takeAway: 35,  pickUp: 25,  delivery: 10 },
  { label: '06/07', dineIn: 65,  takeAway: 80,  pickUp: 40,  delivery: 20 },
  { label: '06/08', dineIn: 98,  takeAway: 65,  pickUp: 55,  delivery: 60 },
  { label: '06/09', dineIn: 98,  takeAway: 15,  pickUp: 30,  delivery: 35 },
  { label: '06/10', dineIn: 35,  takeAway: 115, pickUp: 20,  delivery: 30 },
];
const TOTAL_DINE_IN   = ORDER_MODE_RAW_DATA.reduce((s, d) => s + d.dineIn,   0);
const TOTAL_TAKE_AWAY = ORDER_MODE_RAW_DATA.reduce((s, d) => s + d.takeAway, 0);
const TOTAL_PICK_UP   = ORDER_MODE_RAW_DATA.reduce((s, d) => s + d.pickUp,   0);
const TOTAL_DELIVERY  = ORDER_MODE_RAW_DATA.reduce((s, d) => s + d.delivery, 0);
const GRAND_TOTAL     = TOTAL_DINE_IN + TOTAL_TAKE_AWAY + TOTAL_PICK_UP + TOTAL_DELIVERY;
const PCT_DINE_IN     = Math.round((TOTAL_DINE_IN   / GRAND_TOTAL) * 100);
const PCT_TAKE_AWAY   = Math.round((TOTAL_TAKE_AWAY / GRAND_TOTAL) * 100);
const PCT_PICK_UP     = Math.round((TOTAL_PICK_UP   / GRAND_TOTAL) * 100);
const PCT_DELIVERY    = 100 - PCT_DINE_IN - PCT_TAKE_AWAY - PCT_PICK_UP;

const COLOR_DINE_IN   = '#075EA7';
const COLOR_TAKE_AWAY = 'rgba(98,145,185,0.9)';
const COLOR_PICK_UP   = '#703DDE';
const COLOR_DELIVERY  = '#3C3C41';

// ── Chart registry ─────────────────────────────────────────────────────────────
const CHART_REGISTRY: Record<string, { label: string; chartId: string }[]> = {
  Overview: [
    { label: 'Sales Volume (Order Mode Wise)',     chartId: 'salesVolume'  },
    { label: 'Sales Distribution By Order Modes', chartId: 'salesDistrib' },
    { label: 'Top Performance',                   chartId: 'topPerf'      },
    { label: 'Payment Type',                      chartId: 'payment'      },
    { label: 'Monthly Sales Trend',               chartId: 'monthly'      },
  ],
  Customers: [
    { label: 'Customer Reviews', chartId: 'custReviews' },
    { label: 'Review Items',     chartId: 'reviewItems' },
  ],
  Food: [
    { label: 'Top Selling Items', chartId: 'topSelling' },
  ],
  Performance: [
    { label: 'Live Operations',  chartId: 'liveOps'     },
    { label: 'Low Stock Alerts', chartId: 'stockAlerts' },
  ],
};

// ── Count-up hook ──────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    let raf: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased    = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.floor(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
      else setDisplay(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

// ── Animated KPI value ─────────────────────────────────────────────────────────
const AnimatedKPIValue = ({
  rawValue,
  suffix = '.00',
}: {
  rawValue: number;
  suffix?: string;
}) => {
  const count = useCountUp(rawValue, 1400);
  return (
    <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
      {count.toLocaleString()}{suffix}
    </Text>
  );
};

// ── Drum-roll column ───────────────────────────────────────────────────────────
function DrumColumn<T extends string | number>({
  items,
  selected,
  onSelect,
  width,
}: {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  width: number;
}) {
  const ref    = useRef<FlatList>(null);
  const padded = useMemo(
    () => [...Array(PAD).fill(null), ...items, ...Array(PAD).fill(null)] as (T | null)[],
    [items]
  );
  const idx = items.indexOf(selected);

  useEffect(() => {
    if (idx < 0) return;
    const timer = setTimeout(() => {
      ref.current?.scrollToIndex({
        index: idx + PAD,
        animated: false,
        viewPosition: 0.5,
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [idx, items.length]);

  const commitIndex = useCallback(
    (offsetY: number) => {
      const raw     = Math.round(offsetY / ITEM_H);
      const clamped = Math.max(PAD, Math.min(raw, PAD + items.length - 1));
      const itemIdx = clamped - PAD;
      ref.current?.scrollToIndex({ index: clamped, animated: true });
      if (itemIdx >= 0 && itemIdx < items.length) {
        onSelect(items[itemIdx]);
      }
    },
    [items, onSelect]
  );

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      <View pointerEvents="none" style={drumStyles.highlight} />
      <FlatList
        ref={ref}
        data={padded}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        snapToAlignment="center"
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => commitIndex(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e)      => commitIndex(e.nativeEvent.contentOffset.y)}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        initialScrollIndex={Math.max(0, idx + PAD)}
        onScrollToIndexFailed={(info) =>
          setTimeout(
            () => ref.current?.scrollToIndex({ index: info.index, animated: false }),
            120
          )
        }
        renderItem={({ item, index }) => {
          const itemIdx  = index - PAD;
          const isCenter = item !== null && itemIdx === idx;
          const dist     = Math.abs(itemIdx - idx);
          const opacity  =
            item === null ? 0 : dist === 0 ? 1 : dist === 1 ? 0.5 : 0.2;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (item !== null && itemIdx >= 0 && itemIdx < items.length) {
                  ref.current?.scrollToIndex({ index, animated: true });
                  onSelect(item);
                }
              }}
            >
              <View style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
                <Text
                  style={[
                    drumStyles.drumText,
                    isCenter && drumStyles.drumTextSelected,
                    { opacity },
                  ]}
                >
                  {item === null ? '' : String(item)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const drumStyles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: ITEM_H * PAD,
    left: sw(6),
    right: sw(6),
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.18)',
    borderRadius: BR.xs,
    zIndex: 10,
  },
  drumText:         { fontSize: sc(18, 14, 22), color: '#888', fontWeight: '400' },
  drumTextSelected: { fontSize: sc(20, 16, 24), color: '#000', fontWeight: '600' },
});

// ── Date Range Modal ───────────────────────────────────────────────────────────
const DateRangeModal = ({
  visible,
  onClose,
  dateRange,
  onConfirm,
}: DateRangeModalProps) => {
  const [picking, setPicking] = useState<'from' | 'to'>('from');

  const [fromMonth, setFromMonth] = useState(0);
  const [fromDay,   setFromDay]   = useState(1);
  const [fromYear,  setFromYear]  = useState(new Date().getFullYear());
  const [toMonth,   setToMonth]   = useState(0);
  const [toDay,     setToDay]     = useState(1);
  const [toYear,    setToYear]    = useState(new Date().getFullYear());

  useEffect(() => {
    if (!visible) return;
    const f = toDateObj(dateRange.from);
    const t = toDateObj(dateRange.to || dateRange.from);
    setPicking('from');
    setFromMonth(f.getMonth());
    setFromDay(f.getDate());
    setFromYear(f.getFullYear());
    setToMonth(t.getMonth());
    setToDay(t.getDate());
    setToYear(t.getFullYear());
  }, [visible]);

  const clamp = (day: number, month: number, year: number) =>
    Math.min(day, daysInMonth(year, month));

  const handleFromMonth = useCallback((m: number) => {
    setFromMonth(m);
    setFromDay((d) => clamp(d, m, fromYear));
  }, [fromYear]);

  const handleFromYear = useCallback((y: number) => {
    setFromYear(y);
    setFromDay((d) => clamp(d, fromMonth, y));
  }, [fromMonth]);

  const handleToMonth = useCallback((m: number) => {
    setToMonth(m);
    setToDay((d) => clamp(d, m, toYear));
  }, [toYear]);

  const handleToYear = useCallback((y: number) => {
    setToYear(y);
    setToDay((d) => clamp(d, toMonth, y));
  }, [toMonth]);

  const activeMonth  = picking === 'from' ? fromMonth  : toMonth;
  const activeDay    = picking === 'from' ? fromDay    : toDay;
  const activeYear   = picking === 'from' ? fromYear   : toYear;

  const setActiveMonth = picking === 'from' ? handleFromMonth : handleToMonth;
  const setActiveDay   = picking === 'from' ? setFromDay      : setToDay;
  const setActiveYear  = picking === 'from' ? handleFromYear  : handleToYear;

  const dayCount = daysInMonth(activeYear, activeMonth);
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount]
  );

  const fromStr = toDateStr(new Date(fromYear, fromMonth, fromDay));
  const toStr   = toDateStr(new Date(toYear,   toMonth,   toDay));

  const TOTAL_W = Math.min(SW - sw(40), sw(340));
  const INNER_W = TOTAL_W - sw(32);
  const MONTH_W = Math.round(INNER_W * 0.44);
  const DAY_W   = Math.round(INNER_W * 0.18);
  const YEAR_W  = INNER_W - MONTH_W - DAY_W - sw(8);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[drStyles.card, { width: TOTAL_W }]}>
              <Text style={drStyles.title}>Select date range</Text>
              <View style={drStyles.divider} />

              <View style={drStyles.tabRow}>
                {(['from', 'to'] as const).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[drStyles.tab, picking === tab && drStyles.tabActive]}
                    onPress={() => setPicking(tab)}
                    activeOpacity={0.8}
                  >
                    <Text style={[drStyles.tabText, picking === tab && drStyles.tabTextActive]}>
                      {tab === 'from' ? `From: ${fromStr}` : `To:    ${toStr}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={drStyles.drumsRow}>
                <DrumColumn
                  key={`month-${picking}`}
                  items={MONTHS}
                  selected={MONTHS[activeMonth]}
                  onSelect={(v) => setActiveMonth(MONTHS.indexOf(v as string))}
                  width={MONTH_W}
                />
                <DrumColumn
                  key={`day-${picking}-${activeMonth}-${activeYear}`}
                  items={days}
                  selected={Math.min(activeDay, dayCount)}
                  onSelect={(v) => setActiveDay(v as number)}
                  width={DAY_W}
                />
                <DrumColumn
                  key={`year-${picking}`}
                  items={YEARS}
                  selected={activeYear}
                  onSelect={(v) => setActiveYear(v as number)}
                  width={YEAR_W}
                />
              </View>

              <View style={drStyles.divider} />

              <TouchableOpacity
                style={drStyles.confirmBtn}
                onPress={() => { onConfirm({ from: fromStr, to: toStr }); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={drStyles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const drStyles = StyleSheet.create({
  card:           { backgroundColor: '#F2F2F7', borderRadius: BR.xl, overflow: 'hidden', alignSelf: 'center' },
  title:          { textAlign: 'center', fontSize: FS.md, fontWeight: '500', color: '#000', paddingTop: SP.lg, paddingBottom: SP.md, paddingHorizontal: SP.xl },
  divider:        { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.22)' },
  tabRow:         { flexDirection: 'row', margin: SP.md, backgroundColor: 'rgba(120,120,128,0.12)', borderRadius: BR.md, padding: sw(2) },
  tab:            { flex: 1, paddingVertical: sw(7), borderRadius: BR.sm, alignItems: 'center' },
  tabActive:      { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: sw(4), shadowOffset: { width: 0, height: sw(1) }, elevation: 2 },
  tabText:        { fontSize: FS.xs, color: 'rgba(0,0,0,0.40)', fontWeight: '500' },
  tabTextActive:  { color: '#000' },
  drumsRow:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SP.xxs, paddingHorizontal: SP.lg, paddingVertical: SP.sm, backgroundColor: '#fff' },
  confirmBtn:     { paddingVertical: SP.lg, alignItems: 'center' },
  confirmBtnText: { fontSize: FS.lg, color: '#007AFF', fontWeight: '400' },
});

// ── Side Drawer ────────────────────────────────────────────────────────────────
type DrawerProps = {
  visible: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (t: string) => void;
  selectedCharts: string[];
  onToggleSelect: (chartId: string) => void;
  onScrollToChart: (chartId: string, tab: string) => void;
};

const SideDrawer = ({
  visible,
  onClose,
  activeTab,
  onTabChange,
  selectedCharts,
  onToggleSelect,
  onScrollToChart,
}: DrawerProps) => {
  const translateX   = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [expandedTab, setExpandedTab] = useState<string | null>('Overview');

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const tabs = ['Overview', 'Customers', 'Food', 'Performance'];

  const handleNavTab     = (tab: string) => setExpandedTab((prev) => (prev === tab ? null : tab));
  const handleGoToTab    = (tab: string) => { onTabChange(tab); onClose(); };
  const handleLabelPress = (tab: string, chartId: string) => { onScrollToChart(chartId, tab); onClose(); };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(0,0,0,0.45)',
              opacity: translateX.interpolate({
                inputRange: [-DRAWER_WIDTH, 0],
                outputRange: [0, 1],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      <Animated.View style={[drawerStyles.panel, { transform: [{ translateX }] }]}>
        {/* Header */}
        <View style={drawerStyles.drawerHeader}>
          <View style={drawerStyles.drawerAvatarRing}>
            <Image
              source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
              style={drawerStyles.drawerAvatar}
            />
          </View>
          <View style={{ flex: 1, marginLeft: SP.md }}>
            <Text style={drawerStyles.drawerUserName}>John Smith</Text>
            <Text style={drawerStyles.drawerUserRole}>Administrator</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={drawerStyles.closeBtn}>
            <Svg width={SZ.icon} height={SZ.icon} viewBox="0 0 24 24">
              <Path d="M6 6l12 12M18 6L6 18" stroke="#333" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        <View style={drawerStyles.divider} />

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <Text style={drawerStyles.sectionHeading}>Navigation</Text>

          {tabs.map((tab) => {
            const isExpanded  = expandedTab === tab;
            const charts      = CHART_REGISTRY[tab] || [];
            const tabSelected = charts.filter((c) => selectedCharts.includes(c.chartId)).length;

            return (
              <View key={tab}>
                <TouchableOpacity
                  style={drawerStyles.tabRow}
                  onPress={() => handleNavTab(tab)}
                  activeOpacity={0.7}
                >
                  <View style={drawerStyles.tabLeft}>
                    <View
                      style={[
                        drawerStyles.tabIconBox,
                        { backgroundColor: activeTab === tab ? '#2F6FE4' : 'rgba(47,111,228,0.10)' },
                      ]}
                    >
                      <Svg width={sw(16)} height={sw(16)} viewBox="0 0 24 24">
                        {tab === 'Overview' && (
                          <Path
                            d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"
                            stroke={activeTab === tab ? '#fff' : '#2F6FE4'}
                            strokeWidth={1.8}
                            fill="none"
                            strokeLinejoin="round"
                          />
                        )}
                        {tab === 'Customers' && (
                          <>
                            <Circle cx={12} cy={8} r={4} stroke={activeTab === tab ? '#fff' : '#2F6FE4'} strokeWidth={1.8} fill="none" />
                            <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={activeTab === tab ? '#fff' : '#2F6FE4'} strokeWidth={1.8} fill="none" />
                          </>
                        )}
                        {tab === 'Food' && (
                          <>
                            <Path d="M6 2h12v6a6 6 0 01-12 0V2z" stroke={activeTab === tab ? '#fff' : '#2F6FE4'} strokeWidth={1.8} fill="none" />
                            <Path d="M8 22h8M12 14v8" stroke={activeTab === tab ? '#fff' : '#2F6FE4'} strokeWidth={1.8} fill="none" strokeLinecap="round" />
                          </>
                        )}
                        {tab === 'Performance' && (
                          <Path d="M3 17l5-5 4 4 9-9" stroke={activeTab === tab ? '#fff' : '#2F6FE4'} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </Svg>
                    </View>
                    <Text style={[drawerStyles.tabLabel, activeTab === tab && drawerStyles.tabLabelActive]}>
                      {tab}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.xs }}>
                    {tabSelected > 0 && (
                      <View style={drawerStyles.selBadge}>
                        <Text style={drawerStyles.selBadgeText}>{tabSelected}</Text>
                      </View>
                    )}
                    <Svg width={sw(16)} height={sw(16)} viewBox="0 0 24 24">
                      <Path
                        d={isExpanded ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
                        stroke="#999"
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={drawerStyles.chartList}>
                    <TouchableOpacity
                      style={drawerStyles.goToTabBtn}
                      onPress={() => handleGoToTab(tab)}
                      activeOpacity={0.7}
                    >
                      <Svg width={sw(13)} height={sw(13)} viewBox="0 0 24 24">
                        <Path d="M5 12h14M13 6l6 6-6 6" stroke="#2F6FE4" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={drawerStyles.goToTabText}>Go to {tab}</Text>
                    </TouchableOpacity>

                    <Text style={drawerStyles.chartListHeading}>
                      Select charts to show · tap name to jump
                    </Text>

                    {charts.map((chart) => {
                      const isSelected = selectedCharts.includes(chart.chartId);
                      return (
                        <View key={chart.chartId} style={drawerStyles.chartRow}>
                          <TouchableOpacity
                            onPress={() => onToggleSelect(chart.chartId)}
                            activeOpacity={0.7}
                            hitSlop={{ top: SP.sm, bottom: SP.sm, left: SP.sm, right: SP.sm }}
                          >
                            <View style={[drawerStyles.chartCheckbox, isSelected && drawerStyles.chartCheckboxChecked]}>
                              {isSelected && (
                                <Svg width={sw(11)} height={sw(11)} viewBox="0 0 24 24">
                                  <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                              )}
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{ flex: 1 }}
                            onPress={() => handleLabelPress(tab, chart.chartId)}
                            activeOpacity={0.7}
                          >
                            <Text style={[drawerStyles.chartLabel, isSelected && drawerStyles.chartLabelSelected]}>
                              {chart.label}
                            </Text>
                          </TouchableOpacity>

                          {isSelected && (
                            <View style={drawerStyles.selectedTag}>
                              <Text style={drawerStyles.selectedTagText}>Selected</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const drawerStyles = StyleSheet.create({
  panel:                { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: sw(16), shadowOffset: { width: sw(4), height: 0 }, elevation: 10 },
  drawerHeader:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.lg, paddingTop: isTablet ? SP.xl : sh(48), paddingBottom: SP.lg, backgroundColor: '#F7F9FF' },
  drawerAvatarRing:     { width: SZ.drawerAvatar, height: SZ.drawerAvatar, borderRadius: SZ.drawerAvatar / 2, borderWidth: sw(2), borderColor: '#2F6FE4', padding: sw(2) },
  drawerAvatar:         { width: '100%', height: '100%', borderRadius: BR.pill },
  drawerUserName:       { fontSize: FS.md, fontWeight: '700', color: '#000' },
  drawerUserRole:       { fontSize: FS.sm, color: '#666', marginTop: sw(2) },
  closeBtn:             { width: SZ.closeBtn, height: SZ.closeBtn, justifyContent: 'center', alignItems: 'center' },
  divider:              { height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  sectionHeading:       { fontSize: FS.xs, fontWeight: '700', color: '#999', letterSpacing: 1, marginTop: SP.lg, marginBottom: SP.sm, marginHorizontal: SP.lg, textTransform: 'uppercase' },
  tabRow:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingVertical: SP.md },
  tabLeft:              { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  tabIconBox:           { width: SZ.tabIconBox, height: SZ.tabIconBox, borderRadius: BR.md, justifyContent: 'center', alignItems: 'center' },
  tabLabel:             { fontSize: FS.md, fontWeight: '600', color: '#333' },
  tabLabelActive:       { color: '#2F6FE4' },
  selBadge:             { backgroundColor: '#2F6FE4', borderRadius: sw(10), paddingHorizontal: sw(7), paddingVertical: sw(2) },
  selBadgeText:         { fontSize: FS.xs, color: '#fff', fontWeight: '700' },
  chartList:            { backgroundColor: 'rgba(47,111,228,0.03)', paddingHorizontal: SP.lg, paddingBottom: SP.sm },
  goToTabBtn:           { flexDirection: 'row', alignItems: 'center', gap: SP.xs, paddingVertical: sw(10), marginBottom: SP.xs },
  goToTabText:          { fontSize: FS.sm, color: '#2F6FE4', fontWeight: '600' },
  chartListHeading:     { fontSize: FS.xs, color: '#999', fontWeight: '600', marginBottom: SP.sm, letterSpacing: 0.5 },
  chartRow:             { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: sw(9), borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  chartCheckbox:        { width: SZ.checkboxSm, height: SZ.checkboxSm, borderRadius: BR.xs, borderWidth: sw(1.5), borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  chartCheckboxChecked: { backgroundColor: '#2F6FE4', borderColor: '#2F6FE4' },
  chartLabel:           { fontSize: FS.sm, color: '#555', fontWeight: '400' },
  chartLabelSelected:   { color: '#000', fontWeight: '600' },
  selectedTag:          { backgroundColor: 'rgba(47,111,228,0.12)', borderRadius: BR.xs, paddingHorizontal: SP.sm, paddingVertical: sw(3) },
  selectedTagText:      { fontSize: FS.xxs, color: '#2F6FE4', fontWeight: '600' },
});

// ── Header ─────────────────────────────────────────────────────────────────────
const Header = ({ onHamburger }: { onHamburger: () => void }) => (
  <View style={styles.headerContainer}>
    <TouchableOpacity
      style={styles.hamburger}
      onPress={onHamburger}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.hamLine} />
      <View style={styles.hamLine} />
      <View style={styles.hamLine} />
    </TouchableOpacity>
    <Text style={styles.headerTitle} numberOfLines={1}>Dashboard</Text>
    <View style={styles.avatarRing}>
      <Image
        source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
        style={styles.avatar}
      />
    </View>
  </View>
);

// ── Checkbox ───────────────────────────────────────────────────────────────────
const Checkbox = ({ checked }: CheckboxProps) => (
  <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
    {checked && (
      <Svg width={sw(14)} height={sw(14)} viewBox="0 0 24 24">
        <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    )}
  </View>
);

// ── Location Modal ─────────────────────────────────────────────────────────────
const LocationModal = ({
  visible,
  onClose,
  selected,
  onConfirm,
}: LocationModalProps) => {
  const options = [
    'All Locations',
    'Heaven-One Galle Face',
    'Heaven - Crescat',
    'Heaven- Colombo city center',
    'Heaven- Negombo',
  ];
  const [tempSelected, setTempSelected] = useState<string[]>(selected);

  useEffect(() => {
    if (visible) setTempSelected(selected);
  }, [visible]);

  const toggle = (opt: string) => {
    if (opt === 'All Locations') { setTempSelected(['All Locations']); return; }
    let next = tempSelected.filter((s) => s !== 'All Locations');
    next = next.includes(opt) ? next.filter((s) => s !== opt) : [...next, opt];
    setTempSelected(next.length === 0 ? ['All Locations'] : next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Location</Text>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.modalOptionRow}
                  onPress={() => toggle(opt)}
                  activeOpacity={0.7}
                >
                  <Checkbox checked={tempSelected.includes(opt)} />
                  <Text style={styles.modalOptionText}>{opt}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => { onConfirm(tempSelected); onClose(); }}
              >
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ── Sales Volume Modal ─────────────────────────────────────────────────────────
const SalesVolumeModal = ({ visible, onClose }: SalesVolumeModalProps) => {
  const data = [
    { name: 'Heaven-One Galle Face',       value: '150,240.00' },
    { name: 'Heaven - Crescat',            value: '128,900.00' },
    { name: 'Heaven- Colombo city center', value: '98,344.00'  },
    { name: 'Heaven- Negombo',             value: '79,300.00'  },
  ];
  const MAX = 150240;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.modalTitle}>Sales Volume by Location</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Svg width={sw(16)} height={sw(16)} viewBox="0 0 24 24">
                    <Path d="M6 6l12 12M18 6L6 18" stroke="#333" strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
              {data.map((d) => {
                const raw   = parseFloat(d.value.replace(/,/g, ''));
                const fillW = (raw / MAX) * (CARD_WIDTH * 0.62);
                return (
                  <View key={d.name} style={styles.svLocRow}>
                    <View style={styles.svLocHeader}>
                      <Text style={styles.svLocName}>{d.name}</Text>
                      <Text style={styles.svLocValue}>{d.value}</Text>
                    </View>
                    <View style={styles.svTrack}>
                      <View style={[styles.svFill, { width: fillW }]} />
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity style={styles.confirmBtn} onPress={onClose}>
                <Text style={styles.confirmBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ── Sales Distribution Expanded ────────────────────────────────────────────────
const SalesDistributionExpanded = ({
  visible,
  onClose,
  pieData,
  tableData,
}: {
  visible: boolean;
  onClose: () => void;
  pieData: any[];
  tableData: { color: string; mode: string; pct: string; volume: string }[];
}) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={expStyles.header}>
        <TouchableOpacity onPress={onClose} style={expStyles.backBtn} activeOpacity={0.7}>
          <Svg width={sw(28)} height={sw(28)} viewBox="0 0 24 24">
            <Path d="M15 18l-6-6 6-6" stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={expStyles.title}>{'Sales Distribution\nBy Order Modes'}</Text>
        <View style={{ width: sw(44) }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={expStyles.scrollContent}>
        <View style={expStyles.chartWrapper}>
          <PieChart
            donut
            data={pieData}
            radius={sc(120, 80, 150)}
            innerRadius={sc(74, 48, 90)}
            innerCircleColor="#fff"
            showText
            textBackgroundRadius={0}
            isAnimated
            animationDuration={800}
            sectionAutoFocus
            focusOnPress
            strokeWidth={2}
            strokeColor="#fff"
          />
        </View>
        <View style={expStyles.divider} />
        <View style={expStyles.tableHeader}>
          <Text style={[expStyles.tableHeadText, { flex: 2 }]}>Mode</Text>
          <Text style={[expStyles.tableHeadText, { flex: 1.5, textAlign: 'center' }]}>Percentage</Text>
          <Text style={[expStyles.tableHeadText, { flex: 1.5, textAlign: 'right' }]}>Volume</Text>
        </View>
        {tableData.map((row, i) => (
          <View key={i} style={expStyles.tableRow}>
            <View style={[expStyles.modeCell, { flex: 2 }]}>
              <View style={[expStyles.modeDot, { backgroundColor: row.color }]} />
              <Text style={expStyles.tableText}>{row.mode}</Text>
            </View>
            <Text style={[expStyles.tableText, { flex: 1.5, textAlign: 'center' }]}>{row.pct}</Text>
            <Text style={[expStyles.tableText, { flex: 1.5, textAlign: 'right' }]}>{row.volume}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  </Modal>
);

const expStyles = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingTop: isTablet ? SP.xl : sh(44), paddingBottom: SP.md },
  backBtn:       { width: sw(44), height: sw(44), justifyContent: 'center', alignItems: 'flex-start' },
  title:         { fontSize: FS.xl, fontWeight: '500', color: '#000', textAlign: 'center', lineHeight: sc(28, 22, 36) },
  scrollContent: { paddingBottom: sh(40), alignItems: 'center' },
  chartWrapper:  { marginTop: SP.xl, marginBottom: SP.xxl, alignItems: 'center' },
  divider:       { width: SW - sw(32), height: 1, backgroundColor: 'rgba(0,0,0,0.15)', marginBottom: SP.xl },
  tableHeader:   { flexDirection: 'row', paddingHorizontal: SP.xl, marginBottom: SP.lg, width: '100%' },
  tableHeadText: { fontSize: FS.lg, fontWeight: '700', color: '#000' },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.xl, paddingVertical: sw(14), width: '100%', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  modeCell:      { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  modeDot:       { width: sw(14), height: sw(14), borderRadius: BR.xs },
  tableText:     { fontSize: FS.md, fontWeight: '500', color: '#000' },
});

// ── Top Performance Expanded ───────────────────────────────────────────────────
const TopPerformanceExpanded = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => {
  const restaurants = [
    { name: 'Heaven-One Galle Face',       total: 709, breakdown: { takeAway: 130, dining: 155, pickUp: 230, delivery: 194 } },
    { name: 'Heaven - Crescat',            total: 620, breakdown: { takeAway: 180, dining: 125, pickUp: 200, delivery: 115 } },
    { name: 'Heaven- Colombo city center', total: 583, breakdown: { takeAway: 150, dining: 140, pickUp: 170, delivery: 123 } },
    { name: 'Heaven- Negombo',             total: 425, breakdown: { takeAway: 110, dining: 100, pickUp: 120, delivery: 95  } },
  ];
  const MAX_TOTAL   = 800;
  const axisVals    = [0, 200, 400, 600, 800];
  const LABEL_W     = sc(110, 80, 140);
  const GAP         = SP.sm;
  const TRACK_W     = SW - sw(32) - LABEL_W - GAP;
  const ORDER_MODES = ['Take Away', 'Dining', 'Pick Up', 'Delivery'];
  const BAR_CHART_H = sh(160);
  const Y_LABEL_W   = sw(36);
  const getArr      = (b: typeof restaurants[0]['breakdown']) => [b.takeAway, b.dining, b.pickUp, b.delivery];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={topExpStyles.header}>
          <TouchableOpacity onPress={onClose} style={topExpStyles.backBtn} activeOpacity={0.7}>
            <Svg width={sw(28)} height={sw(28)} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={topExpStyles.title}>Top Performance</Text>
          <View style={{ width: sw(44) }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: sh(40) }}
        >
          <View style={topExpStyles.sectionCard}>
            <Text style={topExpStyles.sectionLabel}>Overall Ranking</Text>
            <View style={{ flexDirection: 'row', marginLeft: LABEL_W + GAP, marginBottom: SP.xs }}>
              {axisVals.map((v) => (
                <Text
                  key={v}
                  style={[topExpStyles.axisLabel, { width: TRACK_W / (axisVals.length - 1), textAlign: 'center' }]}
                >
                  {v}
                </Text>
              ))}
            </View>
            {restaurants.map((r, i) => {
              const fillW = (r.total / MAX_TOTAL) * TRACK_W;
              return (
                <View key={i} style={[topExpStyles.perfRow, { gap: GAP, marginBottom: SP.md }]}>
                  <Text style={[topExpStyles.perfName, { width: LABEL_W }]} numberOfLines={2}>
                    {r.name}
                  </Text>
                  <View style={[topExpStyles.perfTrack, { width: TRACK_W }]}>
                    {axisVals.slice(1).map((v) => (
                      <View
                        key={v}
                        style={{ position: 'absolute', left: (v / MAX_TOTAL) * TRACK_W, top: 0, bottom: 0, width: 1, backgroundColor: '#E0E0E0' }}
                      />
                    ))}
                    <View style={[topExpStyles.perfFill, { width: fillW }]}>
                      <Text style={topExpStyles.perfFillVal}>{r.total}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={[topExpStyles.perfAxisLine, { marginLeft: LABEL_W + GAP }]} />
          </View>

          {restaurants.map((r, ri) => {
            const vals     = getArr(r.breakdown);
            const maxVal   = Math.max(...vals);
            const yMax     = Math.ceil(maxVal / 50) * 50;
            const noOfSec  = yMax / 50;
            const yLabels  = Array.from({ length: noOfSec + 1 }, (_, i) => yMax - i * 50);
            const barW     = sc(26, 18, 36);
            const barSp    = sc(20, 14, 28);
            const chartW   = vals.length * (barW + barSp) + sw(20);
            return (
              <View key={ri}>
                <View style={topExpStyles.divider} />
                <Text style={topExpStyles.restaurantName}>{r.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: Y_LABEL_W, alignItems: 'flex-end', marginRight: SP.sm }}>
                    <View style={{ height: BAR_CHART_H, justifyContent: 'space-between' }}>
                      {yLabels.map((v, i) => (
                        <Text key={i} style={topExpStyles.yLabel}>{v}</Text>
                      ))}
                    </View>
                    <View style={{ height: sh(28) }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ height: BAR_CHART_H, position: 'relative' }}>
                      {yLabels.map((_, i) => (
                        <View
                          key={i}
                          style={{ position: 'absolute', top: (BAR_CHART_H / noOfSec) * i, left: 0, right: 0, height: 1, backgroundColor: i === noOfSec ? '#E0E0E0' : '#F0F0F0' }}
                        />
                      ))}
                      <View style={{ flexDirection: 'row', height: '100%', alignItems: 'flex-end', paddingHorizontal: SP.xxs, gap: SP.sm }}>
                        {vals.map((val, vi) => {
                          const barH = (val / yMax) * BAR_CHART_H;
                          return (
                            <View key={vi} style={{ flex: 1, alignItems: 'center' }}>
                              <Text style={topExpStyles.barTopVal}>{val}</Text>
                              <View style={{ width: '80%', height: barH, backgroundColor: '#69A0C8', borderRadius: BR.xs }} />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', paddingHorizontal: SP.xxs, gap: SP.sm, marginTop: SP.xs }}>
                      {ORDER_MODES.map((m, mi) => (
                        <Text key={mi} style={[topExpStyles.xLabel, { flex: 1 }]} numberOfLines={2} adjustsFontSizeToFit>
                          {m}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

const topExpStyles = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingTop: isTablet ? SP.xl : sh(44), paddingBottom: SP.md, backgroundColor: '#fff' },
  backBtn:        { width: sw(44), height: sw(44), justifyContent: 'center', alignItems: 'flex-start' },
  title:          { fontSize: FS.xl, fontWeight: '500', color: '#000', textAlign: 'center' },
  sectionCard:    { backgroundColor: '#fff', borderRadius: BR.lg, paddingVertical: SP.md, marginBottom: SP.xxs },
  sectionLabel:   { fontSize: FS.sm, fontWeight: '600', color: '#54555A', marginBottom: SP.md },
  axisLabel:      { fontSize: FS.xxs, color: '#54555A', textAlign: 'center' },
  perfRow:        { flexDirection: 'row', alignItems: 'center' },
  perfName:       { fontSize: FS.xs, color: '#54555A', textAlign: 'right' },
  perfTrack:      { height: sc(28, 22, 36), backgroundColor: 'rgba(180,180,180,0.15)', borderRadius: BR.xs, overflow: 'hidden' },
  perfFill:       { height: '100%', backgroundColor: 'rgba(0,98,170,0.60)', justifyContent: 'center', alignItems: 'flex-end', paddingRight: SP.xs, borderRadius: BR.xs },
  perfFillVal:    { fontSize: FS.xs, color: '#fff', fontWeight: '600' },
  perfAxisLine:   { height: 1, backgroundColor: '#E0E0E0', marginTop: SP.xxs },
  divider:        { height: 1, backgroundColor: 'rgba(0,0,0,0.15)', marginVertical: SP.lg },
  restaurantName: { fontSize: FS.md, fontWeight: '600', color: '#000', marginBottom: SP.md },
  yLabel:         { fontSize: FS.xxs, color: '#54555A', textAlign: 'right' },
  barTopVal:      { fontSize: FS.xxs, color: '#333', fontWeight: '500', marginBottom: sw(2), textAlign: 'center' },
  xLabel:         { fontSize: FS.xxs, color: '#54555A', textAlign: 'center', lineHeight: sw(13) },
});

// ── Performance Tab ────────────────────────────────────────────────────────────
const PerformanceTab = ({
  scrollRef,
  selectedCharts,
  chartViewRefs,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  selectedCharts: string[];
  chartViewRefs: React.MutableRefObject<Record<string, View | null>>;
}) => {
  const tabChartIds = (CHART_REGISTRY['Performance'] || []).map((c) => c.chartId);
  const activeSel   = selectedCharts.filter((id) => tabChartIds.includes(id));
  const showAll     = activeSel.length === 0;
  const show        = (id: string) => showAll || activeSel.includes(id);

  const stockAlerts = [
    { name: 'Chicken breast', remaining: '3.2 kg remaining',   level: 'Critical' },
    { name: 'Tomato puree',   remaining: '6.5 kg remaining',   level: 'Low'      },
    { name: 'Cooking oil',    remaining: '4 liters remaining',  level: 'Low'      },
    { name: 'Chicken breast', remaining: '3.2 kg remaining',   level: 'Low'      },
    { name: 'Chicken breast', remaining: '3.2 kg remaining',   level: 'Low'      },
  ];

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: SP.lg, gap: SP.lg, paddingBottom: sh(40) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={perfStyles.warningBanner}>
        <Text style={perfStyles.warningText}>
          <Text style={perfStyles.warningLabel}>Warning: </Text>
          <Text style={perfStyles.warningBody}>Chicken stock is low (Less than 5kg)</Text>
        </Text>
      </View>

      {show('liveOps') && (
        <View
          ref={(r) => { chartViewRefs.current['liveOps'] = r; }}
          collapsable={false}
          style={perfStyles.card}
        >
          <Text style={perfStyles.cardTitle}>Live Operations</Text>
          <View style={perfStyles.liveOpRow}>
            <View style={perfStyles.liveOpLeft}>
              <View style={perfStyles.liveOpIconBox}>
                <Svg width={SZ.icon} height={SZ.icon} viewBox="0 0 24 24">
                  <Path d="M6 2h12v6a6 6 0 01-12 0V2z" stroke="#000" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M6 8H4a2 2 0 000 4h2M18 8h2a2 2 0 010 4h-2" stroke="#000" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                  <Path d="M8 22h8M12 14v8" stroke="#000" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={perfStyles.liveOpLabel}>In Kitchen Preparing</Text>
            </View>
            <Text style={perfStyles.liveOpValue}>12</Text>
          </View>
          <View style={[perfStyles.liveOpRow, { marginBottom: 0 }]}>
            <View style={perfStyles.liveOpLeft}>
              <View style={perfStyles.liveOpIconBox}>
                <Svg width={SZ.icon} height={SZ.icon} viewBox="0 0 24 24">
                  <Rect x={2} y={7} width={20} height={3} rx={1} stroke="#000" strokeWidth={1.5} fill="none" />
                  <Line x1={5}  y1={10} x2={5}  y2={19} stroke="#000" strokeWidth={1.5} strokeLinecap="round" />
                  <Line x1={19} y1={10} x2={19} y2={19} stroke="#000" strokeWidth={1.5} strokeLinecap="round" />
                  <Line x1={5}  y1={14} x2={19} y2={14} stroke="#000" strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={perfStyles.liveOpLabel}>Tables Busy (65%)</Text>
            </View>
            <Text style={perfStyles.liveOpValue}>8 / 12</Text>
          </View>
        </View>
      )}

      {show('stockAlerts') && (
        <View
          ref={(r) => { chartViewRefs.current['stockAlerts'] = r; }}
          collapsable={false}
          style={perfStyles.card}
        >
          <Text style={perfStyles.cardTitle}>Low Stock Alerts</Text>
          {stockAlerts.map((item, i) => (
            <View key={i}>
              {i > 0 && <View style={perfStyles.rowDivider} />}
              <View style={perfStyles.stockRow}>
                <View style={perfStyles.stockImgBox} />
                <View style={perfStyles.stockInfo}>
                  <Text style={perfStyles.stockName}>{item.name}</Text>
                  <Text style={perfStyles.stockRemaining}>{item.remaining}</Text>
                </View>
                <View style={[perfStyles.badge, item.level === 'Critical' ? perfStyles.badgeCritical : perfStyles.badgeLow]}>
                  <Text style={perfStyles.badgeText}>{item.level}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const perfStyles = StyleSheet.create({
  warningBanner:  { backgroundColor: 'rgba(250,167,158,0.60)', borderRadius: BR.sm, paddingHorizontal: SP.md, paddingVertical: SP.sm },
  warningText:    { fontSize: FS.sm, lineHeight: sh(20) },
  warningLabel:   { color: '#FF0202', fontWeight: '700', fontSize: FS.sm },
  warningBody:    { color: '#000', fontWeight: '500', fontSize: FS.sm },
  card:           { backgroundColor: '#fff', borderRadius: BR.xxl, padding: SP.lg, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: sw(10), shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  cardTitle:      { fontSize: FS.md, fontWeight: '500', color: '#000', marginBottom: sw(14) },
  liveOpRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(97,145,185,0.22)', borderRadius: BR.md, paddingHorizontal: sw(14), paddingVertical: SP.md, marginBottom: SP.md, minHeight: sh(80), shadowColor: '#ffffff', shadowOpacity: 0.08, shadowRadius: SP.xs, shadowOffset: { width: 0, height: sw(2) }, elevation: 2 },
  liveOpLeft:     { flex: 1, justifyContent: 'space-between', alignSelf: 'stretch' },
  liveOpIconBox:  { width: sc(36, 28, 44), height: sc(36, 28, 44), backgroundColor: '#fff', borderRadius: BR.md, justifyContent: 'center', alignItems: 'center', marginBottom: SP.xxs },
  liveOpLabel:    { fontSize: FS.sm, fontWeight: '500', color: '#000' },
  liveOpValue:    { fontSize: sc(26, 20, 34), fontWeight: '500', color: '#000', textAlign: 'right', alignSelf: 'center', marginLeft: SP.sm },
  rowDivider:     { height: 1, backgroundColor: 'rgba(0,0,0,0.12)', marginVertical: SP.xs },
  stockRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: SP.sm },
  stockImgBox:    { width: sc(42, 32, 52), height: sc(42, 32, 52), backgroundColor: '#D9D9D9', borderRadius: sw(10) },
  stockInfo:      { flex: 1, marginLeft: sw(14) },
  stockName:      { fontSize: FS.md, fontWeight: '400', color: '#000' },
  stockRemaining: { fontSize: FS.sm, fontWeight: '400', color: '#555', marginTop: sw(2) },
  badge:          { paddingHorizontal: SP.md, paddingVertical: sw(3), borderRadius: BR.xs, minWidth: sw(62), alignItems: 'center' },
  badgeCritical:  { backgroundColor: '#F69B9B' },
  badgeLow:       { backgroundColor: 'rgba(230,164,107,0.53)' },
  badgeText:      { fontSize: FS.sm, fontWeight: '400', color: '#000' },
});

// ── Food Item Expanded ─────────────────────────────────────────────────────────
const FoodItemExpanded = ({
  visible,
  onClose,
  selectedItem,
  chartData,
}: {
  visible: boolean;
  onClose: () => void;
  selectedItem: string;
  chartData: { day: string; value: number }[];
}) => {
  const barWidth    = sc(32, 22, 44);
  const spacing     = sc(26, 18, 36);
  const chartHeight = sh(isTablet ? 380 : 300);
  const maxValue    = 200;
  const noOfSections = 4;

  const barData = chartData.map((d) => ({
    value: d.value,
    label: d.day,
    frontColor: '#AAC3D9',
    topLabelComponent: () => (
      <Text style={{ fontSize: FS.xs, color: '#333', marginBottom: sw(4) }}>{d.value}</Text>
    ),
  }));

  const chartWidth  = chartData.length * (barWidth + spacing) + sw(20);
  const yAxisLabels = Array.from({ length: noOfSections + 1 }, (_, i) =>
    Math.round((maxValue / noOfSections) * (noOfSections - i))
  );
  const yLabelW     = sw(36);
  const xLabelAreaH = sh(24);
  const totalSales  = chartData.reduce((s, d) => s + d.value, 0);
  const avgSales    = Math.round(totalSales / chartData.length);
  const peakDay     = chartData.reduce((max, d) => (d.value > max.value ? d : max), chartData[0]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={foodExpStyles.header}>
          <TouchableOpacity onPress={onClose} style={foodExpStyles.backBtn} activeOpacity={0.7}>
            <Svg width={sw(28)} height={sw(28)} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={foodExpStyles.title} numberOfLines={2}>{selectedItem}</Text>
          <View style={{ width: sw(44) }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: sh(40) }}>
          <View style={foodExpStyles.summaryRow}>
            <View style={foodExpStyles.summaryCard}>
              <Text style={foodExpStyles.summaryLabel}>Total Sales</Text>
              <Text style={foodExpStyles.summaryValue}>{totalSales}</Text>
            </View>
            <View style={foodExpStyles.summaryCard}>
              <Text style={foodExpStyles.summaryLabel}>Avg / Day</Text>
              <Text style={foodExpStyles.summaryValue}>{avgSales}</Text>
            </View>
            <View style={foodExpStyles.summaryCard}>
              <Text style={foodExpStyles.summaryLabel}>Peak Day</Text>
              <Text style={foodExpStyles.summaryValue}>{peakDay.day}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: SP.xl }}>
            <View style={{ width: yLabelW, marginRight: SP.xxs, alignItems: 'flex-end' }}>
              <View style={{ height: chartHeight, justifyContent: 'space-between' }}>
                {yAxisLabels.map((val, i) => (
                  <Text key={i} style={{ fontSize: FS.xxs, color: '#54555A', lineHeight: FS.xxs + 2 }}>{val}</Text>
                ))}
              </View>
              <View style={{ height: xLabelAreaH }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
              <BarChart
                data={barData}
                maxValue={maxValue}
                noOfSections={noOfSections}
                barWidth={barWidth}
                spacing={spacing}
                barBorderRadius={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: 'transparent', fontSize: 1 }}
                yAxisLabelWidth={0}
                xAxisThickness={1}
                xAxisColor="#E0E0E0"
                xAxisLabelTextStyle={{ color: '#54555A', fontSize: FS.xs, textAlign: 'center' }}
                isAnimated
                animationDuration={800}
                rulesType="solid"
                rulesColor="#F0F0F0"
                height={chartHeight}
                width={chartWidth}
                initialSpacing={sw(12)}
                endSpacing={sw(12)}
                disableScroll
              />
            </ScrollView>
          </View>

          <View style={foodExpStyles.divider} />
          <View style={foodExpStyles.tableHeader}>
            <Text style={[foodExpStyles.tableHeadText, { flex: 1 }]}>Day</Text>
            <Text style={[foodExpStyles.tableHeadText, { flex: 1, textAlign: 'right' }]}>Units Sold</Text>
          </View>
          {chartData.map((row, i) => (
            <View key={i} style={foodExpStyles.tableRow}>
              <Text style={[foodExpStyles.tableText, { flex: 1 }]}>{row.day}</Text>
              <Text style={[foodExpStyles.tableText, { flex: 1, textAlign: 'right' }]}>{row.value}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const foodExpStyles = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingTop: isTablet ? SP.xl : sh(44), paddingBottom: SP.md, backgroundColor: '#fff' },
  backBtn:       { width: sw(44), height: sw(44), justifyContent: 'center', alignItems: 'flex-start' },
  title:         { flex: 1, fontSize: FS.xl, fontWeight: '500', color: '#000', textAlign: 'center' },
  summaryRow:    { flexDirection: 'row', gap: SP.md, marginTop: SP.sm },
  summaryCard:   { flex: 1, backgroundColor: 'rgba(97,145,185,0.18)', borderRadius: BR.lg, padding: sw(14), alignItems: 'center' },
  summaryLabel:  { fontSize: FS.xs, color: '#54555A', fontWeight: '500', marginBottom: SP.xs },
  summaryValue:  { fontSize: sc(17, 14, 22), color: '#000', fontWeight: '700' },
  divider:       { height: 1, backgroundColor: 'rgba(0,0,0,0.15)', marginVertical: SP.xl },
  tableHeader:   { flexDirection: 'row', marginBottom: SP.md },
  tableHeadText: { fontSize: FS.md, fontWeight: '700', color: '#000' },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  tableText:     { fontSize: FS.sm, fontWeight: '500', color: '#000' },
});

// ── Food Tab ───────────────────────────────────────────────────────────────────
const FoodTab = ({
  scrollRef,
  selectedCharts,
  chartViewRefs,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  selectedCharts: string[];
  chartViewRefs: React.MutableRefObject<Record<string, View | null>>;
}) => {
  const items = [
    { name: 'Chicken Submarine' },
    { name: 'Mango Juice'       },
    { name: 'Water Bottle'      },
    { name: 'Chicken Pasta'     },
    { name: 'Fish Noodles'      },
  ];
  const [selectedItem,    setSelectedItem   ] = useState('Chicken Submarine');
  const [expandedVisible, setExpandedVisible] = useState(false);

  const chartDataByItem: Record<string, { day: string; value: number }[]> = {
    'Chicken Submarine': [{ day: 'Mon', value: 120 }, { day: 'Tue', value: 200 }, { day: 'Wed', value: 150 }, { day: 'Thu', value: 80  }, { day: 'Fri', value: 70  }, { day: 'Sat', value: 110 }, { day: 'Sun', value: 130 }],
    'Mango Juice':       [{ day: 'Mon', value: 90  }, { day: 'Tue', value: 140 }, { day: 'Wed', value: 100 }, { day: 'Thu', value: 60  }, { day: 'Fri', value: 130 }, { day: 'Sat', value: 150 }, { day: 'Sun', value: 95  }],
    'Water Bottle':      [{ day: 'Mon', value: 60  }, { day: 'Tue', value: 80  }, { day: 'Wed', value: 70  }, { day: 'Thu', value: 90  }, { day: 'Fri', value: 100 }, { day: 'Sat', value: 120 }, { day: 'Sun', value: 85  }],
    'Chicken Pasta':     [{ day: 'Mon', value: 100 }, { day: 'Tue', value: 130 }, { day: 'Wed', value: 160 }, { day: 'Thu', value: 110 }, { day: 'Fri', value: 95  }, { day: 'Sat', value: 140 }, { day: 'Sun', value: 105 }],
    'Fish Noodles':      [{ day: 'Mon', value: 70  }, { day: 'Tue', value: 95  }, { day: 'Wed', value: 120 }, { day: 'Thu', value: 65  }, { day: 'Fri', value: 88  }, { day: 'Sat', value: 100 }, { day: 'Sun', value: 75  }],
  };

  const chartData    = chartDataByItem[selectedItem] || chartDataByItem['Chicken Submarine'];
  const barWidth     = sc(26, 18, 36);
  const spacing      = sc(20, 14, 28);
  const chartHeight  = sh(isTablet ? 320 : 260);
  const maxValue     = 200;
  const noOfSections = 4;

  const barData = chartData.map((d) => ({
    value: d.value,
    label: d.day,
    frontColor: '#AAC3D9',
    topLabelComponent: () => (
      <Text style={{ fontSize: FS.xs, color: '#333', marginBottom: sw(4) }}>{d.value}</Text>
    ),
  }));

  const chartWidth  = chartData.length * (barWidth + spacing) + sw(20);
  const yAxisLabels = Array.from({ length: noOfSections + 1 }, (_, i) =>
    Math.round((maxValue / noOfSections) * (noOfSections - i))
  );
  const yLabelW     = sw(32);
  const xLabelAreaH = sh(24);

  const tabChartIds = (CHART_REGISTRY['Food'] || []).map((c) => c.chartId);
  const activeSel   = selectedCharts.filter((id) => tabChartIds.includes(id));
  const showAll     = activeSel.length === 0;
  const show        = (id: string) => showAll || activeSel.includes(id);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: SP.lg, gap: SP.lg, paddingBottom: sh(40) }}
      showsVerticalScrollIndicator={false}
    >
      {show('topSelling') && (
        <View
          ref={(r) => { chartViewRefs.current['topSelling'] = r; }}
          collapsable={false}
          style={foodStyles.card}
        >
          <Text style={foodStyles.cardTitle}>Top Selling Items</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: SP.lg }}
            contentContainerStyle={{ gap: SP.md, paddingRight: SP.sm }}
          >
            {items.map((item) => {
              const isSel = selectedItem === item.name;
              return (
                <TouchableOpacity
                  key={item.name}
                  onPress={() => setSelectedItem(item.name)}
                  style={[
                    foodStyles.chip,
                    { backgroundColor: isSel ? 'rgba(0,98,170,0.56)' : 'rgba(97,145,185,0.54)' },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={foodStyles.chipText}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ width: yLabelW, marginRight: SP.xxs, alignItems: 'flex-end' }}>
              <View style={{ height: chartHeight, justifyContent: 'space-between' }}>
                {yAxisLabels.map((val, i) => (
                  <Text key={i} style={{ fontSize: FS.xxs, color: '#54555A', lineHeight: FS.xxs + 2 }}>{val}</Text>
                ))}
              </View>
              <View style={{ height: xLabelAreaH }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
              <BarChart
                data={barData}
                maxValue={maxValue}
                noOfSections={noOfSections}
                barWidth={barWidth}
                spacing={spacing}
                barBorderRadius={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: 'transparent', fontSize: 1 }}
                yAxisLabelWidth={0}
                xAxisThickness={1}
                xAxisColor="#E0E0E0"
                xAxisLabelTextStyle={{ color: '#54555A', fontSize: FS.xs, textAlign: 'center' }}
                isAnimated
                animationDuration={800}
                rulesType="solid"
                rulesColor="#F0F0F0"
                height={chartHeight}
                width={chartWidth}
                initialSpacing={sw(12)}
                endSpacing={sw(12)}
                disableScroll
              />
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SP.sm }}>
            <TouchableOpacity style={foodStyles.expandIconBtn} onPress={() => setExpandedVisible(true)}>
              <Svg width={sw(14)} height={sw(14)} viewBox="0 0 24 24">
                <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FoodItemExpanded
        visible={expandedVisible}
        onClose={() => setExpandedVisible(false)}
        selectedItem={selectedItem}
        chartData={chartData}
      />
    </ScrollView>
  );
};

const foodStyles = StyleSheet.create({
  card:          { backgroundColor: '#fff', borderRadius: sw(30), padding: SP.lg, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: sw(10), shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  cardTitle:     { fontSize: FS.lg, fontWeight: '500', color: '#000', marginBottom: sw(14), marginLeft: SP.xxs },
  chip:          { borderRadius: BR.xs, paddingHorizontal: sw(14), paddingVertical: SP.md, minWidth: sc(123, 90, 150), alignItems: 'center', justifyContent: 'center' },
  chipText:      { fontSize: FS.sm, fontWeight: '500', color: '#000' },
  expandIconBtn: { width: sc(26, 20, 32), height: sc(26, 20, 32), justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderRadius: BR.xs, borderWidth: 1, borderColor: 'rgba(0,0,0,0.20)', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: SP.xs, shadowOffset: { width: 0, height: sw(2) }, elevation: 2 },
});

// ── Filter Row ─────────────────────────────────────────────────────────────────
const FilterRow = ({
  dateLabel,
  locationLabel,
  onDatePress,
  onLocationPress,
}: FilterRowProps) => (
  <View style={styles.filterRow}>
    <TouchableOpacity style={styles.filterPill} onPress={onDatePress}>
      <Svg width={sw(13)} height={sw(13)} viewBox="0 0 24 24">
        <Rect x={3} y={4} width={18} height={18} rx={2} stroke="#333" strokeWidth={1.5} fill="none" />
        <Line x1={3}  y1={9}  x2={21} y2={9}  stroke="#333" strokeWidth={1.5} />
        <Line x1={8}  y1={2}  x2={8}  y2={6}  stroke="#333" strokeWidth={1.5} />
        <Line x1={16} y1={2}  x2={16} y2={6}  stroke="#333" strokeWidth={1.5} />
      </Svg>
      <Text style={styles.filterText} numberOfLines={1}>{dateLabel}</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.filterPill} onPress={onLocationPress}>
      <Svg width={sw(13)} height={sw(13)} viewBox="0 0 24 24">
        <Circle cx={12} cy={10} r={3} stroke="#333" strokeWidth={1.5} fill="none" />
        <Path d="M12 2C8 2 5 5.5 5 10c0 5.25 7 12 7 12s7-6.75 7-12c0-4.5-3-8-7-8z" stroke="#333" strokeWidth={1.5} fill="none" />
      </Svg>
      <Text style={styles.filterText} numberOfLines={1}>{locationLabel}</Text>
      <Svg width={sw(12)} height={sw(12)} viewBox="0 0 24 24">
        <Path d="M6 9l6 6 6-6" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  </View>
);

// ── KPI Cards ─────────────────────────────────────────────────────────────────
const KPICards = ({ onSalesVolumePress }: KPICardsProps) => {
  const [showMore, setShowMore] = useState(false);
  const innerCardW = (CARD_WIDTH - sw(32) - SP.md) / 2;

  const ArrowUp = () => (
    <Svg width={sw(13)} height={sw(13)} viewBox="0 0 24 24">
      <Path d="M7 17L17 7M17 7H7M17 7v10" stroke="#333" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
  const BillingIcon = () => (
    <Svg width={SZ.icon} height={SZ.icon} viewBox="0 0 24 24">
      <Rect x={2} y={5} width={20} height={14} rx={2} stroke="#333" strokeWidth={1.5} fill="none" />
      <Line x1={2} y1={10} x2={22} y2={10} stroke="#333" strokeWidth={1.5} />
      <Rect x={5} y={14} width={4} height={2} rx={0.5} fill="#333" />
    </Svg>
  );

  const mainCards = [
    {
      bg: 'rgba(7,94,167,0.22)',
      icon: (
        <Svg width={SZ.icon} height={SZ.icon} viewBox="0 0 24 24">
          <Path d="M3 3h18v4H3zM3 9h8v4H3zM3 15h8v4H3z" stroke="#333" strokeWidth={1.5} fill="none" />
          <Path d="M14 12l4 4 4-4" stroke="#333" strokeWidth={1.5} fill="none" />
          <Line x1={18} y1={8} x2={18} y2={16} stroke="#333" strokeWidth={1.5} />
        </Svg>
      ),
      label: 'Sales Volume',       rawValue: 456784, suffix: '.00',
      sub: '+14.2% from Yesterday', badge: null as string | null,
      showArrow: true, pressable: true, animated: true,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: (
        <Svg width={SZ.icon} height={SZ.icon} viewBox="0 0 24 24">
          <Rect x={5} y={2} width={14} height={20} rx={2} stroke="#333" strokeWidth={1.5} fill="none" />
          <Line x1={9} y1={7}  x2={15} y2={7}  stroke="#333" strokeWidth={1.5} />
          <Line x1={9} y1={11} x2={15} y2={11} stroke="#333" strokeWidth={1.5} />
          <Line x1={9} y1={15} x2={12} y2={15} stroke="#333" strokeWidth={1.5} />
        </Svg>
      ),
      label: 'Total Orders',       rawValue: 734,    suffix: '',
      sub: '+22 new today',         badge: null as string | null,
      showArrow: true, pressable: false, animated: true,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: (
        <Svg width={SZ.icon} height={SZ.icon} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} stroke="#333" strokeWidth={1.5} fill="none" />
          <Line x1={8} y1={16} x2={16} y2={8} stroke="#333" strokeWidth={1.5} />
          <Circle cx={9}  cy={9}  r={1} fill="#333" />
          <Circle cx={15} cy={15} r={1} fill="#333" />
        </Svg>
      ),
      label: 'Discount Volume',    rawValue: 46784,  suffix: '.00',
      sub: '10.2% of gross sales',  badge: null as string | null,
      showArrow: true, pressable: false, animated: true,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: <BillingIcon />,
      label: 'Billing - STANDARD', rawValue: 452217, suffix: '.00',
      sub: null as string | null,   badge: null as string | null,
      showArrow: false, pressable: false, animated: true,
    },
  ];

  const extraCards = [
    { bg: 'rgba(98,145,185,0.18)', icon: <BillingIcon />, label: 'Billing - COST',         rawValue: 4567,   suffix: '.00', sub: null as string | null, badge: null as string | null, showArrow: false, pressable: false, animated: false },
    { bg: 'rgba(98,145,185,0.18)', icon: <BillingIcon />, label: 'Billing - Complementry',  rawValue: 5784,   suffix: '.00', sub: null as string | null, badge: null as string | null, showArrow: false, pressable: false, animated: false },
    { bg: 'rgba(98,145,185,0.18)', icon: <BillingIcon />, label: 'Service Charge',           rawValue: 456784, suffix: '.00', sub: null as string | null, badge: null as string | null, showArrow: false, pressable: false, animated: false },
    { bg: 'rgba(98,145,185,0.18)', icon: <BillingIcon />, label: 'VAT TDL And NBT',          rawValue: 456784, suffix: '.00', sub: null as string | null, badge: null as string | null, showArrow: false, pressable: false, animated: false },
  ];

  const visibleCards = showMore ? [...mainCards, ...extraCards] : mainCards;

  return (
    <View style={styles.kpiOuterCard}>
      <View style={styles.kpiGrid}>
        {visibleCards.map((c, i) => {
          const W = c.pressable ? TouchableOpacity : View;
          return (
            <W
              key={i}
              style={[styles.kpiInnerCard, { width: innerCardW, backgroundColor: c.bg }]}
              {...(c.pressable ? { onPress: onSalesVolumePress, activeOpacity: 0.7 } : {})}
            >
              <View style={styles.kpiIconBadgeRow}>
                <View style={styles.kpiIconBox}>{c.icon}</View>
                {c.badge ? <Text style={styles.kpiBadge}>{c.badge}</Text> : null}
              </View>

              <Text style={styles.kpiLabel}>{c.label}</Text>

              {c.animated ? (
                <AnimatedKPIValue rawValue={c.rawValue} suffix={c.suffix} />
              ) : (
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {c.rawValue.toLocaleString()}{c.suffix}
                </Text>
              )}

              {c.sub ? (
                <View style={styles.kpiSubRow}>
                  {c.showArrow && <ArrowUp />}
                  <Text style={styles.kpiSub} numberOfLines={2}>{c.sub}</Text>
                </View>
              ) : null}
            </W>
          );
        })}
      </View>

      <View style={styles.kpiMoreRow}>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowMore((p) => !p)}>
          <Text style={styles.moreBtnText}>{showMore ? 'Less' : 'More'}</Text>
          <Svg width={sw(14)} height={sw(14)} viewBox="0 0 24 24">
            <Path
              d={showMore ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
              stroke="#333"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Sales Volume Chart ─────────────────────────────────────────────────────────
const SalesVolumeChart = () => {
  const barWidth    = sc(12, 8, 18);
  const spacing     = sc(14, 10, 20);
  const barSpacing  = sw(2);
  const groupW      = 4 * barWidth + 3 * barSpacing + spacing;
  const chartWidth  = ORDER_MODE_RAW_DATA.length * groupW + sw(40);
  const chartHeight = sh(isTablet ? 260 : isSmall ? 180 : 220);
  const maxValue    = 130;
  const noOfSections = 4;

  const mk = (value: number, frontColor: string, label?: string, isLast?: boolean) => ({
    value,
    frontColor,
    barWidth,
    roundedTop: true as const,
    spacing: isLast ? spacing : barSpacing,
    ...(label ? { label } : {}),
  });

  const barData = ORDER_MODE_RAW_DATA.flatMap((d) => [
    mk(d.dineIn,   COLOR_DINE_IN,   d.label),
    mk(d.takeAway, COLOR_TAKE_AWAY),
    mk(d.pickUp,   COLOR_PICK_UP),
    mk(d.delivery, COLOR_DELIVERY, undefined, true),
  ]);

  const legendItems = [
    { color: COLOR_DINE_IN,   label: 'Dine In'   },
    { color: COLOR_TAKE_AWAY, label: 'Take Away'  },
    { color: COLOR_PICK_UP,   label: 'Pick Up'    },
    { color: COLOR_DELIVERY,  label: 'Delivery'   },
  ];

  const yAxisLabels = Array.from({ length: noOfSections + 1 }, (_, i) =>
    Math.round((maxValue / noOfSections) * (noOfSections - i))
  );
  const yLabelW     = sw(32);
  const xLabelAreaH = sh(24);

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Sales Volume (Order Mode Wise)</Text>
      <View style={[styles.legendRow, { flexWrap: 'wrap' }]}>
        {legendItems.map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: yLabelW, marginRight: SP.xxs, alignItems: 'flex-end' }}>
          <View style={{ height: chartHeight, justifyContent: 'space-between' }}>
            {yAxisLabels.map((val, i) => (
              <Text key={i} style={{ fontSize: FS.xxs, color: '#54555A', lineHeight: FS.xxs + 2 }}>{val}</Text>
            ))}
          </View>
          <View style={{ height: xLabelAreaH }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
          <BarChart
            data={barData}
            maxValue={maxValue}
            noOfSections={noOfSections}
            barBorderRadius={BR.xs}
            yAxisThickness={0}
            yAxisTextStyle={{ color: 'transparent', fontSize: 1 }}
            yAxisLabelWidth={0}
            xAxisThickness={1}
            xAxisColor="#E0E0E0"
            xAxisLabelTextStyle={{ color: '#54555A', fontSize: FS.xxs, width: sw(50), textAlign: 'center' }}
            isAnimated
            animationDuration={800}
            rulesType="solid"
            rulesColor="#F0F0F0"
            height={chartHeight}
            width={chartWidth}
            initialSpacing={sw(12)}
            endSpacing={sw(12)}
            showGradient={false}
            disableScroll
          />
        </ScrollView>
      </View>
    </View>
  );
};

// ── Sales Distribution Card ────────────────────────────────────────────────────
const SalesDistributionCard = () => {
  const [expandedVisible, setExpandedVisible] = useState(false);
  const radius      = sc(isTablet ? 95 : isSmall ? 65 : 80,  50, 120);
  const innerRadius = sc(isTablet ? 58 : isSmall ? 38 : 48,  30, 75);

  const pieData = [
    { value: PCT_DINE_IN,   color: COLOR_DINE_IN,   text: `${PCT_DINE_IN}%`,   textColor: '#fff', textSize: FS.xs, fontWeight: 'bold' },
    { value: PCT_TAKE_AWAY, color: COLOR_TAKE_AWAY, text: `${PCT_TAKE_AWAY}%`, textColor: '#fff', textSize: FS.xs, fontWeight: 'bold' },
    { value: PCT_PICK_UP,   color: COLOR_PICK_UP,   text: `${PCT_PICK_UP}%`,   textColor: '#fff', textSize: FS.xs, fontWeight: 'bold' },
    { value: PCT_DELIVERY,  color: COLOR_DELIVERY,  text: `${PCT_DELIVERY}%`,  textColor: '#fff', textSize: FS.xs, fontWeight: 'bold' },
  ];

  const legend = [
    { color: COLOR_DINE_IN,   label: 'Dine In'   },
    { color: COLOR_TAKE_AWAY, label: 'Take Away'  },
    { color: COLOR_PICK_UP,   label: 'Pick Up'    },
    { color: COLOR_DELIVERY,  label: 'Delivery'   },
  ];

  const tableData = [
    { color: COLOR_DINE_IN,   mode: 'Dine In',   pct: `${PCT_DINE_IN}%`,   volume: TOTAL_DINE_IN.toLocaleString()   },
    { color: COLOR_TAKE_AWAY, mode: 'Take Away', pct: `${PCT_TAKE_AWAY}%`, volume: TOTAL_TAKE_AWAY.toLocaleString() },
    { color: COLOR_PICK_UP,   mode: 'Pick Up',   pct: `${PCT_PICK_UP}%`,   volume: TOTAL_PICK_UP.toLocaleString()   },
    { color: COLOR_DELIVERY,  mode: 'Delivery',  pct: `${PCT_DELIVERY}%`,  volume: TOTAL_DELIVERY.toLocaleString()  },
  ];

  return (
    <>
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionTitle, { flex: 1, marginRight: SP.sm, marginBottom: 0 }]}>
            Sales Distribution By Order Modes
          </Text>
          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpandedVisible(true)}>
            <Svg width={sw(16)} height={sw(16)} viewBox="0 0 24 24">
              <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>
        <View style={styles.distributionBody}>
          <PieChart
            donut
            data={pieData}
            radius={radius}
            innerRadius={innerRadius}
            innerCircleColor="#fff"
            showText
            textBackgroundRadius={0}
            isAnimated
            animationDuration={800}
            sectionAutoFocus
            focusOnPress
            strokeWidth={2}
            strokeColor="#fff"
          />
          <View style={styles.donutLegend}>
            {legend.map((l) => (
              <View key={l.label} style={styles.donutLegendItem}>
                <View style={[styles.legendSquare, { backgroundColor: l.color }]} />
                <Text style={styles.donutLegendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <SalesDistributionExpanded
        visible={expandedVisible}
        onClose={() => setExpandedVisible(false)}
        pieData={pieData}
        tableData={tableData}
      />
    </>
  );
};

// ── Top Performance Card ───────────────────────────────────────────────────────
const TopPerformanceCard = () => {
  const [expandedVisible, setExpandedVisible] = useState(false);
  const LABEL_W  = sc(isTablet ? 130 : 100, 80, 150);
  const GAP      = SP.sm;
  const TRACK_W  = CARD_WIDTH - sw(32) - LABEL_W - GAP;
  const MAX      = 800;
  const axisVals = [0, 200, 400, 600, 800];

  const data = [
    { name: 'Heaven-One\nGalle Face',       value: 709 },
    { name: 'Heaven -\nCrescat',            value: 620 },
    { name: 'Heaven-\nColombo city center', value: 583 },
    { name: 'Heaven-\nNegombo',             value: 425 },
  ];

  return (
    <>
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionTitle}>Top Performance</Text>
          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpandedVisible(true)}>
            <Svg width={sw(16)} height={sw(16)} viewBox="0 0 24 24">
              <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', marginLeft: LABEL_W + GAP, marginBottom: SP.xs }}>
          {axisVals.map((v) => (
            <Text
              key={v}
              style={[styles.axisLabel, { width: TRACK_W / (axisVals.length - 1), textAlign: 'center' }]}
            >
              {v}
            </Text>
          ))}
        </View>
        {data.map((d, i) => {
          const fillW = (d.value / MAX) * TRACK_W;
          return (
            <View key={i} style={[styles.perfRow, { gap: GAP, marginBottom: SP.md }]}>
              <Text style={[styles.perfName, { width: LABEL_W }]} numberOfLines={2}>{d.name}</Text>
              <View style={[styles.perfTrack, { width: TRACK_W }]}>
                {axisVals.slice(1).map((v) => (
                  <View
                    key={v}
                    style={{ position: 'absolute', left: (v / MAX) * TRACK_W, top: 0, bottom: 0, width: 1, backgroundColor: '#E0E0E0' }}
                  />
                ))}
                <View style={[styles.perfFill, { width: fillW }]}>
                  <Text style={styles.perfFillVal}>{d.value}</Text>
                </View>
              </View>
            </View>
          );
        })}
        <View style={[styles.perfAxisLine, { marginLeft: LABEL_W + GAP }]} />
      </View>
      <TopPerformanceExpanded visible={expandedVisible} onClose={() => setExpandedVisible(false)} />
    </>
  );
};

// ── Payment Type Card ──────────────────────────────────────────────────────────
const PaymentTypeCard = () => {
  const radius      = sc(isTablet ? 110 : 90, 60, 130);
  const innerRadius = sc(isTablet ? 65  : 54, 36, 78);

  const pieData = [
    { value: 40, color: '#006BD6' },
    { value: 30, color: '#537FF1' },
    { value: 15, color: '#FF6F5A' },
    { value: 10, color: '#3CC3DF' },
    { value: 3,  color: '#FF1301' },
    { value: 2,  color: '#5A4DC0' },
  ];

  const legend = [
    { color: '#5A4DC0', label: 'GIFT VOUCHER' },
    { color: '#FF1301', label: 'CREDIT'       },
    { color: '#3CC3DF', label: 'CASH'         },
    { color: '#FF6F5A', label: 'AMEX CARD'    },
    { color: '#537FF1', label: 'MASTER CARD'  },
    { color: '#006BD6', label: 'VISA CARD'    },
  ];

  return (
    <View style={styles.sectionCard}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.sectionTitle}>Payment Type</Text>
        <TouchableOpacity style={styles.expandBtn}>
          <Svg width={sw(16)} height={sw(16)} viewBox="0 0 24 24">
            <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>
      <View style={{ alignItems: 'center', marginVertical: SP.sm }}>
        <PieChart
          donut
          data={pieData}
          radius={radius}
          innerRadius={innerRadius}
          innerCircleColor="#fff"
          isAnimated
          animationDuration={800}
          sectionAutoFocus
          focusOnPress
          strokeWidth={2}
          strokeColor="#fff"
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: FS.xs, color: '#54555A', fontWeight: '600' }}>Payment</Text>
              <Text style={{ fontSize: FS.xxs, color: '#999' }}>Types</Text>
            </View>
          )}
        />
      </View>
      <View style={styles.payLegendGrid}>
        {legend.map((item) => (
          <View key={item.label} style={styles.payLegendItem}>
            <View style={[styles.payLegendDot, { backgroundColor: item.color }]} />
            <Text style={styles.payLegendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Monthly Sales Trend ────────────────────────────────────────────────────────
const MonthlySalesTrend = () => {
  const chartH      = sh(isTablet ? 220 : isSmall ? 130 : 170);
  const pointW      = sc(isTablet ? 60 : 50, 36, 70);
  const maxValue    = 160000;
  const noOfSections = 4;

  const lineData = [
    { value: 90000,  label: 'Jan' }, { value: 55000,  label: 'Feb' },
    { value: 130000, label: 'Mar' }, { value: 70000,  label: 'Apr' },
    { value: 110000, label: 'May' }, { value: 145000, label: 'Jun' },
    { value: 85000,  label: 'Jul' }, { value: 60000,  label: 'Aug' },
    { value: 100000, label: 'Sep' }, { value: 120000, label: 'Oct' },
    { value: 40000,  label: 'Nov' }, { value: 150000, label: 'Dec' },
  ];

  const chartWidth  = lineData.length * pointW;
  const yAxisLabels = Array.from({ length: noOfSections + 1 }, (_, i) =>
    Math.round((maxValue / noOfSections) * (noOfSections - i) / 1000)
  );
  const yLabelW     = sw(36);
  const xLabelAreaH = sh(24);

  return (
    <View style={[styles.sectionCard, { paddingBottom: SP.md }]}>
      <Text style={styles.sectionTitle}>Monthly Sales Trend</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: yLabelW, marginRight: SP.xxs, alignItems: 'flex-end' }}>
          <View style={{ height: chartH, justifyContent: 'space-between' }}>
            {yAxisLabels.map((val, i) => (
              <Text key={i} style={{ fontSize: FS.xxs, color: '#54555A', lineHeight: FS.xxs + 2 }}>{val}K</Text>
            ))}
          </View>
          <View style={{ height: xLabelAreaH }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
          <LineChart
            data={lineData}
            width={chartWidth}
            height={chartH}
            maxValue={maxValue}
            noOfSections={noOfSections}
            areaChart
            curved
            color="#5D51A9"
            thickness={sw(2.5)}
            startFillColor="rgba(137,121,255,0.5)"
            endFillColor="rgba(137,121,255,0.02)"
            startOpacity={0.8}
            endOpacity={0.1}
            initialSpacing={sw(16)}
            endSpacing={sw(16)}
            spacing={pointW}
            dataPointsColor="#5D51A9"
            dataPointsRadius={sw(4)}
            yAxisColor="transparent"
            xAxisColor="#E0E0E0"
            yAxisThickness={0}
            yAxisTextStyle={{ color: 'transparent', fontSize: 1 }}
            yAxisLabelWidth={0}
            xAxisLabelTextStyle={{ color: '#54555A', fontSize: FS.xxs }}
            rulesType="solid"
            rulesColor="#F0F0F0"
            isAnimated
            animationDuration={1000}
            focusEnabled
            showStripOnFocus
            stripColor="rgba(93,81,169,0.2)"
            stripWidth={sw(2)}
            unFocusOnPressOut
            disableScroll
          />
        </ScrollView>
      </View>
    </View>
  );
};

// ── Overview Tab ───────────────────────────────────────────────────────────────
const OverviewTab = ({
  onSalesVolumePress,
  scrollRef,
  chartViewRefs,
  selectedCharts,
}: {
  onSalesVolumePress: () => void;
  scrollRef: React.RefObject<ScrollView | null>;
  chartViewRefs: React.MutableRefObject<Record<string, View | null>>;
  selectedCharts: string[];
}) => {
  const tabChartIds = (CHART_REGISTRY['Overview'] || []).map((c) => c.chartId);
  const activeSel   = selectedCharts.filter((id) => tabChartIds.includes(id));
  const showAll     = activeSel.length === 0;
  const show        = (id: string) => showAll || activeSel.includes(id);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View ref={(r) => { chartViewRefs.current['kpi'] = r; }} collapsable={false}>
        <KPICards onSalesVolumePress={onSalesVolumePress} />
      </View>

      {show('salesVolume') && (
        <View ref={(r) => { chartViewRefs.current['salesVolume'] = r; }} collapsable={false}>
          <SalesVolumeChart />
        </View>
      )}
      {show('salesDistrib') && (
        <View ref={(r) => { chartViewRefs.current['salesDistrib'] = r; }} collapsable={false}>
          <SalesDistributionCard />
        </View>
      )}
      {show('topPerf') && (
        <View ref={(r) => { chartViewRefs.current['topPerf'] = r; }} collapsable={false}>
          <TopPerformanceCard />
        </View>
      )}
      {show('payment') && (
        <View ref={(r) => { chartViewRefs.current['payment'] = r; }} collapsable={false}>
          <PaymentTypeCard />
        </View>
      )}
      {show('monthly') && (
        <View ref={(r) => { chartViewRefs.current['monthly'] = r; }} collapsable={false}>
          <MonthlySalesTrend />
        </View>
      )}
      <View style={{ height: sh(40) }} />
    </ScrollView>
  );
};

// ── Star Rating ────────────────────────────────────────────────────────────────
const StarRating = ({ rating }: { rating: number }) => {
  const fullStars  = Math.floor(rating);
  const hasHalf    = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  const starColor  = 'rgba(171,119,60,0.79)';

  const FilledStar = () => (
    <Svg width={SZ.starSize} height={SZ.starSize} viewBox="0 0 24 24">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={starColor} stroke={starColor} strokeWidth={1} />
    </Svg>
  );
  const HalfStar = () => (
    <Svg width={SZ.starSize} height={SZ.starSize} viewBox="0 0 24 24">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke={starColor} strokeWidth={1.5} />
      <Path d="M12 2v15.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={starColor} />
    </Svg>
  );
  const EmptyStar = () => (
    <Svg width={SZ.starSize} height={SZ.starSize} viewBox="0 0 24 24">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke={starColor} strokeWidth={1.5} />
    </Svg>
  );

  return (
    <View style={{ flexDirection: 'row', gap: sw(2) }}>
      {Array.from({ length: fullStars  }).map((_, i) => <FilledStar key={`f${i}`} />)}
      {hasHalf && <HalfStar />}
      {Array.from({ length: emptyStars }).map((_, i) => <EmptyStar  key={`e${i}`} />)}
    </View>
  );
};

// ── Review Bar Chart ───────────────────────────────────────────────────────────
const ReviewBarChart = ({ data }: { data: { star: number; count: number }[] }) => {
  const MAX_COUNT = 200;
  const TRACK_W   = CARD_WIDTH - sw(32) - sw(56) - sw(36) - SP.md;
  const BAR_H     = sc(12, 8, 16);
  const ROW_GAP   = sc(8, 6, 12);

  return (
    <View style={{ gap: ROW_GAP }}>
      {data.map((row) => {
        const fillW = Math.max(sw(4), (row.count / MAX_COUNT) * TRACK_W);
        return (
          <View key={row.star} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.xs }}>
            <Text style={custStyles.chartStarLabel}>{row.star}</Text>
            <View style={[custStyles.chartTrack, { width: TRACK_W }]}>
              <View style={[custStyles.chartFill, { width: fillW, height: BAR_H }]} />
            </View>
            <Text style={custStyles.chartCountLabel}>{row.count}</Text>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', marginLeft: sw(18), width: TRACK_W, justifyContent: 'space-between' }}>
        {[0, 50, 100, 150, 200].map((v) => (
          <Text key={v} style={custStyles.chartXLabel}>{v}</Text>
        ))}
      </View>
    </View>
  );
};

// ── Customers Tab ──────────────────────────────────────────────────────────────
const CustomersTab = ({
  scrollRef,
  chartViewRefs,
  selectedCharts,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  chartViewRefs: React.MutableRefObject<Record<string, View | null>>;
  selectedCharts: string[];
}) => {
  const restaurants = [
    { name: 'Heaven-One Galle Face',       rating: 4.6, reviewCount: 1254, barData: [{ star: 5, count: 117 }, { star: 4, count: 150 }, { star: 3, count: 76 }, { star: 2, count: 42 }, { star: 1, count: 11 }] },
    { name: 'Heaven - Crescat',            rating: 4.5, reviewCount: 1254, barData: [{ star: 5, count: 117 }, { star: 4, count: 150 }, { star: 3, count: 76 }, { star: 2, count: 42 }, { star: 1, count: 11 }] },
    { name: 'Heaven- Colombo city center', rating: 4.2, reviewCount: 1254, barData: [{ star: 5, count: 117 }, { star: 4, count: 150 }, { star: 3, count: 76 }, { star: 2, count: 42 }, { star: 1, count: 11 }] },
  ];

  const reviews = [
    { name: 'Sanduni Perera', timeAgo: '2 days ago', restaurant: 'Heaven-One Galle Face', text: 'Service was fast and the chicken biryani tasted amazing. Will definitely order again.' },
    { name: 'Sanduni Perera', timeAgo: '2 days ago', restaurant: 'Heaven - Crescat',      text: 'Service was fast and the chicken biryani tasted amazing. Will definitely order again.' },
  ];

  const tabChartIds = (CHART_REGISTRY['Customers'] || []).map((c) => c.chartId);
  const activeSel   = selectedCharts.filter((id) => tabChartIds.includes(id));
  const showAll     = activeSel.length === 0;
  const show        = (id: string) => showAll || activeSel.includes(id);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: SP.lg, gap: SP.lg, paddingBottom: sh(40) }}
      showsVerticalScrollIndicator={false}
    >
      {show('custReviews') && (
        <View
          ref={(r) => { chartViewRefs.current['custReviews'] = r; }}
          collapsable={false}
          style={custStyles.reviewsCard}
        >
          <View style={custStyles.reviewsCardHeader}>
            <Text style={custStyles.reviewsCardHeaderText}>Customers Reviews</Text>
          </View>
          <View style={{ padding: SP.lg }}>
            {restaurants.map((r, i) => (
              <View key={r.name}>
                <Text style={custStyles.restaurantName}>{r.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.md, marginTop: SP.sm }}>
                  <View style={{ alignItems: 'flex-start', width: sw(80) }}>
                    <Text style={custStyles.bigRating}>{r.rating.toFixed(1)}</Text>
                    <StarRating rating={r.rating} />
                    <Text style={custStyles.reviewCount}>{r.reviewCount.toLocaleString()} Reviews</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ReviewBarChart data={[...r.barData].reverse()} />
                  </View>
                </View>
                {i < restaurants.length - 1 && <View style={custStyles.sectionDivider} />}
              </View>
            ))}
          </View>
        </View>
      )}

      {show('reviewItems') && (
        <View
          ref={(r) => { chartViewRefs.current['reviewItems'] = r; }}
          collapsable={false}
        >
          {reviews.map((rev, i) => (
            <View
              key={i}
              style={[custStyles.reviewCard, i === reviews.length - 1 && { marginBottom: 0 }]}
            >
              <View style={custStyles.reviewAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={custStyles.reviewerName}>{rev.name}</Text>
                <Text style={custStyles.reviewMeta}>{rev.timeAgo} · {rev.restaurant}</Text>
                <View style={custStyles.reviewDivider} />
                <Text style={custStyles.reviewText}>{rev.text}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const custStyles = StyleSheet.create({
  reviewsCard:           { backgroundColor: '#fff', borderRadius: BR.xxl, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: sw(10), shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  reviewsCardHeader:     { backgroundColor: 'rgba(97,145,185,0.34)', paddingHorizontal: SP.lg, paddingVertical: sw(14) },
  reviewsCardHeaderText: { fontSize: FS.md, fontWeight: '500', color: '#000' },
  restaurantName:        { fontSize: FS.md, fontWeight: '400', color: '#000', marginTop: SP.sm },
  bigRating:             { fontSize: sc(34, 26, 44), fontWeight: '400', color: '#000', lineHeight: sc(40, 30, 50), marginBottom: SP.xxs },
  reviewCount:           { fontSize: FS.xs, color: 'rgba(0,0,0,0.50)', marginTop: SP.xxs },
  sectionDivider:        { height: 1, backgroundColor: 'rgba(0,0,0,0.10)', marginVertical: sw(14) },
  chartStarLabel:        { fontSize: FS.xs, color: '#54555A', width: sw(12), textAlign: 'right' },
  chartTrack:            { height: sc(12, 8, 16), backgroundColor: 'rgba(180,180,180,0.18)', borderRadius: sw(2), overflow: 'hidden' },
  chartFill:             { backgroundColor: '#AAC3D9', borderRadius: sw(2) },
  chartCountLabel:       { fontSize: FS.xxs, color: '#54555A', width: sw(24), textAlign: 'right' },
  chartXLabel:           { fontSize: FS.xxs, color: '#54555A', textAlign: 'center' },
  reviewCard:            { flexDirection: 'row', backgroundColor: '#fff', borderRadius: BR.xxl, padding: SP.lg, gap: SP.md, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: sw(10), shadowOffset: { width: 0, height: 0 }, elevation: 4, marginBottom: SP.lg },
  reviewAvatar:          { width: sc(52, 40, 64), height: sc(52, 40, 64), borderRadius: BR.md, backgroundColor: '#D9D9D9', flexShrink: 0 },
  reviewerName:          { fontSize: FS.md, fontWeight: '700', color: '#000' },
  reviewMeta:            { fontSize: FS.sm, fontWeight: '700', color: 'rgba(0,0,0,0.50)', marginTop: sw(2) },
  reviewDivider:         { height: 1, backgroundColor: 'rgba(0,0,0,0.25)', marginVertical: SP.sm },
  reviewText:            { fontSize: FS.sm, fontWeight: '300', color: '#000', lineHeight: sc(20, 16, 24) },
});

// ── Tab Bar ────────────────────────────────────────────────────────────────────
const TabBar = ({
  active,
  onTabChange,
}: {
  active: string;
  onTabChange: (t: string) => void;
}) => {
  const tabs = ['Overview', 'Customers', 'Food', 'Performance'];
  return (
    <View style={styles.tabBarWrapper}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, isActive && styles.activeTab]}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ── AI Chat FAB Robot Icon ─────────────────────────────────────────────────────
const RobotIcon = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    {/* Antenna */}
    <Line x1={32} y1={6} x2={32} y2={14} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    <Circle cx={32} cy={5} r={3} fill="#fff" />
    {/* Head */}
    <Rect x={12} y={14} width={40} height={28} rx={8} fill="#fff" opacity={0.95} />
    {/* Eyes */}
    <Circle cx={23} cy={26} r={5} fill="#2F6FE4" />
    <Circle cx={41} cy={26} r={5} fill="#2F6FE4" />
    <Circle cx={24.5} cy={24.5} r={1.8} fill="#fff" />
    <Circle cx={42.5} cy={24.5} r={1.8} fill="#fff" />
    {/* Mouth */}
    <Rect x={22} y={34} width={20} height={3} rx={1.5} fill="#2F6FE4" opacity={0.7} />
    {/* Body */}
    <Rect x={18} y={44} width={28} height={14} rx={5} fill="#fff" opacity={0.85} />
    {/* Body detail */}
    <Rect x={24} y={49} width={5} height={5} rx={1.5} fill="#2F6FE4" opacity={0.6} />
    <Rect x={35} y={49} width={5} height={5} rx={1.5} fill="#2F6FE4" opacity={0.6} />
    {/* Arms */}
    <Rect x={6}  y={44} width={10} height={6} rx={3} fill="#fff" opacity={0.85} />
    <Rect x={48} y={44} width={10} height={6} rx={3} fill="#fff" opacity={0.85} />
  </Svg>
);

// ── AI Chat FAB ────────────────────────────────────────────────────────────────
const AIChatFAB = ({ onPress }: { onPress: () => void }) => {
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    // Glow / ring animation loop
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    glow.start();
    return () => { pulse.stop(); glow.stop(); };
  }, []);

  const fabSize    = SZ.aiFab;
  const ringSize   = fabSize + sw(16);
  const ringOffset = -sw(8);

  const ringOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.45],
  });
  const ringScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });

  return (
    <View style={fabStyles.fabContainer} pointerEvents="box-none">
      {/* Animated glow ring */}
      <Animated.View
        style={[
          fabStyles.fabRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            top: ringOffset,
            left: ringOffset,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
        pointerEvents="none"
      />

      {/* FAB button */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.82}
          style={[
            fabStyles.fab,
            { width: fabSize, height: fabSize, borderRadius: fabSize / 2 },
          ]}
        >
          <RobotIcon size={fabSize * 0.62} />
        </TouchableOpacity>
      </Animated.View>

      {/* Label */}
      <View style={fabStyles.fabLabel} pointerEvents="none">
        <Text style={fabStyles.fabLabelText}>AI Chat</Text>
      </View>
    </View>
  );
};

const fabStyles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: sh(32),
    left: SP.lg,
    alignItems: 'center',
    zIndex: 999,
  },
  fabRing: {
    position: 'absolute',
    backgroundColor: '#2F6FE4',
  },
  fab: {
    backgroundColor: '#2F6FE4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2F6FE4',
    shadowOpacity: 0.55,
    shadowRadius: sw(12),
    shadowOffset: { width: 0, height: sw(4) },
    elevation: 10,
  },
  fabLabel: {
    marginTop: sw(5),
    backgroundColor: 'rgba(47,111,228,0.92)',
    borderRadius: BR.pill,
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
  },
  fabLabelText: {
    fontSize: FS.xxs,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

// ── Root Screen ────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();

  const [activeTab,               setActiveTab              ] = useState('Overview');
  const [drawerVisible,           setDrawerVisible          ] = useState(false);
  const [locationModalVisible,    setLocationModalVisible   ] = useState(false);
  const [dateModalVisible,        setDateModalVisible       ] = useState(false);
  const [salesVolumeModalVisible, setSalesVolumeModalVisible] = useState(false);
  const [selectedLocations,       setSelectedLocations      ] = useState<string[]>(['All Locations']);
  const [dateRange,               setDateRange              ] = useState<DateRange>({ from: '2026/06/12', to: '' });
  const [selectedCharts,          setSelectedCharts         ] = useState<string[]>([]);

  const overviewScrollRef  = useRef<ScrollView>(null);
  const customersScrollRef = useRef<ScrollView>(null);
  const foodScrollRef      = useRef<ScrollView>(null);
  const perfScrollRef      = useRef<ScrollView>(null);

  const overviewChartRefs  = useRef<Record<string, View | null>>({});
  const customersChartRefs = useRef<Record<string, View | null>>({});
  const foodChartRefs      = useRef<Record<string, View | null>>({});
  const perfChartRefs      = useRef<Record<string, View | null>>({});

  const getScrollRef = (tab: string): React.RefObject<ScrollView | null> => {
    if (tab === 'Overview')    return overviewScrollRef;
    if (tab === 'Customers')   return customersScrollRef;
    if (tab === 'Food')        return foodScrollRef;
    if (tab === 'Performance') return perfScrollRef;
    return overviewScrollRef;
  };

  const getChartRefs = (tab: string): React.MutableRefObject<Record<string, View | null>> => {
    if (tab === 'Overview')    return overviewChartRefs;
    if (tab === 'Customers')   return customersChartRefs;
    if (tab === 'Food')        return foodChartRefs;
    if (tab === 'Performance') return perfChartRefs;
    return overviewChartRefs;
  };

  const handleToggleSelect = (chartId: string) =>
    setSelectedCharts((prev) =>
      prev.includes(chartId) ? prev.filter((id) => id !== chartId) : [...prev, chartId]
    );

  const handleScrollToChart = (chartId: string, tab: string) => {
    const needsTabSwitch = activeTab !== tab;
    if (needsTabSwitch) setActiveTab(tab);
    const delay = needsTabSwitch ? 400 : 100;
    setTimeout(() => {
      const chartRefs = getChartRefs(tab);
      const scrollRef = getScrollRef(tab);
      const viewNode  = chartRefs.current[chartId];
      if (!viewNode || !scrollRef.current) return;
      const scrollNode =
        (scrollRef.current as any).getNativeScrollRef?.() ??
        (scrollRef.current as any)._nativeRef;
      if (!scrollNode) return;
      (viewNode as any).measureLayout(
        scrollNode,
        (_x: number, y: number) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - SP.lg), animated: true });
        },
        () => {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      );
    }, delay);
  };

  const locationLabel =
    selectedLocations.includes('All Locations') || selectedLocations.length === 0
      ? 'All Location'
      : selectedLocations.length === 1
      ? selectedLocations[0]
      : `${selectedLocations.length} Locations`;

  const dateLabel =
    dateRange.to && dateRange.to !== dateRange.from
      ? `${dateRange.from} – ${dateRange.to}`
      : dateRange.from || 'Select Date';

  // Navigate to AI Chat screen
  const handleAIChatPress = () => {
    router.push('/Screens/aichat' as any);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.topArea}>
        <Header onHamburger={() => setDrawerVisible(true)} />
        <TabBar active={activeTab} onTabChange={setActiveTab} />
        <FilterRow
          dateLabel={dateLabel}
          locationLabel={locationLabel}
          onDatePress={() => setDateModalVisible(true)}
          onLocationPress={() => setLocationModalVisible(true)}
        />
      </View>

      {activeTab === 'Overview' && (
        <OverviewTab
          onSalesVolumePress={() => setSalesVolumeModalVisible(true)}
          scrollRef={overviewScrollRef}
          chartViewRefs={overviewChartRefs}
          selectedCharts={selectedCharts}
        />
      )}
      {activeTab === 'Performance' && (
        <PerformanceTab
          scrollRef={perfScrollRef}
          selectedCharts={selectedCharts}
          chartViewRefs={perfChartRefs}
        />
      )}
      {activeTab === 'Food' && (
        <FoodTab
          scrollRef={foodScrollRef}
          selectedCharts={selectedCharts}
          chartViewRefs={foodChartRefs}
        />
      )}
      {activeTab === 'Customers' && (
        <CustomersTab
          scrollRef={customersScrollRef}
          chartViewRefs={customersChartRefs}
          selectedCharts={selectedCharts}
        />
      )}

      {/* ── AI Chat FAB ── always on top of all tabs */}
      <AIChatFAB onPress={handleAIChatPress} />

      <LocationModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        selected={selectedLocations}
        onConfirm={(sel) => setSelectedLocations(sel)}
      />
      <DateRangeModal
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        dateRange={dateRange}
        onConfirm={(range) => setDateRange(range)}
      />
      <SalesVolumeModal
        visible={salesVolumeModalVisible}
        onClose={() => setSalesVolumeModalVisible(false)}
      />

      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setDrawerVisible(false); }}
        selectedCharts={selectedCharts}
        onToggleSelect={handleToggleSelect}
        onScrollToChart={handleScrollToChart}
      />
    </View>
  );
}

// ── Global styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:             { flex: 1, backgroundColor: '#fff' },
  topArea:            { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: SP.xxs, shadowOffset: { width: 0, height: sw(2) } },

  // Header
  headerContainer:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.lg, paddingTop: isTablet ? sw(14) : sh(30), paddingBottom: isTablet ? SP.md : SP.sm, backgroundColor: '#fff' },
  hamburger:          { width: HEADER_SIDE_W, gap: sw(5) },
  hamLine:            { width: SZ.hamLineW, height: SZ.hamLineH, backgroundColor: '#1A1A2E', borderRadius: sw(1) },
  headerTitle:        { flex: 1, textAlign: 'center', fontSize: FS.xl, fontWeight: '700', color: '#000' },
  avatarRing:         { width: HEADER_SIDE_W, height: HEADER_SIDE_W, borderRadius: HEADER_SIDE_W / 2, borderWidth: sw(2), borderColor: '#2F6FE4', padding: sw(2), alignSelf: 'flex-end' },
  avatar:             { width: '100%', height: '100%', borderRadius: BR.pill, backgroundColor: '#D9D9D9' },

  // Tab bar
  tabBarWrapper:      { flexDirection: 'row', alignItems: 'stretch', marginHorizontal: SP.lg, marginBottom: SP.md, backgroundColor: '#E7F0FB', borderRadius: BR.md, padding: SP.xxs },
  tabItem:            { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SP.sm, borderRadius: BR.md },
  activeTab:          { backgroundColor: '#2F6FE4' },
  activeTabText:      { color: '#fff', fontWeight: '600' },
  tabText:            { fontSize: FS.sm, fontWeight: '500', color: '#3A3A3A', textAlign: 'center' },

  // Filter row
  filterRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingVertical: SP.md, backgroundColor: '#fff' },
  filterPill:         { flexDirection: 'row', alignItems: 'center', gap: SP.xs, backgroundColor: '#fff', borderRadius: sw(20), paddingHorizontal: SP.md, paddingVertical: sw(7), borderWidth: 1, borderColor: '#E5E5E5', maxWidth: (CARD_WIDTH - SP.md) / 2 },
  filterText:         { fontSize: FS.xs, fontWeight: '500', color: '#333', flexShrink: 1 },

  // Scroll content
  scrollContent:      { padding: SP.lg, gap: SP.lg },

  // KPI
  kpiOuterCard:       { backgroundColor: '#fff', borderRadius: BR.xl, padding: SP.lg, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: SP.sm, shadowOffset: { width: 0, height: sw(2) }, elevation: 3 },
  kpiGrid:            { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SP.md },
  kpiInnerCard:       { borderRadius: BR.lg, padding: SP.md, minHeight: sh(isTablet ? 150 : 130) },
  kpiIconBadgeRow:    { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.md },
  kpiIconBox:         { width: SZ.iconBox, height: SZ.iconBox, backgroundColor: 'rgba(255,255,255,0.80)', borderRadius: BR.sm, justifyContent: 'center', alignItems: 'center' },
  kpiBadge:           { fontSize: FS.xs, fontWeight: '700', color: '#333' },
  kpiLabel:           { fontSize: FS.sm, fontWeight: '500', color: 'rgba(0,0,0,0.70)', marginBottom: sw(2) },
  kpiValue:           { fontSize: FS.kpi, fontWeight: '700', color: '#1A1A2E', marginBottom: SP.xs },
  kpiSubRow:          { flexDirection: 'row', alignItems: 'center', gap: SP.xxs },
  kpiSub:             { fontSize: FS.xxs, color: 'rgba(0,0,0,0.55)', fontWeight: '500', flexShrink: 1 },
  kpiMoreRow:         { alignItems: 'flex-end', marginTop: SP.md },
  moreBtn:            { flexDirection: 'row', alignItems: 'center', gap: SP.xxs, backgroundColor: '#fff', borderRadius: sw(10), paddingHorizontal: SZ.moreBtn.paddingH, paddingVertical: SZ.moreBtn.paddingV, borderWidth: 1, borderColor: '#E0E0E0', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: SP.xxs, shadowOffset: { width: 0, height: sw(2) }, elevation: 2 },
  moreBtnText:        { fontSize: FS.sm, color: '#000', fontWeight: '500' },

  // Section card
  sectionCard:        { backgroundColor: '#fff', borderRadius: BR.xl, padding: SP.lg, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: SP.sm, shadowOffset: { width: 0, height: sw(2) }, elevation: 3 },
  sectionTitle:       { fontSize: FS.md, fontWeight: '600', color: '#000', marginBottom: SP.md },
  cardHeaderRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.md },
  expandBtn:          { width: SZ.expandBtn, height: SZ.expandBtn, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: BR.xs },

  // Legend
  legendRow:          { flexDirection: 'row', gap: sw(14), marginBottom: SP.md },
  legendItem:         { flexDirection: 'row', alignItems: 'center', gap: SP.xxs },
  legendDot:          { width: SZ.legendDot, height: SZ.legendDot, borderRadius: sw(2) },
  legendText:         { fontSize: FS.xs, color: '#54555A' },

  // Distribution
  distributionBody:   { flexDirection: 'row', alignItems: 'center', gap: SP.lg },
  donutLegend:        { flex: 1, gap: SP.md },
  donutLegendItem:    { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  legendSquare:       { width: SZ.legendSquare, height: SZ.legendSquare, borderRadius: sw(2) },
  donutLegendText:    { fontSize: FS.sm, color: '#222' },

  // Performance
  axisLabel:          { fontSize: FS.xxs, color: '#54555A', textAlign: 'center' },
  perfRow:            { flexDirection: 'row', alignItems: 'center' },
  perfName:           { fontSize: FS.xs, color: '#54555A', textAlign: 'right' },
  perfTrack:          { height: sc(28, 20, 36), backgroundColor: 'rgba(180,180,180,0.15)', borderRadius: BR.xs, overflow: 'hidden' },
  perfFill:           { height: '100%', backgroundColor: 'rgba(0,98,170,0.60)', justifyContent: 'center', alignItems: 'flex-end', paddingRight: SP.xs, borderRadius: BR.xs },
  perfFillVal:        { fontSize: FS.xs, color: '#fff', fontWeight: '600' },
  perfAxisLine:       { height: 1, backgroundColor: '#E0E0E0', marginTop: SP.xxs },

  // Payment legend
  payLegendGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.sm },
  payLegendItem:      { flexDirection: 'row', alignItems: 'center', gap: SP.xxs, width: '45%' },
  payLegendDot:       { width: sc(11, 8, 14), height: sc(11, 8, 14), borderRadius: sw(2) },
  payLegendText:      { fontSize: FS.xs, color: '#54555A' },

  // Modals
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: SP.xl },
  modalCard:          { width: '100%', maxWidth: sw(420), backgroundColor: '#fff', borderRadius: sw(24), padding: SP.xl },
  modalTitle:         { fontSize: FS.lg, fontWeight: '700', color: '#000', marginBottom: SP.lg },
  confirmBtn:         { backgroundColor: '#4A87C6', borderRadius: sw(24), paddingVertical: sw(14), alignItems: 'center', marginTop: SP.lg },
  confirmBtnText:     { color: '#fff', fontSize: FS.md, fontWeight: '600' },
  closeBtn:           { width: SZ.closeBtn, height: SZ.closeBtn, justifyContent: 'center', alignItems: 'center' },
  modalOptionRow:     { flexDirection: 'row', alignItems: 'center', gap: sw(14), paddingVertical: sw(14), borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalOptionText:    { fontSize: FS.md, fontWeight: '600', color: '#000' },
  checkboxBox:        { width: SZ.checkbox, height: SZ.checkbox, borderRadius: BR.xs, borderWidth: sw(1.5), borderColor: '#999', justifyContent: 'center', alignItems: 'center' },
  checkboxBoxChecked: { backgroundColor: '#4A87C6', borderColor: '#4A87C6' },

  // Sales volume modal
  svLocRow:           { marginBottom: sw(14) },
  svLocHeader:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SP.xs },
  svLocName:          { fontSize: FS.sm, fontWeight: '600', color: '#333' },
  svLocValue:         { fontSize: FS.sm, fontWeight: '700', color: '#075EA7' },
  svTrack:            { height: sw(10), borderRadius: sw(5), backgroundColor: 'rgba(7,94,167,0.12)', overflow: 'hidden' },
  svFill:             { height: '100%', backgroundColor: '#075EA7', borderRadius: sw(5) },
});