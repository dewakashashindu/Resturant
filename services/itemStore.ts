import { create } from 'zustand';
import { apiClient } from './api';
import { storage } from './storage';

const ITEM_CACHE_KEY = 'menu_items_cache_v1';
const ITEM_LAST_SYNC_KEY = 'menu_items_last_sync_v1';
const CACHED_CATEGORIES_KEY = 'cached_categories';
const CACHED_ITEMS_KEY = 'cached_items';

type RawItem = Record<string, any>;
type MenuSnapshot = {
  items: RawItem[];
  lastSyncTime: string | null;
};

type ItemStoreState = {
  items: RawItem[];
  lastSyncTime: string | null;
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
    const lastSyncTime = typeof payload.lastSyncTime === 'string' && payload.lastSyncTime
      ? payload.lastSyncTime
      : storage.getString(ITEM_LAST_SYNC_KEY) ?? null;

    return { items, lastSyncTime };
  }

  return {
    items: [],
    lastSyncTime: storage.getString(ITEM_LAST_SYNC_KEY) ?? null,
  };
};

const getTodaySyncDate = () => new Date().toISOString().slice(0, 10);

const readStoredSyncDate = () => {
  const raw = storage.getString(ITEM_LAST_SYNC_KEY);
  return raw ? String(raw).trim().slice(0, 10) : null;
};

const persistSnapshot = (items: RawItem[], lastSyncTime: string | null) => {
  const snapshot: MenuSnapshot = {
    items: items ?? [],
    lastSyncTime,
  };

  storage.set(ITEM_CACHE_KEY, JSON.stringify(snapshot));
  if (lastSyncTime) {
    storage.set(ITEM_LAST_SYNC_KEY, lastSyncTime);
  } else {
    storage.set(ITEM_LAST_SYNC_KEY, '');
  }
};

const persistLegacyCacheKeys = (items: RawItem[], categories: RawItem[]) => {
  storage.set(CACHED_ITEMS_KEY, JSON.stringify(items ?? []));
  storage.set(CACHED_CATEGORIES_KEY, JSON.stringify(categories ?? []));
};

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
      const todaySyncDate = getTodaySyncDate();

      if (storedSyncDate !== todaySyncDate) {
        console.log('[ItemStore] hydrateItems cache is stale, refreshing from API', {
          storedSyncDate,
          todaySyncDate,
        });

        const refreshed = await get().prefetchMenuBootstrapData();
        if (!refreshed) {
          set({ items: snapshot.items, lastSyncTime: storedSyncDate, isHydrated: true });
          return;
        }

        const refreshedSnapshot = readSnapshot(storage.getString(ITEM_CACHE_KEY));
        set({
          items: refreshedSnapshot.items,
          lastSyncTime: readStoredSyncDate(),
          isHydrated: true,
        });
        return;
      }

      console.log('[ItemStore] hydrateItems lastSyncTime=', snapshot.lastSyncTime, 'cachedItems=', snapshot.items.length);
      set({ items: snapshot.items, lastSyncTime: snapshot.lastSyncTime, isHydrated: true });
    } catch (err) {
      set({ items: [], lastSyncTime: null, isHydrated: true });
    }
  },

  prefetchMenuBootstrapData: async () => {
    try {
      const [categoriesResponse, itemsResponse] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getMenuItems(),
      ]);

      const categoriesPayload = categoriesResponse.data ?? {};
      const itemsPayload = itemsResponse.data ?? {};

      const categories = Array.isArray((categoriesPayload as any).categories)
        ? (categoriesPayload as any).categories
        : [];
      const items = Array.isArray((itemsPayload as any).items)
        ? (itemsPayload as any).items
        : [];
      const lastSyncDate = getTodaySyncDate();

      persistLegacyCacheKeys(items, categories);
      persistSnapshot(items, lastSyncDate);

      set({
        items,
        lastSyncTime: lastSyncDate,
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
    if (get().isSyncing) return false;
    set({ isSyncing: true, syncError: null });

    try {
      const response = await apiClient.getMenuItems();

      if (!response.ok) {
        const err = (response as any).error ?? 'Failed to fetch menu data';
        console.log('[ItemStore] getMenuItems failed response=', { ok: response.ok, error: (response as any).error, data: response.data });
        set({ syncError: String(err) });
        return false;
      }

      const payload = response.data ?? {};
      console.log('[ItemStore] getMenuItems response payload=', payload);
      const items = Array.isArray(payload.items) ? payload.items : [];
      const serverSyncDate = getTodaySyncDate();
      const categoriesResponse = await apiClient.getCategories();
      const categoriesPayload = categoriesResponse.data ?? {};
      const categories = Array.isArray((categoriesPayload as any).categories)
        ? (categoriesPayload as any).categories
        : [];

      set({ items, lastSyncTime: serverSyncDate, syncError: null, isHydrated: true });

      persistLegacyCacheKeys(items, categories);
      persistSnapshot(items, serverSyncDate);
      console.log('[ItemStore] persisted menu snapshot items=', items.length, 'lastSyncDate=', serverSyncDate);
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
    } catch (err) {
      console.log('⚠️ [ItemStore] clearItems failed', err);
    }
    set({ items: [], lastSyncTime: null, syncError: null });
  },
}));

export default useItemStore;
