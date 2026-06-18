import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { syncGlobalOrderDescriptions } from '../services/api';
import { useAuthStore } from '../services/authStore';
import useItemStore from '../services/itemStore';


import { AppProvider } from '../AppContext';

// Keep the splash screen visible while we fetch resources
void SplashScreen.preventAutoHideAsync().catch(() => {});

const AUTO_LOGOUT_DELAY_MS = 1 * 60 * 1000;

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
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthenticated = Boolean(token);

  useEffect(() => {
    void syncGlobalOrderDescriptions();
    void hydrateItems().catch((error) => {
      console.log('[AuthGate] hydrateItems failed', error);
    });
    void hydrateAuth()
      .catch((error) => {
        console.log('[AuthGate] hydrateAuth failed', error);
      })
      .finally(() => {
        void SplashScreen.hideAsync().catch(() => {});
      });

    return () => {
      // no-op cleanup
    };
  }, [hydrateAuth, hydrateItems]);

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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      const resumed =
        (previousAppState === 'background' || previousAppState === 'inactive')
        && nextAppState === 'active';

      const wentBackground = nextAppState === 'background' || nextAppState === 'inactive';

      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }

      if (wentBackground) {
        logoutTimerRef.current = setTimeout(() => {
          void clearSession().catch((error) => {
            console.log('[AuthGate] clearSession failed during auto-logout', error);
          });
        }, AUTO_LOGOUT_DELAY_MS);
      }

      if (!resumed) return;
    });

    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
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
    
    <AppProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});