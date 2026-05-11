import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  remark?: string;
}

export default function CartScreen() {
  const router = useRouter();
  const { tableId } = useLocalSearchParams<{ tableId: string }>();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 600;
  const isSmall = height < 700;

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

  // ── ONLY CHANGED: table badge responsive ──────
  const badgeFs   = isTablet ? 14 : isSmall ? 11 : 12;
  const badgePadH = isTablet ? 16 : isSmall ? 10 : 12;
  const badgePadV = isTablet ? 8  : isSmall ? 5  : 6;

  const [cartItems, setCartItems] = useState<CartItem[]>([
    { id: '1', name: 'Orange juice',   price: 1250, quantity: 1 },
    { id: '2', name: 'Chicken Burger', price: 1300, quantity: 1 },
  ]);

  // ── ONLY CHANGED: renamed to dropdownVisible ──
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [remarkVisible, setRemarkVisible] = useState(false);
  const [activeRemarkItemId, setActiveRemarkItemId] = useState<string | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');

  const tableInfo = [
    { label: 'Table',  value: tableId ?? 'GF 1'  },
    { label: 'Status', value: 'Active'             },
    { label: 'Floor',  value: 'Ground Floor'       },
  ];

  const updateQuantity = (itemId: string, delta: number) => {
    setCartItems(items =>
      items
        .map(item => item.id === itemId ? { ...item, quantity: item.quantity + delta } : item)
        .filter(item => item.quantity > 0)
    );
  };

  const removeItem = (itemId: string) => {
    setCartItems(items => items.filter(item => item.id !== itemId));
  };

  const clearCart = () => setCartItems([]);

  const openRemarkModal = (item: CartItem) => {
    setActiveRemarkItemId(item.id);
    setRemarkDraft(item.remark ?? '');
    setRemarkVisible(true);
  };

  const saveRemark = () => {
    if (!activeRemarkItemId) return;
    setCartItems(items =>
      items.map(item =>
        item.id === activeRemarkItemId
          ? { ...item, remark: remarkDraft.trim() }
          : item
      )
    );
    setRemarkVisible(false);
    setActiveRemarkItemId(null);
  };

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemName, { fontSize: itemTitleFs }]}>{item.name}</Text>
        <TouchableOpacity onPress={() => removeItem(item.id)}>
          <Ionicons name="trash-outline" size={isTablet ? 28 : 22} color="rgba(0,0,0,0.5)" />
        </TouchableOpacity>
      </View>

      <Text style={[styles.itemPrice, { fontSize: priceFs }]}>Lkr {item.price.toFixed(2)}</Text>

      <View style={styles.itemFooter}>
        <TouchableOpacity style={styles.remarkBtn} onPress={() => openRemarkModal(item)}>
          <Text style={[styles.remarkText, { fontSize: remarkFs }]}>
            {item.remark ? 'Edit Order Remark' : 'Add Order Remark'}
          </Text>
          {!!item.remark && (
            <Text style={styles.remarkPreview} numberOfLines={1}>{item.remark}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={[styles.qtyBtn, { width: qtyBtnSize, height: qtyBtnSize, borderRadius: qtyBtnSize / 2 }]}
            onPress={() => updateQuantity(item.id, -1)}
          >
            <Text style={styles.qtyText}>-</Text>
          </TouchableOpacity>
          <Text style={[styles.qtyValue, { fontSize: qtyFs }]}>{item.quantity}</Text>
          <TouchableOpacity
            style={[styles.qtyBtn, { width: qtyBtnSize, height: qtyBtnSize, borderRadius: qtyBtnSize / 2 }]}
            onPress={() => updateQuantity(item.id, 1)}
          >
            <Text style={styles.qtyText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.divider} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER — unchanged */}
      <View style={[styles.header, { marginTop: headerMT, paddingHorizontal: hPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonAbsolute}>
          <Image
            source={require('../../assets/icons/blackback.png')}
            style={{ width: isTablet ? 56 : 44, height: isTablet ? 56 : 44 }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { fontSize: titleFs }]}>Cart</Text>

        {/* ── ONLY THIS PART CHANGED ── */}
        <TouchableOpacity
          style={[
            styles.tableBadge,
            { paddingHorizontal: badgePadH, paddingVertical: badgePadV },
          ]}
          onPress={() => setDropdownVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tableBadgeText, { fontSize: badgeFs }]}>
            {tableId ?? 'GF 1'}
          </Text>
          <View style={styles.dropdownArrow} />
        </TouchableOpacity>
      </View>

      {/* ── ONLY THIS PART CHANGED: modal matches selectitems ── */}
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
                {/* Dropdown Header */}
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

                {/* Info Rows */}
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

                {/* Change Table Button */}
                <TouchableOpacity
                  style={[styles.changeTableBtn, { paddingVertical: isTablet ? 12 : 10 }]}
                  onPress={() => {
                    setDropdownVisible(false);
                    router.push('/Screens/tableselection');
                  }}
                >
                  <Text style={[styles.changeTableText, { fontSize: isTablet ? 14 : 13 }]}>
                    Change Table
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ORDER REMARK OVERLAY (like selectitems bottom overlay) */}
      <Modal
        visible={remarkVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRemarkVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setRemarkVisible(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.bottomSheet}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Order Remark</Text>

                <View style={styles.remarkInputWrap}>
                  <TextInput
                    value={remarkDraft}
                    onChangeText={setRemarkDraft}
                    placeholder="Type order remark"
                    placeholderTextColor="rgba(0,0,0,0.5)"
                    style={styles.remarkInput}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <TouchableOpacity style={styles.saveRemarkBtn} onPress={saveRemark} activeOpacity={0.85}>
                  <Text style={styles.saveRemarkText}>Save Remark</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* CLEAR CART — unchanged */}
      <TouchableOpacity
        style={[styles.clearCartBtn, { paddingHorizontal: hPad }]}
        onPress={clearCart}
      >
        <Text style={[styles.clearCartText, { fontSize: clearCartFs }]}>Clear Cart</Text>
      </TouchableOpacity>

      {/* LIST — unchanged */}
      <FlatList
        data={cartItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: hPad, paddingBottom: listBottomPad },
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
              onPress={() => router.push(`/Screens/selectitems${tableId ? `?tableId=${encodeURIComponent(String(tableId))}` : ''}` as never)}
            >
              <Text style={styles.addMoreText}>Add More</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FOOTER — unchanged */}
      <View style={[styles.footer, { padding: footerPad }]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { fontSize: isTablet ? 18 : 16 }]}>
            Gross Total (Lkr)
          </Text>
          <Text style={[styles.totalValue, { fontSize: isTablet ? 18 : 16 }]}>
            {total.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity style={[styles.confirmBtn, { height: btnH }]} onPress={() => router.push('/Screens/BillingScreen' as never)} activeOpacity={0.85}>
          <Text style={[styles.confirmText, { fontSize: isTablet ? 24 : isSmall ? 16 : 18 }]}>
            Confirm
          </Text>
          <Ionicons
            name="checkmark-circle-outline"
            size={isTablet ? 28 : 24}
            color="white"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },

  // ── HEADER — unchanged ────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    position: 'relative',
    
  },
  headerTitle:        { fontWeight: '500', color: 'black', textAlign: 'center', flex: 1, top: 25 },
  backButtonAbsolute: { position: 'absolute', left: 20, top: 30, zIndex: 2 },

  // ── TABLE BADGE — only changed colors/style ───
  tableBadge:     { flexDirection: 'row', backgroundColor: 'rgba(0,98,170,0.15)', borderRadius: 20, alignItems: 'center', gap: 6, top: 25, },
  tableBadgeText: { color: '#000', fontWeight: '600' },
  dropdownArrow:  { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#000' },

  // ── MODAL — changed to match selectitems ──────
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

  // ── REST — all unchanged ──────────────────────
  clearCartBtn:       { alignSelf: 'flex-end', marginRight: 16, marginTop: 30 },
  clearCartText:      { color: '#DB6161', fontWeight: '500' },
  listContent:        { paddingHorizontal: 16, paddingBottom: 100 },
  emptyContainer:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText:          { color: '#999', fontSize: 16, fontWeight: '500' },
  addMoreWrap:        { marginTop: 8, marginBottom: 4 },
  addMoreBtn:         { height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: '#002748', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  addMoreText:        { color: '#002748', fontSize: 16, fontWeight: '700' },
  itemContainer:      { marginTop: 24 },
  itemHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName:           { fontWeight: '500', color: 'black' },
  itemPrice:          { color: 'black', fontWeight: '400', marginTop: 4 },
  itemFooter:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  remarkBtn:          { },
  remarkText:         { color: '#0A70C7', fontWeight: '500' },
  remarkPreview:      { color: '#555', fontSize: 12, marginTop: 4, maxWidth: 170 },
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

  // remark bottom overlay
  sheetOverlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  bottomSheet:        { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24, overflow: 'hidden' },
  sheetHandle:        { alignSelf: 'center', width: 54, height: 5, borderRadius: 999, backgroundColor: '#D9D9D9', marginTop: 10, marginBottom: 14 },
  sheetTitle:         { marginHorizontal: 18, marginBottom: 12, fontSize: 22, fontWeight: '600', color: '#000' },
  remarkInputWrap:    { marginHorizontal: 18, borderWidth: 2, borderColor: '#0062AA', borderRadius: 8, minHeight: 96, justifyContent: 'center' },
  remarkInput:        { paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#000', textAlignVertical: 'top' },
  saveRemarkBtn:      { marginTop: 16, marginHorizontal: 18, height: 52, borderRadius: 8, backgroundColor: '#8D9ED4', alignItems: 'center', justifyContent: 'center' },
  saveRemarkText:     { color: '#FFF', fontSize: 16, fontWeight: '600' },
});