import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { syncGlobalOrderDescriptions } from '../services/api';
import { useAuthStore } from '../services/authStore';
import useItemStore from '../services/itemStore';

import { AppProvider } from '../AppContext';

void SplashScreen.preventAutoHideAsync().catch(() => {});

// Background ගිය timestamp save/read කරන key
const BG_TIMESTAMP_KEY = 'app_background_timestamp';
const AUTO_LOGOUT_DELAY_MS = 1 * 60 * 1000; // 1 minute

export const unstable_settings = {
  anchor: 'auth/login',
};

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#002748" />
    </View>
  );
}

function AuthGate() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const token = useAuthStore((state) => state.token);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
  const clearSession = useAuthStore((state) => state.clearSession);
  const hydrateItems = useItemStore((state) => state.hydrateItems);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isAuthenticated = Boolean(token);

  // App start වෙද්දී — background ගිය time check කරලා logout වෙන්නද බලනවා
  useEffect(() => {
    void syncGlobalOrderDescriptions();
    void hydrateItems().catch((error) => {
      console.log('[AuthGate] hydrateItems failed', error);
    });
    void hydrateAuth()
      .catch((error) => {
        console.log('[AuthGate] hydrateAuth failed', error);
      })
      .finally(async () => {
        // App open වෙද්දී — background timestamp check
        try {
          const { storage } = await import('../services/storage');
          const savedTs = storage.getString(BG_TIMESTAMP_KEY);
          if (savedTs) {
            const elapsed = Date.now() - Number(savedTs);
            console.log('[AuthGate] Time since background:', Math.round(elapsed / 1000), 's');
            if (elapsed >= AUTO_LOGOUT_DELAY_MS) {
              console.log('[AuthGate] Auto-logout triggered on app open');
              await clearSession();
            }
            storage.set(BG_TIMESTAMP_KEY, '');
          }
        } catch (err) {
          console.log('[AuthGate] background timestamp check failed', err);
        }
        void SplashScreen.hideAsync().catch(() => {});
      });
  }, [hydrateAuth, hydrateItems, clearSession]);

  // Redirect — isAuthenticated change වෙද්දී
  useEffect(() => {
    if (!isHydrated || !rootNavigationState?.key) return;

    const target = isAuthenticated ? '/(tabs)' : '/auth/login';
    const timer = setTimeout(() => {
      router.replace(target);
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthenticated, isHydrated, router, rootNavigationState?.key]);

  // AppState listener — background ගිය time MMKV ගේ save කරනවා
  // App kill කළාත් timestamp persist වෙනවා → next open ගේ check කරනවා
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      const wentBackground =
        (nextAppState === 'background' || nextAppState === 'inactive') &&
        previousAppState === 'active';

      const resumed =
        (previousAppState === 'background' || previousAppState === 'inactive') &&
        nextAppState === 'active';

      if (wentBackground) {
        // Background ගිය exact time save කරනවා
        try {
          const { storage } = await import('../services/storage');
          storage.set(BG_TIMESTAMP_KEY, String(Date.now()));
          console.log('[AuthGate] Background timestamp saved');
        } catch (err) {
          console.log('[AuthGate] Failed to save background timestamp', err);
        }
      }

      if (resumed) {
        // Foreground ආවම — background timestamp check කරලා logout කරන්නද බලනවා
        try {
          const { storage } = await import('../services/storage');
          const savedTs = storage.getString(BG_TIMESTAMP_KEY);
          if (savedTs) {
            const elapsed = Date.now() - Number(savedTs);
            console.log('[AuthGate] Resumed after', Math.round(elapsed / 1000), 's');
            if (elapsed >= AUTO_LOGOUT_DELAY_MS) {
              console.log('[AuthGate] Auto-logout triggered on resume');
              storage.set(BG_TIMESTAMP_KEY, '');
              await clearSession();
            } else {
              storage.set(BG_TIMESTAMP_KEY, '');
            }
          }
        } catch (err) {
          console.log('[AuthGate] Failed to check background timestamp on resume', err);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [clearSession]);

  if (!isHydrated) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth/forgotpassword" options={{ headerShown: false }} />
      <Stack.Screen name="auth/resetpassword" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/operation" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/tableselection" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/definetable" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/paxcount" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/selectitems" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/cart" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/settings" options={{ headerShown: false }} />
      <Stack.Screen name="auth/changepassword" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/BillingScreen" options={{ headerShown: false }} />
      <Stack.Screen name="Screens/manageaccess" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthGate />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff00',
  },
});