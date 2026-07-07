import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../services/authStore';

// ─── Breakpoints ────────────────────────────────────────────────────────────
// Small phone  : width < 360
// Phone        : 360 ≤ width < 600
// Tablet       : width ≥ 600
// Landscape    : height < width  (supplementary flag)

function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isLandscape = width > height;
  const isSmallPhone = width < 360;

  // Icon / text scale
  const iconSize = isTablet ? 30 : isSmallPhone ? 20 : 24;
  const textSize = isTablet ? 15 : isSmallPhone ? 10 : 12;

  // Tap-target height (Android 48 dp minimum, comfortable 56-64 on larger)
  const navContentHeight = isTablet ? 64 : isLandscape ? 48 : 56;

  return { isTablet, isLandscape, isSmallPhone, iconSize, textSize, navContentHeight };
}

// ─── Custom Bottom Bar ───────────────────────────────────────────────────────

function CustomBottomBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearSession = useAuthStore((s) => s.clearSession);
  const { iconSize, textSize, navContentHeight, isTablet } = useBreakpoint();

  // Landscape on Android: cutout can be on left/right, not just bottom
  const horizontalInset = Math.max(insets.left, insets.right);

  const handleLogout = useCallback(async () => {
    await clearSession();
    router.replace('/auth/login');
  }, [clearSession, router]);

  const confirmLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => void handleLogout() },
    ]);
  }, [handleLogout]);

  return (
    // Outer wrapper fills the rounded-corner gaps with the same bar colour.
    // Without this, the screen background bleeds through the top corners.
    <View style={styles.bottomNavWrapper}>
    <View
      style={[
        styles.bottomNav,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          paddingLeft: horizontalInset,
          paddingRight: horizontalInset,
          minHeight: navContentHeight + Math.max(insets.bottom, 8),
        },
      ]}
    >
      {/* Home */}
      <TouchableOpacity
        style={[styles.navItem, { minHeight: navContentHeight }]}
        onPress={() => navigation.navigate(state.routeNames[0])}
        accessibilityRole="button"
        accessibilityLabel="Home"
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      >
        <Ionicons name="home" size={iconSize} color="#fff" />
        <Text
          style={[styles.navText, { fontSize: textSize }]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          Home
        </Text>
      </TouchableOpacity>

      {/* Divider — visible but subtle on tablets */}
      {isTablet && <View style={styles.divider} />}

      {/* Logout */}
      <TouchableOpacity
        style={[styles.navItem, { minHeight: navContentHeight }]}
        onPress={confirmLogout}
        accessibilityRole="button"
        accessibilityLabel="Logout"
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      >
        <MaterialCommunityIcons name="logout" size={iconSize} color="#fff" />
        <Text
          style={[styles.navText, { fontSize: textSize }]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          Logout
        </Text>
      </TouchableOpacity>
    </View>
    </View>
  );
}

// ─── Tab Layout ──────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomBottomBar {...props} />}
    >
      <Tabs.Screen name="index" />
    </Tabs>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BAR_COLOR = 'rgb(66, 118, 164)';

const styles = StyleSheet.create({
  // Wrapper fills the gap behind the rounded corners with the same colour,
  // so the screen background never bleeds through on either platform.
  bottomNavWrapper: {
    backgroundColor: BAR_COLOR,
    overflow: 'hidden',
  },

  bottomNav: {
    // NOT absolute — rendered by the navigator in the correct layer so it
    // never overlaps scrollable content and works with both gesture nav and
    // 3-button nav on Android automatically.
    width: '100%',
    backgroundColor: BAR_COLOR,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // Elevation keeps the bar above content on Android without z-index hacks.
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
    }),
  },

  navItem: {
    // flex: 1 makes each item share width equally regardless of label length.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Minimum 48 dp touch target (Android accessibility guideline).
    minWidth: 48,
    paddingVertical: 6,
    gap: 2,
  },

  navText: {
    color: '#fff',
    fontWeight: '500',
    marginTop: 3,
  },

  divider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});