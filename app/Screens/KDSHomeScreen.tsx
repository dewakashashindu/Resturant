import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Tts from 'react-native-tts';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient } from '../../services/api';
import { useNotificationStore } from '../../services/notificationStore';

type KdsStatus = 'S' | 'P' | 'D';
type KdsQueueType = 'K' | 'B';

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
  proStarted: string | null;
  prepDuration: number;
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
  { id: 'P', title: 'IN PROGRESS', color: COLORS.processing, icon: 'flame-outline' },
  { id: 'D', title: 'DONE', color: COLORS.done, icon: 'checkmark-circle-outline' },
];

const statusFromValue = (value: unknown): KdsStatus => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'P' || normalized === 'D') return normalized;
  return 'S';
};

const typeLabel = (value: string) => {
  const type = String(value ?? '').trim().toUpperCase();
  if (type === 'K' || type === 'KT' || type === 'KOT') return 'KITCHEN';
  if (type === 'B' || type === 'BT' || type === 'BOT') return 'BAR';
  return type || 'KITCHEN';
};

const queueTypeFor = (value: string): KdsQueueType | null => {
  const type = String(value ?? '').trim().toUpperCase();
  if (type.startsWith('K')) return 'K';
  if (type.startsWith('B')) return 'B';
  return null;
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

// The KDS status API addresses a physical line with these five fields. A view
// can surface that same line more than once, so optimistic UI changes must
// update every rendered copy together.
const sameKdsSourceLine = (left: KdsItem, right: KdsItem) => (
  left.orderNo === right.orderNo
  && left.itemCode === right.itemCode
  && left.type === right.type
  && left.tableNo === right.tableNo
  && left.invoiceNo === right.invoiceNo
);

type AlertLevel = 'normal' | 'amber' | 'red';

const ALERT_RANK: Record<AlertLevel, number> = { normal: 0, amber: 1, red: 2 };

const elapsedMinutes = (value: string | null, now: number) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, (now - time) / 60000);
};

const relativeTime = (value: string | null, now = Date.now()) => {
  if (!value) return 'New';
  const minutes = Math.floor(elapsedMinutes(value, now));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ${minutes % 60}m` : `${Math.floor(hours / 24)}d`;
};

const itemAlertLevel = (item: KdsItem, now: number): AlertLevel => {
  if (item.status === 'S') {
    const waiting = elapsedMinutes(item.placedTime, now);
    if (waiting > 6) return 'red';
    if (waiting >= 3) return 'amber';
    return 'normal';
  }
  if (item.status === 'P') {
    const prepDuration = Math.max(0, Number(item.prepDuration) || 0);
    if (prepDuration <= 0) return 'normal';
    const progressing = elapsedMinutes(item.proStarted || item.placedTime, now);
    if (progressing >= prepDuration) return 'red';
    if (progressing >= prepDuration * 0.95) return 'amber';
  }
  return 'normal';
};

const orderAlertLevel = (order: KdsOrderGroup, now: number): AlertLevel => order.items.reduce<AlertLevel>((highest, item) => {
  const next = itemAlertLevel(item, now);
  return ALERT_RANK[next] > ALERT_RANK[highest] ? next : highest;
}, 'normal');

const delayAlertKey = (order: KdsOrderGroup) =>
  `${queueTypeFor(order.items[0]?.type ?? '') ?? 'UNKNOWN'}|${order.id}|${order.placedTime ?? ''}`;

let kdsDelayTtsReady = false;
const stopKdsDelayAlert = () => {
  Speech.stop();
  if (Platform.OS === 'android') Tts.stop();
};

const speakKdsDelayAlert = async (order: KdsOrderGroup, isStillAllowed: () => boolean) => {
  if (!isStillAllowed()) return;

  const quantitiesByItem = new Map<string, number>();
  for (const item of order.items) {
    const itemName = item.itemName || item.itemCode;
    const quantity = Number(item.quantity);
    quantitiesByItem.set(itemName, (quantitiesByItem.get(itemName) ?? 0) + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1));
  }
  const itemPhrase = [...quantitiesByItem.entries()]
    .map(([itemName, quantity]) => `${itemName} - ${quantity}`)
    .join(', ');
  const tableNumber = order.tableNo || 'not set';
  const announcement = `Attention! Order Number ${order.orderNo}, Table Number ${tableNumber} is delayed. Items: ${itemPhrase}. Please move this order to In Progress.`;
  if (Platform.OS !== 'android') {
    if (isStillAllowed()) Speech.speak(announcement, { language: 'en-US', rate: 0.88, pitch: 1 });
    return;
  }
  try {
    if (!kdsDelayTtsReady) {
      await Tts.getInitStatus();
      await Tts.setDefaultLanguage('en-US');
      await Tts.setDefaultRate(0.45);
      await Tts.setDefaultPitch(1);
      kdsDelayTtsReady = true;
    }
    // TTS initialization is async. Check focus/app state again immediately
    // before speech so navigating away cannot start a late announcement.
    if (!isStillAllowed()) return;
    Tts.speak(announcement, {
      androidParams: {
        KEY_PARAM_STREAM: 'STREAM_NOTIFICATION',
        KEY_PARAM_VOLUME: 1,
        KEY_PARAM_PAN: 0,
      },
    } as any);
  } catch (error) {
    // Do not fall back to a Media-stream player on Android. The user-facing
    // delay alert must remain controlled by the phone Notification volume.
    console.log('[KDS] delayed-order TTS failed', error);
  }
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
    proStarted: row?.proStarted ?? row?.ProStarted ?? null,
    prepDuration: Math.max(0, Number(row?.prepDuration ?? row?.PrepDuration ?? 0) || 0),
  };
};

const sortKdsItemsOldestFirst = (left: KdsItem, right: KdsItem) => {
  const leftTime = left.placedTime ? new Date(left.placedTime).getTime() : Number.POSITIVE_INFINITY;
  const rightTime = right.placedTime ? new Date(right.placedTime).getTime() : Number.POSITIVE_INFINITY;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.orderNo.localeCompare(right.orderNo) || left.itemCode.localeCompare(right.itemCode);
};

const sameKdsItem = (left: KdsItem, right: KdsItem) => (
  left.id === right.id
  && left.orderNo === right.orderNo
  && left.orderMode === right.orderMode
  && left.type === right.type
  && left.tableNo === right.tableNo
  && left.invoiceNo === right.invoiceNo
  && left.stewardName === right.stewardName
  && left.itemCode === right.itemCode
  && left.itemName === right.itemName
  && left.quantity === right.quantity
  && left.remarks === right.remarks
  && left.status === right.status
  && left.placedTime === right.placedTime
  && left.proStarted === right.proStarted
  && left.prepDuration === right.prepDuration
);

// Polls keep existing object identities where SQL data has not changed. React
// therefore retains visible cards and inserts a newly received To-Do row/order
// in chronological position (normally at the bottom) without a screen reload.
const mergeKdsItems = (current: KdsItem[], incoming: KdsItem[]) => {
  const currentById = new Map(current.map((item) => [item.id, item]));
  return incoming
    .sort(sortKdsItemsOldestFirst)
    .map((item) => {
      const previous = currentById.get(item.id);
      return previous && sameKdsItem(previous, item) ? previous : item;
    });
};

const columnForScreenX = (screenX: number, screenWidth: number): KdsStatus => {
  const index = Math.max(0, Math.min(2, Math.floor(screenX / (screenWidth / 3))));
  return COLUMNS[index].id;
};

const cardStyleForAlertLevel = (level: AlertLevel) =>
  level === 'red' ? styles.orderCardRed : level === 'amber' ? styles.orderCardAmber : null;

const itemStyleForAlertLevel = (level: AlertLevel) =>
  level === 'red' ? styles.itemRowRed : level === 'amber' ? styles.itemRowAmber : null;

type AlertSummary = Record<AlertLevel, number>;

const summarizeOrderAlerts = (orders: KdsOrderGroup[], now: number): AlertSummary => orders.reduce<AlertSummary>((summary, order) => {
  summary[orderAlertLevel(order, now)] += 1;
  return summary;
}, { normal: 0, amber: 0, red: 0 });

type SeveritySummaryProps = { title: string; summary: AlertSummary };
function SeveritySummary({ title, summary }: SeveritySummaryProps) {
  return (
    <View style={styles.severitySummary}>
      <Text style={styles.severitySummaryTitle}>{title}</Text>
      <View style={styles.severityPills}>
        <View style={[styles.severityPill, styles.severityPillNormal]}><Text style={styles.severityPillText}>N {summary.normal}</Text></View>
        <View style={[styles.severityPill, styles.severityPillAmber]}><Text style={styles.severityPillText}>A {summary.amber}</Text></View>
        <View style={[styles.severityPill, styles.severityPillRed]}><Text style={styles.severityPillText}>R {summary.red}</Text></View>
      </View>
    </View>
  );
}

type DraggableItemProps = {
  item: KdsItem;
  alertLevel: AlertLevel;
  screenWidth: number;
  disabled: boolean;
  onTargetChange: (target: KdsStatus | null) => void;
  onDrop: (item: KdsItem, target: KdsStatus) => void;
  onPress: (item: KdsItem) => void;
};

function DraggableItem({ item, alertLevel, screenWidth, disabled, onTargetChange, onDrop, onPress }: DraggableItemProps) {
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
      style={[styles.itemDragWrapper, itemStyleForAlertLevel(alertLevel), disabled && styles.itemRowUpdating, { transform: pan.getTranslateTransform() }]}
    >
      <TouchableOpacity
        style={[styles.itemRow, itemStyleForAlertLevel(alertLevel)]}
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

type TodoSearchResultProps = {
  item: KdsItem;
  disabled: boolean;
  onPress: (item: KdsItem) => void;
};

/** A compact, complete row shown only for To-Do item-name/item-ID searches. */
function TodoSearchResult({ item, disabled, onPress }: TodoSearchResultProps) {
  return (
    <TouchableOpacity
      style={[styles.searchResultRow, disabled && styles.searchResultDisabled]}
      onPress={() => onPress(item)}
      disabled={disabled}
      activeOpacity={0.76}
      accessibilityRole="button"
      accessibilityLabel={`Move To Do item ${item.itemName}, item ID ${item.itemCode}, order ${item.orderNo}, to In Progress`}
    >
      <View style={styles.searchResultTopLine}>
        <View style={styles.searchResultOrderBlock}>
          <Text style={styles.searchResultLabel}>ORDER NUMBER</Text>
          <Text style={styles.searchResultOrder}>{item.orderNo}</Text>
        </View>
        <View style={styles.searchResultTableBlock}>
          <Text style={styles.searchResultLabel}>TABLE NUMBER</Text>
          <Text style={styles.searchResultTable}>{item.tableNo || '—'}</Text>
        </View>
      </View>
      <View style={styles.searchResultItemLine}>
        <View style={styles.searchResultItemCopy}>
          <Text style={styles.searchResultItemName}>{item.itemName}</Text>
          <Text style={styles.searchResultItemId}>ITEM ID: {item.itemCode}</Text>
        </View>
        <View style={styles.searchResultQuantity}>
          <Text style={styles.searchResultLabel}>QTY</Text>
          <Text style={styles.searchResultQuantityText}>{item.quantity}</Text>
        </View>
      </View>
      <View style={styles.searchResultNote}>
        <Ionicons name="chatbox-ellipses-outline" size={13} color="#8A541F" />
        <Text style={styles.searchResultNoteText}>NOTE: {item.remarks || 'No remark'}</Text>
      </View>
      <View style={styles.searchQuickAction}>
        {disabled ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward-circle-outline" size={14} color={COLORS.white} />}
        <Text style={styles.searchQuickActionText}>MOVE TO IN PROGRESS</Text>
      </View>
    </TouchableOpacity>
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
 * The table badge is the whole-order drag handle. Moving it to In Progress or
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
      accessibilityLabel={`Drag table ${order.tableNo || order.orderNo} to In Progress or Done to update the whole order`}
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
  now: number;
  updatingItemId: string | null;
  updatingOrderId: string | null;
  onOrderDrop: (order: KdsOrderGroup, target: 'P' | 'D') => void;
  onTargetChange: (target: KdsStatus | null) => void;
  onDrop: (item: KdsItem, target: KdsStatus) => void;
  onItemPress: (item: KdsItem) => void;
  onShowDetails: (order: KdsOrderGroup) => void;
};

function OrderGroup({ order, screenWidth, now, updatingItemId, updatingOrderId, onOrderDrop, onTargetChange, onDrop, onItemPress, onShowDetails }: OrderGroupProps) {
  const takeAway = order.orderMode.toUpperCase().includes('TAKE') || order.tableNo.toUpperCase().startsWith('TA');
  const cardAlertLevel = orderAlertLevel(order, now);
  return (
    <View style={[styles.orderCard, cardStyleForAlertLevel(cardAlertLevel)]}>
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
        <Text style={styles.orderMetaText}>TIME {relativeTime(order.placedTime, now)} ago</Text>
        {order.orderMode ? <><View style={styles.orderDot} /><Text style={styles.orderMetaText}>TYPE {order.orderMode}</Text></> : null}
      </View>
      <View style={styles.itemsList}>
        {order.items.map((item) => (
          <DraggableItem
            key={item.id}
            item={item}
            alertLevel={itemAlertLevel(item, now)}
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

type KdsLoadMode = 'initial' | 'manual' | 'background';
type KdsDisplayScreenProps = { stationType: KdsQueueType };

/**
 * A station-locked board. KDS mounts this with Kitchen and BDS mounts it with
 * Bar, so neither display can switch to or fetch the other station's queue.
 */
export function KdsDisplayScreen({ stationType }: KdsDisplayScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isKdsScreenFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(() => AppState.currentState);
  const [items, setItems] = useState<KdsItem[]>([]);
  const kdsQueueType = stationType;
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const delayAlertedRef = useRef<Set<string>>(new Set());
  const voiceAllowedRef = useRef(false);
  const loadRequestRef = useRef(0);
  const soundEnabled = useNotificationStore((state) => state.preferences.soundEnabled);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dragTarget, setDragTarget] = useState<KdsStatus | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrderKey, setSelectedOrderKey] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isSelectionUpdating, setIsSelectionUpdating] = useState(false);
  const isKitchenDisplay = kdsQueueType === 'K';
  const displayName = isKitchenDisplay ? 'KDS' : 'BDS';
  const stationName = isKitchenDisplay ? 'Kitchen' : 'Bar';
  const isKdsAppActive = appState === 'active';
  const isVoiceAllowed = isKdsScreenFocused && isKdsAppActive;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  // A KDS delay alert is permitted only while this exact screen is visible and
  // the app is foregrounded. Leaving either state immediately stops speech.
  useEffect(() => {
    voiceAllowedRef.current = isVoiceAllowed;
    if (!isVoiceAllowed) stopKdsDelayAlert();
    return () => {
      voiceAllowedRef.current = false;
      stopKdsDelayAlert();
    };
  }, [isVoiceAllowed]);

  const loadOrders = useCallback(async (mode: KdsLoadMode = 'manual') => {
    const requestId = ++loadRequestRef.current;
    if (mode === 'initial') setIsLoading(true);
    if (mode === 'manual') setIsRefreshing(true);
    try {
      // This is a direct API/database request. It does not reload or remount
      // the screen, so manual refresh leaves the active board in place.
      const response = await apiClient.getKdsOrders(kdsQueueType);
      if (!response.ok || !response.data?.ok) {
        throw new Error(response.data?.message || `Unable to load the ${stationName.toLowerCase()} queue.`);
      }
      if (requestId !== loadRequestRef.current) return;
      const nextItems = (Array.isArray(response.data.items) ? response.data.items : [])
        .map(asKdsItem)
        .filter((item: KdsItem | null): item is KdsItem => Boolean(item))
        // The API receives the immutable KDS/BDS station type. Retain this
        // client guard too, so a mixed/cached proxy response cannot put Bar
        // lines on KDS or Kitchen lines on BDS during a poll.
        .filter((item: KdsItem) => queueTypeFor(item.type) === kdsQueueType);
      setItems((current) => mergeKdsItems(current, nextItems));
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      console.log('[KDS] load failed', error);
      if (mode !== 'background') {
        Alert.alert(`${stationName} queue unavailable`, error instanceof Error ? error.message : 'Please check the connection and try again.');
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'manual') setIsRefreshing(false);
      }
    }
  }, [kdsQueueType, stationName]);

  useEffect(() => {
    // No background database work is needed when this screen is hidden. On
    // return, the immediate direct read catches up before the 30-second poll.
    if (!isKdsScreenFocused || !isKdsAppActive) return;
    void loadOrders('initial');
    const timer = setInterval(() => void loadOrders('background'), 30_000);
    return () => clearInterval(timer);
  }, [isKdsAppActive, isKdsScreenFocused, loadOrders]);

  // Timers must repaint independently of queue polling so 3/6 minute and
  // PrepDuration thresholds turn colour at the correct time.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // A red To-Do line is a station-delay event. Announce once per delayed
  // ORDER (not once per line) so the spoken alert lists the complete order.
  useEffect(() => {
    const delayedOrders = new Map<string, KdsOrderGroup>();
    items
      // The direct API is already station-filtered. Keep this explicit guard so
      // a Kitchen KDS can never announce Bar lines (or vice versa) if a mixed
      // response is ever returned by a proxy/view.
      .filter((item) => item.status === 'S'
        && queueTypeFor(item.type) === kdsQueueType
        && itemAlertLevel(item, now) === 'red')
      .forEach((delayedItem) => {
        const id = orderKeyFor(delayedItem);
        if (delayedOrders.has(id)) return;
        const orderItems = items.filter((item) => orderKeyFor(item) === id);
        const first = orderItems[0];
        if (!first) return;
        delayedOrders.set(id, {
          id,
          orderNo: first.orderNo,
          orderMode: first.orderMode,
          tableNo: first.tableNo,
          invoiceNo: first.invoiceNo,
          stewardName: first.stewardName,
          placedTime: first.placedTime,
          items: orderItems,
        });
      });

    const pendingDelayKeys = new Set([...delayedOrders.values()].map(delayAlertKey));
    const activeStationPrefix = `${kdsQueueType}|`;
    for (const key of delayAlertedRef.current) {
      // Leave the other station's history intact. A Kitchen alert must not
      // suppress its matching Bar alert, and changing tabs must not replay an
      // already-announced pending delay for the previously selected station.
      if (key.startsWith(activeStationPrefix) && !pendingDelayKeys.has(key)) {
        delayAlertedRef.current.delete(key);
      }
    }
    if (!soundEnabled || !isVoiceAllowed) return;

    [...delayedOrders.values()]
      .sort((left, right) => elapsedMinutes(right.placedTime, now) - elapsedMinutes(left.placedTime, now))
      .forEach((order) => {
        const key = delayAlertKey(order);
        if (delayAlertedRef.current.has(key)) return;
        delayAlertedRef.current.add(key);
        void speakKdsDelayAlert(order, () => voiceAllowedRef.current);
      });
  }, [isVoiceAllowed, items, kdsQueueType, now, soundEnabled]);

  const dropItem = async (item: KdsItem, target: KdsStatus) => {
    if (target === item.status || updatingItemId || updatingOrderId) return;
    const before = items;
    const startedAt = target === 'P' ? new Date().toISOString() : null;
    setUpdatingItemId(item.id);
    setItems((current) => current.map((value) => (
      sameKdsSourceLine(value, item)
        ? { ...value, status: target, proStarted: startedAt ?? value.proStarted }
        : value
    )));
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
      await loadOrders('background');
    } catch (error) {
      console.log('[KDS] bulk status update failed', error);
      setItems(before);
      Alert.alert('Order status not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const groupsFor = (status: KdsStatus, sourceItems = items): KdsOrderGroup[] => {
    const groups = new Map<string, KdsOrderGroup>();
    sourceItems.filter((item) => item.status === status).forEach((item) => {
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
    return [...groups.values()].sort((left, right) => {
      const leftTime = left.placedTime ? new Date(left.placedTime).getTime() : Number.POSITIVE_INFINITY;
      const rightTime = right.placedTime ? new Date(right.placedTime).getTime() : Number.POSITIVE_INFINITY;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.orderNo.localeCompare(right.orderNo);
    });
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

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const hasTodoSearch = normalizedSearchQuery.length > 0;
  // The dropdown has an explicit, device-height-aware viewport. Its result
  // list can receive a vertical gesture rather than extending behind the board.
  const searchDropdownMaxHeight = Math.max(240, Math.min(540, height - 180));
  const todoSearchResults = useMemo(() => {
    if (!hasTodoSearch) return [];
    return items
      .filter((item) => item.status === 'S')
      .filter((item) => item.itemName.toLocaleLowerCase().includes(normalizedSearchQuery)
        || item.itemCode.toLocaleLowerCase().includes(normalizedSearchQuery))
      .sort(sortKdsItemsOldestFirst);
  }, [hasTodoSearch, items, normalizedSearchQuery]);
  // A real height (not only maxHeight) gives FlatList a bounded viewport on
  // Android, which is required for it to take the vertical scroll gesture.
  const searchDropdownHeight = Math.min(
    searchDropdownMaxHeight,
    47 + Math.max(152, todoSearchResults.length * 152),
  );
  const searchListHeight = Math.max(105, searchDropdownHeight - 47);

  // These summary counters always describe the full queue, not the temporary
  // To-Do search result subset.
  const todoSummary = summarizeOrderAlerts(groupsFor('S'), now);
  const inProgressSummary = summarizeOrderAlerts(groupsFor('P'), now);

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

  // Search is a rapid To-Do → In Progress workflow. Keep the query intact so
  // the remaining matching rows stay visible and staff can tap the next one.
  const moveSearchItemToInProgress = (item: KdsItem) => {
    void dropItem(item, 'P');
  };

  const modalItems = selectedOrder?.items ?? [];
  const selectedModalItems = modalItems.filter((item) => selectedItemIds.includes(item.id));
  const allModalItemsSelected = modalItems.length > 0 && modalItems.every((item) => selectedItemIds.includes(item.id));
  const canMoveNext = selectedModalItems.some((item) => nextStatus(item.status));
  const canRevert = selectedModalItems.some((item) => previousStatus(item.status));
  const selectedStatusSet = [...new Set(selectedModalItems.map((item) => item.status))];
  const nextButtonText = selectedStatusSet.length === 1
    ? (selectedStatusSet[0] === 'S' ? 'Move to In Progress' : selectedStatusSet[0] === 'P' ? 'Move to Ready' : 'Already Ready')
    : 'Move Next';
  const revertButtonText = selectedStatusSet.length === 1
    ? (selectedStatusSet[0] === 'D' ? 'Revert to In Progress' : selectedStatusSet[0] === 'P' ? 'Revert to New' : 'Already New')
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
      await loadOrders('background');
    } catch (error) {
      console.log('[KDS] selected status update failed', error);
      // At least one request may have reached SQL before another failed. A
      // refresh restores the authoritative state instead of showing stale UI.
      setItems(before);
      await loadOrders('background');
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
          <Text style={styles.headerEyebrow}>LIVE {displayName} QUEUE</Text>
          <Text style={styles.headerTitle}>{stationName} Display</Text>
          <Text style={styles.headerSub}>Station locked to {stationName} · S = To Do · P = In Progress · D = Done</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadOrders('manual')}
          disabled={isRefreshing || isLoading}
          accessibilityRole="button"
          accessibilityLabel={`Refresh the latest ${stationName.toLowerCase()} orders from the database`}
        >
          {isRefreshing ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="refresh" size={20} color={COLORS.white} />}
        </TouchableOpacity>
        {isKitchenDisplay ? (
          <TouchableOpacity
            style={styles.unavailableButton}
            onPress={() => router.push('/Screens/kds-unavailable')}
            accessibilityRole="button"
            accessibilityLabel="Open unavailable items"
          >
            <Ionicons name="close-circle-outline" size={18} color={COLORS.white} />
            <Text style={styles.unavailableButtonText}>Unavailable</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.queueFilter}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search To-Do by item name or item ID"
              placeholderTextColor="#8B9AA8"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search To Do items by item name or item ID"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
                accessibilityRole="button"
                accessibilityLabel="Clear To Do item search"
              >
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {hasTodoSearch ? (
            <View style={[styles.searchDropdown, { height: searchDropdownHeight }]}>
              <View style={styles.searchDropdownHeader}>
                <View>
                  <Text style={styles.searchDropdownTitle}>TO-DO SEARCH RESULTS</Text>
                  <Text style={styles.searchDropdownHint}>Tap an item to move it directly to In Progress</Text>
                </View>
                <View style={styles.searchResultCount}><Text style={styles.searchResultCountText}>{todoSearchResults.length}</Text></View>
              </View>
              <FlatList
                data={todoSearchResults}
                keyExtractor={(item) => `todo-search-${item.id}`}
                renderItem={({ item }) => (
                  <TodoSearchResult
                    item={item}
                    disabled={Boolean(updatingItemId) || Boolean(updatingOrderId)}
                    onPress={moveSearchItemToInProgress}
                  />
                )}
                style={[styles.searchDropdownList, { height: searchListHeight }]}
                contentContainerStyle={styles.searchDropdownContent}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
                scrollEnabled
                scrollEventThrottle={16}
                removeClippedSubviews={false}
                showsVerticalScrollIndicator
                ListEmptyComponent={(
                  <View style={styles.searchNoResults}>
                    <Ionicons name="search-outline" size={22} color="#9AAABA" />
                    <Text style={styles.searchNoResultsText}>No To-Do item matches “{searchQuery.trim()}”</Text>
                  </View>
                )}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.stationIndicator}>
          <View style={styles.stationIndicatorIcon}>
            <Ionicons name={isKitchenDisplay ? 'restaurant-outline' : 'wine-outline'} size={15} color={COLORS.blue} />
          </View>
          <Text style={styles.stationIndicatorTitle}>{displayName} · {stationName.toUpperCase()} STATION</Text>
          <Text style={styles.stationIndicatorHint}>Locked</Text>
        </View>
      </View>

      <View style={styles.summaryHeader}>
        <SeveritySummary title="TO DO" summary={todoSummary} />
        <View style={styles.summaryDivider} />
        <SeveritySummary title="IN PROGRESS" summary={inProgressSummary} />
      </View>

      <View style={styles.board}>
        {COLUMNS.map((column) => {
          // Search is rendered in its own overlay and never changes the board
          // below it: all To-Do, In Progress, and Done cards stay in place.
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
                    <View style={styles.emptyColumn}><Ionicons name={isKitchenDisplay ? 'restaurant-outline' : 'wine-outline'} size={22} color="#B9C7D1" /><Text style={styles.emptyColumnText}>No {stationName} items</Text></View>
                  ) : groups.map((order) => (
                    <OrderGroup
                      key={`${column.id}-${order.id}`}
                      order={order}
                      screenWidth={width}
                      now={now}
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
                <Text style={styles.detailsEyebrow}>{selectedItemIds.length === 1 ? 'ITEM ACTION' : `${stationName.toUpperCase()} ORDER DETAILS`}</Text>
                <View style={styles.detailsIdentityRow}>
                  <View style={styles.detailsIdentityBlock}>
                    <Text style={styles.detailsIdentityLabel}>ORDER NUMBER</Text>
                    <Text style={styles.detailsTitle}>{selectedOrder?.orderNo || '—'}</Text>
                  </View>
                  <View style={styles.detailsTableHero}>
                    <Text style={styles.detailsIdentityLabel}>TABLE NUMBER</Text>
                    <Text style={styles.detailsTableNumber}>{selectedOrder?.tableNo || '—'}</Text>
                  </View>
                </View>
                {selectedOrder?.stewardName ? <Text style={styles.detailsSubtitle}>Steward: {selectedOrder.stewardName}</Text> : null}
              </View>
              <TouchableOpacity style={styles.closeDetails} onPress={closeDetails} accessibilityLabel="Close order details">
                <Ionicons name="close" size={21} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <View style={styles.detailsOrderFacts}>
              <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>ORDER TYPE</Text><Text style={styles.detailsFactValue}>{selectedOrder?.orderMode || '—'}</Text></View>
              <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>ORDER AGE</Text><Text style={styles.detailsFactValue}>{relativeTime(selectedOrder?.placedTime ?? null, now)}</Text></View>
              <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>ITEMS</Text><Text style={styles.detailsFactValue}>{modalItems.length}</Text></View>
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
            <Text style={styles.detailsHint}>Tap a row to select it. Move Next follows New → In Progress → Ready; Revert moves it back one step.</Text>

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
                      <Text style={styles.detailsItemCode}>{item.itemCode}  ·  {typeLabel(item.type)}  ·  Prep {item.prepDuration || 0} min</Text>
                      {item.remarks ? (
                        <View style={styles.detailsRemarkBanner}>
                          <Ionicons name="chatbox-ellipses-outline" size={14} color="#8A541F" />
                          <Text style={styles.detailsRemarkText}>NOTE: {item.remarks}</Text>
                        </View>
                      ) : <Text style={styles.detailsNoRemark}>No remark</Text>}
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

/** Kitchen Display System: permanently bound to Kitchen/KOT data. */
export default function KDSHomeScreen() {
  return <KdsDisplayScreen stationType="K" />;
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
  queueFilter: { paddingHorizontal: 11, paddingVertical: 8, gap: 8, zIndex: 20, elevation: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchRow: { width: '100%', position: 'relative', zIndex: 30 },
  searchBox: { minHeight: 40, paddingLeft: 10, paddingRight: 5, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, backgroundColor: '#F4F8FA', borderWidth: 1, borderColor: '#D5E3EB' },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: COLORS.text, fontSize: 12, fontWeight: '700' },
  clearSearchButton: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderRadius: 15 },
  // A tall, scrollable list deliberately has no result-count cap. Every
  // matching To-Do line remains available by scrolling down this dropdown.
  searchDropdown: { position: 'absolute', top: 46, left: 0, right: 0, zIndex: 40, overflow: 'hidden', borderRadius: 13, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#C9DBE5', shadowColor: '#002748', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 24 },
  searchDropdownHeader: { minHeight: 47, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E3EDF2', backgroundColor: '#F7FBFD' },
  searchDropdownTitle: { color: COLORS.navy, fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  searchDropdownHint: { color: COLORS.textMuted, fontSize: 8, fontWeight: '700', marginTop: 2 },
  searchResultCount: { minWidth: 25, height: 25, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: COLORS.blue },
  searchResultCountText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  searchDropdownList: { flex: 1, minHeight: 0 },
  searchDropdownContent: { padding: 7, gap: 6 },
  searchNoResults: { minHeight: 94, padding: 12, alignItems: 'center', justifyContent: 'center' },
  searchNoResultsText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  stationIndicator: { minHeight: 32, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, backgroundColor: COLORS.blueSoft, borderWidth: 1, borderColor: '#CFE4F2' },
  stationIndicatorIcon: { width: 21, height: 21, justifyContent: 'center', alignItems: 'center', borderRadius: 7, backgroundColor: COLORS.white },
  stationIndicatorTitle: { flex: 1, color: COLORS.blue, fontSize: 9, fontWeight: '900', letterSpacing: 0.25 },
  stationIndicatorHint: { color: COLORS.textMuted, fontSize: 8, fontWeight: '800' },
  summaryHeader: { marginHorizontal: 8, marginTop: 8, marginBottom: 7, paddingVertical: 7, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  summaryDivider: { width: 1, height: 28, backgroundColor: COLORS.border },
  severitySummary: { flex: 1, minWidth: 0 },
  severitySummaryTitle: { color: COLORS.navy, fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  severityPills: { marginTop: 4, flexDirection: 'row', gap: 3 },
  severityPill: { minWidth: 27, paddingHorizontal: 4, paddingVertical: 3, alignItems: 'center', borderRadius: 5 },
  severityPillNormal: { backgroundColor: '#DDEAF1' },
  severityPillAmber: { backgroundColor: '#E8A93F' },
  severityPillRed: { backgroundColor: COLORS.danger },
  severityPillText: { color: COLORS.white, fontSize: 8, fontWeight: '900' },
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
  searchResultRow: { padding: 9, gap: 7, borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#CFE0E9', shadowColor: '#002748', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  searchResultDisabled: { opacity: 0.6 },
  searchResultTopLine: { flexDirection: 'row', gap: 6 },
  searchResultOrderBlock: { flex: 1, minWidth: 0 },
  searchResultTableBlock: { minWidth: 66, paddingHorizontal: 6, paddingVertical: 4, alignItems: 'center', borderRadius: 7, backgroundColor: COLORS.blueSoft },
  searchResultLabel: { color: COLORS.textMuted, fontSize: 7, fontWeight: '900', letterSpacing: 0.25 },
  searchResultOrder: { color: COLORS.navy, fontSize: 13, fontWeight: '900', marginTop: 2 },
  searchResultTable: { color: COLORS.navy, fontSize: 13, fontWeight: '900', marginTop: 2 },
  searchResultItemLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchResultItemCopy: { flex: 1, minWidth: 0 },
  searchResultItemName: { color: COLORS.text, fontSize: 12, fontWeight: '900' },
  searchResultItemId: { color: COLORS.textMuted, fontSize: 8, fontWeight: '800', marginTop: 2 },
  searchResultQuantity: { minWidth: 38, paddingVertical: 4, alignItems: 'center', borderRadius: 7, backgroundColor: '#EDF4F8' },
  searchResultQuantityText: { color: COLORS.blue, fontSize: 14, fontWeight: '900', marginTop: 1 },
  searchResultNote: { minHeight: 26, paddingHorizontal: 6, paddingVertical: 5, flexDirection: 'row', alignItems: 'flex-start', gap: 4, borderRadius: 6, backgroundColor: '#FFF0CF', borderLeftWidth: 3, borderLeftColor: '#E39A2D' },
  searchResultNoteText: { flex: 1, color: '#7A4615', fontSize: 9, lineHeight: 12, fontWeight: '800' },
  searchQuickAction: { minHeight: 28, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: 7, backgroundColor: COLORS.blue },
  searchQuickActionText: { color: COLORS.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.2 },
  orderCard: { borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E0E8EE', shadowColor: '#002748', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  orderCardAmber: { borderColor: '#E4A13A', backgroundColor: '#FFF8E7' },
  orderCardRed: { borderColor: '#D85A52', backgroundColor: '#FFF2F1' },
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
  itemRowAmber: { backgroundColor: '#FFF4D9' },
  itemRowRed: { backgroundColor: '#FFE8E6' },
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
  detailsIdentityRow: { marginTop: 5, flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  detailsIdentityBlock: { flex: 1, minWidth: 0, paddingVertical: 6 },
  detailsIdentityLabel: { color: COLORS.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  detailsTitle: { color: COLORS.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
  detailsTableHero: { minWidth: 98, paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center', borderRadius: 11, backgroundColor: COLORS.blueSoft, borderWidth: 1, borderColor: '#CDE5F5' },
  detailsTableNumber: { color: COLORS.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
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
  detailsRemarkBanner: { marginTop: 6, paddingHorizontal: 6, paddingVertical: 5, flexDirection: 'row', alignItems: 'flex-start', gap: 4, borderRadius: 6, backgroundColor: '#FFF0CF', borderLeftWidth: 3, borderLeftColor: '#E39A2D' },
  detailsRemarkText: { flex: 1, color: '#7A4615', fontSize: 10, lineHeight: 13, fontWeight: '900' },
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
