import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { AUTH_SESSION_KEYS, storage } from './storage';

type AuthUser = {
  userName: string;
  userId: string | number;
  groupId: string | number; 
  assignedFloors?: string[];
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

      let token = mmkvToken;
      let username = mmkvUsername;
      let userId = mmkvUserId;
      let groupId = mmkvGroupId; 

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
              userName: username || 'User',
              userId: userId || username || 'User',
              groupId: groupId || '1', 
              assignedFloors: assignedFloors,
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
    };

    storage.set(AUTH_SESSION_KEYS.token, nextToken);
    storage.set(AUTH_SESSION_KEYS.isLoggedIn, 'true');
    storage.set(AUTH_SESSION_KEYS.username, String(nextUser.userName));
    storage.set(AUTH_SESSION_KEYS.userId, String(nextUser.userId));
    storage.set(AUTH_SESSION_KEYS.groupId, String(nextUser.groupId));

storage.set('assignedFloors', JSON.stringify(nextUser.assignedFloors));

   AsyncStorage.setItem('token', nextToken).catch(() => {});
    AsyncStorage.setItem('username', String(nextUser.userName)).catch(() => {});
    AsyncStorage.setItem('userId', String(nextUser.userId)).catch(() => {});
    AsyncStorage.setItem('groupId', String(nextUser.groupId)).catch(() => {});
    AsyncStorage.setItem('assignedFloors', JSON.stringify(nextUser.assignedFloors)).catch(() => {});

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
      await AsyncStorage.multiRemove(['token', 'username', 'userId', 'groupId', 'assignedFloors']);
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
      await AsyncStorage.multiRemove(['token', 'username', 'userId', 'groupId', 'assignedFloors']);
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
}));