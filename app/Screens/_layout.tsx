import { Slot, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomBar from '../../components/BottomBar';
import { useCartStore } from '../../services/cartStore';
import { useOrderStore } from '../../services/orderStore';

// ─── Screens that are considered "entry points" ───────────────────────────────
// Navigating TO any of these means the user has left the billing/cart flow
// and any in-progress order state should be wiped so the next order starts clean.
const RESET_ON_ENTER: string[] = [
  '/Screens/operation',   // Home / table selection
  '/Screens/TakeAway',    // Take Away entry screen
];

export default function ScreensLayout() {
  const pathname        = usePathname();
  const prevPathnameRef = useRef<string>('');

  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    // Only act when the pathname actually changes AND the new screen is one
    // of the "reset" entry points. We skip the very first render (prev === '')
    // so that a hard-refresh into /operation doesn't wipe a partially-loaded session.
    if (!prev || prev === pathname) return;

    const shouldReset = RESET_ON_ENTER.some((p) => pathname.startsWith(p));
    if (!shouldReset) return;

    // Wipe cart + confirmed order so the next new order starts clean.
    // cartStore.clearCart() already resets orderType → null (fix from previous PR).
    useCartStore.getState().clearCart();
    useOrderStore.getState().clearLastConfirmedOrder();

    console.log('[Layout] Navigated to entry screen — order state cleared.', { from: prev, to: pathname });
  }, [pathname]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>
      <BottomBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
});