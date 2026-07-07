import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
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
  color: string;
  ionIcon: React.ComponentProps<typeof Ionicons>['name'];
  route: string | null;
}[] = [
  {
    label: 'Dining',
    color: '#B9A0D5',
    ionIcon: 'restaurant-outline',
    route: '/Screens/tableselection',
  },
  {
    label: 'Take Away',
    color: '#8D9ED4',
    ionIcon: 'bag-handle-outline',
    route: '/Screens/TakeAway',
  },
  {
    label: 'Delivery',
    color: '#A9ABCF',
    ionIcon: 'bicycle-outline',
    route: null,
  },
  {
    label: 'Pickup',
    color: '#BC8EB6',
    ionIcon: 'storefront-outline',
    route: null,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ModeSelectionScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { s, meta } = getDynamicStyles(width, height, insets.bottom);

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
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F3F3" />

      {/* BACK BUTTON */}
      <TouchableOpacity style={s.backButtonAbsolute} onPress={() => router.back()}>
        <Image
          source={require('../../assets/icons/blackback.png')}
          style={s.backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <View style={s.contentWrapper}>

        {/* HEADER */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Mode Selection</Text>
        </View>

        {/* MAIN CARD */}
        <View style={s.mainCard}>
          <View style={s.grid}>
            {MODES.map((mode, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.82}
                style={[s.modeCard, { backgroundColor: mode.color }]}
                onPress={() => { if (mode.route) router.push(mode.route as any); }}
              >
                {/* Ionicons — same pattern as settings & home screens */}
                <Ionicons
                  name={mode.ionIcon}
                  size={meta.modeIconSize}
                  color="#000000"
                  style={s.modeIconSpacing}
                />
                <View style={s.labelContainer}>
                  <Text style={s.label}>{mode.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* BILL BUTTON */}
        <TouchableOpacity style={s.billButton} onPress={handleBillPress}>
          <Text style={s.billText}>Bill</Text>
        </TouchableOpacity>

      </View>

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
      backgroundColor: '#F3F3F3',
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
      color: '#000',
      fontSize: scale(headerTitleFs),
    },
    mainCard: {
      width: cardW,
      padding: scale(innerPad),
      backgroundColor: '#fff',
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
      backgroundColor: '#000',
      borderRadius: scale(labelRadius),
      paddingHorizontal: scale(labelPadH),
      paddingVertical: scale(labelPadV),
    },
    label: {
      color: '#fff',
      fontWeight: '600',
      fontSize: scale(labelFs),
    },
    billButton: {
      width: cardW,
      marginTop: scale(billMT),
      paddingVertical: scale(billPadV),
      borderRadius: scale(billRadius),
      backgroundColor: '#002748',
      alignItems: 'center',
      justifyContent: 'center',
    },
    billText: {
      fontSize: scale(billFs),
      fontWeight: '700',
      color: '#fff',
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
      backgroundColor: '#FFF',
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
      color: '#002748',
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
      backgroundColor: 'rgba(0,39,72,0.08)',
    },
    overlayCloseText: {
      color: '#002748',
      fontSize: scale(closeIconFs),
      fontWeight: '800',
    },
    overlaySubtitle: {
      marginTop: scale(subtitleMT),
      marginBottom: scale(subtitleMB),
      color: 'rgba(0,39,72,0.68)',
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
      backgroundColor: '#F4F7FB',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: scale(rowMB),
      borderWidth: 1,
      borderColor: 'rgba(0,39,72,0.08)',
    },
    heldTableLabel: {
      color: '#002748',
      fontSize: scale(rowLabelFs),
      fontWeight: '800',
    },
    heldTableHint: {
      color: 'rgba(0,39,72,0.58)',
      marginTop: scale(rowHintMT),
      fontSize: scale(rowHintFs),
      fontWeight: '500',
    },
    heldTableChevron: {
      color: '#002748',
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
      color: '#002748',
      fontSize: scale(emptyTitleFs),
      fontWeight: '800',
    },
    emptyStateText: {
      color: 'rgba(0,39,72,0.68)',
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