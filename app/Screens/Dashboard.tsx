import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isTablet      = SCREEN_WIDTH >= 600;
const isSmall       = SCREEN_HEIGHT < 680;
const CARD_WIDTH    = SCREEN_WIDTH - 32;
const HEADER_SIDE_W = isTablet ? 46 : 40;

// ── drum-roll constants ────────────────────────────────────────────────────────
const ITEM_H   = 44;
const VISIBLE  = 5;
const PAD      = Math.floor(VISIBLE / 2);

// ── date helpers ──────────────────────────────────────────────────────────────
const toDateObj = (str: string): Date => {
  if (!str) return new Date();
  const [y, m, d] = str.split('/').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return isNaN(dt.getTime()) ? new Date() : dt;
};
const toDateStr = (d: Date) =>
  `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;

const daysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const YEAR_MIN = 1970;
const YEAR_MAX = new Date().getFullYear() + 10;
const YEARS    = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

type DateRange           = { from: string; to: string };
type CheckboxProps       = { checked: boolean };
type LocationModalProps  = { visible: boolean; onClose: () => void; selected: string[]; onConfirm: (s: string[]) => void };
type DateRangeModalProps = { visible: boolean; onClose: () => void; dateRange: DateRange; onConfirm: (r: DateRange) => void };
type SalesVolumeModalProps = { visible: boolean; onClose: () => void };
type FilterRowProps      = { dateLabel: string; locationLabel: string; onDatePress: () => void; onLocationPress: () => void };
type KPICardsProps       = { onSalesVolumePress: () => void };

// ─── Drum-roll column ─────────────────────────────────────────────────────────
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
  const padded = [...Array(PAD).fill(null), ...items, ...Array(PAD).fill(null)] as (T | null)[];
  const idx    = items.indexOf(selected);

  React.useEffect(() => {
    if (idx >= 0) {
      const timer = setTimeout(() => {
        ref.current?.scrollToIndex({
          index: idx + PAD,
          animated: false,
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selected, idx]);

  const snapToIndex = (offsetY: number) => {
    const rawIdx     = Math.round(offsetY / ITEM_H);
    const clampedRaw = Math.max(PAD, Math.min(rawIdx, PAD + items.length - 1));
    const itemIdx    = clampedRaw - PAD;

    ref.current?.scrollToIndex({
      index: clampedRaw,
      animated: true,
    });

    if (itemIdx >= 0 && itemIdx < items.length) {
      onSelect(items[itemIdx]);
    }
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    snapToIndex(e.nativeEvent.contentOffset.y);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    snapToIndex(e.nativeEvent.contentOffset.y);
  };

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      <View pointerEvents="none" style={drumStyles.highlight} />
      <FlatList
        ref={ref}
        data={padded}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onScrollEnd}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        initialScrollIndex={Math.max(0, idx + PAD)}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise<void>((resolve) => setTimeout(resolve, 100));
          wait.then(() => {
            ref.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          });
        }}
        renderItem={({ item, index }) => {
          const itemIdx  = index - PAD;
          const isCenter = item !== null && items[itemIdx] === selected;
          const dist     = Math.abs(itemIdx - idx);
          const opacity  = item === null ? 0 : dist === 0 ? 1 : dist === 1 ? 0.55 : 0.25;
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
                <Text style={[drumStyles.drumText, isCenter && drumStyles.drumTextSelected, { opacity }]}>
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
    position:          'absolute',
    top:               ITEM_H * PAD,
    left:              6,
    right:             6,
    height:            ITEM_H,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor:       'rgba(0,0,0,0.18)',
    borderRadius:      4,
    zIndex:            10,
  },
  drumText: {
    fontSize:   isTablet ? 20 : 18,
    color:      '#888',
    fontWeight: '400',
  },
  drumTextSelected: {
    fontSize:   isTablet ? 22 : 20,
    color:      '#000',
    fontWeight: '500',
  },
});

// ─── Date Range Modal ─────────────────────────────────────────────────────────
const DateRangeModal = ({ visible, onClose, dateRange, onConfirm }: DateRangeModalProps) => {
  const [picking, setPicking] = useState<'from' | 'to'>('from');

  const initFrom = toDateObj(dateRange.from);
  const initTo   = toDateObj(dateRange.to || dateRange.from);

  const [fromMonth, setFromMonth] = useState(initFrom.getMonth());
  const [fromDay,   setFromDay  ] = useState(initFrom.getDate());
  const [fromYear,  setFromYear ] = useState(initFrom.getFullYear());
  const [toMonth,   setToMonth  ] = useState(initTo.getMonth());
  const [toDay,     setToDay    ] = useState(initTo.getDate());
  const [toYear,    setToYear   ] = useState(initTo.getFullYear());

  React.useEffect(() => {
    if (visible) {
      const f = toDateObj(dateRange.from);
      const t = toDateObj(dateRange.to || dateRange.from);
      setPicking('from');
      setFromMonth(f.getMonth()); setFromDay(f.getDate()); setFromYear(f.getFullYear());
      setToMonth(t.getMonth());   setToDay(t.getDate());   setToYear(t.getFullYear());
    }
  }, [visible]);

  const clampDay = (day: number, month: number, year: number) => {
    const max = daysInMonth(year, month);
    return Math.min(day, max);
  };

  const month = picking === 'from' ? fromMonth : toMonth;
  const day   = picking === 'from' ? fromDay   : toDay;
  const year  = picking === 'from' ? fromYear  : toYear;

  const setMonth = (m: number) => {
    if (picking === 'from') { setFromMonth(m); setFromDay(clampDay(fromDay, m, fromYear)); }
    else                    { setToMonth(m);   setToDay(clampDay(toDay, m, toYear)); }
  };
  const setDay = (d: number) => {
    if (picking === 'from') setFromDay(d); else setToDay(d);
  };
  const setYear = (y: number) => {
    if (picking === 'from') { setFromYear(y); setFromDay(clampDay(fromDay, fromMonth, y)); }
    else                    { setToYear(y);   setToDay(clampDay(toDay, toMonth, y)); }
  };

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  const fromStr = toDateStr(new Date(fromYear, fromMonth, fromDay));
  const toStr   = toDateStr(new Date(toYear,   toMonth,   toDay));

  const handleConfirm = () => { onConfirm({ from: fromStr, to: toStr }); onClose(); };

  const TOTAL_W = Math.min(SCREEN_WIDTH - 40, 340);
  const INNER_W = TOTAL_W - 32;
  const MONTH_W = Math.round(INNER_W * 0.44);
  const DAY_W   = Math.round(INNER_W * 0.18);
  const YEAR_W  = INNER_W - MONTH_W - DAY_W - 8;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[drStyles.card, { width: TOTAL_W }]}>

              <Text style={drStyles.title}>Pick a date</Text>
              <View style={drStyles.divider} />

              <View style={drStyles.tabRow}>
                {(['from','to'] as const).map(tab => (
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
                  selected={MONTHS[month]}
                  onSelect={v => setMonth(MONTHS.indexOf(v as string))}
                  width={MONTH_W}
                />
                <DrumColumn
                  key={`day-${picking}-${month}-${year}`}
                  items={days}
                  selected={day}
                  onSelect={v => setDay(v as number)}
                  width={DAY_W}
                />
                <DrumColumn
                  key={`year-${picking}`}
                  items={YEARS}
                  selected={year}
                  onSelect={v => setYear(v as number)}
                  width={YEAR_W}
                />
              </View>

              <View style={drStyles.divider} />

              <TouchableOpacity style={drStyles.confirmBtn} onPress={handleConfirm} activeOpacity={0.7}>
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
  card: {
    backgroundColor: '#F2F2F7',
    borderRadius:    16,
    overflow:        'hidden',
    alignSelf:       'center',
  },
  title: {
    textAlign:         'center',
    fontSize:          isTablet ? 17 : 15,
    fontWeight:        '500',
    color:             '#000',
    paddingTop:        16,
    paddingBottom:     12,
    paddingHorizontal: 20,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  tabRow: {
    flexDirection:   'row',
    margin:          12,
    backgroundColor: 'rgba(120,120,128,0.12)',
    borderRadius:    9,
    padding:         2,
  },
  tab: {
    flex:            1,
    paddingVertical: 7,
    borderRadius:    7,
    alignItems:      'center',
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor:     '#000',
    shadowOpacity:   0.12,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 1 },
    elevation:       2,
  },
  tabText: {
    fontSize:   isTablet ? 12 : 11,
    color:      'rgba(0,0,0,0.40)',
    fontWeight: '500',
  },
  tabTextActive: { color: '#000' },
  drumsRow: {
    flexDirection:     'row',
    justifyContent:    'center',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 16,
    paddingVertical:   8,
    backgroundColor:   '#fff',
  },
  confirmBtn: {
    paddingVertical: 16,
    alignItems:      'center',
  },
  confirmBtnText: {
    fontSize:   isTablet ? 18 : 17,
    color:      '#007AFF',
    fontWeight: '400',
  },
});

// ─── Header ───────────────────────────────────────────────────────────────────
const Header = () => (
  <View style={styles.headerContainer}>
    <TouchableOpacity style={styles.hamburger} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
      <View style={styles.hamLine} />
      <View style={styles.hamLine} />
      <View style={styles.hamLine} />
    </TouchableOpacity>
    <Text style={styles.headerTitle} numberOfLines={1}>Dashboard</Text>
    <View style={styles.avatarRing}>
      <Image source={{ uri:'https://randomuser.me/api/portraits/men/32.jpg' }} style={styles.avatar} />
    </View>
  </View>
);

// ─── Checkbox ─────────────────────────────────────────────────────────────────
const Checkbox = ({ checked }: CheckboxProps) => (
  <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
    {checked && (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    )}
  </View>
);

// ─── Location Modal ───────────────────────────────────────────────────────────
const LocationModal = ({ visible, onClose, selected, onConfirm }: LocationModalProps) => {
  const options = ['All Locations','Location 01','Location 02','Location 03'];
  const [tempSelected, setTempSelected] = useState<string[]>(selected);
  React.useEffect(() => { if (visible) setTempSelected(selected); }, [visible]);
  const toggle = (opt: string) => {
    if (opt === 'All Locations') { setTempSelected(['All Locations']); return; }
    let next = tempSelected.filter(s => s !== 'All Locations');
    next = next.includes(opt) ? next.filter(s => s !== opt) : [...next, opt];
    setTempSelected(next.length === 0 ? ['All Locations'] : next);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Location</Text>
              {options.map(opt => (
                <TouchableOpacity key={opt} style={styles.modalOptionRow} onPress={() => toggle(opt)} activeOpacity={0.7}>
                  <Checkbox checked={tempSelected.includes(opt)} />
                  <Text style={styles.modalOptionText}>{opt}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.confirmBtn} onPress={() => { onConfirm(tempSelected); onClose(); }}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ─── Sales Volume Modal ───────────────────────────────────────────────────────
const SalesVolumeModal = ({ visible, onClose }: SalesVolumeModalProps) => {
  const data = [
    { name:'Location 01', value:'150,240.00' },
    { name:'Location 02', value:'128,900.00' },
    { name:'Location 03', value:'98,344.00'  },
    { name:'Location 04', value:'79,300.00'  },
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
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path d="M6 6l12 12M18 6L6 18" stroke="#333" strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
              {data.map(d => {
                const raw   = parseFloat(d.value.replace(/,/g,''));
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

// ─── Sales Distribution Expanded ──────────────────────────────────────────────
const SalesDistributionExpanded = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const radius = isTablet ? 130 : 120, innerRadius = isTablet ? 80 : 74;
  const pieData = [
    { value:40, color:'#2E2855', text:'40%', textColor:'#fff', textSize:14, fontWeight:'bold' },
    { value:28, color:'#8AB4FF', text:'28%', textColor:'#fff', textSize:14, fontWeight:'bold' },
    { value:20, color:'#703DDE', text:'20%', textColor:'#fff', textSize:14, fontWeight:'bold' },
    { value:12, color:'#3F96D4', text:'12%', textColor:'#fff', textSize:14, fontWeight:'bold' },
  ];
  const tableData = [
    { color:'#2E2855', mode:'Dining',    pct:'40%', volume:'87,500' },
    { color:'#8AB4FF', mode:'Take Away', pct:'28%', volume:'62,500' },
    { color:'#703DDE', mode:'Pick Up',   pct:'20%', volume:'50,000' },
    { color:'#3F96D4', mode:'Delivery',  pct:'12%', volume:'25,000' },
  ];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={{ flex:1, backgroundColor:'#fff' }}>
        <View style={expStyles.header}>
          <TouchableOpacity onPress={onClose} style={expStyles.backBtn} activeOpacity={0.7}>
            <Svg width={28} height={28} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={expStyles.title}>{'Sales Distribution\nBy Order Modes'}</Text>
          <View style={{ width:44 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={expStyles.scrollContent}>
          <View style={expStyles.chartWrapper}>
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
          </View>
          <View style={expStyles.divider} />
          <View style={expStyles.tableHeader}>
            <Text style={[expStyles.tableHeadText, { flex:2 }]}>Mode</Text>
            <Text style={[expStyles.tableHeadText, { flex:1.5, textAlign:'center' }]}>Percentage</Text>
            <Text style={[expStyles.tableHeadText, { flex:1.5, textAlign:'right' }]}>Volume</Text>
          </View>
          {tableData.map((row, i) => (
            <View key={i} style={expStyles.tableRow}>
              <View style={[expStyles.modeCell, { flex:2 }]}>
                <View style={[expStyles.modeDot, { backgroundColor:row.color }]} />
                <Text style={expStyles.tableText}>{row.mode}</Text>
              </View>
              <Text style={[expStyles.tableText, { flex:1.5, textAlign:'center' }]}>{row.pct}</Text>
              <Text style={[expStyles.tableText, { flex:1.5, textAlign:'right' }]}>{row.volume}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const expStyles = StyleSheet.create({
  header:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:isTablet?20:44, paddingBottom:12 },
  backBtn:       { width:44, height:44, justifyContent:'center', alignItems:'flex-start' },
  title:         { fontSize:isTablet?24:20, fontWeight:'500', color:'#000', textAlign:'center', lineHeight:isTablet?34:28 },
  scrollContent: { paddingBottom:40, alignItems:'center' },
  chartWrapper:  { marginTop:24, marginBottom:32, alignItems:'center' },
  divider:       { width:SCREEN_WIDTH-32, height:1, backgroundColor:'rgba(0,0,0,0.15)', marginBottom:20 },
  tableHeader:   { flexDirection:'row', paddingHorizontal:24, marginBottom:16, width:'100%' },
  tableHeadText: { fontSize:isTablet?17:15, fontWeight:'700', color:'#000' },
  tableRow:      { flexDirection:'row', alignItems:'center', paddingHorizontal:24, paddingVertical:14, width:'100%', borderBottomWidth:1, borderBottomColor:'rgba(0,0,0,0.06)' },
  modeCell:      { flexDirection:'row', alignItems:'center', gap:10 },
  modeDot:       { width:14, height:14, borderRadius:3 },
  tableText:     { fontSize:isTablet?16:15, fontWeight:'500', color:'#000' },
});

// ─── Top Performance Expanded ─────────────────────────────────────────────────
const TopPerformanceExpanded = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const restaurants = [
    { name:'Crimson Chopsticks', total:709, breakdown:{ takeAway:130, dining:155, pickUp:230, delivery:194 } },
    { name:'Basil & Barrel',     total:620, breakdown:{ takeAway:180, dining:125, pickUp:200, delivery:115 } },
    { name:'The Olive Grove',    total:583, breakdown:{ takeAway:150, dining:140, pickUp:170, delivery:123 } },
    { name:'The Golden Wok',     total:425, breakdown:{ takeAway:110, dining:100, pickUp:120, delivery:95  } },
  ];
  const MAX_TOTAL = 800, axisVals = [0,200,400,600,800];
  const LABEL_W = 110, GAP = 8, TRACK_W = SCREEN_WIDTH - 32 - LABEL_W - GAP;
  const ORDER_MODES = ['Take Away','Dining','Pick Up','Delivery'];
  const BAR_CHART_H = 160, Y_LABEL_W = 36;
  const getArr = (b: typeof restaurants[0]['breakdown']) => [b.takeAway, b.dining, b.pickUp, b.delivery];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={{ flex:1, backgroundColor:'#fff' }}>
        <View style={topExpStyles.header}>
          <TouchableOpacity onPress={onClose} style={topExpStyles.backBtn} activeOpacity={0.7}>
            <Svg width={28} height={28} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={topExpStyles.title}>Top Performance</Text>
          <View style={{ width:44 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:16, paddingBottom:40 }}>
          <View style={topExpStyles.sectionCard}>
            <Text style={topExpStyles.sectionLabel}>Overall Ranking</Text>
            <View style={{ flexDirection:'row', marginLeft:LABEL_W+GAP, marginBottom:6 }}>
              {axisVals.map(v => (
                <Text key={v} style={[topExpStyles.axisLabel, { width:TRACK_W/(axisVals.length-1), textAlign:'center' }]}>{v}</Text>
              ))}
            </View>
            {restaurants.map((r, i) => {
              const fillW = (r.total / MAX_TOTAL) * TRACK_W;
              return (
                <View key={i} style={[topExpStyles.perfRow, { gap:GAP, marginBottom:10 }]}>
                  <Text style={[topExpStyles.perfName, { width:LABEL_W }]} numberOfLines={2}>{r.name}</Text>
                  <View style={[topExpStyles.perfTrack, { width:TRACK_W }]}>
                    {axisVals.slice(1).map(v => (
                      <View key={v} style={{ position:'absolute', left:(v/MAX_TOTAL)*TRACK_W, top:0, bottom:0, width:1, backgroundColor:'#E0E0E0' }} />
                    ))}
                    <View style={[topExpStyles.perfFill, { width:fillW }]}>
                      <Text style={topExpStyles.perfFillVal}>{r.total}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={[topExpStyles.perfAxisLine, { marginLeft:LABEL_W+GAP }]} />
          </View>
          {restaurants.map((r, ri) => {
            const vals   = getArr(r.breakdown);
            const maxVal = Math.max(...vals);
            const yMax   = Math.ceil(maxVal / 50) * 50;
            const noOfSec = yMax / 50;
            const yLabels = Array.from({ length:noOfSec+1 }, (_, i) => yMax - i * 50);
            return (
              <View key={ri}>
                <View style={topExpStyles.divider} />
                <Text style={topExpStyles.restaurantName}>{r.name}</Text>
                <View style={{ flexDirection:'row', alignItems:'flex-start' }}>
                  <View style={{ width:Y_LABEL_W, alignItems:'flex-end', marginRight:8 }}>
                    <View style={{ height:BAR_CHART_H, justifyContent:'space-between' }}>
                      {yLabels.map((v, i) => <Text key={i} style={topExpStyles.yLabel}>{v}</Text>)}
                    </View>
                    <View style={{ height:28 }} />
                  </View>
                  <View style={{ flex:1 }}>
                    <View style={{ height:BAR_CHART_H, position:'relative' }}>
                      {yLabels.map((_, i) => (
                        <View key={i} style={{ position:'absolute', top:(BAR_CHART_H/noOfSec)*i, left:0, right:0, height:1, backgroundColor:i===noOfSec?'#E0E0E0':'#F0F0F0' }} />
                      ))}
                      <View style={{ flexDirection:'row', height:'100%', alignItems:'flex-end', paddingHorizontal:4, gap:8 }}>
                        {vals.map((val, vi) => {
                          const barH = (val / yMax) * BAR_CHART_H;
                          return (
                            <View key={vi} style={{ flex:1, alignItems:'center' }}>
                              <Text style={topExpStyles.barTopVal}>{val}</Text>
                              <View style={{ width:'80%', height:barH, backgroundColor:'#69A0C8', borderRadius:4 }} />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    <View style={{ flexDirection:'row', paddingHorizontal:4, gap:8, marginTop:6 }}>
                      {ORDER_MODES.map((m, mi) => (
                        <Text key={mi} style={[topExpStyles.xLabel, { flex:1 }]} numberOfLines={2} adjustsFontSizeToFit>{m}</Text>
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
  header:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:isTablet?20:44, paddingBottom:12, backgroundColor:'#fff' },
  backBtn:        { width:44, height:44, justifyContent:'center', alignItems:'flex-start' },
  title:          { fontSize:isTablet?24:20, fontWeight:'500', color:'#000', textAlign:'center' },
  sectionCard:    { backgroundColor:'#fff', borderRadius:12, paddingVertical:12, marginBottom:4 },
  sectionLabel:   { fontSize:isTablet?15:13, fontWeight:'600', color:'#54555A', marginBottom:10 },
  axisLabel:      { fontSize:isTablet?11:9, color:'#54555A', textAlign:'center' },
  perfRow:        { flexDirection:'row', alignItems:'center' },
  perfName:       { fontSize:isTablet?12:11, color:'#54555A', textAlign:'right' },
  perfTrack:      { height:isTablet?34:28, backgroundColor:'rgba(180,180,180,0.15)', borderRadius:4, overflow:'hidden' },
  perfFill:       { height:'100%', backgroundColor:'rgba(0,98,170,0.60)', justifyContent:'center', alignItems:'flex-end', paddingRight:6, borderRadius:4 },
  perfFillVal:    { fontSize:isTablet?12:11, color:'#fff', fontWeight:'600' },
  perfAxisLine:   { height:1, backgroundColor:'#E0E0E0', marginTop:4 },
  divider:        { height:1, backgroundColor:'rgba(0,0,0,0.15)', marginVertical:16 },
  restaurantName: { fontSize:isTablet?17:15, fontWeight:'600', color:'#000', marginBottom:12 },
  yLabel:         { fontSize:isTablet?11:9, color:'#54555A', textAlign:'right' },
  barTopVal:      { fontSize:isTablet?11:9, color:'#333', fontWeight:'500', marginBottom:2, textAlign:'center' },
  xLabel:         { fontSize:isTablet?11:9, color:'#54555A', textAlign:'center', lineHeight:13 },
});

// ─── Performance Tab ──────────────────────────────────────────────────────────
const PerformanceTab = () => {
  const stockAlerts = [
    { name:'Chicken breast', remaining:'3.2 kg remaining',   level:'Critical' },
    { name:'Tomato puree',   remaining:'6.5 kg remaining',   level:'Low'      },
    { name:'Cooking oil',    remaining:'4 liters remaining', level:'Low'      },
    { name:'Chicken breast', remaining:'3.2 kg remaining',   level:'Low'      },
    { name:'Chicken breast', remaining:'3.2 kg remaining',   level:'Low'      },
  ];
  return (
    <ScrollView
      style={{ flex:1, backgroundColor:'#fff' }}
      contentContainerStyle={{ padding:16, gap:16, paddingBottom:40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={perfStyles.warningBanner}>
        <Text style={perfStyles.warningText}>
          <Text style={perfStyles.warningLabel}>Warning: </Text>
          <Text style={perfStyles.warningBody}>Chicken stock is low (Less than 5kg)</Text>
        </Text>
      </View>
      <View style={perfStyles.card}>
        <Text style={perfStyles.cardTitle}>Live Operations</Text>
        <View style={perfStyles.liveOpRow}>
          <View style={perfStyles.liveOpLeft}>
            <View style={perfStyles.liveOpIconBox}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path d="M6 2h12v6a6 6 0 01-12 0V2z" stroke="#000" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M6 8H4a2 2 0 000 4h2M18 8h2a2 2 0 010 4h-2" stroke="#000" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                <Path d="M8 22h8M12 14v8" stroke="#000" strokeWidth={1.5} fill="none" strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={perfStyles.liveOpLabel}>In Kitchen Preparing</Text>
          </View>
          <Text style={perfStyles.liveOpValue}>12</Text>
        </View>
        <View style={[perfStyles.liveOpRow, { marginBottom:0 }]}>
          <View style={perfStyles.liveOpLeft}>
            <View style={perfStyles.liveOpIconBox}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
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
      <View style={perfStyles.card}>
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
              <View style={[perfStyles.badge, item.level==='Critical' ? perfStyles.badgeCritical : perfStyles.badgeLow]}>
                <Text style={perfStyles.badgeText}>{item.level}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const perfStyles = StyleSheet.create({
  warningBanner:  { backgroundColor:'rgba(250,167,158,0.60)', borderRadius:8, paddingHorizontal:12, paddingVertical:8 },
  warningText:    { fontSize:13, lineHeight:20 },
  warningLabel:   { color:'#FF0202', fontWeight:'700', fontSize:13 },
  warningBody:    { color:'#000', fontWeight:'500', fontSize:13 },
  card:           { backgroundColor:'#fff', borderRadius:20, padding:16, shadowColor:'#000', shadowOpacity:0.12, shadowRadius:10, shadowOffset:{ width:0, height:0 }, elevation:4 },
  cardTitle:      { fontSize:isTablet?17:15, fontWeight:'500', color:'#000', marginBottom:14 },
  liveOpRow:      { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(97,145,185,0.22)', borderRadius:10, paddingHorizontal:14, paddingVertical:12, marginBottom:12, minHeight:80, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{ width:0, height:2 }, elevation:2 },
  liveOpLeft:     { flex:1, justifyContent:'space-between', alignSelf:'stretch' },
  liveOpIconBox:  { width:36, height:36, backgroundColor:'#fff', borderRadius:8, justifyContent:'center', alignItems:'center', marginBottom:4 },
  liveOpLabel:    { fontSize:isTablet?14:13, fontWeight:'500', color:'#000' },
  liveOpValue:    { fontSize:isTablet?30:26, fontWeight:'500', color:'#000', textAlign:'right', alignSelf:'center', marginLeft:8 },
  rowDivider:     { height:1, backgroundColor:'rgba(0,0,0,0.12)', marginVertical:6 },
  stockRow:       { flexDirection:'row', alignItems:'center', paddingVertical:8 },
  stockImgBox:    { width:42, height:42, backgroundColor:'#D9D9D9', borderRadius:10 },
  stockInfo:      { flex:1, marginLeft:14 },
  stockName:      { fontSize:isTablet?15:14, fontWeight:'400', color:'#000' },
  stockRemaining: { fontSize:isTablet?13:12, fontWeight:'400', color:'#555', marginTop:2 },
  badge:          { paddingHorizontal:10, paddingVertical:3, borderRadius:6, minWidth:62, alignItems:'center' },
  badgeCritical:  { backgroundColor:'#F69B9B' },
  badgeLow:       { backgroundColor:'rgba(230,164,107,0.53)' },
  badgeText:      { fontSize:12, fontWeight:'400', color:'#000' },
});

// ─── Food Tab ─────────────────────────────────────────────────────────────────
const FoodTab = () => {
  const items = [
    { name:'Chicken Submarine' },
    { name:'Mango Juice' },
    { name:'Water Bottle' },
    { name:'Chicken Pasta' },
    { name:'Fish Noodles' },
  ];
  const [selectedItem,     setSelectedItem    ] = useState('Chicken Submarine');
  const [expandedVisible,  setExpandedVisible ] = useState(false);

  const chartDataByItem: Record<string, { day: string; value: number }[]> = {
    'Chicken Submarine': [
      { day:'Mon', value:120 },{ day:'Tue', value:200 },{ day:'Wed', value:150 },
      { day:'Thu', value:80  },{ day:'Fri', value:70  },{ day:'Sat', value:110 },{ day:'Sun', value:130 },
    ],
    'Mango Juice': [
      { day:'Mon', value:90  },{ day:'Tue', value:140 },{ day:'Wed', value:100 },
      { day:'Thu', value:60  },{ day:'Fri', value:130 },{ day:'Sat', value:150 },{ day:'Sun', value:95  },
    ],
    'Water Bottle': [
      { day:'Mon', value:60  },{ day:'Tue', value:80  },{ day:'Wed', value:70  },
      { day:'Thu', value:90  },{ day:'Fri', value:100 },{ day:'Sat', value:120 },{ day:'Sun', value:85  },
    ],
    'Chicken Pasta': [
      { day:'Mon', value:100 },{ day:'Tue', value:130 },{ day:'Wed', value:160 },
      { day:'Thu', value:110 },{ day:'Fri', value:95  },{ day:'Sat', value:140 },{ day:'Sun', value:105 },
    ],
    'Fish Noodles': [
      { day:'Mon', value:70  },{ day:'Tue', value:95  },{ day:'Wed', value:120 },
      { day:'Thu', value:65  },{ day:'Fri', value:88  },{ day:'Sat', value:100 },{ day:'Sun', value:75  },
    ],
  };

  const chartData    = chartDataByItem[selectedItem] || chartDataByItem['Chicken Submarine'];
  const barWidth     = isTablet ? 32 : 26;
  const spacing      = isTablet ? 26 : 20;
  const chartHeight  = isTablet ? 320 : 260;
  const maxValue     = 200;
  const noOfSections = 4;

  const barData = chartData.map(d => ({
    value: d.value,
    label: d.day,
    frontColor: '#AAC3D9',
    topLabelComponent: () => (
      <Text style={{ fontSize:isTablet?12:10, color:'#333', marginBottom:4 }}>{d.value}</Text>
    ),
  }));

  const chartWidth  = chartData.length * (barWidth + spacing) + 20;
  const yAxisLabels = Array.from({ length:noOfSections+1 }, (_, i) => Math.round((maxValue/noOfSections)*(noOfSections-i)));
  const yLabelFs    = isTablet ? 11 : 10;
  const xLabelAreaH = 24;

  return (
    <ScrollView
      style={{ flex:1, backgroundColor:'#fff' }}
      contentContainerStyle={{ padding:16, gap:16, paddingBottom:40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={foodStyles.card}>
        <Text style={foodStyles.cardTitle}>Top Selling Items</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom:16 }}
          contentContainerStyle={{ gap:12, paddingRight:8 }}
        >
          {items.map(item => {
            const isSel = selectedItem === item.name;
            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => setSelectedItem(item.name)}
                style={[foodStyles.chip, { backgroundColor:isSel ? 'rgba(0,98,170,0.56)' : 'rgba(97,145,185,0.54)' }]}
                activeOpacity={0.7}
              >
                <Text style={foodStyles.chipText}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection:'row', alignItems:'flex-start' }}>
          <View style={{ width:32, marginRight:4, alignItems:'flex-end' }}>
            <View style={{ height:chartHeight, justifyContent:'space-between' }}>
              {yAxisLabels.map((val, i) => (
                <Text key={i} style={{ fontSize:yLabelFs, color:'#54555A', lineHeight:yLabelFs+2 }}>{val}</Text>
              ))}
            </View>
            <View style={{ height:xLabelAreaH }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flex:1 }}>
            <BarChart
              data={barData}
              maxValue={maxValue}
              noOfSections={noOfSections}
              barWidth={barWidth}
              spacing={spacing}
              barBorderRadius={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color:'transparent', fontSize:1 }}
              yAxisLabelWidth={0}
              xAxisThickness={1}
              xAxisColor="#E0E0E0"
              xAxisLabelTextStyle={{ color:'#54555A', fontSize:isTablet?12:10, textAlign:'center' }}
              isAnimated
              animationDuration={800}
              rulesType="solid"
              rulesColor="#F0F0F0"
              height={chartHeight}
              width={chartWidth}
              initialSpacing={12}
              endSpacing={12}
              disableScroll
            />
          </ScrollView>
        </View>
        <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:8 }}>
          <TouchableOpacity style={foodStyles.expandIconBtn} onPress={() => setExpandedVisible(true)}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>
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
  card:          { backgroundColor:'#fff', borderRadius:30, padding:16, shadowColor:'#000', shadowOpacity:0.25, shadowRadius:10, shadowOffset:{ width:0, height:0 }, elevation:4 },
  cardTitle:     { fontSize:isTablet?17:16, fontWeight:'500', color:'#000', marginBottom:14, marginLeft:4 },
  chip:          { borderRadius:5, paddingHorizontal:14, paddingVertical:10, minWidth:123, alignItems:'center', justifyContent:'center' },
  chipText:      { fontSize:12, fontWeight:'500', color:'#000' },
  expandIconBtn: { width:26, height:26, justifyContent:'center', alignItems:'center', backgroundColor:'#fff', borderRadius:4, borderWidth:1, borderColor:'rgba(0,0,0,0.20)', shadowColor:'#000', shadowOpacity:0.10, shadowRadius:6, shadowOffset:{ width:0, height:2 }, elevation:2 },
});

// ─── Food Item Expanded ───────────────────────────────────────────────────────
const FoodItemExpanded = ({
  visible, onClose, selectedItem, chartData,
}: {
  visible: boolean; onClose: () => void; selectedItem: string; chartData: { day: string; value: number }[];
}) => {
  const barWidth    = isTablet ? 40 : 32;
  const spacing     = isTablet ? 34 : 26;
  const chartHeight = isTablet ? 380 : 300;
  const maxValue    = 200, noOfSections = 4;

  const barData = chartData.map(d => ({
    value: d.value,
    label: d.day,
    frontColor: '#AAC3D9',
    topLabelComponent: () => (
      <Text style={{ fontSize:isTablet?13:11, color:'#333', marginBottom:4 }}>{d.value}</Text>
    ),
  }));

  const chartWidth  = chartData.length * (barWidth + spacing) + 20;
  const yAxisLabels = Array.from({ length:noOfSections+1 }, (_, i) => Math.round((maxValue/noOfSections)*(noOfSections-i)));
  const yLabelFs    = isTablet ? 12 : 10;
  const xLabelAreaH = 24;
  const totalSales  = chartData.reduce((s, d) => s + d.value, 0);
  const avgSales    = Math.round(totalSales / chartData.length);
  const peakDay     = chartData.reduce((max, d) => d.value > max.value ? d : max, chartData[0]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={{ flex:1, backgroundColor:'#fff' }}>
        <View style={foodExpStyles.header}>
          <TouchableOpacity onPress={onClose} style={foodExpStyles.backBtn} activeOpacity={0.7}>
            <Svg width={28} height={28} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={foodExpStyles.title} numberOfLines={2}>{selectedItem}</Text>
          <View style={{ width:44 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:16, paddingBottom:40 }}>
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
          <View style={{ flexDirection:'row', alignItems:'flex-start', marginTop:24 }}>
            <View style={{ width:36, marginRight:4, alignItems:'flex-end' }}>
              <View style={{ height:chartHeight, justifyContent:'space-between' }}>
                {yAxisLabels.map((val, i) => (
                  <Text key={i} style={{ fontSize:yLabelFs, color:'#54555A', lineHeight:yLabelFs+2 }}>{val}</Text>
                ))}
              </View>
              <View style={{ height:xLabelAreaH }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flex:1 }}>
              <BarChart
                data={barData}
                maxValue={maxValue}
                noOfSections={noOfSections}
                barWidth={barWidth}
                spacing={spacing}
                barBorderRadius={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color:'transparent', fontSize:1 }}
                yAxisLabelWidth={0}
                xAxisThickness={1}
                xAxisColor="#E0E0E0"
                xAxisLabelTextStyle={{ color:'#54555A', fontSize:isTablet?13:11, textAlign:'center' }}
                isAnimated
                animationDuration={800}
                rulesType="solid"
                rulesColor="#F0F0F0"
                height={chartHeight}
                width={chartWidth}
                initialSpacing={12}
                endSpacing={12}
                disableScroll
              />
            </ScrollView>
          </View>
          <View style={foodExpStyles.divider} />
          <View style={foodExpStyles.tableHeader}>
            <Text style={[foodExpStyles.tableHeadText, { flex:1 }]}>Day</Text>
            <Text style={[foodExpStyles.tableHeadText, { flex:1, textAlign:'right' }]}>Units Sold</Text>
          </View>
          {chartData.map((row, i) => (
            <View key={i} style={foodExpStyles.tableRow}>
              <Text style={[foodExpStyles.tableText, { flex:1 }]}>{row.day}</Text>
              <Text style={[foodExpStyles.tableText, { flex:1, textAlign:'right' }]}>{row.value}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const foodExpStyles = StyleSheet.create({
  header:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:isTablet?20:44, paddingBottom:12, backgroundColor:'#fff' },
  backBtn:       { width:44, height:44, justifyContent:'center', alignItems:'flex-start' },
  title:         { flex:1, fontSize:isTablet?22:18, fontWeight:'500', color:'#000', textAlign:'center' },
  summaryRow:    { flexDirection:'row', gap:10, marginTop:8 },
  summaryCard:   { flex:1, backgroundColor:'rgba(97,145,185,0.18)', borderRadius:12, padding:14, alignItems:'center' },
  summaryLabel:  { fontSize:isTablet?13:11, color:'#54555A', fontWeight:'500', marginBottom:6 },
  summaryValue:  { fontSize:isTablet?20:17, color:'#000', fontWeight:'700' },
  divider:       { height:1, backgroundColor:'rgba(0,0,0,0.15)', marginVertical:20 },
  tableHeader:   { flexDirection:'row', marginBottom:12 },
  tableHeadText: { fontSize:isTablet?15:14, fontWeight:'700', color:'#000' },
  tableRow:      { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'rgba(0,0,0,0.06)' },
  tableText:     { fontSize:isTablet?14:13, fontWeight:'500', color:'#000' },
});

// ─── Filter Row ───────────────────────────────────────────────────────────────
const FilterRow = ({ dateLabel, locationLabel, onDatePress, onLocationPress }: FilterRowProps) => (
  <View style={styles.filterRow}>
    <TouchableOpacity style={styles.filterPill} onPress={onDatePress}>
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Rect x={3} y={4} width={18} height={18} rx={2} stroke="#333" strokeWidth={1.5} fill="none" />
        <Line x1={3} y1={9} x2={21} y2={9} stroke="#333" strokeWidth={1.5} />
        <Line x1={8} y1={2} x2={8} y2={6} stroke="#333" strokeWidth={1.5} />
        <Line x1={16} y1={2} x2={16} y2={6} stroke="#333" strokeWidth={1.5} />
      </Svg>
      <Text style={styles.filterText} numberOfLines={1}>{dateLabel}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.filterPill} onPress={onLocationPress}>
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Circle cx={12} cy={10} r={3} stroke="#333" strokeWidth={1.5} fill="none" />
        <Path d="M12 2C8 2 5 5.5 5 10c0 5.25 7 12 7 12s7-6.75 7-12c0-4.5-3-8-7-8z" stroke="#333" strokeWidth={1.5} fill="none" />
      </Svg>
      <Text style={styles.filterText} numberOfLines={1}>{locationLabel}</Text>
      <Svg width={12} height={12} viewBox="0 0 24 24">
        <Path d="M6 9l6 6 6-6" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  </View>
);

// ─── KPI Cards ────────────────────────────────────────────────────────────────
const KPICards = ({ onSalesVolumePress }: KPICardsProps) => {
  const [showMore, setShowMore] = useState(false);
  const innerCardW = (CARD_WIDTH - 32 - 10) / 2;

  const ArrowUp = () => (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M7 17L17 7M17 7H7M17 7v10" stroke="#333" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
  const BillingIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Rect x={2} y={5} width={20} height={14} rx={2} stroke="#333" strokeWidth={1.5} fill="none" />
      <Line x1={2} y1={10} x2={22} y2={10} stroke="#333" strokeWidth={1.5} />
      <Rect x={5} y={14} width={4} height={2} rx={0.5} fill="#333" />
    </Svg>
  );

  const mainCards = [
    { bg:'rgba(7,94,167,0.22)',   icon:(<Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M3 3h18v4H3zM3 9h8v4H3zM3 15h8v4H3z" stroke="#333" strokeWidth={1.5} fill="none"/><Path d="M14 12l4 4 4-4" stroke="#333" strokeWidth={1.5} fill="none"/><Line x1={18} y1={8} x2={18} y2={16} stroke="#333" strokeWidth={1.5}/></Svg>), label:'Sales Volume',      value:'456,784.00', sub:'+14.2% from Yesterday', badge:null as string|null, showArrow:true,  pressable:true  },
    { bg:'rgba(98,145,185,0.18)', icon:(<Svg width={20} height={20} viewBox="0 0 24 24"><Rect x={5} y={2} width={14} height={20} rx={2} stroke="#333" strokeWidth={1.5} fill="none"/><Line x1={9} y1={7} x2={15} y2={7} stroke="#333" strokeWidth={1.5}/><Line x1={9} y1={11} x2={15} y2={11} stroke="#333" strokeWidth={1.5}/><Line x1={9} y1={15} x2={12} y2={15} stroke="#333" strokeWidth={1.5}/></Svg>), label:'Total Orders',      value:'734',         sub:'+22 new today',         badge:null as string|null, showArrow:true,  pressable:false },
    { bg:'rgba(98,145,185,0.18)', icon:(<Svg width={20} height={20} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={9} stroke="#333" strokeWidth={1.5} fill="none"/><Line x1={8} y1={16} x2={16} y2={8} stroke="#333" strokeWidth={1.5}/><Circle cx={9} cy={9} r={1} fill="#333"/><Circle cx={15} cy={15} r={1} fill="#333"/></Svg>), label:'Discount Volume',   value:'46,784.00',   sub:'10.2% of gross sales',  badge:null as string|null, showArrow:true,  pressable:false },
    { bg:'rgba(98,145,185,0.18)', icon:<BillingIcon/>, label:'Billing - STANDARD', value:'452,217.00', sub:null as string|null, badge:null as string|null, showArrow:false, pressable:false },
  ];
  const extraCards = [
    { bg:'rgba(98,145,185,0.18)', icon:<BillingIcon/>, label:'Billing - COST',         value:'4,567.00',   sub:null as string|null, badge:null as string|null, showArrow:false, pressable:false },
    { bg:'rgba(98,145,185,0.18)', icon:<BillingIcon/>, label:'Billing - Complementry', value:'5,784.00',   sub:null as string|null, badge:null as string|null, showArrow:false, pressable:false },
    { bg:'rgba(98,145,185,0.18)', icon:<BillingIcon/>, label:'Service Charge',         value:'456,784.00', sub:null as string|null, badge:null as string|null, showArrow:false, pressable:false },
    { bg:'rgba(98,145,185,0.18)', icon:<BillingIcon/>, label:'VAT TDL And NBT',        value:'456,784.00', sub:null as string|null, badge:null as string|null, showArrow:false, pressable:false },
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
              style={[styles.kpiInnerCard, { width:innerCardW, backgroundColor:c.bg }]}
              {...(c.pressable ? { onPress:onSalesVolumePress, activeOpacity:0.7 } : {})}
            >
              <View style={styles.kpiIconBadgeRow}>
                <View style={styles.kpiIconBox}>{c.icon}</View>
                {c.badge ? <Text style={styles.kpiBadge}>{c.badge}</Text> : null}
              </View>
              <Text style={styles.kpiLabel}>{c.label}</Text>
              <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{c.value}</Text>
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
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowMore(p => !p)}>
          <Text style={styles.moreBtnText}>{showMore ? 'Less' : 'More'}</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d={showMore ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
              stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Sales Volume Chart ───────────────────────────────────────────────────────
const SalesVolumeChart = () => {
  const barWidth   = isTablet ? 18 : 14;
  const spacing    = isTablet ? 20 : 16;
  const barSpacing = 3;
  const groupW     = 3 * barWidth + 2 * barSpacing + spacing;
  const chartWidth = 7 * groupW + 40;
  const chartHeight = isTablet ? 260 : isSmall ? 180 : 220;
  const maxValue    = 130, noOfSections = 4;

  const mk = (value: number, frontColor: string, label?: string, isLast?: boolean) => ({
    value, frontColor, barWidth, roundedTop: true as const,
    spacing: isLast ? spacing : barSpacing, ...(label ? { label } : {}),
  });

  const barData = [
    mk(120,'#075EA7','06/05'), mk(45,'rgba(98,145,185,0.9)'), mk(16,'#3C3C41',undefined,true),
    mk(68,'#075EA7','06/07'),  mk(82,'rgba(98,145,185,0.9)'), mk(21,'#3C3C41',undefined,true),
    mk(101,'#075EA7','06/08'),mk(78,'rgba(98,145,185,0.9)'),  mk(82,'#3C3C41',undefined,true),
    mk(104,'#075EA7','06/09'),mk(23,'rgba(98,145,185,0.9)'),  mk(51,'#3C3C41',undefined,true),
    mk(44,'#075EA7','06/10'), mk(114,'rgba(98,145,185,0.9)'), mk(41,'#3C3C41',undefined,true),
    mk(88,'#075EA7','06/11'), mk(51,'rgba(98,145,185,0.9)'),  mk(92,'#3C3C41',undefined,true),
    mk(25,'#075EA7','06/12'), mk(51,'rgba(98,145,185,0.9)'),  mk(90,'#3C3C41',undefined,true),
  ];

  const legendItems = [
    { color:'#075EA7',              label:'Dine In'   },
    { color:'rgba(98,145,185,0.9)', label:'Take Away' },
    { color:'#3C3C41',              label:'Delivery'  },
  ];

  const yAxisLabels = Array.from({ length:noOfSections+1 }, (_, i) => Math.round((maxValue/noOfSections)*(noOfSections-i)));
  const yLabelFs    = isTablet ? 11 : 9;
  const xLabelAreaH = 24;

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Sales Volume (Order Mode Wise)</Text>
      <View style={styles.legendRow}>
        {legendItems.map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor:l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection:'row', alignItems:'flex-start' }}>
        <View style={{ width:32, marginRight:4, alignItems:'flex-end' }}>
          <View style={{ height:chartHeight, justifyContent:'space-between' }}>
            {yAxisLabels.map((val, i) => (
              <Text key={i} style={{ fontSize:yLabelFs, color:'#54555A', lineHeight:yLabelFs+2 }}>{val}</Text>
            ))}
          </View>
          <View style={{ height:xLabelAreaH }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flex:1 }}>
          <BarChart
            data={barData}
            maxValue={maxValue}
            noOfSections={noOfSections}
            barBorderRadius={4}
            yAxisThickness={0}
            yAxisTextStyle={{ color:'transparent', fontSize:1 }}
            yAxisLabelWidth={0}
            xAxisThickness={1}
            xAxisColor="#E0E0E0"
            xAxisLabelTextStyle={{ color:'#54555A', fontSize:isTablet?11:9, width:44, textAlign:'center' }}
            isAnimated
            animationDuration={800}
            rulesType="solid"
            rulesColor="#F0F0F0"
            height={chartHeight}
            width={chartWidth}
            initialSpacing={12}
            endSpacing={12}
            showGradient={false}
            disableScroll
          />
        </ScrollView>
      </View>
    </View>
  );
};

// ─── Sales Distribution Card ──────────────────────────────────────────────────
const SalesDistributionCard = () => {
  const [expandedVisible, setExpandedVisible] = useState(false);
  const radius      = isTablet ? 95 : isSmall ? 65 : 80;
  const innerRadius = isTablet ? 58 : isSmall ? 38 : 48;
  const pieData = [
    { value:40, color:'#2E2855', text:'40%', textColor:'#fff', textSize:isTablet?13:11, fontWeight:'bold' },
    { value:28, color:'#8AB4FF', text:'28%', textColor:'#fff', textSize:isTablet?13:11, fontWeight:'bold' },
    { value:20, color:'#703DDE', text:'20%', textColor:'#fff', textSize:isTablet?13:11, fontWeight:'bold' },
    { value:12, color:'#3F96D4', text:'12%', textColor:'#fff', textSize:isTablet?13:11, fontWeight:'bold' },
  ];
  const legend = [
    { color:'#2E2855', label:'Dining'    },
    { color:'#8AB4FF', label:'Take Away' },
    { color:'#703DDE', label:'Pick Up'   },
    { color:'#3F96D4', label:'Delivery'  },
  ];
  return (
    <>
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionTitle, { flex:1, marginRight:8, marginBottom:0 }]}>Sales Distribution By Order Modes</Text>
          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpandedVisible(true)}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
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
            {legend.map(l => (
              <View key={l.label} style={styles.donutLegendItem}>
                <View style={[styles.legendSquare, { backgroundColor:l.color }]} />
                <Text style={styles.donutLegendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <SalesDistributionExpanded visible={expandedVisible} onClose={() => setExpandedVisible(false)} />
    </>
  );
};

// ─── Top Performance Card ─────────────────────────────────────────────────────
const TopPerformanceCard = () => {
  const [expandedVisible, setExpandedVisible] = useState(false);
  const LABEL_W = isTablet ? 130 : 100, GAP = 8, TRACK_W = CARD_WIDTH - 32 - LABEL_W - GAP;
  const MAX = 800, axisVals = [0,200,400,600,800];
  const data = [
    { name:'Crimson\nChopsticks', value:709 },
    { name:'Basil & Barrel',      value:620 },
    { name:'The Olive Grove',     value:583 },
    { name:'The Golden Wok',      value:425 },
  ];
  return (
    <>
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionTitle}>Top Performance</Text>
          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpandedVisible(true)}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection:'row', marginLeft:LABEL_W+GAP, marginBottom:6 }}>
          {axisVals.map(v => (
            <Text key={v} style={[styles.axisLabel, { width:TRACK_W/(axisVals.length-1), textAlign:'center' }]}>{v}</Text>
          ))}
        </View>
        {data.map((d, i) => {
          const fillW = (d.value / MAX) * TRACK_W;
          return (
            <View key={i} style={[styles.perfRow, { gap:GAP, marginBottom:10 }]}>
              <Text style={[styles.perfName, { width:LABEL_W }]} numberOfLines={2}>{d.name}</Text>
              <View style={[styles.perfTrack, { width:TRACK_W }]}>
                {axisVals.slice(1).map(v => (
                  <View key={v} style={{ position:'absolute', left:(v/MAX)*TRACK_W, top:0, bottom:0, width:1, backgroundColor:'#E0E0E0' }} />
                ))}
                <View style={[styles.perfFill, { width:fillW }]}>
                  <Text style={styles.perfFillVal}>{d.value}</Text>
                </View>
              </View>
            </View>
          );
        })}
        <View style={[styles.perfAxisLine, { marginLeft:LABEL_W+GAP }]} />
      </View>
      <TopPerformanceExpanded visible={expandedVisible} onClose={() => setExpandedVisible(false)} />
    </>
  );
};

// ─── Payment Type Card ────────────────────────────────────────────────────────
const PaymentTypeCard = () => {
  const radius      = isTablet ? 110 : 90;
  const innerRadius = isTablet ? 65  : 54;
  const pieData = [
    { value:40, color:'#006BD6' },
    { value:30, color:'#537FF1' },
    { value:15, color:'#FF6F5A' },
    { value:10, color:'#3CC3DF' },
    { value:3,  color:'#FF1301' },
    { value:2,  color:'#5A4DC0' },
  ];
  const legend: { color: string; label: string }[] = [
    { color:'#5A4DC0', label:'GIFT VOUCHER' },
    { color:'#FF1301', label:'CREDIT'       },
    { color:'#3CC3DF', label:'CASH'         },
    { color:'#FF6F5A', label:'AMEX CARD'    },
    { color:'#537FF1', label:'MASTER CARD'  },
    { color:'#006BD6', label:'VISA CARD'    },
  ];
  return (
    <View style={styles.sectionCard}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.sectionTitle}>Payment Type</Text>
        <TouchableOpacity style={styles.expandBtn}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>
      <View style={{ alignItems:'center', marginVertical:8 }}>
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
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:isTablet?13:11, color:'#54555A', fontWeight:'600' }}>Payment</Text>
              <Text style={{ fontSize:isTablet?11:9,  color:'#999' }}>Types</Text>
            </View>
          )}
        />
      </View>
      <View style={styles.payLegendGrid}>
        {legend.map(item => (
          <View key={item.label} style={styles.payLegendItem}>
            <View style={[styles.payLegendDot, { backgroundColor:item.color }]} />
            <Text style={styles.payLegendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Monthly Sales Trend ──────────────────────────────────────────────────────
const MonthlySalesTrend = () => {
  const chartH   = isTablet ? 220 : isSmall ? 130 : 170;
  const pointW   = isTablet ? 60  : 50;
  const maxValue = 160000, noOfSections = 4;

  const lineData = [
    { value:90000,  label:'Jan' }, { value:55000,  label:'Feb' }, { value:130000, label:'Mar' },
    { value:70000,  label:'Apr' }, { value:110000, label:'May' }, { value:145000, label:'Jun' },
    { value:85000,  label:'Jul' }, { value:60000,  label:'Aug' }, { value:100000, label:'Sep' },
    { value:120000, label:'Oct' }, { value:40000,  label:'Nov' }, { value:150000, label:'Dec' },
  ];

  const chartWidth  = lineData.length * pointW;
  const yAxisLabels = Array.from({ length:noOfSections+1 }, (_, i) => Math.round((maxValue/noOfSections)*(noOfSections-i)/1000));
  const yLabelFs    = isTablet ? 11 : 9;
  const xLabelAreaH = 24;

  return (
    <View style={[styles.sectionCard, { paddingBottom:12 }]}>
      <Text style={styles.sectionTitle}>Monthly Sales Trend</Text>
      <View style={{ flexDirection:'row', alignItems:'flex-start' }}>
        <View style={{ width:36, marginRight:4, alignItems:'flex-end' }}>
          <View style={{ height:chartH, justifyContent:'space-between' }}>
            {yAxisLabels.map((val, i) => (
              <Text key={i} style={{ fontSize:yLabelFs, color:'#54555A', lineHeight:yLabelFs+2 }}>{val}K</Text>
            ))}
          </View>
          <View style={{ height:xLabelAreaH }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flex:1 }}>
          <LineChart
            data={lineData}
            width={chartWidth}
            height={chartH}
            maxValue={maxValue}
            noOfSections={noOfSections}
            areaChart
            curved
            color="#5D51A9"
            thickness={2.5}
            startFillColor="rgba(137,121,255,0.5)"
            endFillColor="rgba(137,121,255,0.02)"
            startOpacity={0.8}
            endOpacity={0.1}
            initialSpacing={16}
            endSpacing={16}
            spacing={pointW}
            dataPointsColor="#5D51A9"
            dataPointsRadius={4}
            yAxisColor="transparent"
            xAxisColor="#E0E0E0"
            yAxisThickness={0}
            yAxisTextStyle={{ color:'transparent', fontSize:1 }}
            yAxisLabelWidth={0}
            xAxisLabelTextStyle={{ color:'#54555A', fontSize:isTablet?11:9 }}
            rulesType="solid"
            rulesColor="#F0F0F0"
            isAnimated
            animationDuration={1000}
            focusEnabled
            showStripOnFocus
            stripColor="rgba(93,81,169,0.2)"
            stripWidth={2}
            unFocusOnPressOut
            disableScroll
          />
        </ScrollView>
      </View>
    </View>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────
const OverviewTab = ({ onSalesVolumePress }: { onSalesVolumePress: () => void }) => (
  <ScrollView style={{ flex:1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    <KPICards onSalesVolumePress={onSalesVolumePress} />
    <SalesVolumeChart />
    <SalesDistributionCard />
    <TopPerformanceCard />
    <PaymentTypeCard />
    <MonthlySalesTrend />
    <View style={{ height:40 }} />
  </ScrollView>
);

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating = ({ rating }: { rating: number }) => {
  const fullStars  = Math.floor(rating);
  const hasHalf    = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  const starColor  = 'rgba(171,119,60,0.79)';
  const starSize   = isTablet ? 16 : 14;

  const FilledStar = () => (
    <Svg width={starSize} height={starSize} viewBox="0 0 24 24">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={starColor} stroke={starColor} strokeWidth={1} />
    </Svg>
  );
  const HalfStar = () => (
    <Svg width={starSize} height={starSize} viewBox="0 0 24 24">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke={starColor} strokeWidth={1.5} />
      <Path d="M12 2v15.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={starColor} />
    </Svg>
  );
  const EmptyStar = () => (
    <Svg width={starSize} height={starSize} viewBox="0 0 24 24">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke={starColor} strokeWidth={1.5} />
    </Svg>
  );

  return (
    <View style={{ flexDirection:'row', gap:2 }}>
      {Array.from({ length:fullStars  }).map((_, i) => <FilledStar key={`f${i}`} />)}
      {hasHalf && <HalfStar />}
      {Array.from({ length:emptyStars }).map((_, i) => <EmptyStar  key={`e${i}`} />)}
    </View>
  );
};

// ─── Review Bar Chart ─────────────────────────────────────────────────────────
const ReviewBarChart = ({ data }: { data: { star: number; count: number }[] }) => {
  const MAX_COUNT = 200;
  const TRACK_W   = CARD_WIDTH - 32 - 56 - 36 - 12;
  const BAR_H     = isTablet ? 14 : 12;
  const ROW_GAP   = isTablet ? 10 : 8;

  return (
    <View style={{ gap:ROW_GAP }}>
      {data.map(row => {
        const fillW = Math.max(4, (row.count / MAX_COUNT) * TRACK_W);
        return (
          <View key={row.star} style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <Text style={custStyles.chartStarLabel}>{row.star}</Text>
            <View style={[custStyles.chartTrack, { width:TRACK_W }]}>
              <View style={[custStyles.chartFill, { width:fillW, height:BAR_H }]} />
            </View>
            <Text style={custStyles.chartCountLabel}>{row.count}</Text>
          </View>
        );
      })}
      <View style={{ flexDirection:'row', marginLeft:18, width:TRACK_W, justifyContent:'space-between' }}>
        {[0,50,100,150,200].map(v => <Text key={v} style={custStyles.chartXLabel}>{v}</Text>)}
      </View>
    </View>
  );
};

// ─── Restaurant Review Card ───────────────────────────────────────────────────
const RestaurantReviewCard = ({
  name, rating, reviewCount, barData, isLast,
}: {
  name: string; rating: number; reviewCount: number; barData: { star: number; count: number }[]; isLast?: boolean;
}) => (
  <View>
    <Text style={custStyles.restaurantName}>{name}</Text>
    <View style={{ flexDirection:'row', alignItems:'flex-start', gap:12, marginTop:8 }}>
      <View style={{ alignItems:'flex-start', width:80 }}>
        <Text style={custStyles.bigRating}>{rating.toFixed(1)}</Text>
        <StarRating rating={rating} />
        <Text style={custStyles.reviewCount}>{reviewCount.toLocaleString()} Reviews</Text>
      </View>
      <View style={{ flex:1 }}>
        <ReviewBarChart data={barData} />
      </View>
    </View>
    {!isLast && <View style={custStyles.sectionDivider} />}
  </View>
);

// ─── Review Item ──────────────────────────────────────────────────────────────
const ReviewItem = ({
  name, timeAgo, restaurant, text, isLast,
}: {
  name: string; timeAgo: string; restaurant: string; text: string; isLast?: boolean;
}) => (
  <View style={[custStyles.reviewCard, isLast && { marginBottom:0 }]}>
    <View style={custStyles.reviewAvatar} />
    <View style={{ flex:1 }}>
      <Text style={custStyles.reviewerName}>{name}</Text>
      <Text style={custStyles.reviewMeta}>{timeAgo} · {restaurant}</Text>
      <View style={custStyles.reviewDivider} />
      <Text style={custStyles.reviewText}>{text}</Text>
    </View>
  </View>
);

// ─── Customers Tab ────────────────────────────────────────────────────────────
const CustomersTab = () => {
  const restaurants = [
    { name:'Crimson Chopsticks', rating:4.6, reviewCount:1254, barData:[{star:5,count:117},{star:4,count:150},{star:3,count:76},{star:2,count:42},{star:1,count:11}] },
    { name:'Basil & Barrel',     rating:4.5, reviewCount:1254, barData:[{star:5,count:117},{star:4,count:150},{star:3,count:76},{star:2,count:42},{star:1,count:11}] },
    { name:'The Olive Grove',    rating:4.2, reviewCount:1254, barData:[{star:5,count:117},{star:4,count:150},{star:3,count:76},{star:2,count:42},{star:1,count:11}] },
  ];
  const reviews = [
    { name:'Sanduni Perera', timeAgo:'2 days ago', restaurant:'The Olive Grove', text:'Service was fast and the chicken biryani tasted amazing. Will definitely order again.' },
    { name:'Sanduni Perera', timeAgo:'2 days ago', restaurant:'The Olive Grove', text:'Service was fast and the chicken biryani tasted amazing. Will definitely order again.' },
  ];
  return (
    <ScrollView style={{ flex:1, backgroundColor:'#fff' }} contentContainerStyle={{ padding:16, gap:16, paddingBottom:40 }} showsVerticalScrollIndicator={false}>
      <View style={custStyles.reviewsCard}>
        <View style={custStyles.reviewsCardHeader}>
          <Text style={custStyles.reviewsCardHeaderText}>Customers Reviews</Text>
        </View>
        <View style={{ padding:16 }}>
          {restaurants.map((r, i) => (
            <RestaurantReviewCard
              key={r.name}
              name={r.name}
              rating={r.rating}
              reviewCount={r.reviewCount}
              barData={[...r.barData].reverse()}
              isLast={i === restaurants.length - 1}
            />
          ))}
        </View>
      </View>
      {reviews.map((rev, i) => (
        <ReviewItem
          key={i}
          name={rev.name}
          timeAgo={rev.timeAgo}
          restaurant={rev.restaurant}
          text={rev.text}
          isLast={i === reviews.length - 1}
        />
      ))}
    </ScrollView>
  );
};

const custStyles = StyleSheet.create({
  reviewsCard:           { backgroundColor:'#fff', borderRadius:20, overflow:'hidden', shadowColor:'#000', shadowOpacity:0.15, shadowRadius:10, shadowOffset:{width:0,height:0}, elevation:4 },
  reviewsCardHeader:     { backgroundColor:'rgba(97,145,185,0.34)', paddingHorizontal:16, paddingVertical:14 },
  reviewsCardHeaderText: { fontSize:isTablet?17:15, fontWeight:'500', color:'#000' },
  restaurantName:        { fontSize:isTablet?15:14, fontWeight:'400', color:'#000', marginTop:8 },
  bigRating:             { fontSize:isTablet?40:34, fontWeight:'400', color:'#000', lineHeight:isTablet?46:40, marginBottom:4 },
  reviewCount:           { fontSize:isTablet?13:11, color:'rgba(0,0,0,0.50)', marginTop:4 },
  sectionDivider:        { height:1, backgroundColor:'rgba(0,0,0,0.10)', marginVertical:14 },
  chartStarLabel:        { fontSize:isTablet?12:11, color:'#54555A', width:12, textAlign:'right' },
  chartTrack:            { height:isTablet?14:12, backgroundColor:'rgba(180,180,180,0.18)', borderRadius:2, overflow:'hidden' },
  chartFill:             { backgroundColor:'#AAC3D9', borderRadius:2 },
  chartCountLabel:       { fontSize:isTablet?11:10, color:'#54555A', width:24, textAlign:'right' },
  chartXLabel:           { fontSize:isTablet?10:9, color:'#54555A', textAlign:'center' },
  reviewCard:            { flexDirection:'row', backgroundColor:'#fff', borderRadius:20, padding:16, gap:12, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:10, shadowOffset:{width:0,height:0}, elevation:4 },
  reviewAvatar:          { width:isTablet?60:52, height:isTablet?60:52, borderRadius:10, backgroundColor:'#D9D9D9', flexShrink:0 },
  reviewerName:          { fontSize:isTablet?15:14, fontWeight:'700', color:'#000' },
  reviewMeta:            { fontSize:isTablet?13:12, fontWeight:'700', color:'rgba(0,0,0,0.50)', marginTop:2 },
  reviewDivider:         { height:1, backgroundColor:'rgba(0,0,0,0.25)', marginVertical:8 },
  reviewText:            { fontSize:isTablet?14:13, fontWeight:'300', color:'#000', lineHeight:isTablet?22:20 },
});

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
const TabBar = ({ active, onTabChange }: { active: string; onTabChange: (t: string) => void }) => {
  const tabs = ['Overview','Customers','Food','Performance'];
  return (
    <View style={styles.tabBarWrapper}>
      {tabs.map(tab => {
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

// ─── Root Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [activeTab,               setActiveTab              ] = useState('Overview');
  const [locationModalVisible,    setLocationModalVisible   ] = useState(false);
  const [dateModalVisible,        setDateModalVisible       ] = useState(false);
  const [salesVolumeModalVisible, setSalesVolumeModalVisible] = useState(false);
  const [selectedLocations,       setSelectedLocations      ] = useState<string[]>(['All Locations']);
  const [dateRange,               setDateRange              ] = useState<DateRange>({ from:'2026/06/12', to:'' });

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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.topArea}>
        <Header />
        <TabBar active={activeTab} onTabChange={setActiveTab} />
        <FilterRow
          dateLabel={dateLabel}
          locationLabel={locationLabel}
          onDatePress={() => setDateModalVisible(true)}
          onLocationPress={() => setLocationModalVisible(true)}
        />
      </View>

      {activeTab === 'Overview'     && <OverviewTab onSalesVolumePress={() => setSalesVolumeModalVisible(true)} />}
      {activeTab === 'Performance'  && <PerformanceTab />}
      {activeTab === 'Food'         && <FoodTab />}
      {activeTab === 'Customers'    && <CustomersTab />}

      <LocationModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        selected={selectedLocations}
        onConfirm={sel => setSelectedLocations(sel)}
      />
      <DateRangeModal
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        dateRange={dateRange}
        onConfirm={range => setDateRange(range)}
      />
      <SalesVolumeModal
        visible={salesVolumeModalVisible}
        onClose={() => setSalesVolumeModalVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:          { flex:1, backgroundColor:'#fff' },
  topArea:         { backgroundColor:'#fff', elevation:2, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:4, shadowOffset:{ width:0, height:2 } },
  headerContainer: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingTop:isTablet?14:30, paddingBottom:isTablet?12:8, backgroundColor:'#fff' },
  hamburger:       { width:HEADER_SIDE_W, gap:5 },
  hamLine:         { width:isTablet?22:20, height:2, backgroundColor:'#1A1A2E', borderRadius:1 },
  headerTitle:     { flex:1, textAlign:'center', fontSize:isTablet?24:isSmall?18:21, fontWeight:'700', color:'#000' },
  avatarRing:      { width:HEADER_SIDE_W, height:HEADER_SIDE_W, borderRadius:HEADER_SIDE_W/2, borderWidth:2, borderColor:'#2F6FE4', padding:2, alignSelf:'flex-end' },
  avatar:          { width:'100%', height:'100%', borderRadius:999, backgroundColor:'#D9D9D9' },
  tabBarWrapper:   { flexDirection:'row', alignItems:'stretch', marginHorizontal:16, marginBottom:10, backgroundColor:'#E7F0FB', borderRadius:10, padding:4 },
  tabItem:         { flex:1, justifyContent:'center', alignItems:'center', paddingVertical:8, borderRadius:8 },
  activeTab:       { backgroundColor:'#2F6FE4' },
  activeTabText:   { color:'#fff', fontWeight:'600' },
  tabText:         { fontSize:isTablet?14:12, fontWeight:'500', color:'#3A3A3A', textAlign:'center' },
  filterRow:       { flexDirection:'row', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:10, backgroundColor:'#fff' },
  filterPill:      { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#fff', borderRadius:20, paddingHorizontal:12, paddingVertical:7, borderWidth:1, borderColor:'#E5E5E5', maxWidth:(CARD_WIDTH-10)/2 },
  filterText:      { fontSize:isTablet?13:11, fontWeight:'500', color:'#333', flexShrink:1 },
  scrollContent:   { padding:16, gap:16 },
  kpiOuterCard:    { backgroundColor:'#fff', borderRadius:16, padding:16, shadowColor:'#000', shadowOpacity:0.10, shadowRadius:8, shadowOffset:{ width:0, height:2 }, elevation:3 },
  kpiGrid:         { flexDirection:'row', flexWrap:'wrap', gap:10 },
  kpiInnerCard:    { borderRadius:12, padding:12, minHeight:isTablet?150:130 },
  kpiIconBadgeRow: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 },
  kpiIconBox:      { width:isTablet?38:32, height:isTablet?38:32, backgroundColor:'rgba(255,255,255,0.80)', borderRadius:7, justifyContent:'center', alignItems:'center' },
  kpiBadge:        { fontSize:isTablet?12:10, fontWeight:'700', color:'#333' },
  kpiLabel:        { fontSize:isTablet?13:isSmall?11:12, fontWeight:'500', color:'rgba(0,0,0,0.70)', marginBottom:2 },
  kpiValue:        { fontSize:isTablet?22:isSmall?16:19, fontWeight:'700', color:'#1A1A2E', marginBottom:6 },
  kpiSubRow:       { flexDirection:'row', alignItems:'center', gap:4 },
  kpiSub:          { fontSize:isTablet?11:9, color:'rgba(0,0,0,0.55)', fontWeight:'500', flexShrink:1 },
  kpiMoreRow:      { alignItems:'flex-end', marginTop:10 },
  moreBtn:         { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#fff', borderRadius:10, paddingHorizontal:12, paddingVertical:5, borderWidth:1, borderColor:'#E0E0E0', shadowColor:'#000', shadowOpacity:0.10, shadowRadius:4, shadowOffset:{ width:0, height:2 }, elevation:2 },
  moreBtnText:     { fontSize:isTablet?13:12, color:'#000', fontWeight:'500' },
  sectionCard:     { backgroundColor:'#fff', borderRadius:16, padding:16, shadowColor:'#000', shadowOpacity:0.10, shadowRadius:8, shadowOffset:{ width:0, height:2 }, elevation:3 },
  sectionTitle:    { fontSize:isTablet?16:isSmall?13:14, fontWeight:'600', color:'#000', marginBottom:10 },
  cardHeaderRow:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  expandBtn:       { width:30, height:30, justifyContent:'center', alignItems:'center', backgroundColor:'#F0F0F0', borderRadius:6 },
  legendRow:       { flexDirection:'row', gap:14, marginBottom:10 },
  legendItem:      { flexDirection:'row', alignItems:'center', gap:4 },
  legendDot:       { width:10, height:10, borderRadius:2 },
  legendText:      { fontSize:isTablet?12:10, color:'#54555A' },
  distributionBody:{ flexDirection:'row', alignItems:'center', gap:16 },
  donutLegend:     { flex:1, gap:10 },
  donutLegendItem: { flexDirection:'row', alignItems:'center', gap:8 },
  legendSquare:    { width:isTablet?16:14, height:isTablet?16:14, borderRadius:2 },
  donutLegendText: { fontSize:isTablet?14:12, color:'#222' },
  axisLabel:       { fontSize:isTablet?12:10, color:'#54555A', textAlign:'center' },
  perfRow:         { flexDirection:'row', alignItems:'center' },
  perfName:        { fontSize:isTablet?13:11, color:'#54555A', textAlign:'right' },
  perfTrack:       { height:isTablet?34:28, backgroundColor:'rgba(180,180,180,0.15)', borderRadius:4, overflow:'hidden' },
  perfFill:        { height:'100%', backgroundColor:'rgba(0,98,170,0.60)', justifyContent:'center', alignItems:'flex-end', paddingRight:6, borderRadius:4 },
  perfFillVal:     { fontSize:isTablet?13:11, color:'#fff', fontWeight:'600' },
  perfAxisLine:    { height:1, backgroundColor:'#E0E0E0', marginTop:4 },
  payLegendGrid:   { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8 },
  payLegendItem:   { flexDirection:'row', alignItems:'center', gap:4, width:'45%' },
  payLegendDot:    { width:isTablet?13:11, height:isTablet?13:11, borderRadius:2 },
  payLegendText:   { fontSize:isTablet?13:11, color:'#54555A' },
  modalOverlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:20 },
  modalCard:       { width:'100%', maxWidth:420, backgroundColor:'#fff', borderRadius:24, padding:24 },
  modalTitle:      { fontSize:isTablet?20:17, fontWeight:'700', color:'#000', marginBottom:16 },
  confirmBtn:      { backgroundColor:'#4A87C6', borderRadius:24, paddingVertical:14, alignItems:'center', marginTop:18 },
  confirmBtnText:  { color:'#fff', fontSize:isTablet?16:15, fontWeight:'600' },
  closeBtn:        { width:28, height:28, justifyContent:'center', alignItems:'center' },
  modalOptionRow:  { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#EEE' },
  modalOptionText: { fontSize:isTablet?17:15, fontWeight:'600', color:'#000' },
  checkboxBox:        { width:24, height:24, borderRadius:5, borderWidth:1.5, borderColor:'#999', justifyContent:'center', alignItems:'center' },
  checkboxBoxChecked: { backgroundColor:'#4A87C6', borderColor:'#4A87C6' },
  svLocRow:        { marginBottom:14 },
  svLocHeader:     { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  svLocName:       { fontSize:isTablet?14:13, fontWeight:'600', color:'#333' },
  svLocValue:      { fontSize:isTablet?14:13, fontWeight:'700', color:'#075EA7' },
  svTrack:         { height:10, borderRadius:5, backgroundColor:'rgba(7,94,167,0.12)', overflow:'hidden' },
  svFill:          { height:'100%', backgroundColor:'#075EA7', borderRadius:5 },
});