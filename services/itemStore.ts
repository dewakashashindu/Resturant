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
// Prefix for per-item picture cache keys: "item_pic:ITEMCODE"
export const ITEM_PIC_PREFIX = 'item_pic:';

// Welcome preloads the menu in the background. Keep one shared promise so
// Menu Cato joining that preload never starts a duplicate full API download.
let hydrateItemsInFlight: Promise<void> | null = null;

/**
 * Strips ItemPic out of each item, saves pictures to individual MMKV keys,
 * and returns the cleaned items array (no base64 blobs in the main cache).
 */
const stripAndCachePictures = (items: RawItem[]): RawItem[] => {
  let savedCount = 0;
  let nullCount = 0;
  const result = items.map((item) => {
    const code = String(item.MenuItemCode ?? item.ItemCode ?? '').trim();
    const pic = item.ItemPic;
    if (code && pic && typeof pic === 'string' && pic.trim().length > 0) {
      try {
        storage.set(`${ITEM_PIC_PREFIX}${code}`, pic.trim());
        savedCount++;
        if (savedCount <= 5) console.log('[ItemStore] Cached pic for', code, 'length=', pic.trim().length);
      } catch (e) {
        console.log('[ItemStore] Failed to cache picture for', code, e);
      }
    } else if (code) {
      nullCount++;
    }
    const { ItemPic, ...rest } = item as any;
    return rest as RawItem;
  });
  console.log('[ItemStore] stripAndCachePictures done: saved=', savedCount, 'noPic=', nullCount);
  return result;
};

/**
 * Same cache transform as above, but yields every small batch. This lets the
 * Settings screen render genuine image-cache progress for a manual sync.
 */
const stripAndCachePicturesWithProgress = async (
  items: RawItem[],
  onProgress: (completed: number, total: number) => void,
): Promise<RawItem[]> => {
  const result: RawItem[] = [];
  let savedCount = 0;
  let nullCount = 0;
  const total = items.length;
  const batchSize = 25;

  for (let index = 0; index < total; index += 1) {
    const item = items[index];
    const code = String(item.MenuItemCode ?? item.ItemCode ?? '').trim();
    const pic = item.ItemPic;

    if (code && pic && typeof pic === 'string' && pic.trim().length > 0) {
      try {
        storage.set(`${ITEM_PIC_PREFIX}${code}`, pic.trim());
        savedCount += 1;
      } catch (error) {
        console.log('[ItemStore] Failed to cache picture for', code, error);
      }
    } else if (code) {
      nullCount += 1;
    }

    const { ItemPic, ...rest } = item as any;
    result.push(rest as RawItem);

    const completed = index + 1;
    if (completed % batchSize === 0 || completed === total) {
      onProgress(completed, total);
      // Yield to React Native between batches so the progress bar can repaint.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  console.log('[ItemStore] progressive picture cache done: saved=', savedCount, 'noPic=', nullCount);
  return result;
};

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
  // Manual Settings sync publishes its real stages so the UI can show live
  // request/cache progress instead of a spinner with no feedback.
  syncProgress: number;
  syncStage: string;

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
  syncProgress: 0,
  syncStage: '',

  hydrateItems: () => {
    // Welcome begins this work in the background. If Menu Cato opens before it
    // completes, it awaits this same promise instead of making a second full
    // request for the menu and image cache.
    if (hydrateItemsInFlight) return hydrateItemsInFlight;

    const task = (async () => {
      // ── Decision table ───────────────────────────────────────────────────
      // Login flow (login.tsx) already calls prefetchMenuBootstrapData() and
      // awaits it before navigating to tabs. We therefore fetch here only
      // when the cache is missing or belongs to a previous calendar day.
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
    })();

    hydrateItemsInFlight = task;
    return task.finally(() => {
      if (hydrateItemsInFlight === task) hydrateItemsInFlight = null;
    });
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

      // Save pictures to individual MMKV keys; strip from main cache
      const cleanItems = stripAndCachePictures(items);

      persistLegacyCacheKeys(cleanItems, categories);
      persistSnapshot(cleanItems, displayTimestamp);

      set({
        items: cleanItems,
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
    // Manual Settings sync performs a full pull and publishes stages/progress
    // for the screen. The API cannot report byte-level progress, but caching
    // each received item is measured exactly and updates live.
    if (get().isSyncing) return false;
    set({
      isSyncing: true,
      syncError: null,
      syncProgress: 5,
      syncStage: 'Connecting to server...',
    });

    try {
      set({ syncProgress: 18, syncStage: 'Downloading menu items...' });
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
        set({ syncError: String(err), syncProgress: 0, syncStage: 'Sync failed' });
        return false;
      }

      const itemsPayload = itemsResponse.data ?? {};
      const items: RawItem[] = Array.isArray(itemsPayload.items) ? itemsPayload.items : [];

      const categoriesPayload = categoriesResponse.data ?? {};
      const categories = Array.isArray((categoriesPayload as any).categories)
        ? (categoriesPayload as any).categories
        : [];

      set({
        syncProgress: 60,
        syncStage: `Downloaded ${items.length.toLocaleString()} menu items`,
      });

      const cleanItems = await stripAndCachePicturesWithProgress(items, (completed, total) => {
        const cachePercent = total > 0 ? completed / total : 1;
        const progress = 60 + Math.round(cachePercent * 32);
        set({
          syncProgress: progress,
          syncStage: `Caching item images: ${completed.toLocaleString()} / ${total.toLocaleString()}`,
        });
      });

      const displayTimestamp = getDisplayTimestamp();
      set({ syncProgress: 94, syncStage: 'Saving offline menu cache...' });
      persistLegacyCacheKeys(cleanItems, categories);
      persistSnapshot(cleanItems, displayTimestamp);

      set({
        items: cleanItems,
        lastSyncTime: displayTimestamp,
        syncError: null,
        isHydrated: true,
        syncProgress: 100,
        syncStage: 'Menu sync complete',
      });

      console.log('[ItemStore] syncMenuData: done', {
        totalRows: items.length,
        lastSyncTime: displayTimestamp,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ syncError: msg, syncProgress: 0, syncStage: 'Sync failed' });
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