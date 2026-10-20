import { OperationalColors } from '../../constants/operationalTheme';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  FlatList,
  Modal,
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
import Tts from 'react-native-tts';

import { apiClient } from '../../services/api';
import { useNotificationStore } from '../../services/notificationStore';

type KdsStatus = 'S' | 'P' | 'D';
type KdsQueueType = 'K' | 'B';
type KdsWaitingConfig = {
  toDoAmberMinutes: number;
  toDoRedMinutes: number;
  inProgressAmberMinutes: number;
};

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
  background: OperationalColors.canvas,
  navy: OperationalColors.primary,
  blue: OperationalColors.primary,
  blueSoft: OperationalColors.surfaceAlt,
  text: OperationalColors.primary,
  textMuted: OperationalColors.muted,
  border: OperationalColors.border,
  todo: '#E9963C',
  processing: OperationalColors.primary,
  done: '#2B9662',
  white: OperationalColors.onPrimary,
  danger: '#D85A52',
};

type KdsUiMetrics = { styles: any; scale: number };
// KDS and BDS share this context so cards, typography and touch targets scale
// together across compact phones, standard phones and tablet displays.
const KdsUiContext = React.createContext<KdsUiMetrics>({ styles: {}, scale: 1 });

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

// A queue aggregate follows the actual item code when present, with the item
// name only as a safe fallback for legacy rows that have no code.
const todoItemKeyFor = (item: Pick<KdsItem, 'itemCode' | 'itemName'>) => {
  const code = String(item.itemCode ?? '').trim().toUpperCase();
  return code ? `CODE:${code}` : `NAME:${String(item.itemName ?? '').trim().toUpperCase()}`;
};

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

const itemAlertLevel = (item: KdsItem, now: number, waitingConfig: KdsWaitingConfig): AlertLevel => {
  if (item.status === 'S') {
    const waiting = elapsedMinutes(item.placedTime, now);
    if (waitingConfig.toDoRedMinutes > 0 && waiting >= waitingConfig.toDoRedMinutes) return 'red';
    if (waitingConfig.toDoAmberMinutes > 0 && waiting >= waitingConfig.toDoAmberMinutes) return 'amber';
    return 'normal';
  }
  if (item.status === 'P') {
    const prepDuration = waitingConfig.inProgressAmberMinutes > 0
      ? waitingConfig.inProgressAmberMinutes
      : Math.max(0, Number(item.prepDuration) || 0);
    if (prepDuration <= 0) return 'normal';
    const progressing = elapsedMinutes(item.proStarted || item.placedTime, now);
    if (progressing >= prepDuration) return 'red';
    if (progressing >= prepDuration * 0.95) return 'amber';
  }
  return 'normal';
};

const orderAlertLevel = (order: KdsOrderGroup, now: number, waitingConfig: KdsWaitingConfig): AlertLevel => order.items.reduce<AlertLevel>((highest, item) => {
  const next = itemAlertLevel(item, now, waitingConfig);
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

const cardStyleForAlertLevel = (level: AlertLevel, styles: any) =>
  level === 'red' ? styles.orderCardRed : level === 'amber' ? styles.orderCardAmber : null;

const itemStyleForAlertLevel = (level: AlertLevel, styles: any) =>
  level === 'red' ? styles.itemRowRed : level === 'amber' ? styles.itemRowAmber : null;

type AlertSummary = Record<AlertLevel, number>;

const summarizeOrderAlerts = (orders: KdsOrderGroup[], now: number, waitingConfig: KdsWaitingConfig): AlertSummary => orders.reduce<AlertSummary>((summary, order) => {
  summary[orderAlertLevel(order, now, waitingConfig)] += 1;
  return summary;
}, { normal: 0, amber: 0, red: 0 });

type SeveritySummaryProps = { title: string; summary: AlertSummary };
function SeveritySummary({ title, summary }: SeveritySummaryProps) {
  const { styles } = React.useContext(KdsUiContext);
  return (
    <View style={styles.severitySummary}>
      <Text style={styles.severitySummaryTitle}>{title}</Text>
      <View style={styles.severityPills}>
        <View style={[styles.severityPill, styles.severityPillNormal]}>
          <Text style={styles.severityPillLabel}>NORMAL</Text>
          <Text style={styles.severityPillCount}>{summary.normal}</Text>
        </View>
        <View style={[styles.severityPill, styles.severityPillAmber]}>
          <Text style={styles.severityPillLabel}>AMBER</Text>
          <Text style={styles.severityPillCount}>{summary.amber}</Text>
        </View>
        <View style={[styles.severityPill, styles.severityPillRed]}>
          <Text style={styles.severityPillLabel}>RED</Text>
          <Text style={styles.severityPillCount}>{summary.red}</Text>
        </View>
      </View>
    </View>
  );
}

type KdsOrderItemRowProps = {
  item: KdsItem;
  alertLevel: AlertLevel;
  disabled: boolean;
  queueMoreQuantity: number;
  onPress: (item: KdsItem) => void;
  onTodoItemLongPress?: (item: KdsItem) => void;
};

/** A tap opens individual actions; a To-Do hold opens the same-item bulk move sheet. */
function KdsOrderItemRow({
  item,
  alertLevel,
  disabled,
  queueMoreQuantity,
  onPress,
  onTodoItemLongPress,
}: KdsOrderItemRowProps) {
  const { styles, scale } = React.useContext(KdsUiContext);
  const heldLongEnough = useRef(false);
  return (
    <TouchableOpacity
      style={[styles.itemRow, itemStyleForAlertLevel(alertLevel, styles), disabled && styles.itemRowUpdating]}
      onPressIn={() => { heldLongEnough.current = false; }}
      onPress={() => { if (!heldLongEnough.current) onPress(item); }}
      onLongPress={onTodoItemLongPress ? () => {
        heldLongEnough.current = true;
        onTodoItemLongPress(item);
      } : undefined}
      delayLongPress={420}
      disabled={disabled}
      activeOpacity={0.74}
      accessibilityRole="button"
      accessibilityLabel={onTodoItemLongPress
        ? `Hold ${item.itemName} to select matching To Do orders, or tap for item actions`
        : `Select ${item.itemName} for a kitchen status action`}
    >
      <View style={styles.qtyPill}><Text style={styles.qtyText}>{item.quantity}×</Text></View>
      <View style={styles.itemCopy}>
        <Text style={styles.itemName} numberOfLines={2}>{item.itemName}</Text>
        {item.remarks ? <Text style={styles.itemRemark} numberOfLines={2}>{item.remarks}</Text> : null}
        {onTodoItemLongPress && queueMoreQuantity > 0 ? (
          <View style={styles.queueAggregateBadge}>
            <Ionicons name="layers-outline" size={Math.round(11 * scale)} color={COLORS.blue} />
            <Text style={styles.queueAggregateText}>+{queueMoreQuantity} More in Queue</Text>
          </View>
        ) : null}
      </View>
      {disabled ? <ActivityIndicator size="small" color={COLORS.blue} /> : <Ionicons name="chevron-forward-circle-outline" size={Math.round(19 * scale)} color={COLORS.blue} />}
    </TouchableOpacity>
  );
}

type TodoSearchResultProps = {
  item: KdsItem;
  disabled: boolean;
  onPress: (item: KdsItem) => void;
};

/** A compact, complete row shown only for To-Do item-name/item-ID searches. */
function TodoSearchResult({ item, disabled, onPress }: TodoSearchResultProps) {
  const { styles, scale } = React.useContext(KdsUiContext);
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
        <Ionicons name="chatbox-ellipses-outline" size={Math.round(13 * scale)} color="#8A541F" />
        <Text style={styles.searchResultNoteText}>NOTE: {item.remarks || 'No remark'}</Text>
      </View>
      <View style={styles.searchQuickAction}>
        {disabled ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward-circle-outline" size={Math.round(14 * scale)} color={COLORS.white} />}
        <Text style={styles.searchQuickActionText}>MOVE TO IN PROGRESS</Text>
      </View>
    </TouchableOpacity>
  );
}

type OrderTableBadgeProps = { order: KdsOrderGroup; takeAway: boolean; disabled: boolean };

/** Display-only table marker. Whole-order drag/drop is intentionally removed. */
function OrderTableBadge({ order, takeAway, disabled }: OrderTableBadgeProps) {
  const { styles } = React.useContext(KdsUiContext);
  return (
    <View style={[styles.tableBadge, disabled && styles.tableBadgeUpdating]}>
      <Text style={styles.tableLabel}>{takeAway ? 'TAKE AWAY' : 'TABLE'}</Text>
      {disabled ? <ActivityIndicator size="small" color={COLORS.blue} /> : <Text style={styles.tableNumber} numberOfLines={1}>{order.tableNo || '—'}</Text>}
    </View>
  );
}

type OrderGroupProps = {
  order: KdsOrderGroup;
  status: KdsStatus;
  now: number;
  waitingConfig: KdsWaitingConfig;
  updatingItemId: string | null;
  updatingOrderId: string | null;
  onItemPress: (item: KdsItem) => void;
  onTodoItemLongPress: (item: KdsItem) => void;
  queueMoreQuantityForItem: (item: KdsItem) => number;
  onShowDetails: (order: KdsOrderGroup) => void;
};

function OrderGroup({
  order,
  status,
  now,
  waitingConfig,
  updatingItemId,
  updatingOrderId,
  onItemPress,
  onTodoItemLongPress,
  queueMoreQuantityForItem,
  onShowDetails,
}: OrderGroupProps) {
  const { styles, scale } = React.useContext(KdsUiContext);
  const takeAway = order.orderMode.toUpperCase().includes('TAKE') || order.tableNo.toUpperCase().startsWith('TA');
  const cardAlertLevel = orderAlertLevel(order, now, waitingConfig);
  const isTodo = status === 'S';
  return (
    <View style={[styles.orderCard, cardStyleForAlertLevel(cardAlertLevel, styles)]}>
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
        <OrderTableBadge
          order={order}
          takeAway={takeAway}
          disabled={Boolean(updatingItemId) || Boolean(updatingOrderId)}
        />
      </View>
      <View style={styles.orderMeta}>
        <Ionicons name="time-outline" size={Math.round(12 * scale)} color={COLORS.textMuted} />
        <Text style={styles.orderMetaText}>TIME {relativeTime(order.placedTime, now)} ago</Text>
        {order.orderMode ? <><View style={styles.orderDot} /><Text style={styles.orderMetaText}>TYPE {order.orderMode}</Text></> : null}
      </View>
      <View style={styles.itemsList}>
        {order.items.map((item) => (
          <KdsOrderItemRow
            key={item.id}
            item={item}
            alertLevel={itemAlertLevel(item, now, waitingConfig)}
            disabled={Boolean(updatingItemId) || Boolean(updatingOrderId)}
            queueMoreQuantity={isTodo ? queueMoreQuantityForItem(item) : 0}
            onPress={onItemPress}
            onTodoItemLongPress={isTodo ? onTodoItemLongPress : undefined}
          />
        ))}
      </View>
    </View>
  );
}

type KdsLoadMode = 'initial' | 'manual' | 'background';

// To Do column layout: 'order' (default, unchanged) or 'item' (one card per
// item name; tapping it opens a popup that lists the orders for that item).
type TodoViewMode = 'order' | 'item';

type TodoItemGroupProps = {
  name: string;
  rows: KdsItem[];
  now: number;
  waitingConfig: KdsWaitingConfig;
  disabled: boolean;
  onOpenItem: () => void;
  onOpenLine: (item: KdsItem) => void;
};

/** One item (e.g. Chicken Fried Rice). Display only: no selection on the card. */
function TodoItemGroup({
  name,
  rows,
  now,
  waitingConfig,
  disabled,
  onOpenItem,
  onOpenLine,
}: TodoItemGroupProps) {
  const { styles, scale } = React.useContext(KdsUiContext);
  const totalQty = rows.reduce((total, row) => total + row.quantity, 0);
  return (
    <View style={styles.orderCard}>
      <TouchableOpacity
        style={styles.todoGroupHeader}
        onPress={onOpenItem}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name} orders`}
      >
        <View style={styles.todoGroupCopy}>
          <Text style={styles.todoGroupName} numberOfLines={2}>{name}</Text>
          <Text style={styles.todoGroupMeta}>{rows.length} {rows.length === 1 ? 'ORDER' : 'ORDERS'}</Text>
        </View>
        <View style={styles.todoGroupTotal}>
          <Text style={styles.todoGroupTotalText}>{totalQty}×</Text>
        </View>
        <Ionicons name="chevron-forward" size={Math.round(16 * scale)} color={COLORS.navy} />
      </TouchableOpacity>
      <View style={styles.itemsList}>
        {rows.map((row) => {
          const alertLevel = itemAlertLevel(row, now, waitingConfig);
          return (
            <TouchableOpacity
              key={row.id}
              style={[
                styles.todoLineRow,
                itemStyleForAlertLevel(alertLevel, styles),
                disabled && styles.itemRowUpdating,
              ]}
              onPress={() => onOpenLine(row)}
              disabled={disabled}
              activeOpacity={0.74}
              accessibilityRole="button"
              accessibilityLabel={`Open ${row.itemName} for order ${row.orderNo}`}
            >
              <View style={styles.itemCopy}>
                <Text style={styles.itemName} numberOfLines={1}>ORDER {row.orderNo}  ·  TABLE {row.tableNo || '—'}</Text>
                <Text style={styles.todoLineMeta} numberOfLines={1}>
                  {row.stewardName || '—'} · {relativeTime(row.placedTime, now)} ago
                </Text>
                {row.remarks ? <Text style={styles.itemRemark} numberOfLines={2}>{row.remarks}</Text> : null}
              </View>
              <View style={styles.qtyPill}><Text style={styles.qtyText}>{row.quantity}×</Text></View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type TodoItemSheetProps = {
  visible: boolean;
  name: string;
  code: string;
  rows: KdsItem[];
  selectedIds: string[];
  now: number;
  busy: boolean;
  isMoving: boolean;
  onClose: () => void;
  onToggleLine: (item: KdsItem) => void;
  onToggleAll: (rows: KdsItem[]) => void;
  onMove: (lines: KdsItem[]) => void;
};

/** Popup for one item: its orders are ticked here and moved to In Progress. */
function TodoItemSheet({
  visible,
  name,
  code,
  rows,
  selectedIds,
  now,
  busy,
  isMoving,
  onClose,
  onToggleLine,
  onToggleAll,
  onMove,
}: TodoItemSheetProps) {
  const { styles, scale } = React.useContext(KdsUiContext);
  const iconSize = (size: number) => Math.round(size * scale);
  const selectedLines = rows.filter((row) => selectedIds.includes(row.id));
  const selectedQty = selectedLines.reduce((total, row) => total + row.quantity, 0);
  const totalQty = rows.reduce((total, row) => total + row.quantity, 0);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const canMove = selectedLines.length > 0 && !busy;
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.detailsOverlay}>
        <View style={styles.detailsSheet}>
          <View style={styles.detailsHeader}>
            <View style={styles.detailsHeaderCopy}>
              <Text style={styles.detailsEyebrow}>TO DO ITEM</Text>
              <Text style={styles.detailsTitle} numberOfLines={2}>{name || '—'}</Text>
              <Text style={styles.detailsSubtitle}>Item ID: {code || '—'}  ·  {rows.length} {rows.length === 1 ? 'ORDER' : 'ORDERS'}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeDetails}
              onPress={onClose}
              disabled={isMoving}
              accessibilityRole="button"
              accessibilityLabel="Close item orders"
            >
              <Ionicons name="close" size={iconSize(21)} color={COLORS.navy} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsOrderFacts}>
            <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>ORDERS</Text><Text style={styles.detailsFactValue}>{rows.length}</Text></View>
            <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>TOTAL QTY</Text><Text style={styles.detailsFactValue}>{totalQty}×</Text></View>
            <View style={styles.detailsFact}><Text style={styles.detailsFactLabel}>SELECTED</Text><Text style={styles.detailsFactValue}>{selectedLines.length} · {selectedQty}×</Text></View>
          </View>

          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={() => onToggleAll(rows)}
            disabled={busy || rows.length === 0}
            accessibilityRole="button"
            accessibilityLabel={allSelected ? 'Clear all orders' : 'Select all orders'}
          >
            <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={iconSize(16)} color={COLORS.blue} />
            <Text style={styles.selectAllText}>{allSelected ? 'Clear all' : 'Select all'}</Text>
          </TouchableOpacity>
          <Text style={styles.detailsHint}>Tap an order to select it. Only the ticked orders move to In Progress.</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailsList}>
            {rows.map((row) => {
              const checked = selectedIds.includes(row.id);
              return (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.detailsItem, checked && styles.detailsItemSelected]}
                  onPress={() => onToggleLine(row)}
                  disabled={busy}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`Select ${row.itemName} for order ${row.orderNo}`}
                >
                  <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={iconSize(22)} color={checked ? COLORS.blue : OperationalColors.muted} />
                  <View style={styles.detailsQty}><Text style={styles.detailsQtyText}>{row.quantity}×</Text></View>
                  <View style={styles.detailsItemCopy}>
                    <Text style={styles.detailsItemName}>ORDER {row.orderNo}  ·  TABLE {row.tableNo || '—'}</Text>
                    <Text style={styles.detailsItemCode}>{row.stewardName || '—'}  ·  {relativeTime(row.placedTime, now)} ago</Text>
                    {row.remarks ? (
                      <View style={styles.detailsRemarkBanner}>
                        <Ionicons name="chatbox-ellipses-outline" size={iconSize(14)} color="#8A541F" />
                        <Text style={styles.detailsRemarkText}>NOTE: {row.remarks}</Text>
                      </View>
                    ) : <Text style={styles.detailsNoRemark}>No remark</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalActionButton, styles.nextButton, !canMove && styles.modalActionDisabled]}
              onPress={() => onMove(selectedLines)}
              disabled={!canMove}
              accessibilityRole="button"
              accessibilityLabel={`Move ${selectedLines.length} selected orders to In Progress`}
            >
              {isMoving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward-outline" size={iconSize(17)} color={COLORS.white} />}
              <Text style={styles.nextButtonText}>
                {selectedLines.length > 0 ? `Move ${selectedLines.length} to In Progress` : 'Move to In Progress'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type KdsDisplayScreenProps = { stationType: KdsQueueType };

/**
 * A station-locked board. KDS mounts this with Kitchen and BDS mounts it with
 * Bar, so neither display can switch to or fetch the other station's queue.
 */
export function KdsDisplayScreen({ stationType }: KdsDisplayScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Three responsive tiers: compact phone, regular phone, and tablet. The
  // 520 dp tablet threshold also covers the Android tablet viewport shown in
  // the supplied screenshot, where the prior fixed 7–13 px type was too small.
  const isTablet = Math.min(width, height) >= 520;
  const isCompactPhone = !isTablet && height < 700;
  const uiScale = isTablet
    ? Math.min(1.5, Math.max(1.32, width / 400))
    : isCompactPhone ? 0.88 : 1;
  const kdsUi = useMemo(() => ({ styles: createResponsiveKdsStyles(uiScale), scale: uiScale }), [uiScale]);
  const styles = kdsUi.styles;
  const iconSize = (size: number) => Math.round(size * uiScale);
  const isKdsScreenFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(() => AppState.currentState);
  const [items, setItems] = useState<KdsItem[]>([]);
  const [waitingConfig, setWaitingConfig] = useState<KdsWaitingConfig>({
    toDoAmberMinutes: 0,
    toDoRedMinutes: 0,
    inProgressAmberMinutes: 0,
  });
  const kdsQueueType = stationType;
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const delayAlertedRef = useRef<Set<string>>(new Set());
  const voiceAllowedRef = useRef(false);
  const loadRequestRef = useRef(0);
  const soundEnabled = useNotificationStore((state) => state.preferences.soundEnabled);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrderKey, setSelectedOrderKey] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isSelectionUpdating, setIsSelectionUpdating] = useState(false);
  const [bulkTodoItemKey, setBulkTodoItemKey] = useState<string | null>(null);
  const [bulkTodoItemName, setBulkTodoItemName] = useState('');
  const [bulkSelectedTodoIds, setBulkSelectedTodoIds] = useState<string[]>([]);
  const [isBulkTodoMoving, setIsBulkTodoMoving] = useState(false);
  // To Do item view: layout toggle plus the line ids ticked for bulk sending.
  const [todoViewMode, setTodoViewMode] = useState<TodoViewMode>('order');
  const [selectedTodoLineIds, setSelectedTodoLineIds] = useState<string[]>([]);
  const [todoItemKey, setTodoItemKey] = useState<string | null>(null);
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
      const nextConfig = response.data.waitingConfig;
      if (nextConfig) {
        setWaitingConfig({
          toDoAmberMinutes: Math.max(0, Number(nextConfig.toDoAmberMinutes) || 0),
          toDoRedMinutes: Math.max(0, Number(nextConfig.toDoRedMinutes) || 0),
          inProgressAmberMinutes: Math.max(0, Number(nextConfig.inProgressAmberMinutes) || 0),
        });
      }
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

  // Timers repaint independently of queue polling so database-configured
  // waiting thresholds turn colour at the correct time.
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
        && itemAlertLevel(item, now, waitingConfig) === 'red')
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
  }, [isVoiceAllowed, items, kdsQueueType, now, soundEnabled, waitingConfig]);

  const moveItemToStatus = async (item: KdsItem, target: KdsStatus) => {
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

    const movedAt = (item: KdsItem) => {
      const source = status === 'P' ? (item.proStarted || item.placedTime) : item.placedTime;
      const value = source ? new Date(source).getTime() : Number.POSITIVE_INFINITY;
      return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
    };

    return [...groups.values()]
      .map((group) => ({
        ...group,
        // Within an In Progress order, items retain the moment each item moved.
        items: [...group.items].sort((left, right) => movedAt(left) - movedAt(right) || left.itemName.localeCompare(right.itemName)),
      }))
      .sort((left, right) => {
        const leftTime = Math.min(...left.items.map(movedAt));
        const rightTime = Math.min(...right.items.map(movedAt));
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
  const searchDropdownMaxHeight = Math.max(240 * uiScale, Math.min(540 * uiScale, height - 180 * uiScale));
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
  const searchDropdownHeaderHeight = 47 * uiScale;
  const searchDropdownHeight = Math.min(
    searchDropdownMaxHeight,
    searchDropdownHeaderHeight + Math.max(152 * uiScale, todoSearchResults.length * 152 * uiScale),
  );
  const searchListHeight = Math.max(105 * uiScale, searchDropdownHeight - searchDropdownHeaderHeight);

  // These summary counters always describe the full queue, not the temporary
  // To-Do search result subset.
  const todoSummary = summarizeOrderAlerts(groupsFor('S'), now, waitingConfig);
  const inProgressSummary = summarizeOrderAlerts(groupsFor('P'), now, waitingConfig);

  const todoQueueQuantityByItem = useMemo(() => {
    const totals = new Map<string, number>();
    items.filter((item) => item.status === 'S').forEach((item) => {
      const key = todoItemKeyFor(item);
      totals.set(key, (totals.get(key) ?? 0) + item.quantity);
    });
    return totals;
  }, [items]);

  const queueMoreQuantityForItem = useCallback((item: KdsItem) => (
    Math.max(0, (todoQueueQuantityByItem.get(todoItemKeyFor(item)) ?? 0) - item.quantity)
  ), [todoQueueQuantityByItem]);

  const bulkTodoItems = useMemo(() => {
    if (!bulkTodoItemKey) return [];
    return items
      .filter((item) => item.status === 'S' && todoItemKeyFor(item) === bulkTodoItemKey)
      .sort(sortKdsItemsOldestFirst);
  }, [bulkTodoItemKey, items]);

  const bulkTodoAllSelected = bulkTodoItems.length > 0
    && bulkTodoItems.every((item) => bulkSelectedTodoIds.includes(item.id));

  // Item view: every To Do line, grouped by item (oldest line first). In
  // Progress and Done keep the order layout.
  const todoItemGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; rows: KdsItem[] }>();
    items
      .filter((item) => item.status === 'S')
      .sort(sortKdsItemsOldestFirst)
      .forEach((item) => {
        const key = todoItemKeyFor(item);
        const group = groups.get(key);
        if (group) group.rows.push(item);
        else groups.set(key, { key, name: item.itemName, rows: [item] });
      });
    return [...groups.values()];
  }, [items]);

  // The popup follows its item. When every To Do line of that item has moved,
  // the item no longer exists here and the popup closes by itself.
  const activeTodoItem = useMemo(
    () => (todoItemKey ? todoItemGroups.find((group) => group.key === todoItemKey) ?? null : null),
    [todoItemGroups, todoItemKey],
  );

  // Lines that leave To Do (polling, another device, or a send) drop out of the
  // selection so the popup never counts stale rows.
  useEffect(() => {
    const todoIds = new Set(items.filter((item) => item.status === 'S').map((item) => item.id));
    setSelectedTodoLineIds((current) => {
      const next = current.filter((id) => todoIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [items]);

  // Tapping an item name opens its order list. Tapping one order line opens the
  // same list with that order already ticked.
  const openTodoItem = (key: string, lineId?: string) => {
    setTodoItemKey(key);
    setSelectedTodoLineIds(lineId ? [lineId] : []);
  };

  const closeTodoItem = () => {
    if (isBulkTodoMoving) return;
    setTodoItemKey(null);
    setSelectedTodoLineIds([]);
  };

  const toggleTodoLine = (item: KdsItem) => {
    setSelectedTodoLineIds((current) => (current.includes(item.id)
      ? current.filter((id) => id !== item.id)
      : [...current, item.id]));
  };

  const toggleTodoGroupAll = (rows: KdsItem[]) => {
    const ids = rows.map((row) => row.id);
    setSelectedTodoLineIds((current) => {
      const allSelected = ids.every((id) => current.includes(id));
      return allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])];
    });
  };

  // Same request shape as the existing bulk To-Do move: one call per physical
  // KOT/BOT line, optimistic UI, full revert on failure.
  const sendTodoLinesToInProgress = async (lines: KdsItem[]) => {
    if (lines.length === 0 || isBulkTodoMoving || updatingItemId || updatingOrderId) return;
    const before = items;
    const sentIds = new Set(lines.map((item) => item.id));
    const startedAt = new Date().toISOString();
    const uniqueSelections = [...new Map(lines.map((item) => [
      `${item.orderNo}|${item.itemCode}|${item.type}|${item.tableNo}|${item.invoiceNo}`,
      item,
    ])).values()];

    setIsBulkTodoMoving(true);
    setUpdatingItemId('todo-line-send');
    setItems((current) => current.map((item) => (
      sentIds.has(item.id) ? { ...item, status: 'P', proStarted: startedAt } : item
    )));
    try {
      const results = await Promise.all(uniqueSelections.map((item) => apiClient.updateKdsOrderItemStatus({
        orderNo: item.orderNo,
        itemCode: item.itemCode,
        type: item.type,
        tableNo: item.tableNo,
        invoiceNo: item.invoiceNo,
        status: 'P',
      })));
      const failed = results.find((response) => !response.ok || !response.data?.ok);
      if (failed) throw new Error(failed.data?.message || 'One or more items could not be moved.');
      setSelectedTodoLineIds([]);
      setTodoItemKey(null);
      await loadOrders('background');
    } catch (error) {
      console.log('[KDS] To-Do line send failed', error);
      setItems(before);
      await loadOrders('background');
      Alert.alert('Items not moved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUpdatingItemId(null);
      setIsBulkTodoMoving(false);
    }
  };

  const openTodoBulkMove = (item: KdsItem) => {
    setBulkTodoItemKey(todoItemKeyFor(item));
    setBulkTodoItemName(item.itemName);
    // The held row is selected by default; staff can tick any additional orders.
    setBulkSelectedTodoIds([item.id]);
  };

  const closeTodoBulkMove = (force = false) => {
    if (isBulkTodoMoving && !force) return;
    setBulkTodoItemKey(null);
    setBulkTodoItemName('');
    setBulkSelectedTodoIds([]);
  };

  const toggleBulkTodoItem = (itemId: string) => {
    if (isBulkTodoMoving) return;
    setBulkSelectedTodoIds((current) => current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]);
  };

  const toggleBulkTodoAll = () => {
    if (isBulkTodoMoving) return;
    setBulkSelectedTodoIds(bulkTodoAllSelected ? [] : bulkTodoItems.map((item) => item.id));
  };

  const moveBulkTodoItemsToInProgress = async () => {
    if (isBulkTodoMoving || updatingItemId || updatingOrderId) return;
    const selected = bulkTodoItems.filter((item) => bulkSelectedTodoIds.includes(item.id));
    if (selected.length === 0) {
      Alert.alert('Select orders', 'Select at least one To-Do order to move into In Progress.');
      return;
    }

    const before = items;
    const selectedIds = new Set(selected.map((item) => item.id));
    const startedAt = new Date().toISOString();
    // One request per physical KOT/BOT line, even if a source view repeated it.
    const uniqueSelections = [...new Map(selected.map((item) => [
      `${item.orderNo}|${item.itemCode}|${item.type}|${item.tableNo}|${item.invoiceNo}`,
      item,
    ])).values()];

    setIsBulkTodoMoving(true);
    setUpdatingItemId('bulk-todo-move');
    setItems((current) => current.map((item) => (
      selectedIds.has(item.id) ? { ...item, status: 'P', proStarted: startedAt } : item
    )));
    try {
      const results = await Promise.all(uniqueSelections.map((item) => apiClient.updateKdsOrderItemStatus({
        orderNo: item.orderNo,
        itemCode: item.itemCode,
        type: item.type,
        tableNo: item.tableNo,
        invoiceNo: item.invoiceNo,
        status: 'P',
      })));
      const failed = results.find((response) => !response.ok || !response.data?.ok);
      if (failed) throw new Error(failed.data?.message || 'One or more items could not be moved.');
      closeTodoBulkMove(true);
      await loadOrders('background');
    } catch (error) {
      console.log('[KDS] bulk To-Do item move failed', error);
      setItems(before);
      Alert.alert('Items not moved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUpdatingItemId(null);
      setIsBulkTodoMoving(false);
    }
  };

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
    void moveItemToStatus(item, 'P');
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
    <KdsUiContext.Provider value={kdsUi}>
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>LIVE {displayName} QUEUE</Text>
          <Text style={styles.headerTitle}>{stationName} Display</Text>
          <Text style={styles.headerSub}>Station locked to {stationName} · S = To Do · P = In Progress · D = Done</Text>
        </View>
        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => router.push({ pathname: '/Screens/kds-dashboard', params: { type: kdsQueueType } })}
          accessibilityRole="button"
          accessibilityLabel={`Open the ${stationName.toLowerCase()} performance dashboard`}
        >
          <Ionicons name="stats-chart-outline" size={iconSize(20)} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadOrders('manual')}
          disabled={isRefreshing || isLoading}
          accessibilityRole="button"
          accessibilityLabel={`Refresh the latest ${stationName.toLowerCase()} orders from the database`}
        >
          {isRefreshing ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="refresh" size={iconSize(20)} color={COLORS.white} />}
        </TouchableOpacity>
        {isKitchenDisplay ? (
          <TouchableOpacity
            style={styles.unavailableButton}
            onPress={() => router.push('/Screens/kds-unavailable')}
            accessibilityRole="button"
            accessibilityLabel="Open unavailable items"
          >
            <Ionicons name="close-circle-outline" size={iconSize(18)} color={COLORS.white} />
            <Text style={styles.unavailableButtonText}>Unavailable</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.queueFilter}>
        <View style={styles.searchRow}>
          <View style={styles.searchControls}>
          <View style={[styles.searchBox, styles.searchBoxFlex]}>
            <Ionicons name="search-outline" size={iconSize(18)} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search To-Do by item name or item ID"
              placeholderTextColor={OperationalColors.muted}
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
                <Ionicons name="close-circle" size={iconSize(18)} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.todoViewToggle, todoViewMode === 'item' && styles.todoViewToggleActive]}
            onPress={() => {
              setTodoViewMode((current) => (current === 'order' ? 'item' : 'order'));
              setSelectedTodoLineIds([]);
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: todoViewMode === 'item' }}
            accessibilityLabel={todoViewMode === 'item' ? 'Switch To Do to order view' : 'Switch To Do to item view'}
          >
            <Ionicons
              name={todoViewMode === 'item' ? 'list-outline' : 'apps-outline'}
              size={iconSize(15)}
              color={todoViewMode === 'item' ? COLORS.white : COLORS.navy}
            />
            <Text style={[styles.todoViewToggleText, todoViewMode === 'item' && styles.todoViewToggleTextActive]}>
              {todoViewMode === 'item' ? 'ORDER VIEW' : 'ITEM VIEW'}
            </Text>
          </TouchableOpacity>
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
                    <Ionicons name="search-outline" size={iconSize(22)} color={OperationalColors.muted} />
                    <Text style={styles.searchNoResultsText}>No To-Do item matches “{searchQuery.trim()}”</Text>
                  </View>
                )}
              />
            </View>
          ) : null}
        </View>

      </View>

      <View style={styles.summaryHeader} pointerEvents={hasTodoSearch ? 'none' : 'auto'}>
        <SeveritySummary title="TO DO" summary={todoSummary} />
        <View style={styles.summaryDivider} />
        <SeveritySummary title="IN PROGRESS" summary={inProgressSummary} />
      </View>

      {/* While the search dropdown is open, underlying card ScrollViews must
          not capture a vertical swipe intended for the result list. */}
      <View style={styles.board} pointerEvents={hasTodoSearch ? 'none' : 'auto'}>
        {COLUMNS.map((column) => {
          // Search is rendered in its own overlay and never changes the board
          // below it: all To-Do, In Progress, and Done cards stay in place.
          const groups = groupsFor(column.id);
          const itemCount = groups.reduce((total, group) => total + group.items.length, 0);
          // Item view applies to the To Do column only.
          const useItemLayout = column.id === 'S' && todoViewMode === 'item';
          return (
            <View key={column.id} style={styles.column}>
              <View style={[styles.columnHeader, { borderBottomColor: `${column.color}45` }]}>
                <View style={[styles.columnIcon, { backgroundColor: `${column.color}20` }]}><Ionicons name={column.icon} size={iconSize(16)} color={column.color} /></View>
                <Text style={[styles.columnTitle, { color: column.color }]}>{column.title}</Text>
                <View style={[styles.columnCount, { backgroundColor: column.color }]}><Text style={styles.columnCountText}>{itemCount}</Text></View>
              </View>
              {isLoading && items.length === 0 ? (
                <View style={styles.loadingColumn}><ActivityIndicator color={column.color} /><Text style={styles.emptyColumnText}>Loading…</Text></View>
              ) : (
                <ScrollView style={styles.columnScroll} contentContainerStyle={styles.columnContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {(useItemLayout ? todoItemGroups.length === 0 : groups.length === 0) ? (
                    <View style={styles.emptyColumn}><Ionicons name={isKitchenDisplay ? 'restaurant-outline' : 'wine-outline'} size={iconSize(22)} color={OperationalColors.border} /><Text style={styles.emptyColumnText}>No {stationName} items</Text></View>
                  ) : useItemLayout ? todoItemGroups.map((group) => (
                    <TodoItemGroup
                      key={`todo-item-${group.key}`}
                      name={group.name}
                      rows={group.rows}
                      now={now}
                      waitingConfig={waitingConfig}
                      disabled={Boolean(updatingItemId) || Boolean(updatingOrderId)}
                      onOpenItem={() => openTodoItem(group.key)}
                      onOpenLine={(item) => openTodoItem(group.key, item.id)}
                    />
                  )) : groups.map((order) => (
                    <OrderGroup
                      key={`${column.id}-${order.id}`}
                      order={order}
                      status={column.id}
                      now={now}
                      waitingConfig={waitingConfig}
                      updatingItemId={updatingItemId}
                      updatingOrderId={updatingOrderId}
                      onItemPress={(item) => openItemAction(item)}
                      onTodoItemLongPress={openTodoBulkMove}
                      queueMoreQuantityForItem={queueMoreQuantityForItem}
                      onShowDetails={(order) => openOrderDetails(order)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })}
      </View>

      {/* Item view popup: lists the orders of one item. Ticked orders move to In Progress. */}
      <TodoItemSheet
        visible={Boolean(activeTodoItem)}
        name={activeTodoItem?.name ?? ''}
        code={activeTodoItem?.rows[0]?.itemCode ?? ''}
        rows={activeTodoItem?.rows ?? []}
        selectedIds={selectedTodoLineIds}
        now={now}
        busy={isBulkTodoMoving || Boolean(updatingItemId) || Boolean(updatingOrderId)}
        isMoving={isBulkTodoMoving}
        onClose={closeTodoItem}
        onToggleLine={toggleTodoLine}
        onToggleAll={toggleTodoGroupAll}
        onMove={(lines) => void sendTodoLinesToInProgress(lines)}
      />

      {/* Hold a To-Do item to select matching items across all To-Do orders. */}
      <Modal
        transparent
        animationType="slide"
        visible={Boolean(bulkTodoItemKey)}
        onRequestClose={() => closeTodoBulkMove()}
      >
        <View style={styles.bulkTodoOverlay}>
          <View style={styles.bulkTodoSheet}>
            <View style={styles.bulkTodoHeader}>
              <View style={styles.bulkTodoHeaderCopy}>
                <Text style={styles.bulkTodoEyebrow}>TO-DO BULK MOVE</Text>
                <Text style={styles.bulkTodoTitle} numberOfLines={2}>{bulkTodoItemName}</Text>
                <Text style={styles.bulkTodoHint}>Select matching orders, then move them directly to In Progress.</Text>
              </View>
              <TouchableOpacity
                style={styles.closeDetails}
                onPress={() => closeTodoBulkMove()}
                disabled={isBulkTodoMoving}
                accessibilityLabel="Close matching To Do orders"
              >
                <Ionicons name="close" size={iconSize(21)} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.bulkSelectAllButton}
              onPress={toggleBulkTodoAll}
              disabled={isBulkTodoMoving || bulkTodoItems.length === 0}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: bulkTodoAllSelected }}
              accessibilityLabel={bulkTodoAllSelected ? 'Clear all matching To Do orders' : 'Select all matching To Do orders'}
            >
              <Ionicons name={bulkTodoAllSelected ? 'checkbox' : 'square-outline'} size={iconSize(19)} color={COLORS.blue} />
              <Text style={styles.bulkSelectAllText}>{bulkTodoAllSelected ? 'Clear all' : 'Select all'} ({bulkTodoItems.length})</Text>
            </TouchableOpacity>

            <ScrollView style={styles.bulkTodoList} contentContainerStyle={styles.bulkTodoListContent} showsVerticalScrollIndicator={false}>
              {bulkTodoItems.map((item) => {
                const checked = bulkSelectedTodoIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.bulkTodoRow, checked && styles.bulkTodoRowSelected]}
                    onPress={() => toggleBulkTodoItem(item.id)}
                    disabled={isBulkTodoMoving}
                    activeOpacity={0.76}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`Order ${item.orderNo}, table ${item.tableNo || 'not assigned'}, quantity ${item.quantity}`}
                  >
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={iconSize(23)} color={checked ? COLORS.blue : COLORS.textMuted} />
                    <View style={styles.bulkTodoOrderCopy}>
                      <View style={styles.bulkTodoOrderTopLine}>
                        <Text style={styles.bulkTodoOrderNo}>ORDER {item.orderNo}</Text>
                        <Text style={styles.bulkTodoTable}>TABLE {item.tableNo || '—'}</Text>
                      </View>
                      <Text style={styles.bulkTodoQuantity}>Quantity: {item.quantity}</Text>
                      <Text style={styles.bulkTodoRemark} numberOfLines={2}>Note: {item.remarks || 'No remark'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.bulkMoveButton, (bulkSelectedTodoIds.length === 0 || isBulkTodoMoving) && styles.modalActionDisabled]}
              onPress={() => void moveBulkTodoItemsToInProgress()}
              disabled={bulkSelectedTodoIds.length === 0 || isBulkTodoMoving}
              accessibilityRole="button"
              accessibilityLabel="Move selected matching To Do items to In Progress"
            >
              {isBulkTodoMoving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="play-forward" size={iconSize(18)} color={COLORS.white} />}
              <Text style={styles.bulkMoveButtonText}>Move {bulkSelectedTodoIds.length} to In Progress</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                <Ionicons name="close" size={iconSize(21)} color={COLORS.navy} />
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
                <Ionicons name={allModalItemsSelected ? 'checkbox' : 'square-outline'} size={iconSize(16)} color={COLORS.blue} />
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
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={iconSize(22)} color={checked ? COLORS.blue : OperationalColors.muted} />
                    <View style={styles.detailsQty}><Text style={styles.detailsQtyText}>{item.quantity}×</Text></View>
                    <View style={styles.detailsItemCopy}>
                      <Text style={styles.detailsItemName}>{item.itemName}</Text>
                      <Text style={styles.detailsItemCode}>{item.itemCode}  ·  {typeLabel(item.type)}  ·  Prep {item.prepDuration || 0} min</Text>
                      {item.remarks ? (
                        <View style={styles.detailsRemarkBanner}>
                          <Ionicons name="chatbox-ellipses-outline" size={iconSize(14)} color="#8A541F" />
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
                {isSelectionUpdating ? <ActivityIndicator size="small" color={COLORS.navy} /> : <Ionicons name="arrow-undo-outline" size={iconSize(17)} color={COLORS.navy} />}
                <Text style={styles.revertButtonText}>{revertButtonText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.nextButton, (!canMoveNext || isSelectionUpdating) && styles.modalActionDisabled]}
                onPress={() => void moveSelectedItems('next')}
                disabled={!canMoveNext || isSelectionUpdating}
                accessibilityRole="button"
                accessibilityLabel="Move selected items to their next kitchen stage"
              >
                {isSelectionUpdating ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward-outline" size={iconSize(17)} color={COLORS.white} />}
                <Text style={styles.nextButtonText}>{nextButtonText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </KdsUiContext.Provider>
  );
}

/** Kitchen Display System: permanently bound to Kitchen/KOT data. */
export default function KDSHomeScreen() {
  return <KdsDisplayScreen stationType="K" />;
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { minHeight: 112, paddingHorizontal: 14, paddingBottom: 17, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 7 },
  headerEyebrow: { color: OperationalColors.border, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  headerTitle: { color: COLORS.white, fontSize: 22, fontWeight: '900', marginTop: 3 },
  headerSub: { color: 'rgba(248,247,245,0.68)', fontSize: 10, lineHeight: 15, marginTop: 3 },
  dashboardButton: { width: 40, height: 40, marginRight: 7, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: 'rgba(248,247,245,0.13)', borderWidth: 1, borderColor: 'rgba(248,247,245,0.16)' },
  refreshButton: { width: 40, height: 40, marginRight: 7, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: 'rgba(248,247,245,0.13)', borderWidth: 1, borderColor: 'rgba(248,247,245,0.16)' },
  unavailableButton: { minHeight: 40, paddingHorizontal: 9, gap: 4, borderRadius: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(248,247,245,0.13)', borderWidth: 1, borderColor: 'rgba(248,247,245,0.16)' },
  unavailableButtonText: { color: COLORS.white, fontSize: 9, fontWeight: '900' },
  queueFilter: { paddingHorizontal: 11, paddingVertical: 8, gap: 8, zIndex: 20, elevation: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchRow: { width: '100%', position: 'relative', zIndex: 30 },
  searchControls: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  searchBoxFlex: { flex: 1, minWidth: 0 },
  todoViewToggle: { minHeight: 40, paddingHorizontal: 9, gap: 4, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: OperationalColors.surfaceAlt, borderWidth: 1.5, borderColor: OperationalColors.primary },
  todoViewToggleActive: { backgroundColor: OperationalColors.primary },
  todoViewToggleText: { color: OperationalColors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  todoViewToggleTextActive: { color: OperationalColors.onPrimary },
  todoGroupHeader: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: OperationalColors.surface, borderBottomWidth: 1, borderBottomColor: OperationalColors.border },
  todoGroupCopy: { flex: 1, minWidth: 0 },
  todoGroupName: { color: OperationalColors.primary, fontSize: 11, lineHeight: 14, fontWeight: '900' },
  todoGroupMeta: { color: OperationalColors.muted, fontSize: 8, fontWeight: '800', marginTop: 2, letterSpacing: 0.3 },
  todoGroupTotal: { minWidth: 36, height: 26, paddingHorizontal: 6, borderRadius: 8, backgroundColor: '#E9963C', justifyContent: 'center', alignItems: 'center' },
  todoGroupTotalText: { color: OperationalColors.onPrimary, fontSize: 11, fontWeight: '900' },
  todoLineRow: { minHeight: 52, paddingHorizontal: 7, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: OperationalColors.canvas, borderBottomWidth: 1, borderBottomColor: OperationalColors.onPrimary },
  todoLineMeta: { color: OperationalColors.muted, fontSize: 8, fontWeight: '700', marginTop: 2 },
  searchBox: { minHeight: 40, paddingLeft: 10, paddingRight: 5, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, backgroundColor: OperationalColors.surface, borderWidth: 1, borderColor: OperationalColors.border },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: COLORS.text, fontSize: 12, fontWeight: '700' },
  clearSearchButton: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderRadius: 15 },
  // A tall, scrollable list deliberately has no result-count cap. Every
  // matching To-Do line remains available by scrolling down this dropdown.
  searchDropdown: { position: 'absolute', top: 46, left: 0, right: 0, zIndex: 40, overflow: 'hidden', borderRadius: 13, backgroundColor: COLORS.white, borderWidth: 1, borderColor: OperationalColors.border, shadowColor: OperationalColors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 24 },
  searchDropdownHeader: { minHeight: 47, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: OperationalColors.border, backgroundColor: OperationalColors.surface },
  searchDropdownTitle: { color: COLORS.navy, fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  searchDropdownHint: { color: COLORS.textMuted, fontSize: 8, fontWeight: '700', marginTop: 2 },
  searchResultCount: { minWidth: 25, height: 25, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: COLORS.blue },
  searchResultCountText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  searchDropdownList: { flex: 1, minHeight: 0 },
  searchDropdownContent: { padding: 7, gap: 6 },
  searchNoResults: { minHeight: 94, padding: 12, alignItems: 'center', justifyContent: 'center' },
  searchNoResultsText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  // The removed station-lock strip gives this summary room for legible counts.
  summaryHeader: { marginHorizontal: 8, marginTop: 8, marginBottom: 7, paddingVertical: 9, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  summaryDivider: { width: 1, height: 52, backgroundColor: COLORS.border },
  severitySummary: { flex: 1, minWidth: 0 },
  severitySummaryTitle: { color: COLORS.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.45 },
  severityPills: { marginTop: 5, flexDirection: 'row', gap: 4 },
  severityPill: { flex: 1, minWidth: 0, minHeight: 42, paddingHorizontal: 3, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  severityPillNormal: { backgroundColor: OperationalColors.muted },
  severityPillAmber: { backgroundColor: '#E8A93F' },
  severityPillRed: { backgroundColor: COLORS.danger },
  severityPillLabel: { color: COLORS.white, fontSize: 6, fontWeight: '900', letterSpacing: 0.2 },
  severityPillCount: { color: COLORS.white, fontSize: 17, lineHeight: 20, fontWeight: '900', marginTop: 1 },
  board: { flex: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 7, paddingBottom: 7 },
  column: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: OperationalColors.canvas },
  columnHeader: { minHeight: 49, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  columnIcon: { width: 27, height: 27, justifyContent: 'center', alignItems: 'center', borderRadius: 9, marginRight: 5 },
  columnTitle: { flex: 1, fontSize: 10, fontWeight: '900', letterSpacing: 0.15 },
  columnCount: { minWidth: 21, height: 21, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  columnCountText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  columnScroll: { flex: 1 },
  columnContent: { padding: 5, gap: 7, paddingBottom: 20 },
  loadingColumn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyColumn: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 4 },
  emptyColumnText: { color: OperationalColors.muted, fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  searchResultRow: { padding: 9, gap: 7, borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: OperationalColors.border, shadowColor: OperationalColors.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
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
  searchResultQuantity: { minWidth: 38, paddingVertical: 4, alignItems: 'center', borderRadius: 7, backgroundColor: OperationalColors.surfaceAlt },
  searchResultQuantityText: { color: COLORS.blue, fontSize: 14, fontWeight: '900', marginTop: 1 },
  searchResultNote: { minHeight: 26, paddingHorizontal: 6, paddingVertical: 5, flexDirection: 'row', alignItems: 'flex-start', gap: 4, borderRadius: 6, backgroundColor: '#FFF0CF', borderLeftWidth: 3, borderLeftColor: '#E39A2D' },
  searchResultNoteText: { flex: 1, color: '#7A4615', fontSize: 9, lineHeight: 12, fontWeight: '800' },
  searchQuickAction: { minHeight: 28, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: 7, backgroundColor: COLORS.blue },
  searchQuickActionText: { color: COLORS.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.2 },
  orderCard: { borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: OperationalColors.border, shadowColor: OperationalColors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  orderCardAmber: { borderColor: '#E4A13A', backgroundColor: '#FFF8E7' },
  orderCardRed: { borderColor: '#D85A52', backgroundColor: '#FFF2F1' },
  orderHeader: { minHeight: 51, paddingVertical: 7, paddingLeft: 8, paddingRight: 5, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: OperationalColors.surfaceAlt },
  orderCopy: { flex: 1, minWidth: 0 },
  orderNo: { color: COLORS.navy, fontSize: 11, fontWeight: '900' },
  stewardName: { color: COLORS.textMuted, fontSize: 8, fontWeight: '800', marginTop: 2 },
  tapDetails: { color: COLORS.blue, fontSize: 7, fontWeight: '800', marginTop: 2 },
  tableBadge: { minWidth: 44, minHeight: 42, marginLeft: 5, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: COLORS.blueSoft },
  tableBadgeUpdating: { opacity: 0.62 },
  tableLabel: { color: COLORS.textMuted, fontSize: 6, fontWeight: '900', letterSpacing: 0.25 },
  tableNumber: { maxWidth: 55, color: COLORS.navy, fontSize: 15, fontWeight: '900', marginTop: 1 },
  orderMeta: { paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  orderMetaText: { color: COLORS.textMuted, fontSize: 8, fontWeight: '600' },
  orderDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: OperationalColors.muted, marginHorizontal: 2 },
  itemsList: { borderTopWidth: 1, borderTopColor: OperationalColors.surfaceAlt },
  itemRow: { minHeight: 55, paddingHorizontal: 7, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: OperationalColors.onPrimary },
  itemRowAmber: { backgroundColor: '#FFF4D9' },
  itemRowRed: { backgroundColor: '#FFE8E6' },
  itemRowUpdating: { opacity: 0.58 },
  qtyPill: { minWidth: 27, height: 27, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: OperationalColors.surfaceAlt },
  qtyText: { color: COLORS.blue, fontSize: 11, fontWeight: '900' },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: { color: COLORS.text, fontSize: 10, lineHeight: 13, fontWeight: '800' },
  itemRemark: { color: '#A26B32', fontSize: 8, lineHeight: 11, fontWeight: '600', marginTop: 2 },
  queueAggregateBadge: { alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, backgroundColor: OperationalColors.surfaceAlt, borderWidth: 1, borderColor: OperationalColors.border },
  queueAggregateText: { color: COLORS.blue, fontSize: 8, fontWeight: '900' },
  bulkTodoOverlay: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  bulkTodoSheet: { width: '100%', maxWidth: 650, maxHeight: '86%', padding: 16, borderRadius: 22, backgroundColor: COLORS.white, shadowColor: OperationalColors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.24, shadowRadius: 18, elevation: 10 },
  bulkTodoHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  bulkTodoHeaderCopy: { flex: 1, minWidth: 0 },
  bulkTodoEyebrow: { color: COLORS.blue, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  bulkTodoTitle: { color: COLORS.navy, fontSize: 21, fontWeight: '900', marginTop: 2 },
  bulkTodoHint: { color: COLORS.textMuted, fontSize: 10, lineHeight: 14, marginTop: 4, paddingRight: 8 },
  bulkSelectAllButton: { alignSelf: 'flex-start', minHeight: 33, marginTop: 11, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, backgroundColor: COLORS.blueSoft },
  bulkSelectAllText: { color: COLORS.blue, fontSize: 10, fontWeight: '900' },
  bulkTodoList: { marginTop: 10, flexGrow: 0 },
  bulkTodoListContent: { gap: 7, paddingBottom: 8 },
  bulkTodoRow: { minHeight: 70, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: OperationalColors.border, borderRadius: 12, backgroundColor: OperationalColors.canvas },
  bulkTodoRowSelected: { borderColor: COLORS.blue, backgroundColor: OperationalColors.surfaceAlt },
  bulkTodoOrderCopy: { flex: 1, minWidth: 0 },
  bulkTodoOrderTopLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bulkTodoOrderNo: { flex: 1, color: COLORS.navy, fontSize: 12, fontWeight: '900' },
  bulkTodoTable: { color: COLORS.blue, fontSize: 11, fontWeight: '900' },
  bulkTodoQuantity: { color: COLORS.text, fontSize: 10, fontWeight: '800', marginTop: 3 },
  bulkTodoRemark: { color: COLORS.textMuted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  bulkMoveButton: { minHeight: 44, marginTop: 7, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: COLORS.blue },
  bulkMoveButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '900' },
  detailsOverlay: { flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  detailsSheet: { width: '100%', maxWidth: 680, maxHeight: '88%', padding: 18, borderRadius: 24, backgroundColor: COLORS.white, shadowColor: OperationalColors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.24, shadowRadius: 18, elevation: 10 },
  detailsHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  detailsHeaderCopy: { flex: 1, minWidth: 0 },
  detailsEyebrow: { color: COLORS.blue, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  detailsIdentityRow: { marginTop: 5, flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  detailsIdentityBlock: { flex: 1, minWidth: 0, paddingVertical: 6 },
  detailsIdentityLabel: { color: COLORS.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  detailsTitle: { color: COLORS.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
  detailsTableHero: { minWidth: 98, paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center', borderRadius: 11, backgroundColor: COLORS.blueSoft, borderWidth: 1, borderColor: OperationalColors.header },
  detailsTableNumber: { color: COLORS.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
  detailsSubtitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  closeDetails: { width: 36, height: 36, marginLeft: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: OperationalColors.canvas },
  detailsOrderFacts: { marginTop: 13, padding: 10, flexDirection: 'row', gap: 7, borderRadius: 12, backgroundColor: OperationalColors.surface },
  detailsFact: { flex: 1, minWidth: 0 },
  detailsFactLabel: { color: COLORS.textMuted, fontSize: 7, fontWeight: '900', letterSpacing: 0.3 },
  detailsFactValue: { color: COLORS.navy, fontSize: 10, fontWeight: '900', marginTop: 3 },
  selectionToolbar: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectionCount: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  selectAllButton: { minHeight: 30, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, backgroundColor: COLORS.blueSoft },
  selectAllText: { color: COLORS.blue, fontSize: 10, fontWeight: '900' },
  detailsHint: { color: COLORS.textMuted, fontSize: 10, lineHeight: 14, marginTop: 8, marginBottom: 8 },
  detailsList: { gap: 8, paddingBottom: 12 },
  detailsItem: { minHeight: 72, padding: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: OperationalColors.border, borderRadius: 13, backgroundColor: OperationalColors.canvas },
  detailsItemSelected: { borderColor: OperationalColors.border, backgroundColor: OperationalColors.surfaceAlt },
  detailsQty: { width: 38, height: 38, marginLeft: 8, marginRight: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 11, backgroundColor: OperationalColors.surfaceAlt },
  detailsQtyText: { color: COLORS.blue, fontSize: 13, fontWeight: '900' },
  detailsItemCopy: { flex: 1, minWidth: 0, paddingRight: 5 },
  detailsItemName: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  detailsItemCode: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  detailsRemarkBanner: { marginTop: 6, paddingHorizontal: 6, paddingVertical: 5, flexDirection: 'row', alignItems: 'flex-start', gap: 4, borderRadius: 6, backgroundColor: '#FFF0CF', borderLeftWidth: 3, borderLeftColor: '#E39A2D' },
  detailsRemarkText: { flex: 1, color: '#7A4615', fontSize: 10, lineHeight: 13, fontWeight: '900' },
  detailsNoRemark: { color: OperationalColors.muted, fontSize: 10, marginTop: 4 },
  detailsStatus: { maxWidth: 70, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 7 },
  detailsStatusText: { fontSize: 8, fontWeight: '900', textAlign: 'center' },
  modalActions: { paddingTop: 11, flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: OperationalColors.onPrimary },
  modalActionButton: { minHeight: 42, flex: 1, paddingHorizontal: 7, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, borderRadius: 11 },
  revertButton: { backgroundColor: '#FCECCF', borderWidth: 1, borderColor: '#F1CE93' },
  nextButton: { backgroundColor: COLORS.blue },
  modalActionDisabled: { opacity: 0.45 },
  revertButtonText: { color: COLORS.navy, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  nextButtonText: { color: COLORS.white, fontSize: 10, fontWeight: '900', textAlign: 'center' },
});

const responsiveMetricKeys = new Set([
  'fontSize', 'lineHeight', 'letterSpacing',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'gap', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'top', 'bottom', 'left', 'right', 'borderRadius', 'shadowRadius',
]);

const responsiveStyleCache = new Map<number, any>();

/** Builds scaled KDS/BDS styles without changing board behaviour or data flow. */
function createResponsiveKdsStyles(scale: number) {
  const cacheKey = Number(scale.toFixed(2));
  const cached = responsiveStyleCache.get(cacheKey);
  if (cached) return cached;
  if (cacheKey === 1) {
    responsiveStyleCache.set(cacheKey, baseStyles);
    return baseStyles;
  }

  const scaled: Record<string, Record<string, unknown>> = {};
  Object.entries(baseStyles).forEach(([styleName, registeredStyle]) => {
    const source = StyleSheet.flatten(registeredStyle) as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    Object.entries(source).forEach(([property, value]) => {
      next[property] = responsiveMetricKeys.has(property) && typeof value === 'number'
        ? Math.round(value * cacheKey * 100) / 100
        : value;
    });
    scaled[styleName] = next;
  });

  const responsive = StyleSheet.create(scaled);
  responsiveStyleCache.set(cacheKey, responsive);
  return responsive;
}
