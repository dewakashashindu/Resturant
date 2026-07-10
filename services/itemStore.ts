import { create } from 'zustand';
import { apiClient } from './api';
import { storage } from './storage';

const ITEM_CACHE_KEY = 'menu_items_cache_v1';
const ITEM_LAST_SYNC_KEY = 'menu_items_last_sync_v1';
// Separate key to track the DATE portion only — used for daily stale check
const ITEM_LAST_SYNC_DATE_KEY = 'menu_items_last_sync_date_v1';
const CACHED_CATEGORIES_KEY = 'cached_categories';
const CACHED_ITEMS_KEY = 'cached_items';
// Set to '1' on login → forces a fresh full sync on next hydrateItems call
export const FRESH_LOGIN_FLAG_KEY = 'menu_fresh_login_flag';

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
    // ── Decision table ─────────────────────────────────────────────────────
    // Login flow (login.tsx) already calls prefetchMenuBootstrapData() and
    // AWAITS it before navigating to tabs.  So by the time any tab mounts
    // and calls hydrateItems(), the MMKV cache is already populated for
    // today.  We therefore only need a fresh pull here when:
    //   (a) The calendar day has rolled over since the last sync, OR
    //   (b) There is no cache at all (very first ever launch, cleared storage)
    // The FRESH_LOGIN_FLAG is cleared by login.tsx after the prefetch, so
    // we no longer rely on it here — avoids the old race-condition where the
    // flag was still '1' when hydrateItems ran concurrently with the prefetch.
    try {
      const snapshot = readSnapshot(storage.getString(ITEM_CACHE_KEY));
      const storedSyncDate = readStoredSyncDate();
      const todayDate = getTodayDate();

      // Always clear the flag here so a crash in the login prefetch doesn't
      // cause an infinite re-sync loop.
      storage.set(FRESH_LOGIN_FLAG_KEY, '0');

      const cacheEmpty = snapshot.items.length === 0;
      const dateStale  = storedSyncDate !== todayDate;

      if (cacheEmpty || dateStale) {
        console.log('[ItemStore] hydrateItems: fetching from API', {
          reason: cacheEmpty ? 'empty_cache' : 'new_day',
          storedSyncDate,
          todayDate,
        });

        const refreshed = await get().prefetchMenuBootstrapData();
        if (!refreshed) {
          // Server unreachable — use whatever stale cache exists so the app
          // remains usable offline.
          console.log('[ItemStore] hydrateItems: API failed, using stale cache');
          set({ items: snapshot.items, lastSyncTime: snapshot.lastSyncTime, isHydrated: true });
          return;
        }

        // prefetchMenuBootstrapData already called set() — just mark hydrated.
        set((s) => ({ ...s, isHydrated: true }));
        return;
      }

      // Cache is fresh for today — load from MMKV, zero API calls.
      console.log('[ItemStore] hydrateItems: cache hit', {
        lastSyncTime: snapshot.lastSyncTime,
        itemCount: snapshot.items.length,
      });
      set({ items: snapshot.items, lastSyncTime: snapshot.lastSyncTime, isHydrated: true });
    } catch (err) {
      console.log('[ItemStore] hydrateItems: unexpected error', err);
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
    // Called from Settings → "Sync Menu Data" button, and also on the first
    // login after midnight (via hydrateItems). Always does a full pull —
    // no incremental/since filter, so no LastUpdated column is needed on the DB.
    if (get().isSyncing) return false;
    set({ isSyncing: true, syncError: null });

    try {
      const [itemsResponse, categoriesResponse] = await Promise.all([
        apiClient.getMenuItems(), // full pull — no since param
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
      const items: RawItem[] = Array.isArray(itemsPayload.items) ? itemsPayload.items : [];

      const categoriesPayload = categoriesResponse.data ?? {};
      const categories = Array.isArray((categoriesPayload as any).categories)
        ? (categoriesPayload as any).categories
        : [];

      const displayTimestamp = getDisplayTimestamp();

      set({ items, lastSyncTime: displayTimestamp, syncError: null, isHydrated: true });

      persistLegacyCacheKeys(items, categories);
      persistSnapshot(items, displayTimestamp);

      console.log('[ItemStore] syncMenuData: done', {
        totalRows: items.length,
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



export default useItemStore;