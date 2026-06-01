import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { AUTH_SESSION_KEYS, storage } from './storage';

type AuthUser = {
  userName: string;
  userId: string | number;
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

      let token = mmkvToken;
      let username = mmkvUsername;
      let userId = mmkvUserId;

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

      set({
        token: token || null,
        user: token
          ? {
              userName: username || 'User',
              userId: userId || username || 'User',
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
      userName: normalize(user.userName) || 'User',
      userId: user.userId,
    };

    storage.set(AUTH_SESSION_KEYS.token, nextToken);
    storage.set(AUTH_SESSION_KEYS.isLoggedIn, 'true');
    storage.set(AUTH_SESSION_KEYS.username, String(nextUser.userName));
    storage.set(AUTH_SESSION_KEYS.userId, String(nextUser.userId));
    AsyncStorage.setItem('token', nextToken).catch(() => {});
    AsyncStorage.setItem('username', String(nextUser.userName)).catch(() => {});
    AsyncStorage.setItem('userId', String(nextUser.userId)).catch(() => {});

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
      await AsyncStorage.multiRemove(['token', 'username', 'userId']);
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
      } else {
        storage.set(AUTH_SESSION_KEYS.token, '');
        storage.set(AUTH_SESSION_KEYS.isLoggedIn, 'false');
        storage.set(AUTH_SESSION_KEYS.username, '');
        storage.set(AUTH_SESSION_KEYS.userId, '');
      }

      await AsyncStorage.multiRemove(['token', 'username', 'userId']);
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
