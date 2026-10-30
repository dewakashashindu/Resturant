import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions, Platform } from 'react-native';

import { looksLikeTv } from './kdsLayout';

// ─── Screen orientation ─────────────────────────────────────────────────────
// Two groups of screens:
//
//   • FREE    — KDS, BDS, Settings (and the pages that hang off them) plus the
//               login / sign-up flow. These follow the device, exactly like any
//               ordinary app: hold the phone upright and they are portrait, turn
//               the phone sideways (with auto-rotate on) and they become
//               landscape. Nothing is forced.
//   • PINNED  — every other screen (dashboard, order taking, menu, cart …).
//               Those are portrait all the time, whatever the device does.
//
// app.json ships "orientation": "default" so the operating system is allowed to
// rotate at all — an Android TV box has no accelerometer, so without that flag
// the whole app is forced sideways on a TV.

/** Routes that follow the device orientation instead of being pinned portrait. */
export const ROTATABLE_ROUTES = [
  '/Screens/KDSHomeScreen',
  '/Screens/BDSHomeScreen',
  '/Screens/settings',
  // Pages reached from the board keep the board's behaviour.
  '/Screens/kds-unavailable',
  '/Screens/kds-dashboard',
  // Sign-in flow — a steward can type the password in either position.
  '/auth/login',
  '/auth/signup',
  '/auth/forgotpassword',
  '/auth/resetpassword',
] as const;

/**
 * A TV / Android box has no accelerometer, so it must never be told to "go
 * portrait" — that would draw the whole UI rotated 90° on the television.
 *
 * The detection is shared with the layout engine (`looksLikeTv`), which keeps a
 * phone held sideways (≈ 915 × 412 dp) out of the TV tier; mistaking it for a
 * television is what left the portrait-only screens stuck in landscape.
 */
export const isLargeDisplayWindow = (width: number, height: number): boolean =>
  Platform.isTV || looksLikeTv(width, height);

export const isLargeDisplay = (): boolean => {
  if (Platform.isTV) return true;
  const { width, height } = Dimensions.get('window');
  return isLargeDisplayWindow(width, height);
};

export const isRotatableRoute = (pathname: string | null | undefined): boolean => {
  if (!pathname) return false;
  return ROTATABLE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
};

/** Kept for callers that only care about the two boards. */
export const isBoardRoute = (pathname: string | null | undefined): boolean => {
  if (!pathname) return false;
  return ['/Screens/KDSHomeScreen', '/Screens/BDSHomeScreen'].some((route) => pathname.startsWith(route));
};

/**
 * Apply the rule for one route.
 *
 * `rotatable` screens are released back to the device sensor — that is what
 * makes them portrait when the phone is upright and landscape when it is turned
 * (and it respects the system auto-rotate switch: with the switch off Android
 * keeps them upright, which is the expected behaviour).
 *
 * Everything else is pinned to portrait. `isLargeDisplay` (a TV / Android box)
 * is never pinned, because a fixed panel has no second orientation and pinning
 * it would draw the whole UI rotated 90° on the television.
 */
export async function applyRouteOrientation(
  rotatable: boolean,
  isLargeDisplay: boolean,
): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    if (rotatable || isLargeDisplay) {
      // UNSPECIFIED: "let the device decide".
      await ScreenOrientation.unlockAsync();
      return;
    }

    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch (error) {
    // A platform that cannot honour the request (e.g. a multi-window tablet on
    // Android 12+) must not break the screen — the layout is responsive too.
    console.log('[Orientation] could not apply orientation', error);
  }
}

/**
 * Runs before the first screen is mounted.
 *
 * The app ships with "orientation": "default" so that rotation is allowed at
 * all. This primes the very first frame in portrait, which removes the short
 * window where a non-board screen could still be drawn sideways while React is
 * booting. On a TV the call is skipped, because the panel is already in its
 * only position.
 */
export function primeOrientation(): void {
  if (Platform.OS === 'web') return;
  const largeDisplay = isLargeDisplay();
  void applyRouteOrientation(false, largeDisplay);
}
