import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartItem, useCartContext } from './CartContext';

// ─────────────────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#1B1B1B',
  surface:     '#242424',
  card:        '#2A2A2A',
  border:      'rgba(255,255,255,0.08)',
  gold:        '#AB773C',
  goldMuted:   'rgba(171,119,60,0.65)',
  goldSoft:    'rgba(171,119,60,0.15)',
  white:       '#FFFFFF',
  whiteHigh:   'rgba(255,255,255,0.92)',
  whiteMid:    'rgba(255,255,255,0.55)',
  whiteLow:    'rgba(255,255,255,0.25)',
  danger:      '#E05252',
  dangerSoft:  'rgba(224,82,82,0.12)',
  confirm:     '#3D8C5E',
  confirmSoft: 'rgba(61,140,94,0.18)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const parsePriceNum = (price: string): number => {
  const match = price.match(/[\d,]+(\.\d+)?/);
  if (!match) return 0;
  const n = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

const formatPrice = (num: number): string => {
  const fixed = num.toFixed(2);
  const [whole, dec] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `Rs. ${withCommas}.${dec}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// ICON COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <View style={{ width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{
      width: 10, height: 10,
      borderLeftWidth: 2, borderBottomWidth: 2,
      borderColor: C.white,
      transform: [{ rotate: '45deg' }],
    }} />
  </View>
);

const TrashIcon = () => (
  <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', top: 0, width: 14, height: 3, backgroundColor: C.danger, borderRadius: 1.5 }} />
    <View style={{ position: 'absolute', top: -3, width: 5, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: C.danger }} />
    <View style={{ position: 'absolute', top: 4, width: 12, height: 10, backgroundColor: C.danger, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
    <View style={{ position: 'absolute', top: 6, left: 5, width: 1.5, height: 6, backgroundColor: C.bg, borderRadius: 1 }} />
    <View style={{ position: 'absolute', top: 6, left: 8.5, width: 1.5, height: 6, backgroundColor: C.bg, borderRadius: 1 }} />
  </View>
);

const CheckIcon = () => (
  <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{
      width: 5, height: 10,
      borderRightWidth: 2.5, borderBottomWidth: 2.5,
      borderColor: C.white,
      transform: [{ rotate: '45deg' }],
      marginTop: -3,
    }} />
  </View>
);

const EmptyCartIcon = () => (
  <View style={{ width: 80, height: 80, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 52, height: 36, borderWidth: 3, borderColor: C.whiteLow, borderRadius: 6, marginTop: 8 }} />
    <View style={{
      position: 'absolute', top: 10,
      width: 36, height: 18,
      borderTopLeftRadius: 18, borderTopRightRadius: 18,
      borderWidth: 3, borderColor: C.whiteLow, borderBottomWidth: 0,
    }} />
    <View style={{ flexDirection: 'row', gap: 24, marginTop: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.whiteLow }} />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.whiteLow }} />
    </View>
  </View>
);

// ── Home icon — matches the gold door style used in menu_cato ──────────────

const HomeIcon = () => (
  <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'flex-end' }}>
    <View style={{ position: 'absolute', top: 2, left: 4, width: 3, height: 5, backgroundColor: C.white, zIndex: 1 }} />
    <View style={{ width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C.white }} />
    <View style={{ width: 16, height: 10, backgroundColor: C.white, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: 5, height: 6, backgroundColor: C.gold, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// CART ITEM ROW
// ─────────────────────────────────────────────────────────────────────────────

interface CartRowProps {
  item:     CartItem;
  onInc:    (id: string) => void;
  onDec:    (id: string) => void;
  onRemove: (id: string) => void;
}

const CartRow = React.memo(({ item, onInc, onDec, onRemove }: CartRowProps) => {
  const lineTotal = parsePriceNum(item.price) * item.qty;

  return (
    <View style={rowStyles.card}>
      <Image source={item.image} style={rowStyles.image} resizeMode="cover" />

      <View style={rowStyles.details}>
        <View style={rowStyles.topRow}>
          <Text style={rowStyles.name} numberOfLines={2}>{item.name}</Text>
          <TouchableOpacity
            style={rowStyles.trashBtn}
            onPress={() => onRemove(item.id)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <TrashIcon />
          </TouchableOpacity>
        </View>

        <Text style={rowStyles.unitPrice}>{item.price} / item</Text>

        <View style={rowStyles.bottomRow}>
          <View style={rowStyles.stepper}>
            <TouchableOpacity
              style={[rowStyles.stepBtn, item.qty <= 1 && rowStyles.stepBtnDim]}
              onPress={() => onDec(item.id)}
              activeOpacity={0.7}
            >
              <Text style={rowStyles.stepTxt}>−</Text>
            </TouchableOpacity>
            <Text style={rowStyles.qtyTxt}>{item.qty}</Text>
            <TouchableOpacity
              style={rowStyles.stepBtn}
              onPress={() => onInc(item.id)}
              activeOpacity={0.7}
            >
              <Text style={rowStyles.stepTxt}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={rowStyles.lineTotal}>{formatPrice(lineTotal)}</Text>
        </View>
      </View>
    </View>
  );
});

const rowStyles = StyleSheet.create({
  card: {
    flexDirection:    'row',
    backgroundColor:  C.card,
    borderRadius:     16,
    marginHorizontal: 20,
    marginBottom:     12,
    padding:          14,
    borderWidth:      1,
    borderColor:      C.border,
    gap:              14,
  },
  image: {
    width:           90,
    height:          105,
    borderRadius:    12,
    backgroundColor: '#333',
  },
  details: {
    flex:           1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
  },
  name: {
    color:       C.whiteHigh,
    fontSize:    15,
    fontWeight:  '600',
    flex:        1,
    marginRight: 8,
    lineHeight:  21,
  },
  trashBtn: {
    padding:         4,
    borderRadius:    8,
    backgroundColor: C.dangerSoft,
  },
  unitPrice: {
    color:      C.whiteMid,
    fontSize:   12,
    fontWeight: '400',
    marginTop:  4,
  },
  bottomRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      10,
  },
  stepper: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.surface,
    borderRadius:    24,
    borderWidth:     1,
    borderColor:     C.border,
    overflow:        'hidden',
  },
  stepBtn: {
    width:          34,
    height:         32,
    justifyContent: 'center',
    alignItems:     'center',
  },
  stepBtnDim: {
    opacity: 0.35,
  },
  stepTxt: {
    color:      C.white,
    fontSize:   18,
    lineHeight: 20,
    fontWeight: '400',
  },
  qtyTxt: {
    color:      C.white,
    fontSize:   14,
    fontWeight: '700',
    minWidth:   22,
    textAlign:  'center',
  },
  lineTotal: {
    color:      C.gold,
    fontSize:   14,
    fontWeight: '700',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = ({ onBack }: { onBack: () => void }) => (
  <View style={emptyStyles.wrap}>
    <EmptyCartIcon />
    <Text style={emptyStyles.title}>Your cart is empty</Text>
    <Text style={emptyStyles.sub}>Add something delicious from the menu</Text>
    <TouchableOpacity style={emptyStyles.btn} onPress={onBack} activeOpacity={0.85}>
      <Text style={emptyStyles.btnTxt}>Browse Menu</Text>
    </TouchableOpacity>
  </View>
);

const emptyStyles = StyleSheet.create({
  wrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  title: { color: C.whiteHigh, fontSize: 20, fontWeight: '700', marginTop: 8 },
  sub:   { color: C.whiteMid, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop:         12,
    backgroundColor:   C.gold,
    paddingHorizontal: 28,
    paddingVertical:   12,
    borderRadius:      24,
  },
  btnTxt: { color: C.white, fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY FOOTER
// Consistent gold home button — same visual language as FloatingBottomBar
// in menu_cato (gold circle, white icon, gold glow shadow).
// ─────────────────────────────────────────────────────────────────────────────

interface SummaryFooterProps {
  onConfirm:   () => void;
  onHome:      () => void;
  insetBottom: number;
}

const SummaryFooter = ({ onConfirm, onHome, insetBottom }: SummaryFooterProps) => (
  <View style={[footerStyles.wrap, { paddingBottom: insetBottom + 20 }]}>
    <View style={footerStyles.divider} />

    <View style={footerStyles.btnRow}>
      {/* Home button — gold circle, consistent with menu_cato & menu_welcome */}
      <TouchableOpacity style={footerStyles.homeBtn} onPress={onHome} activeOpacity={0.85}>
        <HomeIcon />
      </TouchableOpacity>

      {/* Place Order */}
      <TouchableOpacity style={footerStyles.confirmBtn} onPress={onConfirm} activeOpacity={0.88}>
        <CheckIcon />
        <Text style={footerStyles.confirmTxt}>Place Order</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const footerStyles = StyleSheet.create({
  wrap: {
    backgroundColor:      C.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingTop:           20,
    paddingHorizontal:    20,
    borderTopWidth:       1,
    borderColor:          C.border,
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -4 },
    shadowOpacity:        0.35,
    shadowRadius:         12,
    elevation:            12,
  },
  divider: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: C.whiteLow,
    alignSelf:       'center',
    marginBottom:    16,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  homeBtn: {
    width:           56,
    height:          52,
    borderRadius:    14,
    backgroundColor: C.gold,          // ← same gold as menu_cato FAB
    justifyContent:  'center',
    alignItems:      'center',
    shadowColor:     C.gold,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.45,
    shadowRadius:    10,
    elevation:       8,
  },
  confirmBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: C.confirm,
    borderRadius:    14,
    height:          52,
    gap:             10,
    shadowColor:     C.confirm,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    10,
    elevation:       6,
  },
  confirmTxt: { color: C.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const ReadyToEatScreen = () => {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { cartItems, increment, decrement, remove, clearAll } = useCartContext();

  const totalItems = useMemo(
    () => cartItems.reduce((sum: number, item: CartItem) => sum + item.qty, 0),
    [cartItems],
  );

  const handleBack = useCallback(() => router.back(), [router]);

  // ── Home button → password screen (consistent across all 3 screens) ───────
  const handleHome = useCallback(
    () => router.push('/menu/menu_clear' as any),
    [router],
  );

  const handleConfirm = useCallback(() => {
    clearAll();
    router.back();
  }, [clearAll, router]);

  const isEmpty = cartItems.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 0 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.75}>
          <BackIcon />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Ready to Eat?</Text>
          {!isEmpty && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeTxt}>{totalItems}</Text>
            </View>
          )}
        </View>

        {!isEmpty && (
          <TouchableOpacity onPress={clearAll} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearTxt}>Clear all</Text>
          </TouchableOpacity>
        )}
        {isEmpty && <View style={{ width: 60 }} />}
      </View>

      {/* ── Content ── */}
      {isEmpty ? (
        <EmptyState onBack={handleBack} />
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 16 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Your Order</Text>
              <Text style={styles.sectionCount}>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</Text>
            </View>

            {cartItems.map(item => (
              <CartRow
                key={item.id}
                item={item}
                onInc={increment}
                onDec={decrement}
                onRemove={remove}
              />
            ))}

            <View style={{ height: 8 }} />
          </ScrollView>

          <SummaryFooter
            onConfirm={handleConfirm}
            onHome={handleHome}
            insetBottom={insets.bottom}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderColor:       C.border,
  },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    borderWidth:     1.5,
    borderColor:     C.border,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: C.card,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  headerTitle: {
    color:         C.gold,
    fontSize:      20,
    fontWeight:    '700',
    letterSpacing: 0.2,
  },
  countBadge: {
    backgroundColor:  C.gold,
    borderRadius:     10,
    minWidth:         20,
    height:           20,
    justifyContent:   'center',
    alignItems:       'center',
    paddingHorizontal: 5,
  },
  countBadgeTxt: {
    color:      C.white,
    fontSize:   11,
    fontWeight: '800',
  },
  clearTxt: {
    color:      C.danger,
    fontSize:   13,
    fontWeight: '500',
  },
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 16 },
  sectionRow: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    paddingHorizontal: 20,
    marginBottom:     14,
  },
  sectionLabel: {
    color:      C.whiteHigh,
    fontSize:   17,
    fontWeight: '700',
  },
  sectionCount: {
    color:      C.whiteMid,
    fontSize:   13,
    fontWeight: '400',
  },
});

export default ReadyToEatScreen;