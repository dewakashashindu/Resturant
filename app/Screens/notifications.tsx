import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import { AppNotification, useNotificationStore } from '../../services/notificationStore';

type NotificationTab = 'operational' | 'items';

type CurrentUnavailableItem = {
  itemId: string;
  itemName: string;
};

const relativeTime = (isoDate: string) => {
  const difference = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const minutes = Math.floor(difference / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const tabForNotification = (notification: AppNotification): NotificationTab => {
  const rawType = String(notification.notificationType ?? '').trim().toUpperCase();
  // Database convention: OP = Operational notifications, IT = Item notifications.
  if (rawType === 'IT' || rawType === 'ITEM' || rawType === 'KITCHEN-ITEM-READY') return 'items';
  if (notification.kind === 'kitchen-item-ready') return 'items';
  return 'operational';
};

const notificationIcon = (notification: AppNotification): keyof typeof Ionicons.glyphMap => {
  if (tabForNotification(notification) === 'items') return 'restaurant';
  if (notification.kind === 'kitchen-order-ready') return 'checkmark-circle';
  return 'notifications';
};

const kdsStatusItemsFor = (notification: AppNotification) => {
  if (notification.payload?.kind !== 'kds-status-update' || !Array.isArray(notification.payload.items)) return [];
  return notification.payload.items
    .map((item) => ({
      itemId: String(item?.itemId ?? '').trim(),
      itemName: String(item?.itemName ?? '').trim(),
      quantity: Number(item?.quantity ?? 0) || 0,
      remarks: String(item?.remarks ?? '').trim(),
      type: String(item?.type ?? '').trim(),
    }))
    .filter((item) => item.itemId && item.itemName);
};

const formatCreatedAt = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return relativeTime(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} · ${hour}:${minute}`;
};

function SwipeableNotificationRow({
  notification,
  onOpen,
  onClear,
}: {
  notification: AppNotification;
  onOpen: () => void;
  onClear: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const didClear = useRef(false);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      gesture.dx < -8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => {
      translateX.setValue(Math.min(0, gesture.dx));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -92) {
        didClear.current = true;
        Animated.timing(translateX, { toValue: -420, duration: 180, useNativeDriver: true }).start(onClear);
        return;
      }
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    },
  }), [onClear, translateX]);

  const tableValue = String(notification.tableNo ?? '').replace(/^table\s*/i, '').trim();
  const unavailableUpdate = notification.payload?.kind === 'kds-item-unavailable';
  const statusItems = kdsStatusItemsFor(notification);
  const processingUpdate = String(notification.payload?.status ?? '').trim().toUpperCase() === 'P';

  return (
    <View style={styles.swipeShell}>
      <View style={styles.clearUnderlay}>
        <Ionicons name="trash-outline" size={21} color="#FFFFFF" />
        <Text style={styles.clearUnderlayText}>Clear</Text>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.cardMotion, { transform: [{ translateX }] }]}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          style={[styles.card, !notification.read && styles.unreadCard]}
          onPress={() => { if (!didClear.current) onOpen(); }}
        >
          <View style={[styles.cardIcon, tabForNotification(notification) === 'items' && styles.itemIcon]}>
            <Ionicons name={notificationIcon(notification)} size={21} color="#FFFFFF" />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardTopLine}>
              <Text style={styles.cardTitle} numberOfLines={1}>{notification.title}</Text>
              {!notification.read ? <View style={styles.unreadDot} /> : null}
            </View>
            {unavailableUpdate ? (
              <View style={styles.unavailableNotice}>
                <View style={styles.unavailableLabel}>
                  <Ionicons name="alert-circle" size={13} color="#FFFFFF" />
                  <Text style={styles.unavailableLabelText}>UNAVAILABLE LIST UPDATED</Text>
                </View>
                <Text style={styles.unavailableLead}>{notification.message}</Text>
              </View>
            ) : statusItems.length > 0 ? (
              <View style={[styles.kdsStatusNotice, processingUpdate ? styles.processingNotice : styles.doneNotice]}>
                <View style={[styles.kdsStatusLabel, processingUpdate ? styles.processingLabel : styles.doneLabel]}>
                  <Ionicons name={processingUpdate ? 'flame' : 'checkmark-circle'} size={13} color="#FFFFFF" />
                  <Text style={styles.kdsStatusLabelText}>{processingUpdate ? 'PROCESSING' : 'DONE'}</Text>
                </View>
                <Text style={styles.kdsStatusLead}>{processingUpdate ? 'Kitchen has started this item:' : 'Kitchen has completed this item:'}</Text>
                {statusItems.map((item) => (
                  <View key={`${notification.id}-${item.itemId}`} style={styles.kdsStatusItem}>
                    <View style={styles.kdsQtyPill}><Text style={styles.kdsQtyText}>{item.quantity || 1}×</Text></View>
                    <View style={styles.kdsStatusItemCopy}>
                      <Text style={styles.kdsStatusItemName}>{item.itemName}</Text>
                      <Text style={styles.kdsStatusItemCode}>{item.itemId}{item.type ? `  ·  ${item.type}` : ''}</Text>
                      {item.remarks ? <Text style={styles.kdsStatusItemRemark}>{item.remarks}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.cardMessage} numberOfLines={2}>{notification.message}</Text>
            )}
            <View style={styles.metaRow}>
              {notification.invoiceNo ? <Text style={styles.invoicePill}>Invoice {notification.invoiceNo}</Text> : null}
              <Text style={styles.time}>{unavailableUpdate || statusItems.length > 0 ? `Created ${formatCreatedAt(notification.createdAt)}` : relativeTime(notification.createdAt)}</Text>
            </View>
          </View>
          {tableValue ? (
            <View style={styles.tableBadge}>
              <Text style={styles.tableBadgeLabel}>TABLE</Text>
              <Text style={styles.tableBadgeValue} numberOfLines={1}>{tableValue}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isSmall = height < 680;
  const [activeTab, setActiveTab] = useState<NotificationTab>('operational');
  const [currentUnavailableItems, setCurrentUnavailableItems] = useState<CurrentUnavailableItem[]>([]);
  const [loadingUnavailableItems, setLoadingUnavailableItems] = useState(false);

  // Identical responsive positioning rules to Mode Selection.
  const backBtnTop = Platform.OS === 'android'
    ? (isTablet ? 44 : isSmall ? 36 : 44)
    : (isTablet ? 10 : isSmall ? 6 : 8);
  const backBtnLeft = isTablet ? 16 : isSmall ? 10 : 12;
  const backBtnPad = isTablet ? 12 : isSmall ? 6 : 8;
  const backIconSize = isTablet ? 56 : isSmall ? 38 : 44;

  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const clearAll = useNotificationStore((state) => state.clearAll);

  const loadCurrentUnavailableItems = useCallback(async () => {
    setLoadingUnavailableItems(true);
    try {
      const response = await apiClient.getKdsUnavailableItems();
      if (!response.ok || !response.data?.ok) throw new Error(response.data?.message || 'Unable to load unavailable items.');
      const parsed = (Array.isArray(response.data.items) ? response.data.items : [])
        .map((item: any) => ({
          itemId: String(item?.MenuItmId ?? item?.menuItmId ?? '').trim(),
          itemName: String(item?.MenuItmDes ?? item?.menuItmDes ?? '').trim(),
        }))
        .filter((item: CurrentUnavailableItem) => item.itemId && item.itemName);
      setCurrentUnavailableItems(parsed);
    } catch (error) {
      console.log('[Notifications] unavailable item list failed', error);
      setCurrentUnavailableItems([]);
    } finally {
      setLoadingUnavailableItems(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'items') void loadCurrentUnavailableItems();
  }, [activeTab, loadCurrentUnavailableItems]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );
  const operationalNotifications = useMemo(
    () => notifications.filter((notification) => tabForNotification(notification) === 'operational'),
    [notifications],
  );
  const itemNotifications = useMemo(
    () => notifications.filter((notification) => tabForNotification(notification) === 'items'),
    [notifications],
  );
  // Item tab is a dashboard: only the newest update message remains at the
  // top, while the live unavailable-item state is listed separately below.
  const latestItemNotification = itemNotifications[0] ?? null;
  const visibleNotifications = activeTab === 'operational'
    ? operationalNotifications
    : (latestItemNotification ? [latestItemNotification] : []);

  useEffect(() => {
    if (activeTab === 'items' && latestItemNotification?.id) void loadCurrentUnavailableItems();
  }, [activeTab, latestItemNotification?.id, loadCurrentUnavailableItems]);

  const handleClearAll = () => {
    Alert.alert('Clear all notifications?', 'This removes notification history from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearAll },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor="#F3F3F3" barStyle="dark-content" />

      <TouchableOpacity
        style={[styles.backButtonAbsolute, { top: backBtnTop, left: backBtnLeft, padding: backBtnPad }]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Image
          source={require('../../assets/icons/blackback.png')}
          style={{ width: backIconSize, height: backIconSize }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>
          {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
        </Text>
      </View>

      <View style={styles.tabsWrap}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'operational' && styles.activeTabButton]}
          onPress={() => setActiveTab('operational')}
        >
          <Ionicons name="notifications-outline" size={17} color={activeTab === 'operational' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'operational' && styles.activeTabText]}>Operational</Text>
          <View style={[styles.tabCount, activeTab === 'operational' && styles.activeTabCount]}>
            <Text style={[styles.tabCountText, activeTab === 'operational' && styles.activeTabCountText]}>{operationalNotifications.length}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'items' && styles.activeTabButton]}
          onPress={() => setActiveTab('items')}
        >
          <Ionicons name="restaurant-outline" size={17} color={activeTab === 'items' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'items' && styles.activeTabText]}>Item</Text>
          <View style={[styles.tabCount, activeTab === 'items' && styles.activeTabCount]}>
            <Text style={[styles.tabCountText, activeTab === 'items' && styles.activeTabCountText]}>{latestItemNotification ? 1 : 0}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === 'items' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 18) + 24 }]}
        >
          <View style={styles.itemTabSectionHeader}>
            <Text style={styles.itemTabSectionTitle}>Latest notification</Text>
            <Text style={styles.itemTabSectionText}>The newest unavailable-item update appears here.</Text>
          </View>
          {latestItemNotification ? (
            <SwipeableNotificationRow
              key={latestItemNotification.id}
              notification={latestItemNotification}
              onOpen={() => markAsRead(latestItemNotification.id)}
              onClear={() => removeNotification(latestItemNotification.id)}
            />
          ) : (
            <View style={styles.noLatestMessage}>
              <Ionicons name="notifications-outline" size={19} color="#94A3B8" />
              <Text style={styles.noLatestMessageText}>No new unavailable-item message.</Text>
            </View>
          )}

          <View style={styles.currentUnavailableHeader}>
            <View style={styles.currentUnavailableHeaderIcon}><Ionicons name="alert-circle-outline" size={20} color="#D85A52" /></View>
            <View style={styles.currentUnavailableHeaderCopy}>
              <Text style={styles.currentUnavailableTitle}>Current unavailable items</Text>
              <Text style={styles.currentUnavailableText}>This is the live list from the menu availability status.</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshUnavailableButton}
              onPress={() => void loadCurrentUnavailableItems()}
              disabled={loadingUnavailableItems}
              accessibilityLabel="Refresh unavailable item list"
            >
              {loadingUnavailableItems ? <ActivityIndicator size="small" color="#075EA7" /> : <Ionicons name="refresh" size={18} color="#075EA7" />}
            </TouchableOpacity>
          </View>
          {loadingUnavailableItems && currentUnavailableItems.length === 0 ? (
            <ActivityIndicator style={styles.unavailableLoader} color="#075EA7" />
          ) : currentUnavailableItems.length === 0 ? (
            <View style={styles.currentUnavailableEmpty}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#2B9662" />
              <Text style={styles.currentUnavailableEmptyText}>All menu items are currently available.</Text>
            </View>
          ) : (
            <View style={styles.currentUnavailableList}>
              {currentUnavailableItems.map((item) => (
                <View key={item.itemId} style={styles.currentUnavailableRow}>
                  <View style={styles.currentUnavailableDot} />
                  <View style={styles.currentUnavailableItemCopy}>
                    <Text style={styles.currentUnavailableItemName}>{item.itemName}</Text>
                    <Text style={styles.currentUnavailableItemCode}>{item.itemId}</Text>
                  </View>
                  <Text style={styles.currentUnavailableStatus}>UNAVAILABLE</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : visibleNotifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-outline" size={38} color="#075EA7" />
          </View>
          <Text style={styles.emptyTitle}>No operational notifications</Text>
          <Text style={styles.emptyText}>Kitchen processing and completion updates will appear here.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 18) + 72 }]}
          >
            {visibleNotifications.map((notification) => (
              <SwipeableNotificationRow
                key={notification.id}
                notification={notification}
                onOpen={() => markAsRead(notification.id)}
                onClear={() => removeNotification(notification.id)}
              />
            ))}
          </ScrollView>
          <Text style={styles.swipeHint}>Swipe a notification left to clear it</Text>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll} accessibilityRole="button">
            <Ionicons name="trash-outline" size={17} color="#64748B" />
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F3F3' },
  backButtonAbsolute: { position: 'absolute', zIndex: 10 },
  header: { paddingTop: 70, paddingBottom: 14, paddingHorizontal: 72, alignItems: 'center' },
  headerTitle: { color: '#000000', fontSize: 25, fontWeight: '600' },
  headerSubtitle: { color: '#64748B', fontSize: 12, marginTop: 5 },
  tabsWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  tabButton: { flex: 1, minHeight: 42, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  activeTabButton: { backgroundColor: '#002748' },
  tabText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  activeTabText: { color: '#FFFFFF' },
  tabCount: { minWidth: 18, height: 18, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: '#E2E8F0' },
  activeTabCount: { backgroundColor: 'rgba(255,255,255,0.20)' },
  tabCountText: { color: '#475569', fontSize: 10, fontWeight: '800' },
  activeTabCountText: { color: '#FFFFFF' },
  list: { paddingHorizontal: 16, paddingTop: 2, gap: 11 },
  swipeShell: { minHeight: 96, overflow: 'hidden', borderRadius: 17 },
  clearUnderlay: { ...StyleSheet.absoluteFillObject, paddingRight: 20, flexDirection: 'row', gap: 5, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#DC2626' },
  clearUnderlayText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  cardMotion: { width: '100%' },
  card: { minHeight: 96, padding: 13, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#E4EBF0', borderRadius: 17, backgroundColor: '#FFFFFF' },
  unreadCard: { borderColor: 'rgba(7,94,167,0.30)', backgroundColor: '#F8FCFF' },
  cardIcon: { width: 42, height: 42, marginRight: 11, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: '#075EA7' },
  itemIcon: { backgroundColor: '#15803D' },
  cardContent: { flex: 1, minWidth: 0, paddingRight: 8 },
  cardTopLine: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { flex: 1, color: '#002748', fontSize: 14, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, marginLeft: 7, borderRadius: 4, backgroundColor: '#075EA7' },
  cardMessage: { color: '#526270', fontSize: 12, lineHeight: 18, marginTop: 3 },
  unavailableNotice: { marginTop: 7, padding: 8, borderRadius: 10, backgroundColor: '#FFF3F1', borderWidth: 1, borderColor: '#F3CDC8' },
  unavailableLabel: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, backgroundColor: '#D85A52' },
  unavailableLabelText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  unavailableLead: { color: '#8E443D', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 6 },
  kdsStatusNotice: { marginTop: 7, padding: 8, borderRadius: 10, borderWidth: 1 },
  processingNotice: { backgroundColor: '#EFF7FD', borderColor: '#C7E2F7' },
  doneNotice: { backgroundColor: '#EDF9F1', borderColor: '#C7EAD3' },
  kdsStatusLabel: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6 },
  processingLabel: { backgroundColor: '#287EC1' },
  doneLabel: { backgroundColor: '#2B9662' },
  kdsStatusLabelText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  kdsStatusLead: { color: '#3D6078', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 6 },
  kdsStatusItem: { marginTop: 7, paddingTop: 7, flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(70,125,160,0.16)' },
  kdsQtyPill: { minWidth: 28, height: 28, marginRight: 8, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#DDEEF9' },
  kdsQtyText: { color: '#0B639E', fontSize: 11, fontWeight: '900' },
  kdsStatusItemCopy: { flex: 1 },
  kdsStatusItemName: { color: '#18374D', fontSize: 12, fontWeight: '900' },
  kdsStatusItemCode: { color: '#52718A', fontSize: 9, fontWeight: '700', marginTop: 1 },
  kdsStatusItemRemark: { color: '#A26B32', fontSize: 10, fontWeight: '700', marginTop: 3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  invoicePill: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  time: { color: '#94A3B8', fontSize: 11 },
  tableBadge: { width: 58, minHeight: 63, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: '#E6F2FA' },
  tableBadgeLabel: { color: '#64748B', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  tableBadgeValue: { color: '#002748', fontSize: 22, fontWeight: '900', marginTop: 2 },
  itemTabSectionHeader: { marginTop: 2, marginBottom: 9 },
  itemTabSectionTitle: { color: '#002748', fontSize: 14, fontWeight: '900' },
  itemTabSectionText: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 2 },
  noLatestMessage: { minHeight: 55, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#E1E9EE', borderRadius: 14, backgroundColor: '#FFFFFF' },
  noLatestMessageText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  currentUnavailableHeader: { marginTop: 19, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F1D2CE', borderRadius: 15, backgroundColor: '#FFF8F7' },
  currentUnavailableHeaderIcon: { width: 36, height: 36, marginRight: 9, justifyContent: 'center', alignItems: 'center', borderRadius: 11, backgroundColor: '#FCE4E1' },
  currentUnavailableHeaderCopy: { flex: 1, minWidth: 0 },
  currentUnavailableTitle: { color: '#7F3E37', fontSize: 13, fontWeight: '900' },
  currentUnavailableText: { color: '#9A5E57', fontSize: 10, lineHeight: 14, marginTop: 2 },
  refreshUnavailableButton: { width: 35, height: 35, marginLeft: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#FFFFFF' },
  unavailableLoader: { marginTop: 20 },
  currentUnavailableEmpty: { marginTop: 9, minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#CCEBD7', borderRadius: 14, backgroundColor: '#F1FBF5' },
  currentUnavailableEmptyText: { flex: 1, color: '#27754E', fontSize: 12, fontWeight: '800' },
  currentUnavailableList: { marginTop: 9, gap: 7 },
  currentUnavailableRow: { minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F0D4D0', borderRadius: 13, backgroundColor: '#FFFFFF' },
  currentUnavailableDot: { width: 8, height: 8, marginRight: 10, borderRadius: 4, backgroundColor: '#D85A52' },
  currentUnavailableItemCopy: { flex: 1, minWidth: 0 },
  currentUnavailableItemName: { color: '#422825', fontSize: 13, fontWeight: '900' },
  currentUnavailableItemCode: { color: '#A05B54', fontSize: 10, fontWeight: '700', marginTop: 2 },
  currentUnavailableStatus: { marginLeft: 8, color: '#C84A41', fontSize: 8, fontWeight: '900', letterSpacing: 0.25 },
  emptyWrap: { flex: 1, paddingHorizontal: 42, justifyContent: 'center', alignItems: 'center' },
  emptyIconWrap: { width: 84, height: 84, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E6F2FA' },
  emptyTitle: { color: '#002748', fontSize: 18, fontWeight: '800', marginTop: 19, textAlign: 'center' },
  emptyText: { color: '#64748B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  swipeHint: { position: 'absolute', bottom: 29, left: 16, color: '#94A3B8', fontSize: 10 },
  clearButton: { position: 'absolute', right: 18, bottom: 20, minHeight: 42, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, backgroundColor: '#FFFFFF', shadowColor: '#002748', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  clearText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
});
