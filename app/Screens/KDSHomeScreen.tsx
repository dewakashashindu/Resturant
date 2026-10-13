import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { apiClient } from '../../services/api';

type KdsStatus = 'S' | 'P' | 'D';

type KdsItem = {
  id: string;
  orderNo: string;
  orderMode: string;
  type: string;
  tableNo: string;
  invoiceNo: string;
  stewardName: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  remarks: string;
  status: KdsStatus;
  placedTime: string | null;
};

type KdsOrderGroup = {
  id: string;
  orderNo: string;
  orderMode: string;
  tableNo: string;
  invoiceNo: string;
  stewardName: string;
  placedTime: string | null;
  items: KdsItem[];
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
  white: '#FFFFFF',
  danger: '#D85A52',
};

const COLUMNS: { id: KdsStatus; title: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'S', title: 'TO DO', color: COLORS.todo, icon: 'time-outline' },
  { id: 'P', title: 'PROCESSING', color: COLORS.processing, icon: 'flame-outline' },
  { id: 'D', title: 'DONE', color: COLORS.done, icon: 'checkmark-circle-outline' },
];

const statusFromValue = (value: unknown): KdsStatus => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'P' || normalized === 'D') return normalized;
  return 'S';
};

const typeLabel = (value: string) => {
  const type = String(value ?? '').trim().toUpperCase();
  if (type === 'K' || type === 'KT' || type === 'KOT') return 'KOT';
  if (type === 'B' || type === 'BT' || type === 'BOT') return 'BOT';
  return type || 'KOT';
};

const nextStatus = (status: KdsStatus): KdsStatus | null => {
  if (status === 'S') return 'P';
  if (status === 'P') return 'D';
  return null;
};

const previousStatus = (status: KdsStatus): KdsStatus | null => {
  if (status === 'D') return 'P';
  if (status === 'P') return 'S';
  return null;
};

const orderKeyFor = (item: Pick<KdsItem, 'orderNo' | 'tableNo' | 'invoiceNo'>) =>
  `${item.orderNo}|${item.tableNo}|${item.invoiceNo}`;

const relativeTime = (value: string | null) => {
  if (!value) return 'New';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'New';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ${minutes % 60}m` : `${Math.floor(hours / 24)}d`;
};

const asKdsItem = (row: any, rowIndex: number): KdsItem | null => {
  const orderNo = String(row?.orderNo ?? row?.OrderNo ?? '').trim();
  const itemCode = String(row?.itemCode ?? row?.ItemCode ?? '').trim();
  const type = String(row?.type ?? row?.KOTBOTType ?? row?.Type ?? '').trim();
  if (!orderNo || !itemCode || !type) return null;
  const tableNo = String(row?.tableNo ?? row?.TableNo ?? '').trim();
  const invoiceNo = String(row?.invoiceNo ?? row?.InvoiceNo ?? '').trim();
  const stewardName = String(row?.stewardName ?? row?.StewardName ?? row?.steward ?? row?.Steward ?? '').trim();
  return {
    // Vw_KOTBOTHder can contain repeated identical source rows when its menu
    // assignment join has more than one match. Keep the rendered key unique
    // even before the backend refresh removes exact duplicate projection rows.
    id: `${orderNo}|${itemCode}|${type}|${tableNo}|${invoiceNo}|${rowIndex}`,
    orderNo,
    orderMode: String(row?.orderMode ?? row?.OrderMode ?? '').trim(),
    type,
    tableNo,
    invoiceNo,
    stewardName,
    itemCode,
    itemName: String(row?.itemName ?? row?.MenuItmDes ?? itemCode).trim(),
    quantity: Number(row?.quantity ?? row?.ItmQty ?? 0) || 0,
    remarks: String(row?.remarks ?? row?.ItmRmks ?? '').trim(),
    status: statusFromValue(row?.status ?? row?.ProStatus),
    placedTime: row?.placedTime ?? row?.PlacedTime ?? null,
  };
};

const columnForScreenX = (screenX: number, screenWidth: number): KdsStatus => {
  const index = Math.max(0, Math.min(2, Math.floor(screenX / (screenWidth / 3))));
  return COLUMNS[index].id;
};

type DraggableItemProps = {
  item: KdsItem;
  screenWidth: number;
  disabled: boolean;
  onTargetChange: (target: KdsStatus | null) => void;
  onDrop: (item: KdsItem, target: KdsStatus) => void;
  onPress: (item: KdsItem) => void;
};

function DraggableItem({ item, screenWidth, disabled, onTargetChange, onDrop, onPress }: DraggableItemProps) {
  const pan = useRef(new Animated.ValueXY()).current;

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => !disabled
      && Math.abs(gesture.dx) > 7
      && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => onTargetChange(item.status),
    onPanResponderMove: (_event, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy * 0.15 });
      onTargetChange(columnForScreenX(gesture.moveX, screenWidth));
    },
    onPanResponderRelease: (_event, gesture) => {
      const target = columnForScreenX(gesture.moveX, screenWidth);
      onTargetChange(null);
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 7 }).start();
      onDrop(item, target);
    },
    onPanResponderTerminate: () => {
      onTargetChange(null);
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 7 }).start();
    },
  }), [disabled, item, onDrop, onTargetChange, pan, screenWidth]);

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.itemDragWrapper, disabled && styles.itemRowUpdating, { transform: pan.getTranslateTransform() }]}
    >
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => onPress(item)}
        disabled={disabled}
        activeOpacity={0.74}
        accessibilityRole="button"
        accessibilityLabel={`Select ${item.itemName} for a kitchen status action`}
      >
        <View style={styles.qtyPill}><Text style={styles.qtyText}>{item.quantity}×</Text></View>
        <View style={styles.itemCopy}>
          <Text style={styles.itemName} numberOfLines={2}>{item.itemName}</Text>
          <View style={styles.itemSubRow}>
            <Text style={styles.itemCode}>{item.itemCode}</Text>
            <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{typeLabel(item.type)}</Text></View>
          </View>
          {item.remarks ? <Text style={styles.itemRemark} numberOfLines={2}>{item.remarks}</Text> : null}
        </View>
        {disabled ? <ActivityIndicator size="small" color={COLORS.blue} /> : <Ionicons name="chevron-forward-circle-outline" size={19} color={COLORS.blue} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

type DraggableOrderTableProps = {
  order: KdsOrderGroup;
  takeAway: boolean;
  screenWidth: number;
  disabled: boolean;
  onTargetChange: (target: KdsStatus | null) => void;
  onDrop: (order: KdsOrderGroup, target: 'P' | 'D') => void;
};

/**
 * The table badge is the whole-order drag handle. Moving it to Processing or
 * Done updates every active line in this order through the bulk API. Item rows
 * remain independent drag handles for one-by-one status changes.
 */
function DraggableOrderTable({ order, takeAway, screenWidth, disabled, onTargetChange, onDrop }: DraggableOrderTableProps) {
  const pan = useRef(new Animated.ValueXY()).current;

  const reset = useCallback(() => {
    onTargetChange(null);
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 7 }).start();
  }, [onTargetChange, pan]);

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => !disabled
      && Math.abs(gesture.dx) > 7
      && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => onTargetChange(null),
    onPanResponderMove: (_event, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy * 0.15 });
      onTargetChange(columnForScreenX(gesture.moveX, screenWidth));
    },
    onPanResponderRelease: (_event, gesture) => {
      const target = columnForScreenX(gesture.moveX, screenWidth);
      reset();
      // Whole-order drag intentionally supports the operational stages only.
      // Dropping on To Do does not change an order, avoiding an accidental
      // reset of a completed/preparing order.
      if (target === 'P' || target === 'D') onDrop(order, target);
    },
    onPanResponderTerminate: reset,
  }), [disabled, onDrop, onTargetChange, order, pan, reset, screenWidth]);

  return (
    <Animated.View
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Drag table ${order.tableNo || order.orderNo} to Processing or Done to update the whole order`}
      style={[
        styles.tableBadge,
        styles.draggableTableBadge,
        disabled && styles.tableBadgeUpdating,
        { transform: pan.getTranslateTransform() },
      ]}
    >
      <Text style={styles.tableLabel}>{takeAway ? 'TAKE AWAY' : 'TABLE'}</Text>
      {disabled ? <ActivityIndicator size="small" color={COLORS.blue} /> : <Text style={styles.tableNumber} numberOfLines={1}>{order.tableNo || '—'}</Text>}
      {!disabled ? <Ionicons name="move-outline" size={10} color={COLORS.blue} /> : null}
    </Animated.View>
  );
}

type OrderGroupProps = {
  order: KdsOrderGroup;
  screenWidth: number;
  updatingItemId: string | null;
  updatingOrderId: string | null;
  onOrderDrop: (order: KdsOrderGroup, target: 'P' | 'D') => void;
  onTargetChange: (target: KdsStatus | null) => void;
  onDrop: (item: KdsItem, target: KdsStatus) => void;
  onItemPress: (item: KdsItem) => void;
  onShowDetails: (order: KdsOrderGroup) => void;
};

function OrderGroup({ order, screenWidth, updatingItemId, updatingOrderId, onOrderDrop, onTargetChange, onDrop, onItemPress, onShowDetails }: OrderGroupProps) {
  const takeAway = order.orderMode.toUpperCase().includes('TAKE') || order.tableNo.toUpperCase().startsWith('TA');
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <TouchableOpacity
          style={styles.orderCopy}
          onPress={() => onShowDetails(order)}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={`Show details for order ${order.orderNo}`}
        >
          <Text style={styles.orderNo}>ORDER {order.orderNo}</Text>
          <Text style={styles.stewardName} numberOfLines={1}>STEWARD: {order.stewardName || '—'}</Text>
          <Text style={styles.tapDetails}>Tap order number for item selection</Text>
        </TouchableOpacity>
        <DraggableOrderTable
          order={order}
          takeAway={takeAway}
          screenWidth={screenWidth}
          disabled={Boolean(updatingItemId) || Boolean(updatingOrderId)}
          onTargetChange={onTargetChange}
          onDrop={onOrderDrop}
        />
      </View>
      <View style={styles.orderMeta}>
        <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
        <Text style={styles.orderMetaText}>TIME {relativeTime(order.placedTime)} ago</Text>
        {order.orderMode ? <><View style={styles.orderDot} /><Text style={styles.orderMetaText}>TYPE {order.orderMode}</Text></> : null}
      </View>
      <View style={styles.itemsList}>
        {order.items.map((item) => (
          <DraggableItem
            key={item.id}
            item={item}
            screenWidth={screenWidth}
            disabled={Boolean(updatingItemId) || Boolean(updatingOrderId)}
            onTargetChange={onTargetChange}
            onDrop={onDrop}
            onPress={onItemPress}
          />
        ))}
      </View>
    </View>
  );
}

export default function KDSHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<KdsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dragTarget, setDragTarget] = useState<KdsStatus | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrderKey, setSelectedOrderKey] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isSelectionUpdating, setIsSelectionUpdating] = useState(false);

  const loadOrders = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const response = await apiClient.getKdsOrders();
      if (!response.ok || !response.data?.ok) {
        throw new Error(response.data?.message || 'Unable to load the kitchen queue.');
      }
      const nextItems = (Array.isArray(response.data.items) ? response.data.items : [])
        .map(asKdsItem)
        .filter((item: KdsItem | null): item is KdsItem => Boolean(item));
      setItems(nextItems);
    } catch (error) {
      console.log('[KDS] load failed', error);
      if (!silent) Alert.alert('Kitchen queue unavailable', error instanceof Error ? error.message : 'Please check the connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const timer = setInterval(() => void loadOrders(true), 5000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const dropItem = async (item: KdsItem, target: KdsStatus) => {
    if (target === item.status || updatingItemId || updatingOrderId) return;
    const before = items;
    setUpdatingItemId(item.id);
    setItems((current) => current.map((value) => value.id === item.id ? { ...value, status: target } : value));
    try {
      const response = await apiClient.updateKdsOrderItemStatus({
        orderNo: item.orderNo,
        itemCode: item.itemCode,
        type: item.type,
        tableNo: item.tableNo,
        invoiceNo: item.invoiceNo,
        status: target,
      });
      if (!response.ok || !response.data?.ok) {
        throw new Error(response.data?.message || 'The kitchen status was not saved.');
      }
    } catch (error) {
      console.log('[KDS] status update failed', error);
      setItems(before);
      Alert.alert('Status not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const updateWholeOrderStatus = async (order: KdsOrderGroup, target: 'P' | 'D') => {
    if (updatingItemId || updatingOrderId) return;
    const orderKey = order.id;
    const matchingItems = items.filter((item) => orderKeyFor(item) === orderKey);
    if (matchingItems.length === 0 || matchingItems.every((item) => item.status === target)) return;

    const before = items;
    setUpdatingOrderId(orderKey);
    setItems((current) => current.map((item) => (
      orderKeyFor(item) === orderKey ? { ...item, status: target } : item
    )));
    try {
      const response = await apiClient.updateKdsOrderBulkStatus({
        orderNo: order.orderNo,
        tableNo: order.tableNo,
        invoiceNo: order.invoiceNo,
        status: target,
      });
      if (!response.ok || !response.data?.ok) {
        throw new Error(response.data?.message || 'The order status was not saved.');
      }
      // Re-read the queue so that all KOT/BOT lines (including ones previously
      // shown in another column) reflect the committed database state.
      await loadOrders(true);
    } catch (error) {
      console.log('[KDS] bulk status update failed', error);
      setItems(before);
      Alert.alert('Order status not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const groupsFor = (status: KdsStatus): KdsOrderGroup[] => {
    const groups = new Map<string, KdsOrderGroup>();
    items.filter((item) => item.status === status).forEach((item) => {
      const key = orderKeyFor(item);
      const group = groups.get(key);
      if (group) {
        group.items.push(item);
      } else {
        groups.set(key, {
          id: key,
          orderNo: item.orderNo,
          orderMode: item.orderMode,
          tableNo: item.tableNo,
          invoiceNo: item.invoiceNo,
          stewardName: item.stewardName,
          placedTime: item.placedTime,
          items: [item],
        });
      }
    });
    return [...groups.values()];
  };

  const selectedOrder = useMemo(() => {
    if (!selectedOrderKey) return null;
    const selectedItems = items.filter((item) => orderKeyFor(item) === selectedOrderKey);
    if (selectedItems.length === 0) return null;
    const first = selectedItems[0];
    return {
      id: selectedOrderKey,
      orderNo: first.orderNo,
      orderMode: first.orderMode,
      tableNo: first.tableNo,
      invoiceNo: first.invoiceNo,
      stewardName: first.stewardName,
      placedTime: first.placedTime,
      items: selectedItems,
    } as KdsOrderGroup;
  }, [items, selectedOrderKey]);

  const closeDetails = () => {
    setSelectedOrderKey(null);
    setSelectedItemIds([]);
  };

  const openOrderDetails = (order: KdsOrderGroup) => {
    setSelectedOrderKey(order.id);
    setSelectedItemIds([]);
  };

  const openItemAction = (item: KdsItem) => {
    setSelectedOrderKey(orderKeyFor(item));
    setSelectedItemIds([item.id]);
  };

  const modalItems = selectedOrder?.items ?? [];
  const selectedModalItems = modalItems.filter((item) => selectedItemIds.includes(item.id));
  const allModalItemsSelected = modalItems.length > 0 && modalItems.every((item) => selectedItemIds.includes(item.id));
  const canMoveNext = selectedModalItems.some((item) => nextStatus(item.status));
  const canRevert = selectedModalItems.some((item) => previousStatus(item.status));
  const selectedStatusSet = [...new Set(selectedModalItems.map((item) => item.status))];
  const nextButtonText = selectedStatusSet.length === 1
    ? (selectedStatusSet[0] === 'S' ? 'Move to Preparing' : selectedStatusSet[0] === 'P' ? 'Move to Ready' : 'Already Ready')
    : 'Move Next';
  const revertButtonText = selectedStatusSet.length === 1
    ? (selectedStatusSet[0] === 'D' ? 'Revert to Preparing' : selectedStatusSet[0] === 'P' ? 'Revert to New' : 'Already New')
    : 'Revert Selected';

  const toggleSelectedItem = (itemId: string) => {
    setSelectedItemIds((current) => current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]);
  };

  const toggleSelectAll = () => {
    setSelectedItemIds(allModalItemsSelected ? [] : modalItems.map((item) => item.id));
  };

  const moveSelectedItems = async (direction: 'next' | 'previous') => {
    if (!selectedOrder || isSelectionUpdating || updatingItemId || updatingOrderId) return;
    const statusFor = direction === 'next' ? nextStatus : previousStatus;
    const targets = selectedModalItems
      .map((item) => ({ item, target: statusFor(item.status) }))
      .filter((value): value is { item: KdsItem; target: KdsStatus } => Boolean(value.target));
    if (targets.length === 0) {
      Alert.alert(
        direction === 'next' ? 'Already at final stage' : 'Already at first stage',
        direction === 'next'
          ? 'Done / Ready items cannot move to another next stage.'
          : 'New items cannot be reverted further.',
      );
      return;
    }

    // Duplicate view rows can point to one physical KOT/BOT line. Send each
    // database identity only once, while retaining an optimistic update for
    // every matching rendered row.
    const uniqueTargets = [...new Map(targets.map(({ item, target }) => [
      `${item.orderNo}|${item.itemCode}|${item.type}|${item.tableNo}|${item.invoiceNo}|${target}`,
      { item, target },
    ])).values()];
    const before = items;
    const optimisticStatusById = new Map(targets.map(({ item, target }) => [item.id, target]));
    setIsSelectionUpdating(true);
    setUpdatingOrderId(selectedOrder.id);
    setItems((current) => current.map((item) => ({
      ...item,
      status: optimisticStatusById.get(item.id) ?? item.status,
    })));

    try {
      const results = await Promise.all(uniqueTargets.map(({ item, target }) => (
        apiClient.updateKdsOrderItemStatus({
          orderNo: item.orderNo,
          itemCode: item.itemCode,
          type: item.type,
          tableNo: item.tableNo,
          invoiceNo: item.invoiceNo,
          status: target,
        })
      )));
      const failed = results.find((response) => !response.ok || !response.data?.ok);
      if (failed) throw new Error(failed.data?.message || 'One or more selected item statuses could not be saved.');
      setSelectedItemIds([]);
      await loadOrders(true);
    } catch (error) {
      console.log('[KDS] selected status update failed', error);
      // At least one request may have reached SQL before another failed. A
      // refresh restores the authoritative state instead of showing stale UI.
      setItems(before);
      await loadOrders(true);
      Alert.alert('Selected items not fully saved', error instanceof Error ? error.message : 'Please refresh and try again.');
    } finally {
      setUpdatingOrderId(null);
      setIsSelectionUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>LIVE KOT / BOT QUEUE</Text>
          <Text style={styles.headerTitle}>Kitchen Display</Text>
          <Text style={styles.headerSub}>S = To Do · P = Processing · D = Done</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadOrders(true)}
          disabled={isRefreshing || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Refresh kitchen orders"
        >
          <Ionicons name="refresh" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.unavailableButton}
          onPress={() => router.push('/Screens/kds-unavailable')}
          accessibilityRole="button"
          accessibilityLabel="Open unavailable items"
        >
          <Ionicons name="close-circle-outline" size={18} color={COLORS.white} />
          <Text style={styles.unavailableButtonText}>Unavailable</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.boardHint}>
        <Ionicons name="information-circle-outline" size={15} color={COLORS.blue} />
        <Text style={styles.boardHintText}>Tap an item for direct actions. Tap an order number to select several items. Drag table number for the whole order.</Text>
      </View>

      <View style={styles.board}>
        {COLUMNS.map((column) => {
          const groups = groupsFor(column.id);
          const itemCount = groups.reduce((total, group) => total + group.items.length, 0);
          const isTarget = dragTarget === column.id;
          return (
            <View key={column.id} style={[styles.column, isTarget && { borderColor: column.color, backgroundColor: `${column.color}12` }]}>
              <View style={[styles.columnHeader, { borderBottomColor: `${column.color}45` }]}>
                <View style={[styles.columnIcon, { backgroundColor: `${column.color}20` }]}><Ionicons name={column.icon} size={16} color={column.color} /></View>
                <Text style={[styles.columnTitle, { color: column.color }]}>{column.title}</Text>
                <View style={[styles.columnCount, { backgroundColor: column.color }]}><Text style={styles.columnCountText}>{itemCount}</Text></View>
              </View>
              {isLoading && items.length === 0 ? (
                <View style={styles.loadingColumn}><ActivityIndicator color={column.color} /><Text style={styles.emptyColumnText}>Loading…</Text></View>
              ) : (
                <ScrollView style={styles.columnScroll} contentContainerStyle={styles.columnContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {groups.length === 0 ? (
                    <View style={styles.emptyColumn}><Ionicons name="restaurant-outline" size={22} color="#B9C7D1" /><Text style={styles.emptyColumnText}>No items</Text></View>
                  ) : groups.map((order) => (
                    <OrderGroup
                      key={`${column.id}-${order.id}`}
                      order={order}
                      screenWidth={width}
                      updatingItemId={updatingItemId}
                      updatingOrderId={updatingOrderId}
                      onOrderDrop={(order, target) => void updateWholeOrderStatus(order, target)}
                      onTargetChange={setDragTarget}
                      onDrop={(item, target) => void dropItem(item, target)}
                      onItemPress={(item) => openItemAction(item)}
                      onShowDetails={(order) => openOrderDetails(order)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })}
      </View>

      <Modal
        transparent
        animationType="slide"
        visible={Boolean(selectedOrder)}
        onRequestClose={closeDetails}
      >
        <View style={styles.detailsOverlay}>
          <View style={styles.detailsSheet}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsHeaderCopy}>
                <Text style={styles.detailsEyebrow}>{selectedItemIds.length === 1 ? 'ITEM ACTION' : 'KITCHEN ORDER DETAILS'}</Text>
                <Text style={styles.detailsTitle}>Order {selectedOrder?.orderNo}</Text>
                <Text style={styles.detailsSubtitle}>
                  {selectedOrder?.tableNo ? `Table ${selectedOrder.tableNo}` : 'Table not set'}
                  {selectedOrder?.stewardName ? `  ·  Steward: ${selectedOrder.stewardName}` : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeDetails} onPress={closeDetails} accessibilityLabel="Close order details">
                <Ionicons name="close" size={21} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <View style={styles.detailsOrderFacts}>
              <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>ORDER TYPE</Text><Text style={styles.detailsFactValue}>{selectedOrder?.orderMode || '—'}</Text></View>
              <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>ORDER AGE</Text><Text style={styles.detailsFactValue}>{relativeTime(selectedOrder?.placedTime ?? null)}</Text></View>
              <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>TABLE</Text><Text style={styles.detailsFactValue}>{selectedOrder?.tableNo || '—'}</Text></View>
            </View>

            <View style={styles.selectionToolbar}>
              <Text style={styles.selectionCount}>{selectedModalItems.length} of {modalItems.length} selected</Text>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={toggleSelectAll}
                disabled={isSelectionUpdating}
                accessibilityRole="button"
                accessibilityLabel={allModalItemsSelected ? 'Clear all selected items' : 'Select all items'}
              >
                <Ionicons name={allModalItemsSelected ? 'checkbox' : 'square-outline'} size={16} color={COLORS.blue} />
                <Text style={styles.selectAllText}>{allModalItemsSelected ? 'Clear all' : 'Select all'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.detailsHint}>Tap a row to select it. Move Next follows New → Preparing → Ready; Revert moves it back one step.</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailsList}>
              {modalItems.map((item) => {
                const column = COLUMNS.find((value) => value.id === item.status);
                const checked = selectedItemIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.detailsItem, checked && styles.detailsItemSelected]}
                    onPress={() => toggleSelectedItem(item.id)}
                    disabled={isSelectionUpdating}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`Select ${item.itemName}`}
                  >
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? COLORS.blue : '#94A3B8'} />
                    <View style={styles.detailsQty}><Text style={styles.detailsQtyText}>{item.quantity}×</Text></View>
                    <View style={styles.detailsItemCopy}>
                      <Text style={styles.detailsItemName}>{item.itemName}</Text>
                      <Text style={styles.detailsItemCode}>{item.itemCode}  ·  {typeLabel(item.type)}</Text>
                      {item.remarks ? <Text style={styles.detailsItemRemark}>Remark: {item.remarks}</Text> : <Text style={styles.detailsNoRemark}>No remark</Text>}
                    </View>
                    <View style={[styles.detailsStatus, { backgroundColor: `${column?.color ?? COLORS.todo}20` }]}>
                      <Text style={[styles.detailsStatusText, { color: column?.color ?? COLORS.todo }]}>{column?.title ?? 'TO DO'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.revertButton, (!canRevert || isSelectionUpdating) && styles.modalActionDisabled]}
                onPress={() => void moveSelectedItems('previous')}
                disabled={!canRevert || isSelectionUpdating}
                accessibilityRole="button"
                accessibilityLabel="Revert selected items by one kitchen stage"
              >
                {isSelectionUpdating ? <ActivityIndicator size="small" color={COLORS.navy} /> : <Ionicons name="arrow-undo-outline" size={17} color={COLORS.navy} />}
                <Text style={styles.revertButtonText}>{revertButtonText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.nextButton, (!canMoveNext || isSelectionUpdating) && styles.modalActionDisabled]}
                onPress={() => void moveSelectedItems('next')}
                disabled={!canMoveNext || isSelectionUpdating}
                accessibilityRole="button"
                accessibilityLabel="Move selected items to their next kitchen stage"
              >
                {isSelectionUpdating ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward-outline" size={17} color={COLORS.white} />}
                <Text style={styles.nextButtonText}>{nextButtonText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { minHeight: 112, paddingHorizontal: 14, paddingBottom: 17, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 7 },
  headerEyebrow: { color: '#8FB8D7', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  headerTitle: { color: COLORS.white, fontSize: 22, fontWeight: '900', marginTop: 3 },
  headerSub: { color: 'rgba(255,255,255,0.68)', fontSize: 10, lineHeight: 15, marginTop: 3 },
  refreshButton: { width: 40, height: 40, marginRight: 7, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  unavailableButton: { minHeight: 40, paddingHorizontal: 9, gap: 4, borderRadius: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  unavailableButtonText: { color: COLORS.white, fontSize: 9, fontWeight: '900' },
  boardHint: { marginHorizontal: 10, marginTop: 9, marginBottom: 7, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, backgroundColor: COLORS.blueSoft },
  boardHintText: { flex: 1, color: '#35627F', fontSize: 10, lineHeight: 14 },
  board: { flex: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 7, paddingBottom: 7 },
  column: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: '#F8FAFB' },
  columnHeader: { minHeight: 49, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  columnIcon: { width: 27, height: 27, justifyContent: 'center', alignItems: 'center', borderRadius: 9, marginRight: 5 },
  columnTitle: { flex: 1, fontSize: 10, fontWeight: '900', letterSpacing: 0.15 },
  columnCount: { minWidth: 21, height: 21, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  columnCountText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  columnScroll: { flex: 1 },
  columnContent: { padding: 5, gap: 7, paddingBottom: 20 },
  loadingColumn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyColumn: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 4 },
  emptyColumnText: { color: '#9AAABA', fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  orderCard: { borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E0E8EE', shadowColor: '#002748', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  orderHeader: { minHeight: 51, paddingVertical: 7, paddingLeft: 8, paddingRight: 5, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F5' },
  orderCopy: { flex: 1, minWidth: 0 },
  orderNo: { color: COLORS.navy, fontSize: 11, fontWeight: '900' },
  stewardName: { color: COLORS.textMuted, fontSize: 8, fontWeight: '800', marginTop: 2 },
  tapDetails: { color: COLORS.blue, fontSize: 7, fontWeight: '800', marginTop: 2 },
  tableBadge: { minWidth: 44, minHeight: 42, marginLeft: 5, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: COLORS.blueSoft },
  draggableTableBadge: { borderWidth: 1, borderColor: '#CDE5F5', elevation: 1 },
  tableBadgeUpdating: { opacity: 0.62 },
  tableLabel: { color: COLORS.textMuted, fontSize: 6, fontWeight: '900', letterSpacing: 0.25 },
  tableNumber: { maxWidth: 55, color: COLORS.navy, fontSize: 15, fontWeight: '900', marginTop: 1 },
  orderMeta: { paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  orderMetaText: { color: COLORS.textMuted, fontSize: 8, fontWeight: '600' },
  orderDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#A9B8C4', marginHorizontal: 2 },
  itemsList: { borderTopWidth: 1, borderTopColor: '#EDF2F5' },
  itemDragWrapper: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F0F4F6' },
  itemRow: { minHeight: 55, paddingHorizontal: 7, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.white },
  itemRowUpdating: { opacity: 0.58 },
  qtyPill: { minWidth: 27, height: 27, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#EDF4F8' },
  qtyText: { color: COLORS.blue, fontSize: 11, fontWeight: '900' },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: { color: COLORS.text, fontSize: 10, lineHeight: 13, fontWeight: '800' },
  itemSubRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 5 },
  itemCode: { color: COLORS.textMuted, fontSize: 8, fontWeight: '700' },
  typeBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, backgroundColor: '#E8F2F7' },
  typeBadgeText: { color: '#35627F', fontSize: 7, fontWeight: '900' },
  itemRemark: { color: '#A26B32', fontSize: 8, lineHeight: 11, fontWeight: '600', marginTop: 2 },
  detailsOverlay: { flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  detailsSheet: { width: '100%', maxWidth: 680, maxHeight: '88%', padding: 18, borderRadius: 24, backgroundColor: COLORS.white, shadowColor: '#002748', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.24, shadowRadius: 18, elevation: 10 },
  detailsHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  detailsHeaderCopy: { flex: 1, minWidth: 0 },
  detailsEyebrow: { color: COLORS.blue, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  detailsTitle: { color: COLORS.navy, fontSize: 22, fontWeight: '900', marginTop: 2 },
  detailsSubtitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  closeDetails: { width: 36, height: 36, marginLeft: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#EEF3F6' },
  detailsOrderFacts: { marginTop: 13, padding: 10, flexDirection: 'row', gap: 7, borderRadius: 12, backgroundColor: '#F4F8FA' },
  detailsFact: { flex: 1, minWidth: 0 },
  detailsFactLabel: { color: COLORS.textMuted, fontSize: 7, fontWeight: '900', letterSpacing: 0.3 },
  detailsFactValue: { color: COLORS.navy, fontSize: 10, fontWeight: '900', marginTop: 3 },
  selectionToolbar: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectionCount: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  selectAllButton: { minHeight: 30, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, backgroundColor: COLORS.blueSoft },
  selectAllText: { color: COLORS.blue, fontSize: 10, fontWeight: '900' },
  detailsHint: { color: COLORS.textMuted, fontSize: 10, lineHeight: 14, marginTop: 8, marginBottom: 8 },
  detailsList: { gap: 8, paddingBottom: 12 },
  detailsItem: { minHeight: 72, padding: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0E9EE', borderRadius: 13, backgroundColor: '#FBFDFE' },
  detailsItemSelected: { borderColor: '#64A9D8', backgroundColor: '#F1F8FD' },
  detailsQty: { width: 38, height: 38, marginLeft: 8, marginRight: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 11, backgroundColor: '#E6F2FA' },
  detailsQtyText: { color: COLORS.blue, fontSize: 13, fontWeight: '900' },
  detailsItemCopy: { flex: 1, minWidth: 0, paddingRight: 5 },
  detailsItemName: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  detailsItemCode: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  detailsItemRemark: { color: '#A26B32', fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 4 },
  detailsNoRemark: { color: '#94A3B8', fontSize: 10, marginTop: 4 },
  detailsStatus: { maxWidth: 70, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 7 },
  detailsStatusText: { fontSize: 8, fontWeight: '900', textAlign: 'center' },
  modalActions: { paddingTop: 11, flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#E4ECF1' },
  modalActionButton: { minHeight: 42, flex: 1, paddingHorizontal: 7, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, borderRadius: 11 },
  revertButton: { backgroundColor: '#FCECCF', borderWidth: 1, borderColor: '#F1CE93' },
  nextButton: { backgroundColor: COLORS.blue },
  modalActionDisabled: { opacity: 0.45 },
  revertButtonText: { color: COLORS.navy, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  nextButtonText: { color: COLORS.white, fontSize: 10, fontWeight: '900', textAlign: 'center' },
});
