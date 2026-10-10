import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform, Vibration } from 'react-native';
import { apiClient } from '../services/api';
import { useAuthStore } from '../services/authStore';
import { getUniqueDeviceId } from '../services/deviceIdService';
import {
  AppNotificationKind,
  getLastNotificationIdKey,
  useNotificationStore,
} from '../services/notificationStore';
import { playForegroundNotificationSound } from '../services/notificationSound';
import { storage } from '../services/storage';

const POLL_INTERVAL_MS = 3000;
const NOTIFICATION_SOUND = 'notification-chime.wav';
// Versioned channel IDs force Android to read the new sound configuration after
// an app rebuild; Android does not allow an existing channel's sound to change.
const ANDROID_SOUND_CHANNEL = 'restaurant-alert-sound-v2';
const ANDROID_SILENT_CHANNEL = 'restaurant-alert-silent-v2';

// Local notifications supply the normal phone sound while the app is open.
// The visual in-app experience remains the app's own right-side toast bubble.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const asText = (value: unknown) => String(value ?? '').trim();
const asNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const mapKind = (value: unknown): AppNotificationKind => {
  const type = asText(value).toLowerCase().replace(/_/g, '-');
  if (type === 'kitchen-item-ready' || type === 'item-ready') return 'kitchen-item-ready';
  if (type === 'kitchen-order-ready' || type === 'order-ready') return 'kitchen-order-ready';
  return 'general';
};

const configureAndroidChannels = async () => {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(ANDROID_SOUND_CHANNEL, {
      name: 'Restaurant alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: NOTIFICATION_SOUND,
      enableVibrate: false,
    }),
    Notifications.setNotificationChannelAsync(ANDROID_SILENT_CHANNEL, {
      name: 'Restaurant alerts (silent)',
      importance: Notifications.AndroidImportance.MAX,
      sound: undefined,
      enableVibrate: false,
    }),
  ]);
};

/**
 * Foreground LAN listener. The backend reads the local MSSQL notification
 * queue; this component safely polls it only while a signed-in app is active.
 */
export default function NotificationPolling() {
  const token = useAuthStore((state) => state.token);
  const receiveNotification = useNotificationStore((state) => state.receiveNotification);
  const preferences = useNotificationStore((state) => state.preferences);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const inFlightRef = useRef(false);
  const deviceIdRef = useRef<string | null>(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    if (!token) return;
    let mounted = true;

    const initialize = async () => {
      try {
        const deviceId = await getUniqueDeviceId();
        if (!mounted || !deviceId) return;
        deviceIdRef.current = deviceId;
        lastIdRef.current = Math.max(0, Number(storage.getString(getLastNotificationIdKey(deviceId)) ?? '0') || 0);
        await configureAndroidChannels();
        await Notifications.requestPermissionsAsync();
      } catch (error) {
        console.log('[Notifications] listener initialization failed', error);
      }
    };

    void initialize();
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const poll = async () => {
      const deviceId = deviceIdRef.current;
      if (!deviceId || inFlightRef.current || appStateRef.current !== 'active') return;
      inFlightRef.current = true;
      try {
        const response = await apiClient.getDeviceNotifications(deviceId, lastIdRef.current);
        const rows: any[] = response.ok && Array.isArray(response.data?.notifications)
          ? response.data.notifications
          : [];

        for (const row of rows) {
          const idNumber = asNumber(row.NotificationId);
          if (idNumber <= lastIdRef.current) continue;

          const id = String(idNumber);
          const title = asText(row.Title) || 'Restaurant update';
          const message = asText(row.Message) || 'You have a new notification.';
          receiveNotification({
            id,
            kind: mapKind(row.NotificationType),
            title,
            message,
            tableNo: asText(row.TableNo) || undefined,
            invoiceNo: asText(row.InvoiceNo) || undefined,
            itemCode: asText(row.ItemCode) || undefined,
            createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : new Date().toISOString(),
          });

          if (preferences.vibrationEnabled) {
            // A clear three-pulse alert. This is intentionally stronger and
            // longer than the default single success haptic.
            Vibration.vibrate([0, 320, 150, 320, 150, 560]);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          }

          if (preferences.soundEnabled) {
            // Direct app audio is reliable in the foreground. If a handset
            // blocks that audio route, retain the local-notification channel
            // as a fallback.
            const playedDirectly = await playForegroundNotificationSound();
            if (!playedDirectly) {
              try {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title,
                    body: message,
                    sound: NOTIFICATION_SOUND,
                    data: { notificationId: id, tableNo: asText(row.TableNo), invoiceNo: asText(row.InvoiceNo) },
                    ...(Platform.OS === 'android' ? { channelId: ANDROID_SOUND_CHANNEL } : {}),
                  },
                  trigger: null,
                });
              } catch (error) {
                console.log('[Notifications] sound playback fallback failed', error);
              }
            }
          }

          lastIdRef.current = idNumber;
          storage.set(getLastNotificationIdKey(deviceId), String(idNumber));
        }
      } catch (error) {
        console.log('[Notifications] polling failed', error);
      } finally {
        inFlightRef.current = false;
      }
    };

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') void poll();
    });
    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      appStateSubscription.remove();
      clearInterval(timer);
    };
  }, [preferences.soundEnabled, preferences.vibrationEnabled, receiveNotification, token]);

  return null;
}
