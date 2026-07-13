import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
} from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 600;
const isSmall  = SCREEN_HEIGHT < 680;
const CARD_WIDTH = SCREEN_WIDTH - 32;
const HEADER_SIDE_W = isTablet ? 46 : 40;

// ─── Type Definitions ────────────────────────────────────────────────────────
type DateRange = {
  from: string;
  to: string;
};

type CheckboxProps = {
  checked: boolean;
};

type LocationModalProps = {
  visible: boolean;
  onClose: () => void;
  selected: string[];
  onConfirm: (selected: string[]) => void;
};

type DateRangeModalProps = {
  visible: boolean;
  onClose: () => void;
  dateRange: DateRange;
  onConfirm: (range: DateRange) => void;
};

type SalesVolumeModalProps = {
  visible: boolean;
  onClose: () => void;
};

type FilterRowProps = {
  dateLabel: string;
  locationLabel: string;
  onDatePress: () => void;
  onLocationPress: () => void;
};

type KPICardsProps = {
  onSalesVolumePress: () => void;
};

// ─── Header ───────────────────────────────────────────────────────────────────
const Header = () => (
  <View style={styles.headerContainer}>
    <TouchableOpacity
      style={styles.hamburger}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.hamLine} />
      <View style={styles.hamLine} />
      <View style={styles.hamLine} />
    </TouchableOpacity>

    <Text style={styles.headerTitle} numberOfLines={1}>
      Dashboard
    </Text>

    <View style={styles.avatarRing}>
      <Image
        source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
        style={styles.avatar}
      />
    </View>
  </View>
);

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
const TabBar = () => {
  const tabs = ['Overview', 'Customers', 'Food', 'Performance'];
  const [active, setActive] = useState<string>('Overview');

  return (
    <View style={styles.tabBarWrapper}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, isActive && styles.activeTab]}
            onPress={() => setActive(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Checkbox ─────────────────────────────────────────────────────────────────
const Checkbox = ({ checked }: CheckboxProps) => (
  <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
    {checked && (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path
          d="M5 13l4 4L19 7"
          stroke="#fff"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    )}
  </View>
);

// ─── Location Modal ───────────────────────────────────────────────────────────
const LocationModal = ({
  visible,
  onClose,
  selected,
  onConfirm,
}: LocationModalProps) => {
  const options = ['All Locations', 'Location 01', 'Location 02', 'Location 03'];
  const [tempSelected, setTempSelected] = useState<string[]>(selected);

  React.useEffect(() => {
    if (visible) setTempSelected(selected);
  }, [visible]);

  const toggle = (opt: string) => {
    if (opt === 'All Locations') {
      setTempSelected(['All Locations']);
    } else {
      let next = tempSelected.filter((s) => s !== 'All Locations');
      if (next.includes(opt)) {
        next = next.filter((s) => s !== opt);
      } else {
        next = [...next, opt];
      }
      if (next.length === 0) next = ['All Locations'];
      setTempSelected(next);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Location</Text>

              {options.map((opt) => {
                const isChecked = tempSelected.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={styles.modalOptionRow}
                    onPress={() => toggle(opt)}
                    activeOpacity={0.7}
                  >
                    <Checkbox checked={isChecked} />
                    <Text style={styles.modalOptionText}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => {
                  onConfirm(tempSelected);
                  onClose();
                }}
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

// ─── Calendar Icon ────────────────────────────────────────────────────────────
const CalendarIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Rect
      x={3} y={4} width={18} height={18} rx={2}
      stroke="#666" strokeWidth={1.5} fill="none"
    />
    <Line x1={3}  y1={9}  x2={21} y2={9}  stroke="#666" strokeWidth={1.5} />
    <Line x1={8}  y1={2}  x2={8}  y2={6}  stroke="#666" strokeWidth={1.5} />
    <Line x1={16} y1={2}  x2={16} y2={6}  stroke="#666" strokeWidth={1.5} />
  </Svg>
);

// ─── Date Range Modal ─────────────────────────────────────────────────────────
const DateRangeModal = ({
  visible,
  onClose,
  dateRange,
  onConfirm,
}: DateRangeModalProps) => {
  const [from, setFrom] = useState<string>(dateRange.from);
  const [to, setTo]     = useState<string>(dateRange.to);

  React.useEffect(() => {
    if (visible) {
      setFrom(dateRange.from);
      setTo(dateRange.to);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Transaction Date</Text>

              <View style={styles.dateInputRow}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="From:"
                  placeholderTextColor="#999"
                  value={from}
                  onChangeText={setFrom}
                />
                <View style={styles.dateIconBox}>
                  <CalendarIcon />
                </View>
              </View>

              <View style={styles.dateInputRow}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="To:"
                  placeholderTextColor="#999"
                  value={to}
                  onChangeText={setTo}
                />
                <View style={styles.dateIconBox}>
                  <CalendarIcon />
                </View>
              </View>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => {
                  onConfirm({ from, to });
                  onClose();
                }}
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

// ─── Sales Volume By Location Modal ──────────────────────────────────────────
const SalesVolumeModal = ({ visible, onClose }: SalesVolumeModalProps) => {
  const data = [
    { name: 'Location 01', value: '150,240.00', pct: 33 },
    { name: 'Location 02', value: '128,900.00', pct: 28 },
    { name: 'Location 03', value: '98,344.00',  pct: 22 },
    { name: 'Location 04', value: '79,300.00',  pct: 17 },
  ];
  const MAX = 150240;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.modalTitle}>Sales Volume by Location</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="#333"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </Svg>
                </TouchableOpacity>
              </View>

              {data.map((d) => {
                const rawValue = parseFloat(d.value.replace(/,/g, ''));
                const fillW = (rawValue / MAX) * (CARD_WIDTH * 0.62);
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

// ─── Filter Row ───────────────────────────────────────────────────────────────
const FilterRow = ({
  dateLabel,
  locationLabel,
  onDatePress,
  onLocationPress,
}: FilterRowProps) => (
  <View style={styles.filterRow}>
    <TouchableOpacity style={styles.filterPill} onPress={onDatePress}>
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Rect
          x={3} y={4} width={18} height={18} rx={2}
          stroke="#333" strokeWidth={1.5} fill="none"
        />
        <Line x1={3}  y1={9}  x2={21} y2={9}  stroke="#333" strokeWidth={1.5} />
        <Line x1={8}  y1={2}  x2={8}  y2={6}  stroke="#333" strokeWidth={1.5} />
        <Line x1={16} y1={2}  x2={16} y2={6}  stroke="#333" strokeWidth={1.5} />
      </Svg>
      <Text style={styles.filterText} numberOfLines={1}>{dateLabel}</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.filterPill} onPress={onLocationPress}>
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Circle cx={12} cy={10} r={3} stroke="#333" strokeWidth={1.5} fill="none" />
        <Path
          d="M12 2C8 2 5 5.5 5 10c0 5.25 7 12 7 12s7-6.75 7-12c0-4.5-3-8-7-8z"
          stroke="#333" strokeWidth={1.5} fill="none"
        />
      </Svg>
      <Text style={styles.filterText} numberOfLines={1}>{locationLabel}</Text>
      <Svg width={12} height={12} viewBox="0 0 24 24">
        <Path
          d="M6 9l6 6 6-6"
          stroke="#333" strokeWidth={2} fill="none"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  </View>
);

// ─── KPI Cards ────────────────────────────────────────────────────────────────
const KPICards = ({ onSalesVolumePress }: KPICardsProps) => {
  const [showMore, setShowMore] = useState<boolean>(false);
  const innerCardW = (CARD_WIDTH - 32 - 10) / 2;

  const ArrowUp = () => (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d="M7 17L17 7M17 7H7M17 7v10"
        stroke="#333" strokeWidth={2.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );

  const BillingIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Rect
        x={2} y={5} width={20} height={14} rx={2}
        stroke="#333" strokeWidth={1.5} fill="none"
      />
      <Line x1={2} y1={10} x2={22} y2={10} stroke="#333" strokeWidth={1.5} />
      <Rect x={5} y={14} width={4} height={2} rx={0.5} fill="#333" />
    </Svg>
  );

  const mainCards = [
    {
      bg: 'rgba(7,94,167,0.22)',
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path
            d="M3 3h18v4H3zM3 9h8v4H3zM3 15h8v4H3z"
            stroke="#333" strokeWidth={1.5} fill="none"
          />
          <Path d="M14 12l4 4 4-4" stroke="#333" strokeWidth={1.5} fill="none" />
          <Line x1={18} y1={8} x2={18} y2={16} stroke="#333" strokeWidth={1.5} />
        </Svg>
      ),
      label: 'Sales Volume',
      value: '456,784.00',
      sub: '+14.2% from Yesterday',
      badge: null as string | null,
      showArrow: true,
      pressable: true,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Rect
            x={5} y={2} width={14} height={20} rx={2}
            stroke="#333" strokeWidth={1.5} fill="none"
          />
          <Line x1={9} y1={7}  x2={15} y2={7}  stroke="#333" strokeWidth={1.5} />
          <Line x1={9} y1={11} x2={15} y2={11} stroke="#333" strokeWidth={1.5} />
          <Line x1={9} y1={15} x2={12} y2={15} stroke="#333" strokeWidth={1.5} />
        </Svg>
      ),
      label: 'Total Orders',
      value: '734',
      sub: '+22 new today',
      badge: null as string | null,
      showArrow: true,
      pressable: false,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} stroke="#333" strokeWidth={1.5} fill="none" />
          <Line x1={8} y1={16} x2={16} y2={8} stroke="#333" strokeWidth={1.5} />
          <Circle cx={9}  cy={9}  r={1} fill="#333" />
          <Circle cx={15} cy={15} r={1} fill="#333" />
        </Svg>
      ),
      label: 'Discount Volume',
      value: '46,784.00',
      sub: '10.2% of gross sales',
      badge: null as string | null,
      showArrow: true,
      pressable: false,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: <BillingIcon />,
      label: 'Billing - STANDARD',
      value: '452,217.00',
      sub: null as string | null,
      badge: null as string | null,
      showArrow: false,
      pressable: false,
    },
  ];

  const extraCards = [
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: <BillingIcon />,
      label: 'Billing - COST',
      value: '4,567.00',
      sub: null as string | null,
      badge: null as string | null,
      showArrow: false,
      pressable: false,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: <BillingIcon />,
      label: 'Billing - Complementry',
      value: '5,784.00',
      sub: null as string | null,
      badge: null as string | null,
      showArrow: false,
      pressable: false,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: <BillingIcon />,
      label: 'Service Charge',
      value: '456,784.00',
      sub: null as string | null,
      badge: null as string | null,
      showArrow: false,
      pressable: false,
    },
    {
      bg: 'rgba(98,145,185,0.18)',
      icon: <BillingIcon />,
      label: 'VAT TDL And NBT',
      value: '456,784.00',
      sub: null as string | null,
      badge: null as string | null,
      showArrow: false,
      pressable: false,
    },
  ];

  const visibleCards = showMore ? [...mainCards, ...extraCards] : mainCards;

  return (
    <View style={styles.kpiOuterCard}>
      <View style={styles.kpiGrid}>
        {visibleCards.map((c, i) => {
          const CardWrapper = c.pressable ? TouchableOpacity : View;
          return (
            <CardWrapper
              key={i}
              style={[
                styles.kpiInnerCard,
                { width: innerCardW, backgroundColor: c.bg },
              ]}
              {...(c.pressable
                ? { onPress: onSalesVolumePress, activeOpacity: 0.7 }
                : {})}
            >
              {/* Icon row with optional badge */}
              <View style={styles.kpiIconBadgeRow}>
                <View style={styles.kpiIconBox}>{c.icon}</View>
                {c.badge ? (
                  <Text style={styles.kpiBadge}>{c.badge}</Text>
                ) : null}
              </View>

              <Text style={styles.kpiLabel}>{c.label}</Text>
              <Text
                style={styles.kpiValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {c.value}
              </Text>
              {c.sub ? (
                <View style={styles.kpiSubRow}>
                  {c.showArrow && <ArrowUp />}
                  <Text style={styles.kpiSub} numberOfLines={2}>
                    {c.sub}
                  </Text>
                </View>
              ) : null}
            </CardWrapper>
          );
        })}
      </View>

      {/* More / Less button */}
      <View style={styles.kpiMoreRow}>
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setShowMore((prev) => !prev)}
        >
          <Text style={styles.moreBtnText}>{showMore ? 'Less' : 'More'}</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d={showMore ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
              stroke="#333" strokeWidth={2} fill="none"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Sales Volume Bar Chart (horizontally scrollable, larger) ─────────────────
const SalesVolumeChart = () => {
  const barWidth   = isTablet ? 18 : 14;
  const spacing    = isTablet ? 20 : 16;
  const barSpacing = 3;

  const groupW     = 3 * barWidth + 2 * barSpacing + spacing;
  const chartWidth = 7 * groupW + 40;

  const mk = (
    value: number,
    frontColor: string,
    label?: string,
    isLast?: boolean,
  ) => ({
    value,
    frontColor,
    barWidth,
    roundedTop: true as const,
    spacing: isLast ? spacing : barSpacing,
    ...(label ? { label } : {}),
  });

  const barData = [
    mk(120, '#075EA7',              '06/05'), mk(45,  'rgba(98,145,185,0.9)'), mk(16, '#3C3C41', undefined, true),
    mk(68,  '#075EA7',              '06/07'), mk(82,  'rgba(98,145,185,0.9)'), mk(21, '#3C3C41', undefined, true),
    mk(101, '#075EA7',              '06/08'), mk(78,  'rgba(98,145,185,0.9)'), mk(82, '#3C3C41', undefined, true),
    mk(104, '#075EA7',              '06/09'), mk(23,  'rgba(98,145,185,0.9)'), mk(51, '#3C3C41', undefined, true),
    mk(44,  '#075EA7',              '06/10'), mk(114, 'rgba(98,145,185,0.9)'), mk(41, '#3C3C41', undefined, true),
    mk(88,  '#075EA7',              '06/11'), mk(51,  'rgba(98,145,185,0.9)'), mk(92, '#3C3C41', undefined, true),
    mk(25,  '#075EA7',              '06/12'), mk(51,  'rgba(98,145,185,0.9)'), mk(90, '#3C3C41', undefined, true),
  ];

  const legendItems = [
    { color: '#075EA7',              label: 'Dine In'   },
    { color: 'rgba(98,145,185,0.9)', label: 'Take Away' },
    { color: '#3C3C41',              label: 'Delivery'  },
  ];

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Sales Volume (Order Mode Wise)</Text>

      <View style={styles.legendRow}>
        {legendItems.map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
      >
        <BarChart
          data={barData}
          maxValue={130}
          noOfSections={4}
          barBorderRadius={4}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor="#E0E0E0"
          yAxisTextStyle={{ color: '#54555A', fontSize: isTablet ? 11 : 9 }}
          xAxisLabelTextStyle={{
            color: '#54555A',
            fontSize: isTablet ? 11 : 9,
            width: 44,
            textAlign: 'center',
          }}
          isAnimated
          animationDuration={800}
          rulesType="solid"
          rulesColor="#F0F0F0"
          height={isTablet ? 260 : isSmall ? 180 : 220}
          width={chartWidth}
          initialSpacing={12}
          endSpacing={12}
          showGradient={false}
          disableScroll
        />
      </ScrollView>
    </View>
  );
};

// ─── Sales Distribution Donut ─────────────────────────────────────────────────
const SalesDistributionCard = () => {
  const radius      = isTablet ? 95  : isSmall ? 65 : 80;
  const innerRadius = isTablet ? 58  : isSmall ? 38 : 48;

  const pieData = [
    { value: 35, color: '#2E2855', text: '35%', textColor: '#fff', textSize: isTablet ? 13 : 11, fontWeight: 'bold' },
    { value: 25, color: '#8AB4FF', text: '25%', textColor: '#fff', textSize: isTablet ? 13 : 11, fontWeight: 'bold' },
    { value: 20, color: '#703DDE', text: '20%', textColor: '#fff', textSize: isTablet ? 13 : 11, fontWeight: 'bold' },
    { value: 10, color: '#3F96D4', text: '10%', textColor: '#fff', textSize: isTablet ? 13 : 11, fontWeight: 'bold' },
    { value: 10, color: '#E8EDF2', text: '',    textColor: 'transparent' },
  ];

  const legend = [
    { color: '#2E2855', label: 'Dining'    },
    { color: '#8AB4FF', label: 'Take Away' },
    { color: '#703DDE', label: 'Pick Up'   },
    { color: '#3F96D4', label: 'Delivery'  },
  ];

  return (
    <View style={styles.sectionCard}>
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.sectionTitle, { flex: 1, marginRight: 8, marginBottom: 0 }]}>
          Sales Distribution By Order Modes
        </Text>
        <TouchableOpacity style={styles.expandBtn}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
              stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round"
            />
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
  );
};

// ─── Top Performance Horizontal Bars ─────────────────────────────────────────
const TopPerformanceCard = () => {
  const LABEL_W  = isTablet ? 130 : 100;
  const GAP      = 8;
  const TRACK_W  = CARD_WIDTH - 32 - LABEL_W - GAP;
  const MAX      = 800;
  const axisVals = [0, 200, 400, 600, 800];

  const data = [
    { name: 'Crimson\nChopsticks', value: 709 },
    { name: 'Basil & Barrel',      value: 620 },
    { name: 'The Olive Grove',     value: 583 },
    { name: 'The Golden Wok',      value: 425 },
  ];

  return (
    <View style={styles.sectionCard}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.sectionTitle}>Top Performance</Text>
        <TouchableOpacity style={styles.expandBtn}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
              stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginLeft: LABEL_W + GAP, marginBottom: 6 }}>
        {axisVals.map((v) => (
          <Text
            key={v}
            style={[
              styles.axisLabel,
              { width: TRACK_W / (axisVals.length - 1), textAlign: 'center' },
            ]}
          >
            {v}
          </Text>
        ))}
      </View>

      {data.map((d, i) => {
        const fillW = (d.value / MAX) * TRACK_W;
        return (
          <View key={i} style={[styles.perfRow, { gap: GAP, marginBottom: 10 }]}>
            <Text style={[styles.perfName, { width: LABEL_W }]} numberOfLines={2}>
              {d.name}
            </Text>
            <View style={[styles.perfTrack, { width: TRACK_W }]}>
              {axisVals.slice(1).map((v) => (
                <View
                  key={v}
                  style={{
                    position: 'absolute',
                    left: (v / MAX) * TRACK_W,
                    top: 0, bottom: 0,
                    width: 1,
                    backgroundColor: '#E0E0E0',
                  }}
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
  );
};

// ─── Payment Type Donut ───────────────────────────────────────────────────────
const PaymentTypeCard = () => {
  const radius      = isTablet ? 110 : 90;
  const innerRadius = isTablet ? 65  : 54;

  const pieData = [
    { value: 40, color: '#006BD6', label: 'VISA CARD'    },
    { value: 30, color: '#537FF1', label: 'MASTER CARD'  },
    { value: 15, color: '#FF6F5A', label: 'AMEX CARD'    },
    { value: 10, color: '#3CC3DF', label: 'CASH'         },
    { value: 3,  color: '#FF1301', label: 'CREDIT'       },
    { value: 2,  color: '#5A4DC0', label: 'GIFT VOUCHER' },
  ];

  // ── object array instead of tuple array to avoid ReactNode type error ───────
  const legend: { color: string; label: string }[] = [
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
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
              stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: 'center', marginVertical: 8 }}>
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
              <Text style={{ fontSize: isTablet ? 13 : 11, color: '#54555A', fontWeight: '600' }}>
                Payment
              </Text>
              <Text style={{ fontSize: isTablet ? 11 : 9, color: '#999' }}>
                Types
              </Text>
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

// ─── Monthly Sales Trend Line Chart ──────────────────────────────────────────
const MonthlySalesTrend = () => {
  const chartWidth = CARD_WIDTH - 80;
  const chartH     = isTablet ? 220 : isSmall ? 130 : 170;

  const lineData = [
    { value: 90000,  label: 'Jan', dataPointText: '90K'  },
    { value: 55000,  label: 'Feb', dataPointText: '55K'  },
    { value: 130000, label: 'Mar', dataPointText: '130K' },
    { value: 70000,  label: 'Apr', dataPointText: '70K'  },
    { value: 110000, label: 'May', dataPointText: '110K' },
    { value: 145000, label: 'Jun', dataPointText: '145K' },
    { value: 85000,  label: 'Jul', dataPointText: '85K'  },
    { value: 60000,  label: 'Aug', dataPointText: '60K'  },
    { value: 100000, label: 'Sep', dataPointText: '100K' },
    { value: 120000, label: 'Oct', dataPointText: '120K' },
    { value: 40000,  label: 'Nov', dataPointText: '40K'  },
    { value: 150000, label: 'Dec', dataPointText: '150K' },
  ];

  return (
    <View style={[styles.sectionCard, { paddingBottom: 12 }]}>
      <Text style={styles.sectionTitle}>Monthly Sales Trend</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={lineData}
          width={chartWidth}
          height={chartH}
          maxValue={160000}
          noOfSections={4}
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
          dataPointsColor="#5D51A9"
          dataPointsRadius={4}
          dataPointsWidth={4}
          yAxisColor="transparent"
          xAxisColor="#E0E0E0"
          yAxisTextStyle={{ color: '#54555A', fontSize: isTablet ? 11 : 9 }}
          xAxisLabelTextStyle={{ color: '#54555A', fontSize: isTablet ? 11 : 9 }}
          rulesType="solid"
          rulesColor="#F0F0F0"
          yAxisLabelSuffix="K"
          formatYLabel={(v) => `${Math.round(Number(v) / 1000)}`}
          isAnimated
          animationDuration={1000}
          showTextOnFocus
          focusEnabled
          showStripOnFocus
          stripColor="rgba(93,81,169,0.2)"
          stripWidth={2}
          unFocusOnPressOut
        />
      </ScrollView>
    </View>
  );
};

// ─── Root Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [locationModalVisible, setLocationModalVisible] =
    useState<boolean>(false);
  const [dateModalVisible, setDateModalVisible] =
    useState<boolean>(false);
  const [salesVolumeModalVisible, setSalesVolumeModalVisible] =
    useState<boolean>(false);

  const [selectedLocations, setSelectedLocations] =
    useState<string[]>(['All Locations']);
  const [dateRange, setDateRange] =
    useState<DateRange>({ from: '2026/06/12', to: '' });

  const locationLabel =
    selectedLocations.includes('All Locations') || selectedLocations.length === 0
      ? 'All Location'
      : selectedLocations.length === 1
      ? selectedLocations[0]
      : `${selectedLocations.length} Locations`;

  const dateLabel =
    dateRange.to && dateRange.to !== dateRange.from
      ? `${dateRange.from} - ${dateRange.to}`
      : dateRange.from || 'Select Date';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.topArea}>
        <Header />
        <TabBar />
        <FilterRow
          dateLabel={dateLabel}
          locationLabel={locationLabel}
          onDatePress={() => setDateModalVisible(true)}
          onLocationPress={() => setLocationModalVisible(true)}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <KPICards onSalesVolumePress={() => setSalesVolumeModalVisible(true)} />
        <SalesVolumeChart />
        <SalesDistributionCard />
        <TopPerformanceCard />
        <PaymentTypeCard />
        <MonthlySalesTrend />
        <View style={{ height: 40 }} />
      </ScrollView>

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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },

  // Top area
  topArea: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#ffffff',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  // Header
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: isTablet ? 14 : 30,
    paddingBottom: isTablet ? 12 : 8,
    backgroundColor: '#fff',
  },
  hamburger: { width: HEADER_SIDE_W, gap: 5 },
  hamLine: {
    width: isTablet ? 22 : 20,
    height: 2,
    backgroundColor: '#1A1A2E',
    borderRadius: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: isTablet ? 24 : isSmall ? 18 : 21,
    fontWeight: '700',
    color: '#000',
  },
  avatarRing: {
    width: HEADER_SIDE_W,
    height: HEADER_SIDE_W,
    borderRadius: HEADER_SIDE_W / 2,
    borderWidth: 2,
    borderColor: '#2F6FE4',
    padding: 2,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D9D9D9',
  },

  // Tabs
  tabBarWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#E7F0FB',
    borderRadius: 10,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTab:     { backgroundColor: '#2F6FE4' },
  activeTabText: { color: '#fff', fontWeight: '600' },
  tabText: {
    fontSize: isTablet ? 14 : 12,
    fontWeight: '500',
    color: '#3A3A3A',
    textAlign: 'center',
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    maxWidth: (CARD_WIDTH - 10) / 2,
  },
  filterText: {
    fontSize: isTablet ? 13 : 11,
    fontWeight: '500',
    color: '#333',
    flexShrink: 1,
  },

  // Scroll
  scrollView:    { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  // KPI outer
  kpiOuterCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiInnerCard: {
    borderRadius: 12,
    padding: 12,
    minHeight: isTablet ? 150 : 130,
  },

  // icon + badge row
  kpiIconBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  kpiIconBox: {
    width: isTablet ? 38 : 32,
    height: isTablet ? 38 : 32,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiBadge: {
    fontSize: isTablet ? 12 : 10,
    fontWeight: '700',
    color: '#333',
  },

  kpiLabel: {
    fontSize: isTablet ? 13 : isSmall ? 11 : 12,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.70)',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: isTablet ? 22 : isSmall ? 16 : 19,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  kpiSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiSub: {
    fontSize: isTablet ? 11 : 9,
    color: 'rgba(0,0,0,0.55)',
    fontWeight: '500',
    flexShrink: 1,
  },
  kpiMoreRow: { alignItems: 'flex-end', marginTop: 10 },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  moreBtnText: {
    fontSize: isTablet ? 13 : 12,
    color: '#000',
    fontWeight: '500',
  },

  // Section card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: isTablet ? 16 : isSmall ? 13 : 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  expandBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
  },

  // Legend
  legendRow:  { flexDirection: 'row', gap: 14, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: isTablet ? 12 : 10, color: '#54555A' },

  // Distribution
  distributionBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutLegend:      { flex: 1, gap: 10 },
  donutLegendItem:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSquare: {
    width: isTablet ? 16 : 14,
    height: isTablet ? 16 : 14,
    borderRadius: 2,
  },
  donutLegendText: { fontSize: isTablet ? 14 : 12, color: '#222' },

  // Top Performance
  axisLabel:    { fontSize: isTablet ? 12 : 10, color: '#54555A', textAlign: 'center' },
  perfRow:      { flexDirection: 'row', alignItems: 'center' },
  perfName:     { fontSize: isTablet ? 13 : 11, color: '#54555A', textAlign: 'right' },
  perfTrack: {
    height: isTablet ? 34 : 28,
    backgroundColor: 'rgba(180,180,180,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  perfFill: {
    height: '100%',
    backgroundColor: 'rgba(0,98,170,0.60)',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 6,
    borderRadius: 4,
  },
  perfFillVal:  { fontSize: isTablet ? 13 : 11, color: '#fff', fontWeight: '600' },
  perfAxisLine: { height: 1, backgroundColor: '#E0E0E0', marginTop: 4 },

  // Payment legend
  payLegendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  payLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '45%' },
  payLegendDot: {
    width: isTablet ? 13 : 11,
    height: isTablet ? 13 : 11,
    borderRadius: 2,
  },
  payLegendText: { fontSize: isTablet ? 13 : 11, color: '#54555A' },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: isTablet ? 20 : 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  confirmBtn: {
    backgroundColor: '#4A87C6',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: isTablet ? 16 : 15,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Location modal
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalOptionText: {
    fontSize: isTablet ? 17 : 15,
    fontWeight: '600',
    color: '#000',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#4A87C6',
    borderColor: '#4A87C6',
  },

  // Date modal
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: isTablet ? 15 : 14,
    color: '#000',
  },
  dateIconBox: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 6,
  },

  // Sales volume modal bars
  svLocRow:    { marginBottom: 14 },
  svLocHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  svLocName:   { fontSize: isTablet ? 14 : 13, fontWeight: '600', color: '#333' },
  svLocValue:  { fontSize: isTablet ? 14 : 13, fontWeight: '700', color: '#075EA7' },
  svTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(7,94,167,0.12)',
    overflow: 'hidden',
  },
  svFill: {
    height: '100%',
    backgroundColor: '#075EA7',
    borderRadius: 5,
  },
});