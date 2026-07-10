import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { FRESH_LOGIN_FLAG_KEY } from './itemStore';
import { AUTH_SESSION_KEYS, storage } from './storage';

type AuthUser = {
  userName: string;
  userId: string | number;
  groupId: string | number;
  assignedFloors?: string[];
  picture?: string | null;   // base64 string from DB
  locCode?: string | null;
};

type AuthStore = {
  token: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  isAuthenticated: boolean;
  hydrateAuth: () => Promise<void>;
  setSession: (payload: { token: string; user: AuthUser }) => void;
  clearSession: () => Promise<void>;
  forceLogout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
  updatePicture: (base64: string | null) => void;
};

const normalize = (value: unknown) => String(value ?? '').trim();

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isHydrated: false,
  isAuthenticated: false,
  

  
  hydrateAuth: async () => {
    try {
      const mmkvToken = normalize(storage.getString(AUTH_SESSION_KEYS.token));
      const mmkvUsername = normalize(storage.getString(AUTH_SESSION_KEYS.username));
      const mmkvUserId = normalize(storage.getString(AUTH_SESSION_KEYS.userId));
      const mmkvGroupId = normalize(storage.getString(AUTH_SESSION_KEYS.groupId)); 
      const mmkvFloorsStr = storage.getString('assignedFloors');
      const mmkvPicture = storage.getString(AUTH_SESSION_KEYS.picture) || null;
      const mmkvLocCode = storage.getString(AUTH_SESSION_KEYS.locCode) || null;
      const mmkvUserName = storage.getString(AUTH_SESSION_KEYS.userName) || null;

      let token = mmkvToken;
      let username = mmkvUsername;
      let userId = mmkvUserId;
      let groupId = mmkvGroupId;
      let picture = mmkvPicture;
      let locCode = mmkvLocCode;
      let userName = mmkvUserName;

      let assignedFloors: string[] = [];

      if (mmkvFloorsStr) {
        try { assignedFloors = JSON.parse(mmkvFloorsStr); } catch { assignedFloors = []; }
      }

      if (!token) {
        const legacyToken = normalize(await AsyncStorage.getItem('token'));
        if (legacyToken) {
          token = legacyToken;
          storage.set(AUTH_SESSION_KEYS.token, token);
          storage.set(AUTH_SESSION_KEYS.isLoggedIn, 'true');
        }
      }

      if (!username) {
        const legacyUsername = normalize(await AsyncStorage.getItem('username'));
        if (legacyUsername) {
          username = legacyUsername;
          storage.set(AUTH_SESSION_KEYS.username, username);
        }
      }

      if (!userId) {
        const legacyUserId = normalize(await AsyncStorage.getItem('userId'));
        if (legacyUserId) {
          userId = legacyUserId;
          storage.set(AUTH_SESSION_KEYS.userId, userId);
        }
      }

      if (!groupId) {
        const legacyGroupId = normalize(await AsyncStorage.getItem('groupId'));
        if (legacyGroupId) {
          groupId = legacyGroupId;
          storage.set(AUTH_SESSION_KEYS.groupId, groupId);
        }
      }

      if (assignedFloors.length === 0) {
        const legacyFloorsStr = await AsyncStorage.getItem('assignedFloors');
        if (legacyFloorsStr) {
          try { 
            assignedFloors = JSON.parse(legacyFloorsStr); 
            storage.set('assignedFloors', legacyFloorsStr); 
          } catch { assignedFloors = []; }
        }
      }

      set({
        token: token || null,
        user: token
          ? {
              userName: userName || username || 'User',
              userId: userId || username || 'User',
              groupId: groupId || '1',
              assignedFloors: assignedFloors,
              picture: picture || null,
              locCode: locCode || null,
            }
          : null,
        isAuthenticated: Boolean(token),
        isHydrated: true,
      });
    } catch (error) {
      console.log('[AuthStore] hydrateAuth failed', error);
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      });
    }
  },

  
  setSession: ({ token, user }) => {
    const nextToken = normalize(token);
    const nextUser = {
      userName: normalize((user as any).userName || (user as any).username) || 'User',
      userId: (user as any).userId || (user as any).UserId,
      groupId: (user as any).groupId || (user as any).GroupId,
      assignedFloors: (user as any).assignedFloors || [],
      picture: (user as any).picture || null,
      locCode: (user as any).locCode || null,
    };

    storage.set(AUTH_SESSION_KEYS.token, nextToken);
    storage.set(AUTH_SESSION_KEYS.isLoggedIn, 'true');
    storage.set(AUTH_SESSION_KEYS.username, String(nextUser.userName));
    storage.set(AUTH_SESSION_KEYS.userId, String(nextUser.userId));
    storage.set(AUTH_SESSION_KEYS.groupId, String(nextUser.groupId));
    storage.set(AUTH_SESSION_KEYS.userName, String(nextUser.userName));
    if (nextUser.picture) storage.set(AUTH_SESSION_KEYS.picture, nextUser.picture);
    if (nextUser.locCode) storage.set(AUTH_SESSION_KEYS.locCode, String(nextUser.locCode));

storage.set('assignedFloors', JSON.stringify(nextUser.assignedFloors));

    // Signal itemStore to do a fresh full sync — only when the calendar day
    // has changed since the last sync. Same-day re-logins reuse the MMKV
    // cache and skip the API call entirely.
    const lastSyncDate = String(storage.getString('menu_items_last_sync_date_v1') ?? '').slice(0, 10);
    const todayDate = new Date().toISOString().slice(0, 10);
    if (lastSyncDate !== todayDate) {
      storage.set(FRESH_LOGIN_FLAG_KEY, '1');
    }

    set({
      token: nextToken,
      user: nextUser,
      isAuthenticated: true,
      isHydrated: true,
    });
  },

  clearSession: async () => {
    try {
      storage.set(AUTH_SESSION_KEYS.token, '');
      storage.set(AUTH_SESSION_KEYS.isLoggedIn, 'false');
      storage.set(AUTH_SESSION_KEYS.username, '');
      storage.set(AUTH_SESSION_KEYS.userId, '');
      storage.set(AUTH_SESSION_KEYS.groupId, '');
      storage.set('assignedFloors', '');
      storage.set(AUTH_SESSION_KEYS.picture, '');
      storage.set(AUTH_SESSION_KEYS.locCode, '');
      storage.set(AUTH_SESSION_KEYS.userName, '');
      storage.set(FRESH_LOGIN_FLAG_KEY, '0');
    } catch (error) {
      console.log('[AuthStore] clearSession failed', error);
    } finally {
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      });
    }
  },

  forceLogout: async () => {
    try {
      const mmkvStorage = storage as any;
      if (typeof mmkvStorage.delete === 'function') {
        mmkvStorage.delete(AUTH_SESSION_KEYS.token);
        mmkvStorage.delete(AUTH_SESSION_KEYS.isLoggedIn);
        mmkvStorage.delete(AUTH_SESSION_KEYS.username);
        mmkvStorage.delete(AUTH_SESSION_KEYS.userId);
        mmkvStorage.delete(AUTH_SESSION_KEYS.groupId);
        mmkvStorage.delete('assignedFloors');
      } else {
        storage.set(AUTH_SESSION_KEYS.token, '');
        storage.set(AUTH_SESSION_KEYS.isLoggedIn, 'false');
        storage.set(AUTH_SESSION_KEYS.username, '');
        storage.set(AUTH_SESSION_KEYS.userId, '');
        storage.set(AUTH_SESSION_KEYS.groupId, '');
      }

      storage.set('assignedFloors', '');
      storage.set(FRESH_LOGIN_FLAG_KEY, '0');
    } catch (error) {
      console.log('[AuthStore] forceLogout failed', error);
    } finally {
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      });
    }
  },

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),

  updatePicture: (base64) => {
    if (base64) {
      storage.set(AUTH_SESSION_KEYS.picture, base64);
    } else {
      storage.set(AUTH_SESSION_KEYS.picture, '');
    }
    set((state) => ({
      user: state.user ? { ...state.user, picture: base64 } : null,
    }));
  },
}));