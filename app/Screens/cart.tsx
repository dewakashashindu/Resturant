import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { default as React, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient, getCachedOrderDescriptions } from '../../services/api';
import { useAuthStore } from '../../services/authStore';
import { CartItem, useCartStore } from '../../services/cartStore';
import useItemStore from '../../services/itemStore';
import { useOrderStore } from '../../services/orderStore';

type CartDisplayItem = CartItem & {
  isExisting?: boolean;
};

export default function CartScreen() {
  const router = useRouter();
  const { tableName, tableId, localPax, foreignPax, floor, status, fromBilling, invoiceNo: routeInvoiceNo } = useLocalSearchParams<{
    tableName?: string;
    tableId?: string;
    localPax?: string;
    foreignPax?: string;
    floor?: string;
    status?: string;
    fromBilling?: string;
    invoiceNo?: string;
  }>();
  const isFromBilling = fromBilling === '1';
  const orderType = useCartStore((state) => state.orderType);
  const customerInfo = useCartStore((state) => state.customerInfo);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isTablet = width >= 600;
  const isSmall = height < 700;

  const predefinedRemarks = [
    'No Spicy',
    'Extra Spicy',
    'Less Sugar',
    'No Onions',
    'Takeaway'
  ];

  const hPad = isTablet ? 40 : 16;
  const headerMT = isTablet ? 60 : isSmall ? 12 : 20;
  const titleFs = isTablet ? 32 : isSmall ? 20 : 24;
  const itemTitleFs = isTablet ? 24 : isSmall ? 18 : 20;
  const priceFs = isTablet ? 18 : isSmall ? 13 : 14;
  const clearCartFs = isTablet ? 20 : isSmall ? 11 : 12;
  const remarkFs = isTablet ? 18 : isSmall ? 13 : 14;
  const qtyFs = isTablet ? 18 : isSmall ? 14 : 16;
  const qtyBtnSize = isTablet ? 34 : 28;
  const btnH = isTablet ? 64 : isSmall ? 48 : 54;
  const listBottomPad = isTablet ? 140 : 110;
  const footerPad = isTablet ? 24 : 16;

  const badgeFs   = isTablet ? 14 : isSmall ? 11 : 12;
  const badgePadH = isTablet ? 16 : isSmall ? 10 : 12;
  const badgePadV = isTablet ? 8  : isSmall ? 5  : 6;

  const cartItems = useCartStore((state) => state.cartItems);
  const updateQuantityInCart = useCartStore((state) => state.updateQuantity);
  const clearCartInStore = useCartStore((state) => state.clearCart);
  const lastConfirmedOrder = useOrderStore((s) => s.lastConfirmedOrder);

  const existingBillItems = useMemo<CartDisplayItem[]>(() => {
    if (!isFromBilling || !lastConfirmedOrder?.items?.length) return [];

    return lastConfirmedOrder.items.map((item) => ({
      menuItemCode: item.menuItemCode,
      menuItmDes: item.menuItmDes ?? '',
      salesPrice: Number(item.salesPrice ?? 0),
      quantity: Math.max(0, Number(item.quantity ?? 0)),
      itemRemarks: item.itemRemarks ?? '',
      isExisting: true,
    }));
  }, [isFromBilling, lastConfirmedOrder]);

  const editableCartItems = useMemo<CartDisplayItem[]>(() => {
    if (!isFromBilling || !lastConfirmedOrder?.items?.length) {
      return cartItems.map((item) => ({ ...item, isExisting: false }));
    }

    const existingQtyByCode = new Map<string, number>();
    for (const item of lastConfirmedOrder.items) {
      existingQtyByCode.set(
        item.menuItemCode,
        (existingQtyByCode.get(item.menuItemCode) ?? 0) + Number(item.quantity ?? 0),
      );
    }

    return cartItems
      .map((item) => {
        const existingQty = existingQtyByCode.get(item.menuItemCode) ?? 0;
        const deltaQty = Math.max(0, Number(item.quantity ?? 0) - existingQty);
        if (deltaQty <= 0) return null;
        return {
          ...item,
          quantity: deltaQty,
          isExisting: false,
        };
      })
      .filter((item) => item !== null) as CartDisplayItem[];
  }, [cartItems, isFromBilling, lastConfirmedOrder]);

  const displayCartItems = useMemo<CartDisplayItem[]>(
    () => (isFromBilling ? [...existingBillItems, ...editableCartItems] : editableCartItems),
    [editableCartItems, existingBillItems, isFromBilling],
  );

  const newCartItemsForConfirm = useMemo(
    () => displayCartItems.filter((item) => !item.isExisting),
    [displayCartItems],
  );

  const currentInvoiceNo = routeInvoiceNo
    ? String(routeInvoiceNo)
    : lastConfirmedOrder?.invoiceNo
      ? String(lastConfirmedOrder.invoiceNo)
      : null;

  // ── Item store — used to look up Category per cart item ──────────────────
  const storeItems = useItemStore((state) => state.items);

  // Build a quick lookup: menuItemCode → Category (F/B/S/O)
  const categoryByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of storeItems) {
      const code = String(item.MenuItemCode ?? item.ItemCode ?? '').trim();
      const cat  = String(item.Category ?? '').trim();
      if (code && cat) map[code] = cat;
    }
    return map;
  }, [storeItems]);

  // Human-readable label for each category code
  const CATEGORY_LABELS: Record<string, string> = {
    F: 'Foods',
    B: 'Beverages',
    S: 'Siga',
    O: 'Others',
  };

  // Priority order for sections (matches server ORDER BY)
  const CATEGORY_ORDER = ['F', 'B', 'S', 'O'];

  type CartSection = { categoryCode: string; label: string; items: CartDisplayItem[] };

  // Group cartItems by Category; unknown items go to 'Others' bucket
  const cartSections = useMemo((): CartSection[] => {
    const buckets: Record<string, CartDisplayItem[]> = {};
    for (const item of displayCartItems) {
      const cat = categoryByCode[item.menuItemCode] ?? 'O';
      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push(item);
    }
    // Sort sections by known order, then alphabetically for any unknown codes
    const knownOrder = CATEGORY_ORDER.filter((c) => buckets[c]);
    const unknownOrder = Object.keys(buckets)
      .filter((c) => !CATEGORY_ORDER.includes(c))
      .sort();
    return [...knownOrder, ...unknownOrder].map((cat) => ({
      categoryCode: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      items: buckets[cat],
    }));
  }, [displayCartItems, categoryByCode]);

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [remarkVisible, setRemarkVisible] = useState(false);
  const [activeRemarkItemId, setActiveRemarkItemId] = useState<string | null>(null);
  const [activeRemarkItemName, setActiveRemarkItemName] = useState('');
  const [remarkDraft, setRemarkDraft] = useState('');
  const [remarksByCode, setRemarksByCode] = useState<Record<string, string>>({});
  const [modalTags, setModalTags] = useState<string[]>([]);
  const [isViewingRemarkPresets, setIsViewingRemarkPresets] = useState(false);
  const [remarkOptions, setRemarkOptions] = useState<string[]>(() => getCachedOrderDescriptions());
  const [loadingRemarkOptions, setLoadingRemarkOptions] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);

  const [confirming, setConfirming] = useState(false);

  const displayTable = tableName ?? tableId ?? 'GF 1';
  const displayLocalPax = localPax ?? '0';
  const displayForeignPax = foreignPax ?? '0';
  const tableInfo = [
    { label: 'Table', value: displayTable },
    { label: 'Floor', value: floor ?? '—' },
    { label: 'Local Pax', value: displayLocalPax },
    { label: 'Foreign Pax', value: displayForeignPax },
    { label: 'Status', value: status ?? 'Active' },
  ];

  // Counts only unique types of items
  const totalItemsCount = displayCartItems.length;
  const currentUser = useAuthStore((state) => state.user);
  useEffect(() => {
    // Instantly load the same globally synced preset list into the Cart view modal.
    setRemarkOptions(getCachedOrderDescriptions());
  }, []);

  const openRemarkModal = (item: CartItem) => {
    setActiveRemarkItemId(item.menuItemCode);
    setActiveRemarkItemName(item.menuItmDes);
    const existing = (item.itemRemarks ?? remarksByCode[item.menuItemCode] ?? '').trim();
    const parts = existing ? existing.split(',').map(s => s.trim()).filter(Boolean) : [];
    setModalTags(parts);
    setRemarkDraft('');
    setEditingTagIndex(null);
    setIsViewingRemarkPresets(false);
    setRemarkVisible(true);
  };

  const loadRemarkOptions = async () => {
    setLoadingRemarkOptions(true);
    try {
      const descriptions = await apiClient.getOrderDescriptions();
      console.log('Fetched database remarks:', descriptions);
      if (descriptions.length > 0) {
        setRemarkOptions(descriptions);
      } else {
        console.log('No database remarks found, using fallback presets.');
        setRemarkOptions(predefinedRemarks);
      }
    } catch (error) {
      console.log('Failed to fetch database remarks:', error);
      setRemarkOptions(predefinedRemarks);
    } finally {
      setLoadingRemarkOptions(false);
    }
  };

  const editTag = (tag: string, index: number) => {
    setRemarkDraft(tag);
    setEditingTagIndex(index);
    setModalTags(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = (tag: string) => {
    const t = String(tag || '').trim();
    if (!t) return;
    setModalTags(prev => {
      if (editingTagIndex !== null) {
        const next = [...prev];
        const insertAt = Math.max(0, Math.min(editingTagIndex, next.length));
        next.splice(insertAt, 0, t);
        return next;
      }
      return prev.includes(t) ? prev : [...prev, t];
    });
    setRemarkDraft('');
    setEditingTagIndex(null);
    setIsViewingRemarkPresets(false);
  };

  const removeTag = (tag: string) => {
    setModalTags(prev => {
      const removeIndex = prev.indexOf(tag);
      if (removeIndex === -1) return prev;
      const next = prev.filter((t, i) => i !== removeIndex);
      setEditingTagIndex(current => {
        if (current === null) return null;
        if (current === removeIndex) return null;
        return current > removeIndex ? current - 1 : current;
      });
      return next;
    });
  };

  const saveRemarks = () => {
    if (!activeRemarkItemId) return;
    const trimmedDraft = remarkDraft.trim();
    const finalTags = [...modalTags];

    if (trimmedDraft) {
      if (editingTagIndex !== null) {
        const insertAt = Math.max(0, Math.min(editingTagIndex, finalTags.length));
        finalTags.splice(insertAt, 0, trimmedDraft);
      } else if (!finalTags.includes(trimmedDraft)) {
        finalTags.push(trimmedDraft);
      }
    }

    const compiled = finalTags.join(', ');
    const currentItem = cartItems.find((item) => item.menuItemCode === activeRemarkItemId);

    if (currentItem) {
      useCartStore.getState().upsertCartItem({
        menuItemCode: currentItem.menuItemCode,
        menuItmDes: currentItem.menuItmDes,
        salesPrice: currentItem.salesPrice,
        quantity: currentItem.quantity,
        itemRemarks: compiled,
      });
    }

    setRemarksByCode(items => ({
      ...items,
      [activeRemarkItemId]: compiled,
    }));
    setRemarkVisible(false);
    setActiveRemarkItemId(null);
    setActiveRemarkItemName('');
    setEditingTagIndex(null);
    setIsViewingRemarkPresets(false);
  };

  const total = displayCartItems.reduce((sum, item) => sum + item.salesPrice * item.quantity, 0);

  const removeItem = (item: CartItem) => {
    if ((item as CartDisplayItem).isExisting) return;
    updateQuantityInCart(item.menuItemCode, -item.quantity);
    setRemarksByCode(items => {
      const next = { ...items };
      delete next[item.menuItemCode];
      return next;
    });
  };

const handleConfirm = async () => {
  if (!displayCartItems || displayCartItems.length === 0) {
    Alert.alert('Cart is empty', 'Please add items before confirming.');
    return;
  }

  const isFromBilling = fromBilling === '1';
  const confirmItems = isFromBilling ? newCartItemsForConfirm : displayCartItems;

  // 1. Billing flow එකේදී items නැත්නම් කෙලින්ම යන්න
  if (isFromBilling && confirmItems.length === 0) {
    router.push({
      pathname: '/Screens/BillingScreen',
      params: {
        tableName: tableName ?? displayTable,
        tableNo: String(lastConfirmedOrder?.tableNo ?? tableName ?? ''),
        invoiceNo: String(currentInvoiceNo ?? ''),
        localPax: displayLocalPax,
        foreignPax: displayForeignPax,
        floor: floor ?? '',
        status: status ?? '',
      },
    });
    return;
  }

  let finalTableNo = lastConfirmedOrder?.tableNo 
    ? lastConfirmedOrder.tableNo 
    : (orderType === 'TA' ? '' : (tableName ?? displayTable));

  const consolidatedItems = confirmItems.reduce((acc: any[], current: any) => {
    const existing = acc.find(item => item.menuItemCode === current.menuItemCode);
    if (existing) {
      existing.quantity += current.quantity; 
    } else {
      acc.push({ ...current });
    }
    return acc;
  }, []);

  const finalOrderType = isFromBilling 
    ? (lastConfirmedOrder?.orderType || 'DI') 
    : (orderType || 'DI');

  const finalTableGrpID = isFromBilling 
    ? (lastConfirmedOrder?.tableGrpId ?? (tableId === 'TA-PENDING' ? ' ' : ''))
    : (tableId === 'TA-PENDING' ? ' ' : (tableId ?? ''));

  const payload = {
    OrderType: finalOrderType,
    orderType: finalOrderType, 
    TableNo: finalTableNo,
    tableNo: finalTableNo,
    tableId: finalTableNo,
    UserID: currentUser?.userName ? String(currentUser.userName) : (currentUser?.userId ? String(currentUser.userId) : 'SYSTEM'),
    userId: currentUser?.userName ? String(currentUser.userName) : (currentUser?.userId ? String(currentUser.userId) : 'SYSTEM'),
    TabelGrpID: finalTableGrpID,
    TableGrpID: finalTableGrpID,
    tableGrpId: finalTableGrpID,
    lPax: Number(localPax ?? 0),
    fPax: Number(foreignPax ?? 0),
    existingInvoiceNo: isFromBilling ? currentInvoiceNo : null,
    items: consolidatedItems.map((i: any) => ({
      ItemCode: i.menuItemCode,   
      itemCode: i.menuItemCode,   
      QTY: i.quantity,            
      quantity: i.quantity,       
      SalesPrice: i.salesPrice,   
      salesPrice: i.salesPrice,   
      ItemRemarks: i.itemRemarks || remarksByCode[i.menuItemCode] || '', 
      itemRemarks: i.itemRemarks || remarksByCode[i.menuItemCode] || '',
    })),
    customerDetails: finalOrderType === 'TA' ? {
      regTel: customerInfo?.contactNumber || '',
      cusName: customerInfo?.customerName || '',
      rmks: customerInfo?.remark || ''
    } : null
  };

  try {
    setConfirming(true);
    let generatedTableNo = lastConfirmedOrder?.tableNo;
    let finalInvoiceNo = currentInvoiceNo; 

    const isPending = !generatedTableNo || generatedTableNo === 'TA-PENDING';

    if (isPending || isFromBilling) {
      const res = await apiClient.confirmCart(payload as any);
      if (res.ok || (res.data && res.data.ok)) {
        generatedTableNo = res.data?.data?.tableNo || res.data?.data?.TableNo || generatedTableNo;
        finalInvoiceNo = res.data?.data?.invoiceNo || res.data?.data?.InvoiceNo || res.data?.invoiceNo || currentInvoiceNo;
      } else {
        const serverMsg = res.data && (res.data.message || JSON.stringify(res.data));
        Alert.alert('Error', serverMsg || 'Failed to save order');
        setConfirming(false);
        return;
      }
    }

    // 🌟 Billing එකෙන් ආවා නම් Memory එක Merge කරන්නේ නැත (Duplicate වැළැක්වීමට)
    if (!isFromBilling) {
      const currentNewItems = (payload.items as any[]).map((it) => ({
        ...it,
        salesPrice: confirmItems.find(c => c.menuItemCode === (it.ItemCode || it.itemCode))?.salesPrice ?? 0,
        menuItmDes: confirmItems.find(c => c.menuItemCode === (it.ItemCode || it.itemCode))?.menuItmDes ?? '',
      }));

      (useOrderStore.getState() as any).setLastConfirmedOrder({
        ...payload,
        tableNo: generatedTableNo ?? '', 
        items: currentNewItems,
        createdAt: lastConfirmedOrder?.createdAt ?? new Date().toISOString(),
        invoiceNo: finalInvoiceNo, 
      });
    }

    router.push({
      pathname: '/Screens/BillingScreen',
      params: {
        tableName: tableName ?? displayTable,
        tableNo: generatedTableNo,
        invoiceNo: finalInvoiceNo || '',
        localPax: displayLocalPax,
        foreignPax: displayForeignPax,
        floor: floor ?? '',
        status: status ?? '',
        fromBilling: isFromBilling ? '1' : undefined,
        fromCart: isFromBilling ? '1' : undefined, // මෙය BillingScreen එකේදී fresh DB fetch එකක් trigger කරයි
      },
    });

  } catch (error) {
    console.error('confirmCart exception', error);
    Alert.alert('Error', 'Failed to save order');
  } finally {
    setConfirming(false);
  }
};


  const decrementItem = (item: CartItem) => {
    if (item.quantity <= 1) {
      removeItem(item);
      return;
    }
    updateQuantityInCart(item.menuItemCode, -1);
  };

  const incrementItem = (item: CartItem) => {
    updateQuantityInCart(item.menuItemCode, 1);
  };

  const renderItem = ({ item }: { item: CartDisplayItem }) => {
    // Calculate total price for this specific item based on quantity
    const itemTotal = item.salesPrice * item.quantity;
    const remarkText = (item.itemRemarks || remarksByCode[item.menuItemCode] || '').trim();
    const isReadOnly = Boolean(item.isExisting);
    // New items added via "Add More" get a highlighted border
    const isNewAddition = isFromBilling && !item.isExisting;

 return (
  <View style={[
    styles.itemContainer,
    isReadOnly && styles.itemContainerReadOnly,
   
  ]}>
    <View style={styles.itemHeader}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0, marginRight: 8, gap: 6 }}>
        <Text
          style={[
            styles.itemName,
            { fontSize: itemTitleFs, flex: 1 },
            isReadOnly && styles.itemNameReadOnly,
          ]}
        >
          {item.menuItmDes}
        </Text>
        
      </View>
      <TouchableOpacity onPress={() => removeItem(item)} disabled={isReadOnly}>
        <Ionicons name="trash-outline" size={isTablet ? 28 : 22} color="rgba(0,0,0,0.5)" />
      </TouchableOpacity>
    </View>

    {/* Updated Price Layout: Single Price x Qty = Total Price */}
    <Text style={[styles.itemPrice, { fontSize: priceFs }, isReadOnly && styles.itemPriceReadOnly]}>
      Lkr {item.salesPrice.toFixed(2)} × {item.quantity} = Lkr {itemTotal.toFixed(2)}
    </Text>

    {!!remarkText && (
      <TouchableOpacity
        style={styles.itemRemarkBlock}
        activeOpacity={0.8}
        onPress={() => (!isReadOnly ? openRemarkModal(item) : undefined)}
        disabled={isReadOnly}
      >
        <Text
          style={[
            styles.remarkPreview,
            { fontSize: remarkFs - 1 },
            isReadOnly && styles.remarkPreviewReadOnly,
          ]}
          numberOfLines={2}
        >
          {remarkText}
        </Text>
      </TouchableOpacity>
    )}

    <View style={styles.itemFooter}>
      <TouchableOpacity
        style={styles.remarkBtn}
        onPress={() => (!isReadOnly ? openRemarkModal(item) : undefined)}
        disabled={isReadOnly}
      >
        <Text style={[styles.remarkText, { fontSize: remarkFs }, isReadOnly && styles.remarkTextReadOnly]}>
          {remarkText ? 'Edit Order Remark' : 'Add Order Remark'}
        </Text>
      </TouchableOpacity>

      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={[
            styles.qtyBtn,
            { width: qtyBtnSize, height: qtyBtnSize, borderRadius: qtyBtnSize / 2 },
            isReadOnly && styles.qtyBtnDisabled,
          ]}
          disabled={isReadOnly}
          onPress={() => decrementItem(item)}
        >
          <Text style={[styles.qtyText, isReadOnly && styles.qtyTextDisabled]}>-</Text>
        </TouchableOpacity>
        <Text style={[styles.qtyValue, { fontSize: qtyFs }, isReadOnly && styles.qtyValueReadOnly]}>{item.quantity}</Text>
        <TouchableOpacity
          style={[
            styles.qtyBtn,
            { width: qtyBtnSize, height: qtyBtnSize, borderRadius: qtyBtnSize / 2 },
            isReadOnly && styles.qtyBtnDisabled,
          ]}
          disabled={isReadOnly}
          onPress={() => incrementItem(item)}
        >
          <Text style={[styles.qtyText, isReadOnly && styles.qtyTextDisabled]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
    <View style={styles.divider} />
  </View>
);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={[styles.header, { marginTop: headerMT, paddingHorizontal: hPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonAbsolute}>
          <Image
            source={require('../../assets/icons/blackback.png')}
            style={{ width: isTablet ? 56 : 44, height: isTablet ? 56 : 44 }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { fontSize: titleFs }]}>Cart</Text>

        <TouchableOpacity
          style={[
            styles.tableBadge,
            { paddingHorizontal: badgePadH, paddingVertical: badgePadV },
          ]}
          onPress={() => setDropdownVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tableBadgeText, { fontSize: badgeFs }]}>
            {displayTable}
          </Text>
          <View style={styles.dropdownArrow} />
        </TouchableOpacity>
      </View>

      {/* TABLE INFO MODAL */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[
                styles.dropdown,
                {
                  right: hPad,
                  top: headerMT + 70,
                  minWidth: isTablet ? 240 : 200,
                },
              ]}>
                <View style={styles.dropdownHeader}>
                  <Text style={[styles.dropdownTitle, { fontSize: isTablet ? 16 : 14 }]}>
                    Table Info
                  </Text>
                  <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                    <Text style={[styles.dropdownClose, { fontSize: isTablet ? 16 : 14 }]}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.ddDivider} />

                {tableInfo.map((info, i) => (
                  <View key={i} style={styles.dropdownRow}>
                    <Text style={[styles.dropdownLabel, { fontSize: isTablet ? 14 : 13 }]}>
                      {info.label}
                    </Text>
                    <Text style={[styles.dropdownValue, { fontSize: isTablet ? 14 : 13 }]}>
                      {info.value}
                    </Text>
                  </View>
                ))}

                <View style={styles.ddDivider} />

                <TouchableOpacity
                  style={[styles.changeTableBtn, { paddingVertical: isTablet ? 12 : 10 }]}
                  onPress={() => {
                    setDropdownVisible(false);
                    if (orderType === 'TA') {
                      router.push('/Screens/operation');
                    } else {
                      clearCartInStore();
                      setRemarksByCode({});
                      router.push('/Screens/tableselection');
                    }
                  }}
                >
                  <Text style={[styles.changeTableText, { fontSize: isTablet ? 14 : 13 }]}>
                    {orderType === 'TA' ? 'Change Order' : 'Change Table'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ORDER REMARK OVERLAY */}
      <Modal
        visible={remarkVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRemarkVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setRemarkVisible(false)}>
          <View style={styles.remarkModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.remarkCard}>
                {!isViewingRemarkPresets ? (
                  <>
                    <View style={styles.remarkCardHeader}>
                      <Text style={styles.remarkCardHeaderTitle}>Order Remark</Text>
                      <TouchableOpacity onPress={() => setRemarkVisible(false)} activeOpacity={0.8}>
                        <Ionicons name="close" size={22} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.remarkCardBody}>
                      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.remarkCardContent} style={styles.remarkScrollArea}>
                        <View style={styles.tagsWrap}>
                          {modalTags.map((t, index) => (
                            <View key={`${t}-${index}`} style={styles.tagBadge}>
                              <TouchableOpacity onPress={() => editTag(t, index)} style={styles.tagLabelBtn} activeOpacity={0.75}>
                                <Text style={styles.tagText}>{t}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => removeTag(t)} style={styles.tagClose}>
                                <Ionicons name="close" size={14} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>

                        <View style={styles.remarkInputRow}>
                          <View style={styles.remarkInputShell}>
                            <TextInput
                              value={remarkDraft}
                              onChangeText={setRemarkDraft}
                              placeholder="Type custom remark"
                              placeholderTextColor="rgba(0,0,0,0.5)"
                              style={styles.remarkInput}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                setIsViewingRemarkPresets(true);
                              }}
                              style={styles.remarkDropdownIconBtn}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="chevron-down" size={20} color="#0062AA" />
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity style={styles.addTagBtn} onPress={() => addTag(remarkDraft)}>
                            <Text style={styles.addTagText}>Add Tag</Text>
                          </TouchableOpacity>
                        </View>
                      </ScrollView>

                      <TouchableOpacity style={styles.saveRemarkBtn} onPress={saveRemarks} activeOpacity={0.85}>
                        <Text style={styles.saveRemarkText}>Save Remarks</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.remarkCardHeader}>
                      <TouchableOpacity onPress={() => setIsViewingRemarkPresets(false)} activeOpacity={0.8} style={styles.remarkHeaderIconBtn}>
                        <Ionicons name="arrow-back" size={22} color="#0F172A" />
                      </TouchableOpacity>
                      <Text style={styles.remarkCardHeaderTitle}>Select Preset Remark</Text>
                      <TouchableOpacity onPress={() => setRemarkVisible(false)} activeOpacity={0.8} style={styles.remarkHeaderIconBtn}>
                        <Ionicons name="close" size={22} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.presetsDivider} />

                    {loadingRemarkOptions ? (
                      <View style={styles.presetsLoaderWrap}>
                        <ActivityIndicator size="small" color="#002748" />
                      </View>
                    ) : (
                      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.presetsListContent}>
                        {remarkOptions.map((r) => (
                          <TouchableOpacity key={r} style={styles.presetsRow} onPress={() => addTag(r)}>
                            <Text style={styles.presetsRowText}>{r}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ITEMS COUNT & CLEAR CART */}
      <View style={[styles.actionHeaderRow, { paddingHorizontal: hPad }]}>
        <Text style={[styles.itemsCountText, { fontSize: clearCartFs + 1 }]}>
          Items: {totalItemsCount}
        </Text>
        
        <TouchableOpacity
          style={styles.clearCartBtn}
          onPress={() => {
            clearCartInStore();
            setRemarksByCode({});
          }}
        >
          <Text style={[styles.clearCartText, { fontSize: clearCartFs }]}>Clear Cart</Text>
        </TouchableOpacity>
      </View>

      {/* LIST — grouped by category */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: hPad, paddingBottom: listBottomPad + insets.bottom },
        ]}
      >
        {displayCartItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Your cart is empty</Text>
          </View>
        ) : (
          <>
            {cartSections.map((section) => (
              <View key={section.categoryCode}>
                {/* Category section header */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{section.label}</Text>
                  <View style={styles.sectionHeaderLine} />
                </View>
                {section.items.map((item) => (
                  <React.Fragment key={item.menuItemCode}>
                    {renderItem({ item })}
                  </React.Fragment>
                ))}
              </View>
            ))}

            {/* Add More button */}
            <View style={styles.addMoreWrap}>
              <TouchableOpacity
                style={styles.addMoreBtn}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/Screens/selectitems',
                    params: {
                      tableName: tableName ?? displayTable,
                      localPax: displayLocalPax,
                      foreignPax: displayForeignPax,
                      floor: floor ?? '',
                      status: status ?? '',
                      invoiceNo: currentInvoiceNo ?? '',
                      fromBilling: isFromBilling ? '1' : undefined,
                    },
                  })
                }
              >
                <Text style={styles.addMoreText}>Add More</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* FOOTER */}
      <View style={[styles.footer, { padding: footerPad }]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { fontSize: isTablet ? 18 : 16 }]}>
            Gross Total (Lkr)
          </Text>
          <Text style={[styles.totalValue, { fontSize: isTablet ? 18 : 16 }]}>
            {total.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.confirmBtn, { height: btnH }]}
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={[styles.confirmText, { fontSize: isTablet ? 24 : isSmall ? 16 : 18 }]}>Confirm</Text>
              <Ionicons name="checkmark-circle-outline" size={isTablet ? 28 : 24} color="white" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    position: 'relative',
  },
  headerTitle:        { fontWeight: '500', color: 'black', textAlign: 'center', flex: 1, top: 25 },
  backButtonAbsolute: { position: 'absolute', left: 20, top: 30, zIndex: 2 },

  tableBadge:     { flexDirection: 'row', backgroundColor: 'rgba(0,98,170,0.15)', borderRadius: 20, alignItems: 'center', gap: 6, top: 25, },
  tableBadgeText: { color: '#000', fontWeight: '600' },
  dropdownArrow:  { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#000' },

  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  dropdown:        { position: 'absolute', backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 8, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  dropdownHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  dropdownTitle:   { fontWeight: '700', color: '#002748' },
  dropdownClose:   { color: '#888', fontWeight: '600' },
  ddDivider:       { height: 1, backgroundColor: '#EEE', marginVertical: 4 },
  dropdownRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  dropdownLabel:   { color: '#666', fontWeight: '500' },
  dropdownValue:   { color: '#000', fontWeight: '700' },
  changeTableBtn:  { marginHorizontal: 12, marginTop: 4, marginBottom: 6, backgroundColor: '#002748', borderRadius: 10, alignItems: 'center' },
  changeTableText: { color: '#FFF', fontWeight: '700' },

  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 45,
    marginBottom: 5,
  },
  itemsCountText: {
    color: '#334155',
    fontWeight: '700',
  },
  clearCartBtn:       { alignSelf: 'flex-end' },
  clearCartText:      { color: '#DB6161', fontWeight: '500' },
  
  listContent:        { paddingHorizontal: 16, paddingBottom: 100 },
  emptyContainer:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText:          { color: '#999', fontSize: 16, fontWeight: '500' },
  addMoreWrap:        { marginTop: 8, marginBottom: 4 },
  addMoreBtn:         { height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: '#002748', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  addMoreText:        { color: '#002748', fontSize: 16, fontWeight: '700' },
  itemContainer:         { marginTop: 24 },
  itemContainerReadOnly: { opacity: 0.55 },
  itemContainerNew:      {
    borderWidth: 1.5,
    borderColor: '#0062AA',
    borderRadius: 10,
    padding: 10,
    marginTop: 16,
    backgroundColor: 'rgba(0,98,170,0.04)',
  },
  newBadge: {
    backgroundColor: '#0062AA',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexShrink: 0,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  itemHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName:           { fontWeight: '500', color: 'black', flex: 1, flexShrink: 1, minWidth: 0, marginRight: 8 },
  itemNameReadOnly:    { color: '#6B7280' },
  itemPrice:          { color: 'black', fontWeight: '400', marginTop: 4 },
  itemPriceReadOnly:   { color: '#6B7280' },
  itemRemarkBlock:    { marginTop: 6, alignSelf: 'stretch' },
  itemFooter:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, width: '100%' },
  remarkBtn:          { flexShrink: 1 },
  remarkText:         { color: '#64748B', fontWeight: '600' },
  remarkTextReadOnly: { color: '#9CA3AF' },
  remarkPreview:      { color: '#64748B', fontSize: 12, maxWidth: '100%', textAlign: 'left' },
  remarkPreviewReadOnly: { color: '#9CA3AF' },
  quantityContainer:  { flexDirection: 'row', alignItems: 'center', gap: 15 },
  qtyBtn:             { borderWidth: 1, borderColor: 'black', alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled:     { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  qtyText:            { fontSize: 18, fontWeight: '500' },
  qtyTextDisabled:    { color: '#94A3B8' },
  qtyValue:           { fontWeight: '500', minWidth: 20, textAlign: 'center' },
  qtyValueReadOnly:   { color: '#94A3B8' },
  divider:            { height: 1, backgroundColor: 'rgba(0,0,0,0.1)', marginTop: 20 },
  footer:             { padding: 16, borderTopWidth: 5, borderTopColor: 'rgba(0,0,0,0.05)' },
  totalRow:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  totalLabel:         { fontWeight: '500' },
  totalValue:         { fontWeight: '500' },
  confirmBtn:         { backgroundColor: '#8D9ED4', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  confirmText:        { color: 'white', fontWeight: '700' },

  remarkModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  remarkCard:        { width: '90%', maxWidth: 560, height: 320, borderRadius: 20, backgroundColor: '#fff', padding: 16, overflow: 'hidden', elevation: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16 },
  remarkCardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  remarkCardHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', flex: 1, textAlign: 'center' },
  remarkHeaderIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  remarkCardBody:    { flex: 1 },
  remarkScrollArea:   { flex: 1 },
  remarkCardContent:  { paddingBottom: 4 },
  remarkItemTitle: { fontSize: 22, fontWeight: '800', color: '#000', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 },
  presetsDivider:     { height: 1, backgroundColor: '#E2E8F0', marginBottom: 8 },
  presetsLoaderWrap:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  remarkInput:        { height: 48, paddingHorizontal: 12, fontSize: 16, color: '#000', textAlignVertical: 'center', flex: 1 },
  saveRemarkBtn:      { marginTop: 14, height: 48, borderRadius: 8, backgroundColor: '#8D9ED4', alignItems: 'center', justifyContent: 'center' },
  saveRemarkText:     { color: '#FFF', fontSize: 16, fontWeight: '600' },
  tagsWrap:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tagBadge:           { backgroundColor: '#0062AA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 8 },
  tagLabelBtn:        { paddingRight: 4 },
  tagText:            { color: '#FFF', fontSize: 13, marginRight: 6 },
  tagClose:           { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  remarkInputRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  remarkInputShell:   { flex: 1, position: 'relative' },
  remarkDropdownIconBtn: { position: 'absolute', right: 8, top: 0, bottom: 0, width: 36, alignItems: 'center', justifyContent: 'center' },
  addTagBtn:          { backgroundColor: '#002748', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addTagText:         { color: '#FFF', fontWeight: '700' },
  presetsListContent: { paddingVertical: 2 },
  presetsRow:         { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F4F4F4' },
  presetsRowText:     { color: '#003366', fontWeight: '600' },

  // ── Category section headers ───────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#186cb1',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginRight: 10,
    flexShrink: 0,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(0,39,72,0.12)',
  },
});