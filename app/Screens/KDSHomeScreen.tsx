import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type ColumnId = 'todo' | 'base_prep' | 'garnishing' | 'done';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  note?: string;
}

interface KDSOrder {
  id: string;
  columnId: ColumnId;
  tokenId: string;
  tableNo: string;
  orderType: string;
  items: OrderItem[];
}

interface KDSColumn {
  id: ColumnId;
  title: string;
  accent: string;
}

// ─────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────

const C = {
  bg:       '#F0F5FF',
  white:    '#FFFFFF',
  blue:     '#2563EB',
  blueSoft: '#EFF6FF',
  border:   '#DBEAFE',
  text:     '#1E3A5F',
  textSub:  '#7B93B8',
  overlay:  'rgba(0,0,0,0.4)',
};

// ─────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────

const MOCK: KDSOrder[] = [
  {
    id: '1', columnId: 'todo', tokenId: '#T-041', tableNo: 'Table 05', orderType: 'Dine-In',
    items: [
      { id: 'a', name: 'Chicken Burger', quantity: 2, note: 'Extra sauce' },
      { id: 'b', name: 'Large Fries', quantity: 1 },
    ],
  },
  {
    id: '2', columnId: 'todo', tokenId: '#T-042', tableNo: 'Table 11', orderType: 'Dine-In',
    items: [
      { id: 'd', name: 'Margherita Pizza', quantity: 1 },
      { id: 'e', name: 'Caesar Salad', quantity: 1 },
    ],
  },
  {
    id: '3', columnId: 'base_prep', tokenId: '#T-039', tableNo: 'Counter 2', orderType: 'Takeaway',
    items: [
      { id: 'f', name: 'BBQ Ribs', quantity: 1 },
      { id: 'g', name: 'Onion Rings', quantity: 1 },
    ],
  },
  {
    id: '4', columnId: 'base_prep', tokenId: '#T-040', tableNo: 'Table 03', orderType: 'Dine-In',
    items: [
      { id: 'i', name: 'Grilled Salmon', quantity: 2 },
    ],
  },
  {
    id: '5', columnId: 'garnishing', tokenId: '#T-037', tableNo: 'Delivery #D8', orderType: 'Delivery',
    items: [
      { id: 'k', name: 'Pepperoni Pizza', quantity: 2 },
    ],
  },
];

// ─────────────────────────────────────────────
// DETAIL MODAL
// ─────────────────────────────────────────────

interface RVals {
  modalW: number;
  modalTitle: number;
  modalSub: number;
  modalItem: number;
  btnFont: number;
  infoFont: number;
}

const DetailModal: React.FC<{
  order: KDSOrder | null;
  visible: boolean;
  columns: KDSColumn[];
  onClose: () => void;
  onMove: (id: string) => void;
  r: RVals;
}> = ({ order, visible, columns, onClose, onMove, r }) => {
  if (!order) return null;

  const idx     = columns.findIndex(c => c.id === order.columnId);
  const canMove = idx < columns.length - 1;
  const nextCol = canMove ? columns[idx + 1] : null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.modal, { width: r.modalW }]}>

          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalToken, { fontSize: r.modalSub }]}>
                {order.tokenId}
              </Text>
              <Text style={[styles.modalTable, { fontSize: r.modalTitle }]}>
                {order.tableNo}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeIcon, { fontSize: r.modalTitle * 0.7 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Order Type */}
          <Text style={[styles.infoText, { fontSize: r.infoFont }]}>
            {order.orderType}
          </Text>

          {/* Items */}
          <View style={styles.modalItemsBox}>
            {order.items.map(item => (
              <View key={item.id} style={styles.modalItemRow}>
                <Text style={[styles.modalQty, { fontSize: r.modalItem }]}>
                  {item.quantity}x
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalItemName, { fontSize: r.modalItem }]}>
                    {item.name}
                  </Text>
                  {item.note && (
                    <Text style={[styles.modalNote, { fontSize: r.infoFont }]}>
                      {item.note}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={[styles.closeBtnTxt, { fontSize: r.btnFont }]}>Close</Text>
            </TouchableOpacity>

            {nextCol && (
              <TouchableOpacity
                style={[styles.moveBtn, { backgroundColor: nextCol.accent }]}
                onPress={() => { onMove(order.id); onClose(); }}
              >
                <Text style={[styles.moveBtnTxt, { fontSize: r.btnFont }]}>
                  Move to {nextCol.title}
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────
// ORDER CARD
// ─────────────────────────────────────────────

const OrderCard: React.FC<{
  order: KDSOrder;
  onPress: () => void;
  cardPad: number;
  tableSize: number;
  itemFont: number;
}> = ({ order, onPress, cardPad, tableSize, itemFont }) => {
  return (
    <TouchableOpacity
      style={[styles.card, { padding: cardPad }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.cardTable, { fontSize: tableSize }]}>
        {order.tableNo}
      </Text>

      {order.items.map(item => (
        <Text
          key={item.id}
          style={[styles.cardItem, { fontSize: itemFont }]}
          numberOfLines={1}
        >
          {item.quantity}x {item.name}
        </Text>
      ))}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────

export default function KDSScreen() {
  const { width, height } = Dimensions.get('window');
  const isTablet = width >= 600;
  const isSmall  = height < 680;

  // ── RESPONSIVE VALUES ─────────────────────────────────────────────────────
  const headerH          = isTablet ? height * 0.14 : isSmall ? height * 0.10 : height * 0.12;
  const headerPaddingTop = isTablet ? 40            : isSmall ? 20            : 30;
  const titleSize        = isTablet ? 26            : isSmall ? 16            : 20;
  const subSize          = isTablet ? 15            : isSmall ? 10            : 12;

  const colTitle    = isTablet ? 14  : isSmall ? 9   : 11;
  const colBadge    = isTablet ? 14  : isSmall ? 10  : 12;
  const tableSize   = isTablet ? 18  : isSmall ? 13  : 15;
  const itemFont    = isTablet ? 15  : isSmall ? 10  : 12;

  const cardPad   = isTablet ? 16 : isSmall ? 8  : 10;
  const colPad    = isTablet ? 12 : isSmall ? 6  : 8;
  const boardPad  = isTablet ? 14 : isSmall ? 6  : 8;
  const colGap    = isTablet ? 12 : isSmall ? 6  : 8;

  const modalW      = isTablet ? 460 : Math.min(width * 0.88, 380);
  const modalTitle  = isTablet ? 24  : isSmall ? 16 : 19;
  const modalSub    = isTablet ? 15  : isSmall ? 10 : 12;
  const modalItem   = isTablet ? 16  : isSmall ? 12 : 14;
  const infoFont    = isTablet ? 14  : isSmall ? 10 : 12;
  const btnFont     = isTablet ? 16  : isSmall ? 12 : 13;

  const r: RVals = { modalW, modalTitle, modalSub, modalItem, btnFont, infoFont };

  const COLUMNS: KDSColumn[] = [
    { id: 'todo',       title: 'TO DO',      accent: '#2563EB' },
    { id: 'base_prep',  title: 'BASE PREP',  accent: '#0891B2' },
    { id: 'garnishing', title: 'GARNISHING', accent: '#059669' },
    { id: 'done',       title: 'DONE',       accent: '#7C3AED' },
  ];

  const [orders, setOrders]     = useState<KDSOrder[]>(MOCK);
  const [selected, setSelected] = useState<KDSOrder | null>(null);
  const [modal, setModal]       = useState(false);

  const handleMove = useCallback((orderId: string) => {
    setOrders(prev => {
      const o = prev.find(x => x.id === orderId);
      if (!o) return prev;
      const idx = COLUMNS.findIndex(c => c.id === o.columnId);
      if (idx >= COLUMNS.length - 1) return prev;
      const nextId = COLUMNS[idx + 1].id;
      return prev.map(x => x.id === orderId ? { ...x, columnId: nextId } : x);
    });
  }, []);

  const openModal = (order: KDSOrder) => {
    setSelected(order);
    setModal(true);
  };

  const liveOrder = selected
    ? orders.find(o => o.id === selected.id) ?? null
    : null;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* ── HEADER ─────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            minHeight: headerH,
            paddingTop: headerPaddingTop,
            paddingHorizontal: isTablet ? 24 : 16,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { fontSize: titleSize }]}>
          Kitchen Display
        </Text>
        <Text style={[styles.headerSub, { fontSize: subSize }]}>
          {orders.filter(o => o.columnId !== 'done').length} active orders
        </Text>
      </View>

      {/* ── BOARD ──────────────────────────── */}
      <View style={[styles.board, { padding: boardPad, gap: colGap }]}>
        {COLUMNS.map(col => {
          const colOrders = orders.filter(o => o.columnId === col.id);
          return (
            <View key={col.id} style={styles.colOuter}>
              <View style={styles.col}>

                <View style={[styles.colHeader, { padding: colPad }]}>
                  <Text style={[styles.colTitle, { fontSize: colTitle, color: col.accent }]}>
                    {col.title}
                  </Text>
                  <Text style={[styles.colCount, { fontSize: colBadge }]}>
                    {colOrders.length}
                  </Text>
                </View>

                <ScrollView
                  contentContainerStyle={{ padding: colPad, gap: colPad * 0.8 }}
                  showsVerticalScrollIndicator={false}
                >
                  {colOrders.length === 0 ? (
                    <Text style={[styles.emptyTxt, { fontSize: itemFont }]}>
                      No orders
                    </Text>
                  ) : (
                    colOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onPress={() => openModal(order)}
                        cardPad={cardPad}
                        tableSize={tableSize}
                        itemFont={itemFont}
                      />
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          );
        })}
      </View>

      <DetailModal
        order={liveOrder}
        visible={modal}
        columns={COLUMNS}
        onClose={() => setModal(false)}
        onMove={handleMove}
        r={r}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    backgroundColor: C.white,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    justifyContent: 'center',
  },
  headerTitle: {
    color: C.text,
    fontWeight: '700',
  },
  headerSub: {
    color: C.textSub,
    marginTop: 4,
  },

  // Board
  board: {
    flex: 1,
    flexDirection: 'row',
  },
  colOuter: { flex: 1 },
  col: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  colHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  colTitle: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  colCount: {
    color: C.textSub,
    fontWeight: '600',
  },
  emptyTxt: {
    color: C.textSub,
    textAlign: 'center',
    marginTop: 30,
  },

  // Card
  card: {
    backgroundColor: C.blueSoft,
    borderRadius: 8,
    gap: 4,
  },
  cardTable: {
    color: C.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardItem: {
    color: C.text,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalToken: {
    color: C.textSub,
    marginBottom: 2,
  },
  modalTable: {
    color: C.text,
    fontWeight: '700',
  },
  closeIcon: {
    color: C.textSub,
    fontWeight: '600',
  },
  infoText: {
    color: C.textSub,
    fontWeight: '500',
  },
  modalItemsBox: {
    backgroundColor: C.blueSoft,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  modalItemRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalQty: {
    color: C.blue,
    fontWeight: '700',
    minWidth: 28,
  },
  modalItemName: {
    color: C.text,
    fontWeight: '600',
  },
  modalNote: {
    color: C.textSub,
    marginTop: 2,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.blueSoft,
    alignItems: 'center',
  },
  closeBtnTxt: {
    color: C.textSub,
    fontWeight: '600',
  },
  moveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  moveBtnTxt: {
    color: C.white,
    fontWeight: '700',
  },
});