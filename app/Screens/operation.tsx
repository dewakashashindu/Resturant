import { OperationalColors } from '../../constants/operationalTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  ScrollView,
  Image,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';

// ─── Static data ──────────────────────────────────────────────────────────────
const MODES: {
  label: string;
  visible: boolean;
  color: string;
  ionIcon: React.ComponentProps<typeof Ionicons>['name'];
  route: string | null;
}[] = [
  {
    label: 'Dining',
    visible: true,
    color: OperationalColors.surfaceAlt,
    ionIcon: 'restaurant-outline',
    route: '/Screens/tableselection',
  },
  {
    label: 'Take Away',
    visible: true,
    color: OperationalColors.surfaceAlt,
    ionIcon: 'bag-handle-outline',
    route: '/Screens/TakeAway',
  },
  {
    label: 'Delivery',
    visible: false,
    color: OperationalColors.surfaceAlt,
    ionIcon: 'bicycle-outline',
    route: null,
  },
  {
    label: 'Pickup',
    visible: false,
    color: OperationalColors.surfaceAlt,
    ionIcon: 'storefront-outline',
    route: null,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ModeSelectionScreen() {
  const router = useRouter();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { s } = getDynamicStyles(width, height, insets.bottom);
  const contentWidth = Math.min(Math.max(0, width - insets.left - insets.right), 800);
  const modeColumns = contentWidth < 350 || fontScale > 1.3 ? 1 : 2;
  const modeWidth = Math.floor((contentWidth - 40 - (modeColumns - 1) * 14) / modeColumns);

  // ── State ──────────────────────────────────────────────────────────────────
  const [billOverlayVisible, setBillOverlayVisible] = useState(false);
  const [heldBills, setHeldBills] = useState<{ tableNo: string; invoiceNo: string }[]>([]);

  // ── Handlers & side-effects ────────────────────────────────────────────────
  const refreshHeldTables = async () => {
    try {
      const response = await apiClient.fetchUnpaidBills();
      if (!response.ok) { setHeldBills([]); return; }
      const bills = Array.isArray(response.data?.data) ? response.data.data : [];
      const parsed = bills
        .map((bill: any) => ({
          tableNo:   String(bill.tableNo   ?? '').trim(),
          invoiceNo: String(bill.invoiceNo ?? '').trim(),
        }))
        .filter((b: { tableNo: string; invoiceNo: string }) => b.tableNo && b.invoiceNo);
      setHeldBills(
        parsed.sort((a: { tableNo: string; invoiceNo: string }, b: { tableNo: string; invoiceNo: string }) =>
          a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true, sensitivity: 'base' }),
        ),
      );
    } catch {
      setHeldBills([]);
    }
  };

  useEffect(() => {
    if (billOverlayVisible) refreshHeldTables();
  }, [billOverlayVisible]);

  const handleBillPress = () => {
    setBillOverlayVisible(true);
  };

  const handleHeldTableSelect = (bill: { tableNo: string; invoiceNo: string }) => {
    setBillOverlayVisible(false);
    router.replace({
      pathname: '/Screens/BillingScreen',
      params: { tableName: bill.tableNo, invoiceNo: bill.invoiceNo },
    });
  };

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={modeStyles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={OperationalColors.header} />
      <ScrollView style={modeStyles.scroll} contentContainerStyle={modeStyles.scrollContent}>
        <View style={modeStyles.header}>
          <View pointerEvents="none" style={modeStyles.circle} />
          <View style={modeStyles.headerRow}>
            <TouchableOpacity style={modeStyles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={24} color={OperationalColors.primary} />
            </TouchableOpacity>
            <Text style={modeStyles.title}>Mode Selection</Text>
            <View style={{ width: 48 }} />
          </View>
          <Text style={modeStyles.subtitle}>Choose how you would like to serve.</Text>
        </View>
        <View style={modeStyles.main}>
          <Text style={modeStyles.sectionTitle}>Start an order</Text>
          <View style={modeStyles.grid}>
            {MODES.filter((mode) => mode.visible).map((mode) => (
              <TouchableOpacity
                key={mode.label}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={mode.label}
                style={[modeStyles.card, { width: modeWidth }, mode.label === 'Dining' && modeStyles.primaryCard]}
                onPress={() => { if (mode.route) router.push(mode.route as any); }}
              >
                <View style={modeStyles.cardTop}>
                  <View style={modeStyles.iconBox}><Ionicons name={mode.ionIcon} size={32} color={OperationalColors.primary} /></View>
                  <Ionicons name="arrow-forward" size={18} color={OperationalColors.muted} />
                </View>
                <Text style={modeStyles.cardTitle}>{mode.label}</Text>
                <Text style={modeStyles.cardSubtitle}>{mode.label === 'Dining' ? 'Table service' : 'Collection orders'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={modeStyles.billButton} onPress={handleBillPress} accessibilityRole="button" accessibilityLabel="View listed bills">
            <Ionicons name="receipt-outline" size={21} color={OperationalColors.onPrimary} />
            <Text style={modeStyles.billText}>Bill</Text>
            <Ionicons name="arrow-forward" size={19} color={OperationalColors.onPrimary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* BILL OVERLAY MODAL */}
      <Modal
        visible={billOverlayVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBillOverlayVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setBillOverlayVisible(false)}>
          <View style={s.overlayBackdrop}>
            <TouchableWithoutFeedback>
              <View style={s.overlayCard}>

                <View style={s.overlayHeader}>
                  <Text style={s.overlayTitle}>Listed Bills</Text>
                  <TouchableOpacity
                    onPress={() => setBillOverlayVisible(false)}
                    style={s.overlayCloseBtn}
                  >
                    <Text style={s.overlayCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.overlaySubtitle}>Select a listed bill to view or modify it</Text>

                {heldBills.length > 0 ? (
                  <FlatList
                    data={heldBills}
                    keyExtractor={(item) => item.invoiceNo}
                    contentContainerStyle={s.heldTableList}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={s.heldTableRow}
                        activeOpacity={0.82}
                        onPress={() => handleHeldTableSelect(item)}
                      >
                        <View>
                          <Text style={s.heldTableLabel}>Table {item.tableNo}</Text>
                          <Text style={s.heldTableHint}>Tap to continue this order</Text>
                        </View>
                        <Text style={s.heldTableChevron}>›</Text>
                      </TouchableOpacity>
                    )}
                  />
                ) : (
                  <View style={s.emptyStateWrap}>
                    <Text style={s.emptyStateTitle}>No listed bills</Text>
                    <Text style={s.emptyStateText}>
                      Start a new order to create a listed bill here.
                    </Text>
                  </View>
                )}

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Dynamic Styles Factory ───────────────────────────────────────────────────
function getDynamicStyles(width: number, height: number, bottomInset: number) {
  const isTablet = width >= 600;
  const isSmall  = height < 700;

  const BASE_WIDTH = isTablet ? 768 : 375;
  const scale = (size: number): number => (width / BASE_WIDTH) * size;

  // ── 3-Tier Conditional Benchmarks ─────────────────────────────────────────

  // Back button
  const backBtnTop    = Platform.OS === 'android'
    ? (isTablet ? 44  : isSmall ? 36  : 44)
    : (isTablet ? 10  : isSmall ?  6  :  8);
  const backBtnLeft   = isTablet ?  16 : isSmall ?  10 : 12;
  const backBtnPad    = isTablet ?  12 : isSmall ?   6 :  8;
  const backIconSize  = isTablet ?  56 : isSmall ?  38 : 44;

  // Header
  const headerMT      = Platform.OS === 'android'
    ? (isTablet ? 20  : isSmall ? 14  : 16)
    : (isTablet ? 12  : isSmall ?  8  : 10);
  const headerMB      = isTablet ?  24 : isSmall ?  14 : 18;
  const hPad          = isTablet ?  24 : isSmall ?  12 : 16;
  const headerTitleFs = isTablet ?  32 : isSmall ?  20 : 24;

  // Card
  const cardW         = isTablet ? width * 0.9 : width - scale(hPad) * 2;
  const innerPad      = isTablet ?  24 : isSmall ?  14 : 16;
  const cardRadius    = isTablet ?  22 : isSmall ?  14 : 16;
  const shadowH       = isTablet ?   4 : isSmall ?   2 :  3;
  const shadowR       = isTablet ?  12 : isSmall ?   7 :  8;

  // Mode grid
  const modeGap       = isTablet ?  24 : isSmall ?  12 : 14;
  const modeCardW     = (cardW - scale(innerPad) * 2 - scale(modeGap)) / 2;
  const modeCardH     = isTablet ? modeCardW * 0.72 : modeCardW * 0.80;
  const modeCardR     = isTablet ?  14 : isSmall ?   9 : 10;

  // Icon — raw number for Ionicons size prop (not a StyleSheet value)
  const modeIconSize  = isTablet ? modeCardW * 0.38 : isSmall ? modeCardW * 0.40 : modeCardW * 0.42;
  const iconMB        = isTablet ?  16 : isSmall ?  10 : 12;

  // Label pill
  const labelFs       = isTablet ?  20 : isSmall ?  10 : 12;
  const labelPadH     = isTablet ?  32 : isSmall ?  14 : 16;
  const labelPadV     = isTablet ?   8 : isSmall ?   3 :  4;
  const labelRadius   = isTablet ?  28 : isSmall ?  17 : 20;

  // Bill button
  const billMT        = isTablet ?  22 : isSmall ?  14 : 18;
  const billPadV      = isTablet ?  18 : isSmall ?  12 : 14;
  const billRadius    = isTablet ?  18 : isSmall ?  12 : 14;
  const billFs        = isTablet ?  22 : isSmall ?  14 : 16;

  // Overlay
  const overlayPadH   = isTablet ?  22 : isSmall ?  12 : 16;
  const overlayCardW  = isTablet ? Math.min(width * 0.78, scale(620)) : width - scale(32);
  const overlayPad    = isTablet ?  24 : isSmall ?  14 : 18;
  const overlayRadius = isTablet ?  30 : isSmall ?  18 : 22;
  const overlayShadH  = isTablet ?  10 : isSmall ?   6 :  8;
  const overlayShadR  = isTablet ?  20 : isSmall ?  12 : 16;
  const overlayTitleFs  = isTablet ? 24 : isSmall ? 15 : 18;
  const closeBtnSize    = isTablet ? 44 : isSmall ? 28 : 34;
  const closeBtnRadius  = isTablet ? 22 : isSmall ? 14 : 17;
  const closeIconFs     = isTablet ? 24 : isSmall ? 15 : 18;
  const subtitleMT    = isTablet ?  12 : isSmall ?   6 :  8;
  const subtitleMB    = isTablet ?  18 : isSmall ?  12 : 14;
  const subtitleFs    = isTablet ?  17 : isSmall ?  11 : 13;

  // Held table rows
  const rowRadius     = isTablet ?  22 : isSmall ?  14 : 16;
  const rowPadV       = isTablet ?  18 : isSmall ?  12 : 14;
  const rowPadH       = isTablet ?  18 : isSmall ?  12 : 14;
  const rowMB         = isTablet ?  14 : isSmall ?   8 : 10;
  const rowLabelFs    = isTablet ?  22 : isSmall ?  14 : 16;
  const rowHintMT     = isTablet ?   4 : isSmall ?   1 :  2;
  const rowHintFs     = isTablet ?  16 : isSmall ?  10 : 12;
  const chevronFs     = isTablet ?  38 : isSmall ?  22 : 28;
  const chevronML     = isTablet ?  12 : isSmall ?   6 :  8;
  const listPB        = isTablet ?   4 : isSmall ?   1 :  2;

  // Empty state
  const emptyPadV     = isTablet ?  40 : isSmall ?  22 : 28;
  const emptyTitleFs  = isTablet ?  24 : isSmall ?  15 : 18;
  const emptyTextMT   = isTablet ?  10 : isSmall ?   5 :  6;
  const emptyTextFs   = isTablet ?  17 : isSmall ?  11 : 13;
  const emptyLineH    = isTablet ?  24 : isSmall ?  15 : 18;

  // ── StyleSheet ─────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: OperationalColors.canvas,
    },
    backButtonAbsolute: {
      position: 'absolute',
      top: scale(backBtnTop),
      left: scale(backBtnLeft),
      zIndex: 10,
      padding: scale(backBtnPad),
    },
    backIcon: {
      width: scale(backIconSize),
      height: scale(backIconSize),
    },
    contentWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      alignItems: 'center',
      marginTop: scale(headerMT),
      marginBottom: scale(headerMB),
      paddingHorizontal: scale(hPad),
    },
    headerTitle: {
      fontWeight: '600',
      color: OperationalColors.text,
      fontSize: scale(headerTitleFs),
    },
    mainCard: {
      borderWidth: 1,
      borderColor: OperationalColors.border,
      width: cardW,
      padding: scale(innerPad),
      backgroundColor: OperationalColors.canvas,
      borderRadius: scale(cardRadius),
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: scale(shadowH) },
      shadowOpacity: 0.12,
      shadowRadius: scale(shadowR),
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: scale(modeGap),
    },
    modeCard: {
      borderWidth: 1,
      borderColor: OperationalColors.border,
      width: modeCardW,
      height: modeCardH,
      borderRadius: scale(modeCardR),
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Spacing below the icon — replaces the old modeIcon marginBottom
    modeIconSpacing: {
      marginBottom: scale(iconMB),
    },
    labelContainer: {
      backgroundColor: OperationalColors.primary,
      borderRadius: scale(labelRadius),
      paddingHorizontal: scale(labelPadH),
      paddingVertical: scale(labelPadV),
    },
    label: {
      color: OperationalColors.onPrimary,
      fontWeight: '600',
      fontSize: scale(labelFs),
    },
    billButton: {
      width: cardW,
      marginTop: scale(billMT),
      paddingVertical: scale(billPadV),
      borderRadius: scale(billRadius),
      backgroundColor: OperationalColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    billText: {
      fontSize: scale(billFs),
      fontWeight: '700',
      color: OperationalColors.onPrimary,
    },
    overlayBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.48)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: scale(overlayPadH),
    },
    overlayCard: {
      width: overlayCardW,
      padding: scale(overlayPad),
      backgroundColor: OperationalColors.canvas,
      borderRadius: scale(overlayRadius),
      maxHeight: '78%',
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: scale(overlayShadR),
      shadowOffset: { width: 0, height: scale(overlayShadH) },
    },
    overlayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    overlayTitle: {
      color: OperationalColors.primary,
      fontSize: scale(overlayTitleFs),
      fontWeight: '800',
      flex: 1,
    },
    overlayCloseBtn: {
      width: scale(closeBtnSize),
      height: scale(closeBtnSize),
      borderRadius: scale(closeBtnRadius),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(114,86,60,0.08)',
    },
    overlayCloseText: {
      color: OperationalColors.primary,
      fontSize: scale(closeIconFs),
      fontWeight: '800',
    },
    overlaySubtitle: {
      marginTop: scale(subtitleMT),
      marginBottom: scale(subtitleMB),
      color: 'rgba(114,86,60,0.68)',
      fontSize: scale(subtitleFs),
      fontWeight: '500',
    },
    heldTableList: {
      paddingBottom: scale(listPB) + bottomInset,
    },
    heldTableRow: {
      borderRadius: scale(rowRadius),
      paddingVertical: scale(rowPadV),
      paddingHorizontal: scale(rowPadH),
      backgroundColor: OperationalColors.canvas,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: scale(rowMB),
      borderWidth: 1,
      borderColor: 'rgba(114,86,60,0.08)',
    },
    heldTableLabel: {
      color: OperationalColors.primary,
      fontSize: scale(rowLabelFs),
      fontWeight: '800',
    },
    heldTableHint: {
      color: 'rgba(114,86,60,0.58)',
      marginTop: scale(rowHintMT),
      fontSize: scale(rowHintFs),
      fontWeight: '500',
    },
    heldTableChevron: {
      color: OperationalColors.primary,
      fontSize: scale(chevronFs),
      fontWeight: '300',
      marginLeft: scale(chevronML),
    },
    emptyStateWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(emptyPadV),
    },
    emptyStateTitle: {
      color: OperationalColors.primary,
      fontSize: scale(emptyTitleFs),
      fontWeight: '800',
    },
    emptyStateText: {
      color: 'rgba(114,86,60,0.68)',
      textAlign: 'center',
      marginTop: scale(emptyTextMT),
      fontSize: scale(emptyTextFs),
      lineHeight: scale(emptyLineH),
    },
  });

  // ── Meta — raw numeric values needed as props (e.g. Ionicons size) ─────────
  const meta = {
    modeIconSize: Math.round(modeIconSize),
  };

  return { s, meta };
}
const modeStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: OperationalColors.header },
  scroll: { flex: 1, backgroundColor: OperationalColors.canvas },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },
  header: { backgroundColor: OperationalColors.header, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 26, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: OperationalColors.border },
  circle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -60, top: -65, backgroundColor: 'rgba(255,253,250,0.18)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 760, width: '100%', alignSelf: 'center' },
  backButton: { width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,253,250,0.5)', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 23, color: OperationalColors.text, fontWeight: '700' },
  subtitle: { color: OperationalColors.primary, fontSize: 13, textAlign: 'center', marginTop: 18 },
  main: { width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 26 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: OperationalColors.text, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { minHeight: 180, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: OperationalColors.border, backgroundColor: OperationalColors.surface },
  primaryCard: { backgroundColor: OperationalColors.surfaceAlt, borderColor: OperationalColors.accent },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  iconBox: { width: 56, height: 56, borderRadius: 15, backgroundColor: OperationalColors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: OperationalColors.text, marginTop: 25 },
  cardSubtitle: { fontSize: 12, color: OperationalColors.muted, marginTop: 5 },
  billButton: { marginTop: 22, minHeight: 56, borderRadius: 15, backgroundColor: OperationalColors.primary, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  billText: { flex: 1, color: OperationalColors.onPrimary, fontWeight: '700', fontSize: 17, textAlign: 'center' },
});
