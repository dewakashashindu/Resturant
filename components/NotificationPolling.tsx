import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import Tts from 'react-native-tts';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform, Vibration } from 'react-native';
import { apiClient } from '../services/api';
import { useAuthStore } from '../services/authStore';
import { getUniqueDeviceId } from '../services/deviceIdService';
import menuItemStore from '../services/itemStore';
import {
  AppNotificationKind,
  getLastNotificationIdKey,
  useNotificationStore,
} from '../services/notificationStore';
import { storage } from '../services/storage';

const POLL_INTERVAL_MS = 3000;
// Android resource filenames may contain only lowercase letters, numbers and
// underscores. Keep this value exactly aligned with app.json and the asset.
const NOTIFICATION_SOUND = 'notification_chime.wav';
// Versioned channel IDs force Android to read the new sound configuration after
// an app rebuild; Android does not allow an existing channel's sound to change.
const ANDROID_SOUND_CHANNEL = 'restaurant-alert-sound-v2';
const ANDROID_SILENT_CHANNEL = 'restaurant-alert-silent-v2';
let androidNotificationTtsReady = false;

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

// READY speech is deliberately composed here rather than read from the SQL
// Message field. It gives the receiving steward a consistent, useful phrase:
// “Hello Dewaka, order for Table T36: 2 Fried Rice and 1 Coke are ready for pickup.”
const readyAnnouncementText = (row: any, recipientName = ''): string | null => {
  const status = asText(row?.StatusCode).toUpperCase();
  const kind = asText(row?.NotificationKind).toLowerCase();
  if (status !== 'D' || !['kds-status-update', 'kds-order-status-update'].includes(kind)) return null;

  const tableNo = asText(row?.TableNo);
  if (!tableNo || !Array.isArray(row?.Items)) return null;

  const quantitiesByName = new Map<string, number>();
  for (const item of row.Items) {
    const itemName = asText(item?.ItemName ?? item?.itemName);
    if (!itemName) continue;
    const quantity = Number(item?.Quantity ?? item?.quantity ?? 0);
    quantitiesByName.set(itemName, (quantitiesByName.get(itemName) ?? 0) + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1));
  }
  const spokenItems = [...quantitiesByName.entries()].map(([itemName, quantity]) => `${quantity} ${itemName}`);
  if (spokenItems.length === 0) return null;

  const itemPhrase = spokenItems.length === 1
    ? spokenItems[0]
    : spokenItems.length === 2
      ? `${spokenItems[0]} and ${spokenItems[1]}`
      : `${spokenItems.slice(0, -1).join(', ')}, and ${spokenItems[spokenItems.length - 1]}`;
  const greetingName = asText(recipientName);
  const greeting = greetingName ? `Hello ${greetingName}, ` : 'Hello, ';
  return `${greeting}order for Table ${tableNo}: ${itemPhrase} ${spokenItems.length === 1 ? 'is' : 'are'} ready for pickup.`;
};

const parseNotificationDetails = (row: any) => {
  const items = Array.isArray(row?.Items)
    ? row.Items
      .map((item: any) => ({
        itemId: asText(item?.ItemCode ?? item?.itemCode),
        itemName: asText(item?.ItemName ?? item?.itemName),
        quantity: Number(item?.Quantity ?? item?.quantity ?? 0) || undefined,
        remarks: asText(item?.ItemRemarks ?? item?.remarks) || undefined,
        type: asText(item?.ItemType ?? item?.type) || undefined,
      }))
      .filter((item: { itemId: string; itemName: string }) => item.itemId && item.itemName)
    : undefined;
  return {
    kind: asText(row?.NotificationKind) || undefined,
    status: asText(row?.StatusCode) || undefined,
    orderNo: undefined,
    tableNo: asText(row?.TableNo) || undefined,
    invoiceNo: asText(row?.InvoiceNo) || undefined,
    ...(items?.length ? { items } : {}),
  };
};

/**
 * READY uses Android's native TextToSpeech notification stream, not media.
 * This makes the device Notification-volume control apply to the spoken table
 * and item message. Expo Speech remains a safe iOS/fallback implementation.
 */
const speakReadyAnnouncement = async (announcement: string) => {
  if (Platform.OS !== 'android') {
    Speech.speak(announcement, { language: 'en-US', rate: 0.88, pitch: 1 });
    return;
  }

  try {
    if (!androidNotificationTtsReady) {
      await Tts.getInitStatus();
      await Tts.setDefaultLanguage('en-US');
      await Tts.setDefaultRate(0.45);
      await Tts.setDefaultPitch(1);
      androidNotificationTtsReady = true;
    }
    Tts.speak(announcement, {
      androidParams: {
        KEY_PARAM_STREAM: 'STREAM_NOTIFICATION',
        KEY_PARAM_VOLUME: 1,
        KEY_PARAM_PAN: 0,
      },
    } as any);
  } catch (error) {
    // Do not fall back to Expo Speech on Android: it can use the Media stream,
    // which would bypass the requested Notification-volume control.
    console.log('[Notifications] Android notification-stream TTS failed', error);
  }
};

const configureAndroidChannels = async () => {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(ANDROID_SOUND_CHANNEL, {
      name: 'Mila Mirissa alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: NOTIFICATION_SOUND,
      enableVibrate: false,
    }),
    Notifications.setNotificationChannelAsync(ANDROID_SILENT_CHANNEL, {
      name: 'Mila Mirissa alerts (silent)',
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
  const recipientName = useAuthStore((state) => state.user?.userName ?? '');
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

  // Mute must be immediate as well as preventing future announcements. Stop a
  // currently queued/playing TTS utterance when Settings Voice/Sound is turned off.
  useEffect(() => {
    if (preferences.soundEnabled) return;
    if (Platform.OS === 'android') {
      void Tts.stop().catch(() => {});
    }
    Speech.stop();
  }, [preferences.soundEnabled]);

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
          const title = asText(row.Title) || 'Mila Mirissa update';
          const message = asText(row.Message) || 'You have a new notification.';
          receiveNotification({
            id,
            kind: mapKind(row.NotificationType),
            notificationType: asText(row.NotificationType) || 'OP',
            title,
            message,
            tableNo: asText(row.TableNo) || undefined,
            invoiceNo: asText(row.InvoiceNo) || undefined,
            itemCode: asText(row.ItemCode) || undefined,
            payload: parseNotificationDetails(row),
            createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : new Date().toISOString(),
          });

          // An IT message means KDS saved a new availability state. Refresh the
          // local menu cache immediately, so unavailable items disappear from
          // customer/POS menu cards without waiting for the next daily sync.
          if (asText(row?.NotificationType).toUpperCase() === 'IT') {
            void menuItemStore.getState().syncMenuData().catch((error) => {
              console.log('[Notifications] menu availability refresh failed', error);
            });
          }

          const notificationStatus = asText(row?.StatusCode).toUpperCase();
          const notificationKind = asText(row?.NotificationKind).toLowerCase();

          // READY/DONE: TTS only. It intentionally has no notification chime.
          // The Android implementation speaks through STREAM_NOTIFICATION.
          const announcement = readyAnnouncementText(row, recipientName);
          if (announcement && preferences.soundEnabled) {
            await speakReadyAnnouncement(announcement);
          }

          if (preferences.vibrationEnabled) {
            // A clear three-pulse alert. This is intentionally stronger and
            // longer than the default single success haptic.
            Vibration.vibrate([0, 320, 150, 320, 150, 560]);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          }

          // PROCESSING/P: keep the normal notification beep. A real Android
          // notification channel uses the phone's Notification volume, instead
          // of expo-av's media stream. READY/D has no beep by design.
          const shouldPlayPreparingBeep = preferences.soundEnabled
            && ['kds-status-update', 'kds-order-status-update'].includes(notificationKind)
            && notificationStatus === 'P';
          if (shouldPlayPreparingBeep) {
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
              console.log('[Notifications] preparing beep failed', error);
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
  }, [preferences.soundEnabled, preferences.vibrationEnabled, receiveNotification, recipientName, token]);

  return null;
}
