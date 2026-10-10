import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Alert,
  Image,
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

const relativeTime = (isoDate: string) => {
  const difference = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const minutes = Math.floor(difference / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const notificationIcon = (kind: AppNotification['kind']): keyof typeof Ionicons.glyphMap => {
  if (kind === 'kitchen-order-ready') return 'checkmark-circle';
  if (kind === 'kitchen-item-ready') return 'restaurant';
  return 'notifications';
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isSmall = height < 680;

  // Kept identical to the Mode Selection back-button positioning rules.
  const backBtnTop = Platform.OS === 'android'
    ? (isTablet ? 44 : isSmall ? 36 : 44)
    : (isTablet ? 10 : isSmall ? 6 : 8);
  const backBtnLeft = isTablet ? 16 : isSmall ? 10 : 12;
  const backBtnPad = isTablet ? 12 : isSmall ? 6 : 8;
  const backIconSize = isTablet ? 56 : isSmall ? 38 : 44;
  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const clearAll = useNotificationStore((state) => state.clearAll);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const handleClear = () => {
    Alert.alert('Clear notifications?', 'This removes all notification history from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearAll },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor="#F3F3F3" barStyle="dark-content" />

      {/* Same light, centred heading and circular back control as Mode Selection. */}
      <TouchableOpacity
        style={[
          styles.backButtonAbsolute,
          { top: backBtnTop, left: backBtnLeft, padding: backBtnPad },
        ]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Image
          source={require('../../assets/icons/blackback.png')}
          style={[styles.backIcon, { width: backIconSize, height: backIconSize }]}
          resizeMode="contain"
        />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>
          {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
        </Text>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-outline" size={38} color="#075EA7" />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            Kitchen-ready updates and other important order alerts will appear here.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 18) + 72 }]}
          >
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                activeOpacity={0.8}
                style={[styles.card, !notification.read && styles.unreadCard]}
                onPress={() => markAsRead(notification.id)}
              >
                <View style={[styles.cardIcon, notification.kind === 'kitchen-order-ready' && styles.readyIcon]}>
                  <Ionicons name={notificationIcon(notification.kind)} size={21} color="#FFFFFF" />
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.cardTopLine}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{notification.title}</Text>
                    {!notification.read ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.cardMessage}>{notification.message}</Text>
                  <View style={styles.metaRow}>
                    {notification.tableNo ? <Text style={styles.tablePill}>Table {notification.tableNo}</Text> : null}
                    {notification.invoiceNo ? <Text style={styles.invoicePill}>Invoice {notification.invoiceNo}</Text> : null}
                    <Text style={styles.time}>{relativeTime(notification.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            accessibilityRole="button"
          >
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
  backButtonAbsolute: {
    position: 'absolute',
    zIndex: 10,
  },
  backIcon: {}, 
  header: {
    paddingTop: 70,
    paddingBottom: 20,
    paddingHorizontal: 72,
    alignItems: 'center',
  },
  headerTitle: { color: '#000000', fontSize: 25, fontWeight: '600' },
  headerSubtitle: { color: '#64748B', fontSize: 12, marginTop: 5 },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 11 },
  card: {
    minHeight: 88,
    padding: 13,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E4EBF0',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  unreadCard: { borderColor: 'rgba(7,94,167,0.30)', backgroundColor: '#F8FCFF' },
  cardIcon: {
    width: 42,
    height: 42,
    marginRight: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#075EA7',
  },
  readyIcon: { backgroundColor: '#15803D' },
  cardContent: { flex: 1 },
  cardTopLine: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { flex: 1, color: '#002748', fontSize: 14, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, marginLeft: 7, borderRadius: 4, backgroundColor: '#075EA7' },
  cardMessage: { color: '#526270', fontSize: 12, lineHeight: 18, marginTop: 3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  tablePill: { color: '#075EA7', fontSize: 11, fontWeight: '700' },
  invoicePill: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  time: { color: '#94A3B8', fontSize: 11 },
  emptyWrap: { flex: 1, paddingHorizontal: 42, justifyContent: 'center', alignItems: 'center' },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E6F2FA',
  },
  emptyTitle: { color: '#002748', fontSize: 19, fontWeight: '800', marginTop: 19 },
  emptyText: { color: '#64748B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  clearButton: {
    position: 'absolute',
    right: 18,
    bottom: 20,
    minHeight: 42,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#002748',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  clearText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
});
