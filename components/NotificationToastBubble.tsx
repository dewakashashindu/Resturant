import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../services/authStore';
import { useNotificationStore } from '../services/notificationStore';

/**
 * Global foreground toast. It deliberately sits above every screen, so a
 * future kitchen READY event is visible while the user is inside Menu Card,
 * Item Selection, Cart, or any other workflow.
 */
export default function NotificationToastBubble() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.token);
  const notifications = useNotificationStore((state) => state.notifications);
  const activeToastId = useNotificationStore((state) => state.activeToastId);
  const dismissToast = useNotificationStore((state) => state.dismissToast);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const translateX = useRef(new Animated.Value(360)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const notification = notifications.find((item) => item.id === activeToastId) ?? null;

  useEffect(() => {
    if (!notification || !token) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: 360, duration: 160, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
      return;
    }

    translateX.setValue(360);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 170, useNativeDriver: true }),
    ]).start();
  }, [notification?.id, opacity, token, translateX]);

  if (!notification || !token) return null;

  const openInbox = () => {
    markAsRead(notification.id);
    dismissToast();
    router.push('/Screens/notifications' as never);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.wrap,
          { top: insets.top + 76, opacity, transform: [{ translateX }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.card}
          onPress={openInbox}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <View style={styles.iconWrap}>
            <Ionicons name="notifications" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.messageWrap}>
            <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{notification.message}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismissToast}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification popup"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#64748B" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    width: 300,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    flex: 1,
    minHeight: 70,
    paddingVertical: 11,
    paddingLeft: 11,
    paddingRight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(7, 94, 167, 0.18)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#002748',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 11,
  },
  iconWrap: {
    width: 38,
    height: 38,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 13,
    backgroundColor: '#075EA7',
  },
  messageWrap: { flex: 1 },
  title: { color: '#002748', fontSize: 13, fontWeight: '800' },
  message: { color: '#475569', fontSize: 11, lineHeight: 16, marginTop: 2 },
  closeButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
});
