import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProtectedMenuExitModal } from '../../components/ProtectedMenuExitModal';
import { apiClient } from '../../services/api';
import { useCartStore } from '../../services/cartStore';
import { ITEM_PIC_PREFIX, useItemStore } from '../../services/itemStore';
import { useMenuSessionStore } from '../../services/menuSessionStore';
import { useOrderStore } from '../../services/orderStore';
import { storage } from '../../services/storage';

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

const PLACEHOLDER = require('../../assets/images/image-removebg-preview.png');

/**
 * Menu images are stored independently in MMKV by itemStore so the normal item
 * cache stays small. Resolve the same cached ItemPic / URL used by Menu Card,
 * keyed by the real Dining item code in cartStore.
 */
const getCustomerCartProductImage = (
  itemCode: string,
  menuRecord?: Record<string, any>,
): ImageSourcePropType => {
  const normalizedCode = String(itemCode ?? '').trim();

  try {
    const cachedPicture = normalizedCode
      ? storage.getString(`${ITEM_PIC_PREFIX}${normalizedCode}`)?.trim()
      : '';
    if (cachedPicture) {
      return {
        uri: cachedPicture.startsWith('data:')
          ? cachedPicture
          : `data:image/jpeg;base64,${cachedPicture}`,
      } as ImageSourcePropType;
    }
  } catch {
    // Continue to the URL / placeholder fallback if local image cache fails.
  }

  const itemPicture = String(menuRecord?.ItemPic ?? '').trim();
  if (itemPicture) {
    return {
      uri: itemPicture.startsWith('data:')
        ? itemPicture
        : `data:image/jpeg;base64,${itemPicture}`,
    } as ImageSourcePropType;
  }

  const imageUrl = String(
    menuRecord?.ItemImageUrl
      ?? menuRecord?.ImageUrl
      ?? menuRecord?.imageUrl
      ?? menuRecord?.PhotoUrl
      ?? menuRecord?.photoUrl
      ?? menuRecord?.Image
      ?? menuRecord?.image
      ?? '',
  ).trim();

  return imageUrl ? ({ uri: imageUrl } as ImageSourcePropType) : PLACEHOLDER;
};

type CustomerCartItem = {
  id: string;
  name: string;
  price: string;
  image: ImageSourcePropType;
  qty: number;
  existingBillQty: number;
};

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
  item:     CustomerCartItem;
  onInc:    (id: string) => void;
  onDec:    (id: string) => void;
  onRemove: (id: string) => void;
}

const CartRow = React.memo(({ item, onInc, onDec, onRemove }: CartRowProps) => {
  const lineTotal = parsePriceNum(item.price) * item.qty;
  const hasOnlyExistingBillQty = item.qty <= item.existingBillQty;

  return (
    <View style={rowStyles.card}>
      <Image source={item.image} style={rowStyles.image} resizeMode="cover" />

      <View style={rowStyles.details}>
        <View style={rowStyles.topRow}>
          <Text style={rowStyles.name} numberOfLines={2}>{item.name}</Text>
          <TouchableOpacity
            style={[rowStyles.trashBtn, hasOnlyExistingBillQty && rowStyles.trashBtnDisabled]}
            onPress={() => onRemove(item.id)}
            activeOpacity={0.7}
            disabled={hasOnlyExistingBillQty}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <TrashIcon />
          </TouchableOpacity>
        </View>

        <Text style={rowStyles.unitPrice}>{item.price} / item</Text>

        <View style={rowStyles.bottomRow}>
          <View style={rowStyles.stepper}>
            <TouchableOpacity
              style={[rowStyles.stepBtn, hasOnlyExistingBillQty && rowStyles.stepBtnDim]}
              onPress={() => onDec(item.id)}
              activeOpacity={0.7}
              disabled={hasOnlyExistingBillQty}
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

CartRow.displayName = 'CartRow';

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
  trashBtnDisabled: { opacity: 0.35 },
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
        <Text style={footerStyles.confirmTxt}>Confirm Order</Text>
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
  const realCartItems = useCartStore((state) => state.cartItems);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const setCartItems = useCartStore((state) => state.setCartItems);
  const clearCart = useCartStore((state) => state.clearCart);
  const menuItems = useItemStore((state) => state.items);
  const diningSession = useMenuSessionStore((state) => state.diningSession);
  const clearSavedCartItems = useMenuSessionStore((state) => state.clearSavedCartItems);
  const saveCartItems = useMenuSessionStore((state) => state.saveCartItems);

  const [handoffVisible, setHandoffVisible] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const menuItemByCode = useMemo(() => {
    const itemsByCode = new Map<string, Record<string, any>>();
    menuItems.forEach((item) => {
      const itemCode = String(item.MenuItemCode ?? item.ItemCode ?? item.itemCode ?? '').trim();
      if (itemCode) itemsByCode.set(itemCode, item);
    });
    return itemsByCode;
  }, [menuItems]);

  const existingBillQuantityByCode = useMemo(() => new Map(
    (diningSession?.existingBillItems ?? []).map((item) => [item.menuItemCode, item.quantity]),
  ), [diningSession?.existingBillItems]);

  const cartItems = useMemo<CustomerCartItem[]>(() => realCartItems.map((item) => ({
    id: item.menuItemCode,
    name: item.menuItmDes,
    price: formatPrice(item.salesPrice),
    image: getCustomerCartProductImage(item.menuItemCode, menuItemByCode.get(item.menuItemCode)),
    qty: item.quantity,
    existingBillQty: existingBillQuantityByCode.get(item.menuItemCode) ?? 0,
  })), [existingBillQuantityByCode, menuItemByCode, realCartItems]);

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems],
  );

  const handleBack = useCallback(() => router.back(), [router]);
  const handleHome = useCallback(() => setExitModalVisible(true), []);

  const increment = useCallback((itemCode: string) => updateQuantity(itemCode, 1), [updateQuantity]);
  const decrement = useCallback((itemCode: string) => {
    const current = realCartItems.find((item) => item.menuItemCode === itemCode);
    const existingBillQuantity = existingBillQuantityByCode.get(itemCode) ?? 0;
    if (current && current.quantity > existingBillQuantity) updateQuantity(itemCode, -1);
  }, [existingBillQuantityByCode, realCartItems, updateQuantity]);
  const remove = useCallback((itemCode: string) => {
    const current = realCartItems.find((item) => item.menuItemCode === itemCode);
    const existingBillQuantity = existingBillQuantityByCode.get(itemCode) ?? 0;
    if (current && current.quantity > existingBillQuantity) {
      updateQuantity(itemCode, existingBillQuantity - current.quantity);
    }
  }, [existingBillQuantityByCode, realCartItems, updateQuantity]);

  const handleClear = useCallback(() => {
    const existingBillItems = diningSession?.existingBillItems ?? [];
    if (existingBillItems.length > 0) {
      // Keep already-confirmed bill items and clear only this customer's new additions.
      setCartItems(existingBillItems);
      saveCartItems(existingBillItems);
      return;
    }
    clearCart();
    clearSavedCartItems();
  }, [clearCart, clearSavedCartItems, diningSession?.existingBillItems, saveCartItems, setCartItems]);

  const openHandoff = () => {
    if (!cartItems.length) return;
    setPassword('');
    setPasswordError('');
    setHandoffVisible(true);
  };

  const handoffToMainCart = async () => {
    const value = password.trim();
    if (!value) {
      setPasswordError('Enter the logged-in user password to continue.');
      return;
    }
    if (!diningSession) {
      setPasswordError('Table session is missing. Please select the table again.');
      return;
    }

    setVerifying(true);
    setPasswordError('');
    try {
      const result = await apiClient.verifyCurrentPassword(value);
      if (!result.ok || !result.data?.ok) {
        setPasswordError(result.data?.message || 'Incorrect password.');
        return;
      }

      const existingInvoiceNo = String(diningSession.existingInvoiceNo ?? '').trim();
      const existingBillItems = diningSession.existingBillItems ?? [];
      if (existingInvoiceNo && existingBillItems.length > 0) {
        // Main Cart's add-more path needs the original bill quantities as its
        // baseline so an item already on the bill is increased, not replaced.
        useOrderStore.getState().setLastConfirmedOrder({
          orderType: 'DI',
          tableNo: diningSession.tableNo,
          userId: 'SYSTEM',
          tableGrpId: diningSession.groupId,
          lPax: Number(diningSession.localPax) || 0,
          fPax: Number(diningSession.foreignPax) || 0,
          invoiceNo: existingInvoiceNo,
          createdAt: new Date().toISOString(),
          items: existingBillItems,
        });
      }

      setHandoffVisible(false);
      setPassword('');
      router.push({
        pathname: '/Screens/cart',
        params: {
          tableName: diningSession.tableName,
          tableNo: diningSession.tableNo,
          tableId: diningSession.groupId,
          localPax: diningSession.localPax,
          foreignPax: diningSession.foreignPax,
          floor: diningSession.floor,
          orderType: diningSession.orderType,
          // Existing-table customer orders must append to this invoice.
          fromBilling: existingInvoiceNo ? '1' : undefined,
          invoiceNo: existingInvoiceNo || undefined,
          // Lets Main Cart remove the persisted Menu Card snapshot only after
          // the real Dining order is successfully submitted.
          menuCardOrder: '1',
        },
      });
    } catch {
      setPasswordError('Unable to verify password. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

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
          <TouchableOpacity onPress={handleClear} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            onConfirm={openHandoff}
            onHome={handleHome}
            insetBottom={insets.bottom}
          />
        </>
      )}

      <Modal
        visible={handoffVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !verifying && setHandoffVisible(false)}
      >
        <TouchableWithoutFeedback onPress={verifying ? undefined : () => setHandoffVisible(false)}>
          <View style={styles.handoffOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.handoffCard}>
                <View style={styles.handoffIcon}><Text style={styles.handoffIconText}>🔐</Text></View>
                <Text style={styles.handoffTitle}>Staff confirmation</Text>
                <Text style={styles.handoffDescription}>
                  Please enter the logged-in user password to send this customer order to the main cart.
                </Text>
                <TextInput
                  style={[styles.handoffInput, Boolean(passwordError) && styles.handoffInputError]}
                  value={password}
                  onChangeText={(value) => { setPassword(value); if (passwordError) setPasswordError(''); }}
                  placeholder="User password / PIN"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!verifying}
                  returnKeyType="done"
                  onSubmitEditing={() => void handoffToMainCart()}
                />
                {passwordError ? <Text style={styles.handoffError}>{passwordError}</Text> : null}
                <View style={styles.handoffActions}>
                  <TouchableOpacity
                    style={styles.handoffCancel}
                    onPress={() => setHandoffVisible(false)}
                    disabled={verifying}
                  >
                    <Text style={styles.handoffCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.handoffConfirm}
                    onPress={() => void handoffToMainCart()}
                    disabled={verifying}
                  >
                    {verifying ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.handoffConfirmText}>Confirm</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <ProtectedMenuExitModal visible={exitModalVisible} onClose={() => setExitModalVisible(false)} />
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
  handoffOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  handoffCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: C.border,
  },
  handoffIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.goldSoft,
    marginBottom: 14,
  },
  handoffIconText: { fontSize: 22 },
  handoffTitle: { color: C.white, fontSize: 20, fontWeight: '800' },
  handoffDescription: { color: C.whiteMid, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 17 },
  handoffInput: {
    height: 52,
    borderRadius: 13,
    paddingHorizontal: 14,
    color: C.white,
    fontSize: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  handoffInputError: { borderColor: C.danger },
  handoffError: { color: C.danger, fontSize: 12, marginTop: 7 },
  handoffActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  handoffCancel: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  handoffCancelText: { color: C.whiteMid, fontSize: 14, fontWeight: '700' },
  handoffConfirm: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.confirm,
  },
  handoffConfirmText: { color: C.white, fontSize: 14, fontWeight: '800' },
});

export default ReadyToEatScreen;