import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ColumnId = 'todo' | 'processing' | 'done';

type KitchenItem = {
  id: string;
  name: string;
  quantity: number;
  status: ColumnId;
  remark?: string;
};

type KitchenOrder = {
  id: string;
  orderNo: string;
  tableNo: string;
  invoiceNo: string;
  orderType: 'DINE IN' | 'TAKE AWAY';
  placedAt: string;
  items: KitchenItem[];
};

const COLORS = {
  background: '#EEF3F6',
  navy: '#002748',
  blue: '#075EA7',
  blueSoft: '#E6F2FA',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#DCE6ED',
  todo: '#E9963C',
  processing: '#287EC1',
  done: '#2B9662',
  danger: '#D85A52',
  white: '#FFFFFF',
};

const COLUMNS: { id: ColumnId; title: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'todo', title: 'TO DO', color: COLORS.todo, icon: 'time-outline' },
  { id: 'processing', title: 'PROCESSING', color: COLORS.processing, icon: 'flame-outline' },
  { id: 'done', title: 'DONE', color: COLORS.done, icon: 'checkmark-circle-outline' },
];

const INITIAL_ORDERS: KitchenOrder[] = [
  {
    id: 'order-105', orderNo: '#105', tableNo: '12', invoiceNo: 'INV-20261011-105', orderType: 'DINE IN', placedAt: '2 min',
    items: [
      { id: '105-rice', name: 'Chicken Fried Rice', quantity: 2, status: 'todo', remark: 'Less spicy' },
      { id: '105-fries', name: 'French Fries', quantity: 2, status: 'todo' },
      { id: '105-coke', name: 'Coke', quantity: 1, status: 'todo' },
    ],
  },
  {
    id: 'order-106', orderNo: '#106', tableNo: '07', invoiceNo: 'INV-20261011-106', orderType: 'DINE IN', placedAt: '4 min',
    items: [
      { id: '106-burger', name: 'Classic Chicken Burger', quantity: 1, status: 'processing', remark: 'No onions' },
      { id: '106-water', name: 'Mineral Water', quantity: 2, status: 'todo' },
    ],
  },
  {
    id: 'order-107', orderNo: '#107', tableNo: 'TA', invoiceNo: 'INV-20261011-107', orderType: 'TAKE AWAY', placedAt: '8 min',
    items: [
      { id: '107-pizza', name: 'Margherita Pizza', quantity: 1, status: 'done' },
      { id: '107-cola', name: 'Coca Cola 1L', quantity: 1, status: 'done' },
    ],
  },
];

const getColumnForScreenX = (x: number, screenWidth: number): ColumnId => {
  const index = Math.max(0, Math.min(2, Math.floor(x / (screenWidth / 3))));
  return COLUMNS[index].id;
};

type DraggableItemProps = {
  item: KitchenItem;
  screenWidth: number;
  unavailable: boolean;
  onTargetChange: (target: ColumnId | null) => void;
  onDrop: (itemId: string, target: ColumnId) => void;
};

function DraggableItem({ item, screenWidth, unavailable, onTargetChange, onDrop }: DraggableItemProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const dragging = useRef(false);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > 7 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => {
      dragging.current = true;
      onTargetChange(item.status);
    },
    onPanResponderMove: (_event, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy * 0.16 });
      onTargetChange(getColumnForScreenX(gesture.moveX, screenWidth));
    },
    onPanResponderRelease: (_event, gesture) => {
      const target = getColumnForScreenX(gesture.moveX, screenWidth);
      dragging.current = false;
      onTargetChange(null);
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 7 }).start();
      onDrop(item.id, target);
    },
    onPanResponderTerminate: () => {
      dragging.current = false;
      onTargetChange(null);
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 7 }).start();
    },
  }), [item.id, item.status, onDrop, onTargetChange, pan, screenWidth]);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.itemRow,
        unavailable && styles.unavailableItemRow,
        { transform: pan.getTranslateTransform() },
      ]}
    >
      <View style={styles.qtyPill}>
        <Text style={styles.qtyText}>{item.quantity}×</Text>
      </View>
      <View style={styles.itemCopy}>
        <Text style={[styles.itemName, unavailable && styles.unavailableItemName]} numberOfLines={2}>{item.name}</Text>
        {item.remark ? <Text style={styles.itemRemark} numberOfLines={1}>{item.remark}</Text> : null}
      </View>
      <Ionicons name="reorder-three-outline" size={20} color="#9AAABA" />
    </Animated.View>
  );
}

type OrderGroupProps = {
  order: KitchenOrder;
  items: KitchenItem[];
  screenWidth: number;
  unavailableIds: string[];
  onTargetChange: (target: ColumnId | null) => void;
  onDrop: (itemId: string, target: ColumnId) => void;
};

function OrderGroup({ order, items, screenWidth, unavailableIds, onTargetChange, onDrop }: OrderGroupProps) {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNo}>ORDER {order.orderNo}</Text>
          <Text style={styles.invoiceNo} numberOfLines={1}>{order.invoiceNo}</Text>
        </View>
        <View style={styles.tableBadge}>
          <Text style={styles.tableLabel}>{order.orderType === 'TAKE AWAY' ? 'TAKE AWAY' : 'TABLE'}</Text>
          <Text style={styles.tableNumber}>{order.tableNo}</Text>
        </View>
      </View>
      <View style={styles.orderMeta}>
        <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
        <Text style={styles.orderMetaText}>{order.placedAt} ago</Text>
        <View style={styles.orderDot} />
        <Text style={styles.orderMetaText}>{items.length} item{items.length === 1 ? '' : 's'} in this stage</Text>
      </View>
      <View style={styles.itemsList}>
        {items.map((item) => (
          <DraggableItem
            key={item.id}
            item={item}
            screenWidth={screenWidth}
            unavailable={unavailableIds.includes(item.name)}
            onTargetChange={onTargetChange}
            onDrop={onDrop}
          />
        ))}
      </View>
    </View>
  );
}

export default function KDSHomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<KitchenOrder[]>(INITIAL_ORDERS);
  const [dragTarget, setDragTarget] = useState<ColumnId | null>(null);
  const [unavailableVisible, setUnavailableVisible] = useState(false);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);

  const unavailableOptions = useMemo(
    () => [...new Set(orders.flatMap((order) => order.items.map((item) => item.name)))].sort(),
    [orders],
  );

  const moveItem = (itemId: string, target: ColumnId) => {
    setOrders((current) => current.map((order) => ({
      ...order,
      items: order.items.map((item) => item.id === itemId ? { ...item, status: target } : item),
    })));
  };

  const toggleUnavailable = (itemName: string) => {
    setUnavailableIds((current) => current.includes(itemName)
      ? current.filter((value) => value !== itemName)
      : [...current, itemName]);
  };

  const groupedOrdersForColumn = (columnId: ColumnId) => orders
    .map((order) => ({ ...order, items: order.items.filter((item) => item.status === columnId) }))
    .filter((order) => order.items.length > 0);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>KITCHEN CONTROL</Text>
          <Text style={styles.headerTitle}>Kitchen Display</Text>
          <Text style={styles.headerSub}>Touch, hold and drag each item to update its stage.</Text>
        </View>
        <TouchableOpacity
          style={styles.unavailableButton}
          onPress={() => setUnavailableVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Manage unavailable items"
        >
          <Ionicons name="basket-outline" size={24} color={COLORS.white} />
          {unavailableIds.length > 0 ? <View style={styles.unavailableCount}><Text style={styles.unavailableCountText}>{unavailableIds.length}</Text></View> : null}
        </TouchableOpacity>
      </View>

      <View style={styles.boardHint}>
        <Ionicons name="information-circle-outline" size={15} color={COLORS.blue} />
        <Text style={styles.boardHintText}>Drag an individual item — the rest of the order stays where it is.</Text>
      </View>

      <View style={styles.board}>
        {COLUMNS.map((column) => {
          const orderGroups = groupedOrdersForColumn(column.id);
          const itemCount = orderGroups.reduce((count, order) => count + order.items.length, 0);
          const isDropTarget = dragTarget === column.id;
          return (
            <View key={column.id} style={[styles.column, isDropTarget && { borderColor: column.color, backgroundColor: `${column.color}12` }]}>
              <View style={[styles.columnHeader, { borderBottomColor: `${column.color}45` }]}>
                <View style={[styles.columnIcon, { backgroundColor: `${column.color}20` }]}>
                  <Ionicons name={column.icon} size={16} color={column.color} />
                </View>
                <Text style={[styles.columnTitle, { color: column.color }]}>{column.title}</Text>
                <View style={[styles.columnCount, { backgroundColor: column.color }]}>
                  <Text style={styles.columnCountText}>{itemCount}</Text>
                </View>
              </View>
              <ScrollView
                style={styles.columnScroll}
                contentContainerStyle={styles.columnContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {orderGroups.length === 0 ? (
                  <View style={styles.emptyColumn}>
                    <Ionicons name="restaurant-outline" size={22} color="#B9C7D1" />
                    <Text style={styles.emptyColumnText}>No items</Text>
                  </View>
                ) : orderGroups.map((order) => (
                  <OrderGroup
                    key={`${column.id}-${order.id}`}
                    order={order}
                    items={order.items}
                    screenWidth={width}
                    unavailableIds={unavailableIds}
                    onTargetChange={setDragTarget}
                    onDrop={moveItem}
                  />
                ))}
              </ScrollView>
            </View>
          );
        })}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={unavailableVisible}
        onRequestClose={() => setUnavailableVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.unavailableModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Today’s unavailable items</Text>
                <Text style={styles.modalSubtitle}>Mark items the kitchen cannot prepare today.</Text>
              </View>
              <TouchableOpacity style={styles.closeModal} onPress={() => setUnavailableVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.navy} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.unavailableList}>
              {unavailableOptions.map((itemName) => {
                const unavailable = unavailableIds.includes(itemName);
                return (
                  <TouchableOpacity key={itemName} style={styles.unavailableRow} onPress={() => toggleUnavailable(itemName)} activeOpacity={0.8}>
                    <View style={[styles.availabilityIcon, unavailable && styles.availabilityIconOff]}>
                      <Ionicons name={unavailable ? 'close' : 'checkmark'} size={17} color={unavailable ? COLORS.white : COLORS.done} />
                    </View>
                    <Text style={styles.unavailableName}>{itemName}</Text>
                    <Text style={[styles.availabilityText, unavailable && styles.availabilityTextOff]}>{unavailable ? 'Unavailable' : 'Available'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.doneButton} onPress={() => setUnavailableVisible(false)}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { minHeight: 112, paddingHorizontal: 17, paddingBottom: 17, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy },
  headerCopy: { flex: 1, paddingRight: 12 },
  headerEyebrow: { color: '#8FB8D7', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  headerTitle: { color: COLORS.white, fontSize: 24, fontWeight: '800', marginTop: 3 },
  headerSub: { color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 16, marginTop: 3 },
  unavailableButton: { width: 48, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  unavailableCount: { position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: COLORS.danger, borderWidth: 1.5, borderColor: COLORS.navy },
  unavailableCountText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  boardHint: { marginHorizontal: 12, marginTop: 10, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, backgroundColor: COLORS.blueSoft },
  boardHintText: { flex: 1, color: '#35627F', fontSize: 10, lineHeight: 14 },
  board: { flex: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 8, paddingBottom: 8 },
  column: { flex: 1, minWidth: 0, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: '#F8FAFB' },
  columnHeader: { minHeight: 49, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  columnIcon: { width: 27, height: 27, justifyContent: 'center', alignItems: 'center', borderRadius: 9, marginRight: 5 },
  columnTitle: { flex: 1, fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
  columnCount: { minWidth: 21, height: 21, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  columnCountText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  columnScroll: { flex: 1 },
  columnContent: { padding: 5, gap: 7, paddingBottom: 20 },
  emptyColumn: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 4 },
  emptyColumnText: { color: '#9AAABA', fontSize: 10, fontWeight: '700', marginTop: 5 },
  orderCard: { overflow: 'visible', borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E0E8EE', shadowColor: '#002748', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  orderHeader: { minHeight: 51, paddingVertical: 7, paddingLeft: 8, paddingRight: 5, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F5' },
  orderNo: { color: COLORS.navy, fontSize: 11, fontWeight: '900' },
  invoiceNo: { maxWidth: 80, color: COLORS.textMuted, fontSize: 8, fontWeight: '600', marginTop: 2 },
  tableBadge: { minWidth: 39, minHeight: 38, marginLeft: 'auto', paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: COLORS.blueSoft },
  tableLabel: { color: COLORS.textMuted, fontSize: 6, fontWeight: '900', letterSpacing: 0.3 },
  tableNumber: { color: COLORS.navy, fontSize: 17, fontWeight: '900', marginTop: 1 },
  orderMeta: { paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  orderMetaText: { color: COLORS.textMuted, fontSize: 8, fontWeight: '600' },
  orderDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#A9B8C4', marginHorizontal: 2 },
  itemsList: { borderTopWidth: 1, borderTopColor: '#EDF2F5' },
  itemRow: { minHeight: 49, paddingHorizontal: 7, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F0F4F6', zIndex: 5 },
  unavailableItemRow: { backgroundColor: '#FFF5F4' },
  qtyPill: { minWidth: 27, height: 27, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#EDF4F8' },
  qtyText: { color: COLORS.blue, fontSize: 11, fontWeight: '900' },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: { color: COLORS.text, fontSize: 10, lineHeight: 13, fontWeight: '800' },
  unavailableItemName: { color: COLORS.danger, textDecorationLine: 'line-through' },
  itemRemark: { color: '#A26B32', fontSize: 8, fontWeight: '600', marginTop: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  unavailableModal: { maxHeight: '76%', padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: COLORS.white },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { color: COLORS.navy, fontSize: 19, fontWeight: '900' },
  modalSubtitle: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  closeModal: { width: 34, height: 34, marginLeft: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#EEF3F6' },
  unavailableList: { gap: 8, paddingBottom: 14 },
  unavailableRow: { minHeight: 57, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E1E9EE', borderRadius: 13 },
  availabilityIcon: { width: 28, height: 28, marginRight: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: '#ECF8F0' },
  availabilityIconOff: { backgroundColor: COLORS.danger },
  unavailableName: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '700' },
  availabilityText: { color: COLORS.done, fontSize: 11, fontWeight: '800' },
  availabilityTextOff: { color: COLORS.danger },
  doneButton: { minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: COLORS.navy },
  doneButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
