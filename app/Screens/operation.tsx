import { OperationalColors } from '../../constants/operationalTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

// ─── Open bill row ────────────────────────────────────────────────────────────
// One row per table. `billType` says who opened the bill: 'app' bills carry the
// invoice this app generated, 'pos' bills were opened by the POS / central
// system and have no invoice at all.
type HeldBill = {
  tableNo: string;
  invoiceNo: string;
  billType: 'app' | 'pos';
  items: number;
  qty: number;
  netTotal: number | null;
  itemsTotal: number;
  orderMode: string;
  pax: string;
  lastTime: unknown;
};

const formatAmount = (value: number): string => {
  const amount = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(amount * 100) / 100;
  const [whole, decimals] = String(rounded).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals ? `${grouped}.${decimals}` : grouped;
};

const formatBillTime = (value: unknown): string => {
  if (!value) return '';
  const stamp = new Date(String(value));
  if (Number.isNaN(stamp.getTime())) return '';
  const hours = String(stamp.getHours()).padStart(2, '0');
  const minutes = String(stamp.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

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
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [heldBillsLoading, setHeldBillsLoading] = useState(false);
  // 'mine' when the POS profile limits a non-manager to their own bills,
  // 'all' for a manager or when the profile allows every bill.
  const [heldBillsScope, setHeldBillsScope] = useState<'mine' | 'all' | null>(null);
  const [heldBillsError, setHeldBillsError] = useState('');

  // ── Handlers & side-effects ────────────────────────────────────────────────
  // Every open bill, straight from the POS bill table (Tbl_HoldUps). A bill that
  // carries an invoice was opened by this app; one without came from the central
  // system, and both are listed here so nothing is hidden from the steward.
  const refreshHeldTables = async () => {
    setHeldBillsLoading(true);
    setHeldBillsError('');
    try {
      const response = await apiClient.fetchOpenBills();

      if (!response.ok) {
        setHeldBills([]);
        setHeldBillsScope(null);
        const data: any = response.data ?? {};
        if (data.code === 'AUTH_REQUIRED') {
          setHeldBillsError('');
          Alert.alert('Session Expired', 'Please sign in again.', [
            {
              text: 'OK',
              onPress: () => {
                import('../../services/authStore')
                  .then((mod) => mod.useAuthStore.getState().forceLogout())
                  .catch(() => {});
              },
            },
          ]);
          return;
        }
        setHeldBillsError(String(data.message ?? 'Could not load the open bills.'));
        return;
      }

      setHeldBillsScope(response.data?.scope?.mode === 'mine' ? 'mine' : 'all');
      const rows = Array.isArray(response.data?.bills) ? response.data.bills : [];
      const parsed: HeldBill[] = rows
        .map((bill: any) => ({
          tableNo: String(bill.tableNo ?? '').trim(),
          invoiceNo: String(bill.invoiceNo ?? '').trim(),
          billType: bill.billType === 'app' ? 'app' : 'pos',
          items: Number(bill.items ?? 0) || 0,
          qty: Number(bill.qty ?? 0) || 0,
          netTotal: bill.netTotal === null || bill.netTotal === undefined ? null : Number(bill.netTotal),
          itemsTotal: Number(bill.itemsTotal ?? 0) || 0,
          orderMode: String(bill.orderMode ?? '').trim(),
          pax: String(bill.pax ?? '').trim(),
          lastTime: bill.lastTime ?? null,
        }))
        .filter((bill: HeldBill) => bill.tableNo);
      setHeldBills(
        parsed.sort((a: HeldBill, b: HeldBill) =>
          a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true, sensitivity: 'base' }),
        ),
      );
    } catch {
      setHeldBills([]);
      setHeldBillsScope(null);
      setHeldBillsError('Could not load the open bills.');
    } finally {
      setHeldBillsLoading(false);
    }
  };

  useEffect(() => {
    if (billOverlayVisible) refreshHeldTables();
  }, [billOverlayVisible]);

  const handleBillPress = () => {
    setBillOverlayVisible(true);
  };

  const handleHeldTableSelect = (bill: HeldBill) => {
    setBillOverlayVisible(false);
    router.replace({
      pathname: '/Screens/BillingScreen',
      params: {
        tableName: bill.tableNo,
        tableNo: bill.tableNo,
        // A bill the central system opened has no invoice; the screen works from
        // the table number and the server decides the value when saving.
        invoiceNo: bill.invoiceNo,
      },
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

                <Text style={s.overlaySubtitle}>
                  {heldBillsScope === 'mine'
                    ? 'Your open bills only'
                    : 'Every open bill, from the POS and from this app'}
                </Text>

                {heldBills.length > 0 ? (
                  <FlatList
                    data={heldBills}
                    keyExtractor={(item) => item.tableNo}
                    contentContainerStyle={s.heldTableList}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={s.heldTableRow}
                        activeOpacity={0.82}
                        onPress={() => handleHeldTableSelect(item)}
                      >
                        <View style={s.heldTableLeft}>
                          <View style={s.heldTableTitleRow}>
                            <Text style={s.heldTableLabel}>Table {item.tableNo}</Text>
                            <View style={[s.billBadge, item.billType === 'app' ? s.billBadgeApp : s.billBadgePos]}>
                              <Text style={[s.billBadgeText, item.billType === 'app' ? s.billBadgeTextApp : s.billBadgeTextPos]}>
                                {item.billType === 'app' ? 'APP' : 'POS'}
                              </Text>
                            </View>
                          </View>
                          <Text style={s.heldTableHint} numberOfLines={1}>
                            {`${item.items} item${item.items === 1 ? '' : 's'}`
                              + (item.pax ? ` · ${item.pax} pax` : '')
                              + (item.orderMode ? ` · ${item.orderMode}` : '')}
                          </Text>
                        </View>

                        <View style={s.heldTableRight}>
                          <Text style={s.billAmount}>
                            {`Rs. ${formatAmount(item.netTotal !== null ? item.netTotal : item.itemsTotal)}`}
                          </Text>
                          <Text style={s.billAmountNote}>
                            {item.netTotal !== null ? 'bill total' : 'not finalised'}
                          </Text>
                          <Text style={s.heldTableTime}>{formatBillTime(item.lastTime)}</Text>
                        </View>

                        <Text style={s.heldTableChevron}>›</Text>
                      </TouchableOpacity>
                    )}
                  />
                ) : heldBillsLoading ? (
                  <View style={s.emptyStateWrap}>
                    <ActivityIndicator color={OperationalColors.primary} />
                    <Text style={s.emptyStateText}>Loading open bills...</Text>
                  </View>
                ) : heldBillsError ? (
                  <View style={s.emptyStateWrap}>
                    <Text style={s.emptyStateTitle}>Bills not available</Text>
                    <Text style={s.emptyStateText}>{heldBillsError}</Text>
                    <TouchableOpacity
                      style={s.billRetryBtn}
                      activeOpacity={0.85}
                      onPress={() => { void refreshHeldTables(); }}
                    >
                      <Text style={s.billRetryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.emptyStateWrap}>
                    <Text style={s.emptyStateTitle}>
                      {heldBillsScope === 'mine' ? 'No open bills for you' : 'No open bills'}
                    </Text>
                    <Text style={s.emptyStateText}>
                      {heldBillsScope === 'mine'
                        ? 'Bills opened by other users are hidden on this device.'
                        : 'Start an order to open a bill. It appears here once the POS has it.'}
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
    heldTableLeft: {
      flex: 1,
      paddingRight: scale(8),
    },
    heldTableTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(6),
    },
    billBadge: {
      borderRadius: scale(6),
      paddingHorizontal: scale(6),
      paddingVertical: scale(1),
      borderWidth: 1,
    },
    billBadgeApp: {
      backgroundColor: 'rgba(78,142,196,0.12)',
      borderColor: 'rgba(78,142,196,0.35)',
    },
    billBadgePos: {
      backgroundColor: 'rgba(114,86,60,0.10)',
      borderColor: 'rgba(114,86,60,0.30)',
    },
    billBadgeText: {
      fontSize: scale(9.5),
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    billBadgeTextApp: { color: '#2F6F9E' },
    billBadgeTextPos: { color: OperationalColors.primary },
    heldTableRight: {
      alignItems: 'flex-end',
    },
    billAmount: {
      color: OperationalColors.primary,
      fontSize: scale(rowLabelFs),
      fontWeight: '800',
    },
    billAmountNote: {
      color: 'rgba(114,86,60,0.52)',
      fontSize: scale(9.5),
      fontWeight: '600',
      marginTop: scale(1),
    },
    heldTableTime: {
      color: 'rgba(114,86,60,0.58)',
      fontSize: scale(9.5),
      fontWeight: '600',
      marginTop: scale(1),
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
    billRetryBtn: {
      marginTop: scale(10),
      paddingVertical: scale(6),
      paddingHorizontal: scale(16),
      borderRadius: scale(8),
      backgroundColor: OperationalColors.primary,
    },
    billRetryText: {
      color: OperationalColors.canvas,
      fontSize: scale(10.5),
      fontWeight: '800',
      letterSpacing: 0.3,
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
