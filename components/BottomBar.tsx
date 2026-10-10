import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
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
import { useAuthStore } from '../services/authStore';
import { useNotificationStore } from '../services/notificationStore';

// ─── Screens that belong to the Order Taking flow ───────────────────────────
const ORDER_TAKING_SCREENS = [
  'operation', 'tableselection', 'definetable', 'paxcount',
  'selectitems', 'cart', 'BillingScreen', 'TakeAway', 'manageaccess',
];

const TABS = [
  {
    name: 'index',
    label: 'Home',
    icon: 'home' as React.ComponentProps<typeof Ionicons>['name'],
    route: '/(tabs)/',
  },
  {
    name: 'operation',
    label: 'Order Taking',
    icon: 'receipt-outline' as React.ComponentProps<typeof Ionicons>['name'],
    route: '/Screens/operation',
  },
  {
    name: 'notifications',
    label: 'Alerts',
    icon: 'notifications-outline' as React.ComponentProps<typeof Ionicons>['name'],
    route: '/Screens/notifications',
  },
] as const;

const BAR_COLOR = 'rgb(66, 118, 164)';

export const BOTTOM_BAR_HEIGHT = 72;

// ─── Component ───────────────────────────────────────────────────────────────
export default function BottomBar() {
  const router   = useRouter();
  const segments = useSegments();
  const insets   = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const clearSession = useAuthStore((s) => s.clearSession);
  const unreadCount = useNotificationStore((s) => s.unreadCount());

  // ── Hide Android OS navigation bar ────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    NavigationBar.setVisibilityAsync('hidden');
    NavigationBar.setBehaviorAsync('overlay-swipe');

    return () => {
      NavigationBar.setVisibilityAsync('visible');
    };
  }, []);

  // ── Responsive sizing ──────────────────────────────────────────────────────
  const isTablet     = width >= 600;
  const isLandscape  = width > height;
  const isSmallPhone = width < 360;
  const iconSize         = isTablet ? 30 : isSmallPhone ? 20 : 24;
  const textSize         = isTablet ? 15 : isSmallPhone ? 10 : 12;
  const navContentHeight = isTablet ? 64 : isLandscape ? 48 : 56;
  const horizontalInset  = Math.max(insets.left, insets.right);

  // ── Active tab detection ───────────────────────────────────────────────────
  const currentSegment = segments[segments.length - 1] ?? '';
  const activeTabName: string = currentSegment === 'notifications'
    ? 'notifications'
    : ORDER_TAKING_SCREENS.includes(currentSegment)
      ? 'operation'
      : 'index';

  // ── Logout ────────────────────────────────────────────────────────────────
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
    <View style={styles.wrapper}>
      <View
        style={[
          styles.bar,
          {
            paddingBottom: Math.max(insets.bottom, 8),
            paddingLeft:   horizontalInset,
            paddingRight:  horizontalInset,
            minHeight:     navContentHeight + Math.max(insets.bottom, 8),
          },
        ]}
      >
        {/* ── Home + Order Taking ── */}
        {TABS.map((tab) => {
          const isActive = activeTabName === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.navItem, { minHeight: navContentHeight }]}
              onPress={() => router.push(tab.route as any)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={tab.icon} size={iconSize} color="#fff" />
                {tab.name === 'notifications' && unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.navText, { fontSize: textSize }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Tablet divider */}
        {isTablet && <View style={styles.divider} />}

        {/* ── Logout ── */}
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: BAR_COLOR,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: BAR_COLOR,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    paddingVertical: 6,
    gap: 2,
    position: 'relative',
  },
  navText: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 3,
  },
  iconWrap: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -11,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: BAR_COLOR,
    backgroundColor: '#E84B4B',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});