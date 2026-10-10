import { create } from 'zustand';
import { storage } from './storage';

const NOTIFICATIONS_KEY = 'app_notifications_v1';
const MAX_STORED_NOTIFICATIONS = 100;

export type AppNotificationKind = 'kitchen-item-ready' | 'kitchen-order-ready' | 'general';

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  title: string;
  message: string;
  createdAt: string;
  tableNo?: string;
  invoiceNo?: string;
  itemCode?: string;
  read: boolean;
};

type IncomingNotification = Omit<AppNotification, 'id' | 'createdAt' | 'read'> &
  Partial<Pick<AppNotification, 'id' | 'createdAt' | 'read'>>;

type NotificationState = {
  notifications: AppNotification[];
  activeToastId: string | null;
  unreadCount: () => number;
  receiveNotification: (notification: IncomingNotification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissToast: () => void;
  clearAll: () => void;
};

const readSavedNotifications = (): AppNotification[] => {
  try {
    const raw = storage.getString(NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is AppNotification => Boolean(item?.id && item?.title && item?.message))
      .slice(0, MAX_STORED_NOTIFICATIONS);
  } catch {
    return [];
  }
};

const persistNotifications = (notifications: AppNotification[]) => {
  try {
    storage.set(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, MAX_STORED_NOTIFICATIONS)));
  } catch (error) {
    console.log('[NotificationStore] failed to save notifications', error);
  }
};

const initialNotifications = readSavedNotifications();

/**
 * Shared UI notification inbox. The kitchen/push implementation will call
 * receiveNotification() when it receives a real READY event. Keeping this
 * separate lets the home, bottom navigation and floating bubble stay in sync.
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: initialNotifications,
  activeToastId: null,

  unreadCount: () => get().notifications.filter((notification) => !notification.read).length,

  receiveNotification: (incoming) => {
    const notification: AppNotification = {
      id: incoming.id ?? `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: incoming.kind ?? 'general',
      title: incoming.title,
      message: incoming.message,
      createdAt: incoming.createdAt ?? new Date().toISOString(),
      tableNo: incoming.tableNo,
      invoiceNo: incoming.invoiceNo,
      itemCode: incoming.itemCode,
      read: incoming.read ?? false,
    };

    const existing = get().notifications.find((item) => item.id === notification.id);
    if (existing) return;

    const notifications = [notification, ...get().notifications].slice(0, MAX_STORED_NOTIFICATIONS);
    persistNotifications(notifications);
    set({ notifications, activeToastId: notification.id });
  },

  markAsRead: (id) => {
    const notifications = get().notifications.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification,
    );
    persistNotifications(notifications);
    set({ notifications });
  },

  markAllAsRead: () => {
    const notifications = get().notifications.map((notification) => ({ ...notification, read: true }));
    persistNotifications(notifications);
    set({ notifications });
  },

  dismissToast: () => set({ activeToastId: null }),

  clearAll: () => {
    try {
      storage.remove(NOTIFICATIONS_KEY);
    } catch {
      // The in-memory inbox still clears if storage is temporarily unavailable.
    }
    set({ notifications: [], activeToastId: null });
  },
}));
