import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
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
import { AppNotification, useNotificationStore } from '../../services/notificationStore';

type NotificationTab = 'operational' | 'items';

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
            <Text style={styles.cardMessage} numberOfLines={2}>{notification.message}</Text>
            <View style={styles.metaRow}>
              {notification.invoiceNo ? <Text style={styles.invoicePill}>Invoice {notification.invoiceNo}</Text> : null}
              <Text style={styles.time}>{relativeTime(notification.createdAt)}</Text>
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
  const visibleNotifications = activeTab === 'operational' ? operationalNotifications : itemNotifications;

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
            <Text style={[styles.tabCountText, activeTab === 'items' && styles.activeTabCountText]}>{itemNotifications.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {visibleNotifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name={activeTab === 'items' ? 'restaurant-outline' : 'notifications-outline'} size={38} color="#075EA7" />
          </View>
          <Text style={styles.emptyTitle}>No {activeTab === 'items' ? 'item' : 'operational'} notifications</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'items'
              ? 'Item-level kitchen updates will appear here.'
              : 'Operational updates will appear here.'}
          </Text>
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
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  invoicePill: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  time: { color: '#94A3B8', fontSize: 11 },
  tableBadge: { width: 58, minHeight: 63, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: '#E6F2FA' },
  tableBadgeLabel: { color: '#64748B', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  tableBadgeValue: { color: '#002748', fontSize: 22, fontWeight: '900', marginTop: 2 },
  emptyWrap: { flex: 1, paddingHorizontal: 42, justifyContent: 'center', alignItems: 'center' },
  emptyIconWrap: { width: 84, height: 84, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E6F2FA' },
  emptyTitle: { color: '#002748', fontSize: 18, fontWeight: '800', marginTop: 19, textAlign: 'center' },
  emptyText: { color: '#64748B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  swipeHint: { position: 'absolute', bottom: 29, left: 16, color: '#94A3B8', fontSize: 10 },
  clearButton: { position: 'absolute', right: 18, bottom: 20, minHeight: 42, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, backgroundColor: '#FFFFFF', shadowColor: '#002748', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  clearText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
});
