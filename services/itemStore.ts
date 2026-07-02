import { create } from 'zustand';
import { apiClient } from './api';
import { storage } from './storage';

const ITEM_CACHE_KEY = 'menu_items_cache_v1';
const ITEM_LAST_SYNC_KEY = 'menu_items_last_sync_v1';
// Separate key to track the DATE portion only — used for daily stale check
const ITEM_LAST_SYNC_DATE_KEY = 'menu_items_last_sync_date_v1';
const CACHED_CATEGORIES_KEY = 'cached_categories';
const CACHED_ITEMS_KEY = 'cached_items';

type RawItem = Record<string, any>;
type MenuSnapshot = {
  items: RawItem[];
  lastSyncTime: string | null;
};

type ItemStoreState = {
  items: RawItem[];
  lastSyncTime: string | null;   // Full "YYYY-MM-DD HH:MM:SS" — shown in Settings
  isHydrated: boolean;
  isSyncing: boolean;
  syncError: string | null;

  hydrateItems: () => Promise<void>;
  prefetchMenuBootstrapData: () => Promise<boolean>;
  syncMenuData: () => Promise<boolean>;
  syncItems: (opts?: { forceFullSync?: boolean }) => Promise<void>;
  replaceItems: (items: RawItem[], lastSyncTime?: string | null) => void;
  clearItems: () => void;
};

const safeParse = (value?: string | null) => {
  if (value === undefined || value === null || value === '') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readSnapshot = (raw?: string | null): MenuSnapshot => {
  const parsed = safeParse(raw);

  if (Array.isArray(parsed)) {
    return {
      items: parsed,
      lastSyncTime: storage.getString(ITEM_LAST_SYNC_KEY) ?? null,
    };
  }

  if (parsed && typeof parsed === 'object') {
    const payload = parsed as Record<string, any>;
    const items = Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.data?.items)
        ? payload.data.items
        : [];
    const lastSyncTime =
      typeof payload.lastSyncTime === 'string' && payload.lastSyncTime
        ? payload.lastSyncTime
        : storage.getString(ITEM_LAST_SYNC_KEY) ?? null;

    return { items, lastSyncTime };
  }

  return {
    items: [],
    lastSyncTime: storage.getString(ITEM_LAST_SYNC_KEY) ?? null,
  };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns current local date as "YYYY-MM-DD" — used for stale-check only.
 */
const getTodayDate = () => new Date().toISOString().slice(0, 10);

/**
 * Returns a human-readable local datetime string for display in Settings.
 * Format: "2025-06-25 14:32:07"
 */
const getDisplayTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
};

/**
 * Reads only the date portion (YYYY-MM-DD) stored for the stale-date check.
 */
const readStoredSyncDate = (): string | null => {
  const raw = storage.getString(ITEM_LAST_SYNC_DATE_KEY);
  return raw ? String(raw).trim().slice(0, 10) : null;
};

const persistSnapshot = (items: RawItem[], displayTimestamp: string | null) => {
  const snapshot: MenuSnapshot = {
    items: items ?? [],
    lastSyncTime: displayTimestamp,
  };
  storage.set(ITEM_CACHE_KEY, JSON.stringify(snapshot));

  if (displayTimestamp) {
    // Full timestamp for display
    storage.set(ITEM_LAST_SYNC_KEY, displayTimestamp);
    // Date-only for daily stale check
    storage.set(ITEM_LAST_SYNC_DATE_KEY, displayTimestamp.slice(0, 10));
  } else {
    storage.set(ITEM_LAST_SYNC_KEY, '');
    storage.set(ITEM_LAST_SYNC_DATE_KEY, '');
  }
};

const persistLegacyCacheKeys = (items: RawItem[], categories: RawItem[]) => {
  storage.set(CACHED_ITEMS_KEY, JSON.stringify(items ?? []));
  storage.set(CACHED_CATEGORIES_KEY, JSON.stringify(categories ?? []));
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useItemStore = create<ItemStoreState>((set, get) => ({
  items: [],
  lastSyncTime: null,
  isHydrated: false,
  isSyncing: false,
  syncError: null,

  hydrateItems: async () => {
    try {
      const snapshot = readSnapshot(storage.getString(ITEM_CACHE_KEY));
      const storedSyncDate = readStoredSyncDate();
      const todayDate = getTodayDate();

      if (storedSyncDate !== todayDate) {
        // Cache is from a previous day → full refresh needed
        console.log('[ItemStore] hydrateItems: cache stale, full refresh', {
          storedSyncDate,
          todayDate,
        });

        const refreshed = await get().prefetchMenuBootstrapData();
        if (!refreshed) {
          // API unreachable — fall back to stale cache so app still works
          set({ items: snapshot.items, lastSyncTime: snapshot.lastSyncTime, isHydrated: true });
          return;
        }

        const refreshedSnapshot = readSnapshot(storage.getString(ITEM_CACHE_KEY));
        set({
          items: refreshedSnapshot.items,
          lastSyncTime: refreshedSnapshot.lastSyncTime,
          isHydrated: true,
        });
        return;
      }

      // Cache is fresh for today — load from MMKV, no API call
      console.log('[ItemStore] hydrateItems: cache is fresh', {
        lastSyncTime: snapshot.lastSyncTime,
        cachedItems: snapshot.items.length,
      });
      set({ items: snapshot.items, lastSyncTime: snapshot.lastSyncTime, isHydrated: true });
    } catch (err) {
      set({ items: [], lastSyncTime: null, isHydrated: true });
    }
  },

  prefetchMenuBootstrapData: async () => {
    // Full sync — no `since` filter. Used on first launch or stale-day refresh.
    try {
      const [categoriesResponse, itemsResponse] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getMenuItems(), // no `since` → full pull
      ]);

      const categoriesPayload = categoriesResponse.data ?? {};
      const itemsPayload = itemsResponse.data ?? {};

      const categories = Array.isArray((categoriesPayload as any).categories)
        ? (categoriesPayload as any).categories
        : [];
      const items = Array.isArray((itemsPayload as any).items)
        ? (itemsPayload as any).items
        : [];

      const displayTimestamp = getDisplayTimestamp();

      persistLegacyCacheKeys(items, categories);
      persistSnapshot(items, displayTimestamp);

      set({
        items,
        lastSyncTime: displayTimestamp,
        isHydrated: true,
        syncError: null,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ syncError: message });
      return false;
    }
  },

  syncMenuData: async () => {
    // Called from Settings → "Sync Menu Data" button.
    // Uses incremental sync (since=lastSyncDate) to avoid pulling the full
    // table every time the user manually refreshes. Only changed rows come back.
    if (get().isSyncing) return false;
    set({ isSyncing: true, syncError: null });

    try {
      // Pass the stored sync DATE as the `since` filter.
      // The server does: WHERE LastUpdated > @since
      // On first ever sync storedSyncDate is null → full pull (no filter).
      const storedSyncDate = readStoredSyncDate();

      const [itemsResponse, categoriesResponse] = await Promise.all([
        apiClient.getMenuItems(storedSyncDate ?? undefined), // incremental if date exists
        apiClient.getCategories(),
      ]);

      if (!itemsResponse.ok) {
        const err = (itemsResponse as any).error ?? 'Failed to fetch menu data';
        console.log('[ItemStore] syncMenuData: getMenuItems failed', {
          ok: itemsResponse.ok,
          error: (itemsResponse as any).error,
        });
        set({ syncError: String(err) });
        return false;
      }

      const itemsPayload = itemsResponse.data ?? {};
      const incomingItems: RawItem[] = Array.isArray(itemsPayload.items) ? itemsPayload.items : [];

      // Merge incoming (changed) items into existing cache.
      // If this was a full pull (no since), incomingItems IS the full list.
      const existingItems = get().items;
      const mergedItems = mergeItems(existingItems, incomingItems);

      const categoriesPayload = categoriesResponse.data ?? {};
      const categories = Array.isArray((categoriesPayload as any).categories)
        ? (categoriesPayload as any).categories
        : [];

      const displayTimestamp = getDisplayTimestamp();

      set({ items: mergedItems, lastSyncTime: displayTimestamp, syncError: null, isHydrated: true });

      persistLegacyCacheKeys(mergedItems, categories);
      persistSnapshot(mergedItems, displayTimestamp);

      console.log('[ItemStore] syncMenuData: done', {
        incomingRows: incomingItems.length,
        totalCached: mergedItems.length,
        lastSyncTime: displayTimestamp,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ syncError: msg });
      return false;
    } finally {
      set({ isSyncing: false });
    }
  },

  syncItems: async () => {
    await get().syncMenuData();
  },

  replaceItems: (items, lastSyncTime = null) => {
    try {
      persistSnapshot(items || [], lastSyncTime);
    } catch (err) {
      console.log('⚠️ [ItemStore] replaceItems persist failed', err);
    }
    set({ items: items ?? [], lastSyncTime, syncError: null });
  },

  clearItems: () => {
    try {
      persistSnapshot([], null);
      storage.set(ITEM_LAST_SYNC_KEY, '');
      storage.set(ITEM_LAST_SYNC_DATE_KEY, '');
    } catch (err) {
      console.log('⚠️ [ItemStore] clearItems failed', err);
    }
    set({ items: [], lastSyncTime: null, syncError: null });
  },
}));

// ── Merge helper ──────────────────────────────────────────────────────────────
/**
 * Merges changed/new items from the server into the existing cached list.
 * Matches on MenuItemCode. If the server returned ALL items (full pull),
 * this just replaces the whole list cleanly.
 */
const mergeItems = (existing: RawItem[], incoming: RawItem[]): RawItem[] => {
  if (incoming.length === 0) return existing;

  const map = new Map<string, RawItem>();
  for (const item of existing) {
    const key = String(item.MenuItemCode ?? item.menuItemCode ?? '');
    if (key) map.set(key, item);
  }
  for (const item of incoming) {
    const key = String(item.MenuItemCode ?? item.menuItemCode ?? '');
    if (key) map.set(key, item); // overwrites stale row
  }
  return [...map.values()];
};

export default useItemStore;