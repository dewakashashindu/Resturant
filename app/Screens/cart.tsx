import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { default as React, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useOrderStore } from '../../services/orderStore';

export default function CartScreen() {
  const router = useRouter();
  const { tableName, tableId, localPax, foreignPax, floor, status } = useLocalSearchParams<{
    tableName?: string;
    tableId?: string;
    localPax?: string;
    foreignPax?: string;
    floor?: string;
    status?: string;
  }>();
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
const lastConfirmedOrder = useOrderStore((s) => s.lastConfirmedOrder);
  const tableInfo = [
    { label: 'Table', value: displayTable },
    { label: 'Floor', value: floor ?? '—' },
    { label: 'Local Pax', value: displayLocalPax },
    { label: 'Foreign Pax', value: displayForeignPax },
    { label: 'Status', value: status ?? 'Active' },
  ];

  // Counts only unique types of items
  const totalItemsCount = cartItems.length;
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

  const total = cartItems.reduce((sum, item) => sum + item.salesPrice * item.quantity, 0);

  const removeItem = (item: CartItem) => {
    updateQuantityInCart(item.menuItemCode, -item.quantity);
    setRemarksByCode(items => {
      const next = { ...items };
      delete next[item.menuItemCode];
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!cartItems || cartItems.length === 0) {
      Alert.alert('Cart is empty', 'Please add items before confirming.');
      return;
    }
    let finalTableNo = lastConfirmedOrder?.tableNo 
    ? lastConfirmedOrder.tableNo 
    : (orderType === 'TA' ? 'TA-PENDING' : (tableName ?? displayTable));

   
    const payload = {
      orderType: orderType || 'DI', 
      tableNo: finalTableNo,            
     userId: currentUser?.userId ? String(currentUser.userId) : '1',
      tableGrpId: tableId ?? '',
      lPax: Number(localPax ?? 0),
      fPax: Number(foreignPax ?? 0),
      items: cartItems.map((i) => ({
        menuItemCode: i.menuItemCode,
        quantity: i.quantity,
        salesPrice: i.salesPrice,
        itemRemarks: i.itemRemarks || remarksByCode[i.menuItemCode] || '',
      })),
      
      
      customerDetails: orderType === 'TA' ? {
        regTel: customerInfo?.contactNumber || '',
        cusName: customerInfo?.customerName || '',
        rmks: customerInfo?.remark || ''
      } : null
    };

try {
      setConfirming(true);

      //  Check if we already have a REAL generated number (not 'TA-PENDING')
      let generatedTableNo = lastConfirmedOrder?.tableNo;
      
      // If the stored number is just the placeholder 'TA-PENDING', we treat it as "not generated yet"
      const isPending = !generatedTableNo || generatedTableNo === 'TA-PENDING';

      //  Only call the API if we don't have a final TA number yet
      if (isPending) {
        const res = await apiClient.confirmCart(payload);
        console.log('confirmCart response', res);

        if (res.ok || (res.data && res.data.ok)) {
          //  GET THE ACTUAL NUMBER FROM THE SERVER
          generatedTableNo = res.data?.data?.tableNo; 
        } else {
          console.error('confirmCart error', res.data);
          const serverMsg = res.data && (res.data.message || JSON.stringify(res.data));
          Alert.alert('Error', serverMsg || 'Failed to save order');
          setConfirming(false);
          return;
        }
      } else {
        console.log('Reusing already generated tableNo:', generatedTableNo);
      }

      //  Update the Store with the ACTUAL number from the server
      useOrderStore.getState().setLastConfirmedOrder({
        ...payload,
        tableNo: generatedTableNo ?? '', // Now this will be "TA-1266" instead of "TA-PENDING"
        items: payload.items.map((it) => ({
          ...it,
          salesPrice: cartItems.find(c => c.menuItemCode === it.menuItemCode)?.salesPrice ?? 0,
          menuItmDes: cartItems.find(c => c.menuItemCode === it.menuItemCode)?.menuItmDes ?? '',
        })),
        createdAt: lastConfirmedOrder?.createdAt ?? new Date().toISOString(),
      });

      // Navigate to Billing
      router.push({
        pathname: '/Screens/BillingScreen',
        params: {
          tableName: tableName ?? displayTable,
          tableNo: generatedTableNo, 
          // ... rest of your params
          localPax: displayLocalPax,
          foreignPax: displayForeignPax,
          floor: floor ?? '',
          status: status ?? '',
          orderType: orderType || 'DINING', 
          contactNumber: customerInfo?.contactNumber || '',
          customerName: customerInfo?.customerName || '',
          remark: customerInfo?.remark || '',
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

  const renderItem = ({ item }: { item: CartItem }) => {
    // Calculate total price for this specific item based on quantity
    const itemTotal = item.salesPrice * item.quantity;
    const remarkText = (item.itemRemarks || remarksByCode[item.menuItemCode] || '').trim();

    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemName, { fontSize: itemTitleFs }]}>{item.menuItmDes}</Text>
          <TouchableOpacity onPress={() => removeItem(item)}>
            <Ionicons name="trash-outline" size={isTablet ? 28 : 22} color="rgba(0,0,0,0.5)" />
          </TouchableOpacity>
        </View>

        {/* Updated Price Layout: Single Price x Qty = Total Price */}
        <Text style={[styles.itemPrice, { fontSize: priceFs }]}>
          Lkr {item.salesPrice.toFixed(2)} × {item.quantity} = Lkr {itemTotal.toFixed(2)}
        </Text>

        {!!remarkText && (
          <TouchableOpacity style={styles.itemRemarkBlock} activeOpacity={0.8} onPress={() => openRemarkModal(item)}>
            <Text style={[styles.remarkPreview, { fontSize: remarkFs - 1 }]} numberOfLines={2}>
              {remarkText}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.itemFooter}>
          <TouchableOpacity style={styles.remarkBtn} onPress={() => openRemarkModal(item)}>
            <Text style={[styles.remarkText, { fontSize: remarkFs }]}>
              {remarkText ? 'Edit Order Remark' : 'Add Order Remark'}
            </Text>
          </TouchableOpacity>

          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={[styles.qtyBtn, { width: qtyBtnSize, height: qtyBtnSize, borderRadius: qtyBtnSize / 2 }]}
              onPress={() => decrementItem(item)}
            >
              <Text style={styles.qtyText}>-</Text>
            </TouchableOpacity>
            <Text style={[styles.qtyValue, { fontSize: qtyFs }]}>{item.quantity}</Text>
            <TouchableOpacity
              style={[styles.qtyBtn, { width: qtyBtnSize, height: qtyBtnSize, borderRadius: qtyBtnSize / 2 }]}
              onPress={() => incrementItem(item)}
            >
              <Text style={styles.qtyText}>+</Text>
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

      {/* LIST */}
      <FlatList
        data={cartItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.menuItemCode}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: hPad, paddingBottom: listBottomPad + insets.bottom },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Your cart is empty</Text>
          </View>
        }
        ListFooterComponent={
          <View style={[styles.addMoreWrap, { paddingHorizontal: hPad }]}> 
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
                  },
                })
              }
            >
              <Text style={styles.addMoreText}>Add More</Text>
            </TouchableOpacity>
          </View>
        }
      />

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
  itemContainer:      { marginTop: 24 },
  itemHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName:           { fontWeight: '500', color: 'black', flex: 1, flexShrink: 1, minWidth: 0, marginRight: 8 },
  itemPrice:          { color: 'black', fontWeight: '400', marginTop: 4 },
  itemRemarkBlock:    { marginTop: 6, alignSelf: 'stretch' },
  itemFooter:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, width: '100%' },
  remarkBtn:          { flexShrink: 1 },
  remarkText:         { color: '#64748B', fontWeight: '600' },
  remarkPreview:      { color: '#64748B', fontSize: 12, maxWidth: '100%', textAlign: 'left' },
  quantityContainer:  { flexDirection: 'row', alignItems: 'center', gap: 15 },
  qtyBtn:             { borderWidth: 1, borderColor: 'black', alignItems: 'center', justifyContent: 'center' },
  qtyText:            { fontSize: 18, fontWeight: '500' },
  qtyValue:           { fontWeight: '500', minWidth: 20, textAlign: 'center' },
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
});