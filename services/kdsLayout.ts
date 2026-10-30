import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { storage } from './storage';

// ─── KDS / BDS / Settings screen layout ─────────────────────────────────────
// One place that decides how the board and the settings page lay themselves
// out, so the same code works on
//   • a normal phone (portrait),
//   • a phone / tablet held sideways (landscape),
//   • the kitchen TV that is driven by an Android box (always landscape,
//     roughly 960 × 540 dp on a 1080p panel, and often overscanned).
// The choice is stored in MMKV because it is a per-device preference: the TV
// box wants "TV", a steward's phone wants the automatic behaviour.

const LAYOUT_SETTINGS_KEY = 'kds_layout_settings_v1';

export type ScreenMode = 'auto' | 'phone' | 'tv';

export type ScreenModeOption = {
  value: ScreenMode;
  label: string;
  hint: string;
};

export const SCREEN_MODE_OPTIONS: ScreenModeOption[] = [
  { value: 'auto', label: 'Automatic', hint: 'Detect the layout from the screen size' },
  { value: 'phone', label: 'Phone / Tablet', hint: 'Compact phone and tablet spacing' },
  { value: 'tv', label: 'TV / Large screen', hint: 'Kitchen TV driven by an Android box' },
];

export const DEFAULT_SCREEN_MODE: ScreenMode = 'auto';

export const isScreenMode = (value: unknown): value is ScreenMode =>
  SCREEN_MODE_OPTIONS.some((option) => option.value === value);

export const screenModeOption = (value: ScreenMode): ScreenModeOption =>
  SCREEN_MODE_OPTIONS.find((option) => option.value === value)
  ?? SCREEN_MODE_OPTIONS[0];

type KdsLayoutState = {
  screenMode: ScreenMode;
  setScreenMode: (value: ScreenMode) => void;
};

const readScreenMode = (): ScreenMode => {
  try {
    const raw = storage.getString(LAYOUT_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return isScreenMode(parsed?.screenMode) ? parsed.screenMode : DEFAULT_SCREEN_MODE;
  } catch {
    return DEFAULT_SCREEN_MODE;
  }
};

const persistScreenMode = (screenMode: ScreenMode) => {
  try {
    storage.set(LAYOUT_SETTINGS_KEY, JSON.stringify({ screenMode }));
  } catch (error) {
    console.log('[KdsLayout] failed to save screen mode', error);
  }
};

const initialScreenMode = readScreenMode();

export const useKdsLayoutStore = create<KdsLayoutState>((set) => ({
  screenMode: initialScreenMode,

  setScreenMode: (value) => {
    const next = isScreenMode(value) ? value : DEFAULT_SCREEN_MODE;
    persistScreenMode(next);
    set({ screenMode: next });
  },
}));

// ─── Pure geometry helper ───────────────────────────────────────────────────

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export type KdsLayoutInput = {
  width: number;
  height: number;
  insetsTop: number;
  insetsBottom: number;
  insetsLeft: number;
  insetsRight: number;
  screenMode: ScreenMode;
};

export type KdsLayout = {
  screenMode: ScreenMode;
  isLandscape: boolean;
  isTv: boolean;
  isTablet: boolean;
  compactChrome: boolean;
  scale: number;
  headerMinHeight: number;
  headerPaddingTop: number;
  headerPaddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  filterPaddingVertical: number;
  summaryPaddingVertical: number;
  columnHeaderMinHeight: number;
  boardPadding: number;
  showEyebrow: boolean;
  showCardHint: boolean;
  sheetMaxWidth?: number;
  sheetMaxHeight: `${number}%`;
  searchDropdownMaxHeight: number;
};

/**
 * A TV / Android box reports ~960 × 540 dp on a 1080p panel, ~1280 × 720 dp on
 * a 720p one and ~1920 × 1080 dp on a 4K one.
 *
 * The height threshold is what separates a TV from a phone held sideways: a
 * modern phone in landscape is very wide (Pixel 7 = 915 × 412 dp, iPhone 14 =
 * 844 × 390 dp) but never more than ~430 dp tall. Comparing the width alone
 * would mistake every phone in landscape for a television — that bug made the
 * "portrait only" screens stay landscape.
 */
export const looksLikeTv = (width: number, height: number): boolean => {
  if (width <= height) return false;                    // a tablet in portrait is not a TV
  if (height < 480) return false;                       // phones in landscape stop at ~430 dp
  if (width < 800) return false;
  return width / height >= 1.5;                         // 4:3 tablets are not TVs either
};

export function resolveKdsLayout(input: KdsLayoutInput): KdsLayout {
  const { width, height, screenMode } = input;
  const isLandscape = width > height;
  const isTv = screenMode === 'tv' || (screenMode === 'auto' && looksLikeTv(width, height));
  const isTablet = !isTv && Math.min(width, height) >= 520;
  const compactChrome = isTv || isLandscape;

  // Scale key: the scarce dimension wins. A landscape phone only has ~360 dp
  // of height, while a TV has ~540 dp of height but is watched from far away,
  // so it keeps a normal (even slightly larger) type size instead of shrinking.
  let scale: number;
  if (isTv) {
    scale = clamp(height / 500, 1, 1.2);
  } else if (isLandscape) {
    scale = clamp(height / 760, 0.72, 1);
  } else if (isTablet) {
    scale = clamp(width / 400, 1.32, 1.5);
  } else if (height < 700) {
    scale = 0.88;
  } else {
    scale = 1;
  }

  // Chrome: on a TV the header must not eat a quarter of the panel, and on any
  // landscape phone it must stay a thin strip so all three columns fit.
  const headerMinHeight = isTv ? 84 : isLandscape ? 58 : 112;
  const headerPaddingTop = compactChrome ? Math.max(input.insetsTop, 4) : Math.max(input.insetsTop, 10);
  const headerPaddingBottom = isTv ? 10 : isLandscape ? 6 : 17;

  // Overscan: many TVs cut the outer 3–5 %, so the TV tier keeps a wider
  // margin than the safe-area insets report.
  const overscan = isTv ? 22 : 0;
  const paddingLeft = Math.max(input.insetsLeft, overscan, compactChrome ? 12 : 0);
  const paddingRight = Math.max(input.insetsRight, overscan, compactChrome ? 12 : 0);

  const filterPaddingVertical = isTv ? 6 : isLandscape ? 4 : 8;
  const summaryPaddingVertical = isTv ? 6 : isLandscape ? 4 : 9;
  const columnHeaderMinHeight = isTv ? 46 : isLandscape ? 34 : 49;
  const boardPadding = isTv ? 10 : isLandscape ? 6 : 7;

  const sheetMaxWidth = isTv ? 900 : isLandscape ? 760 : undefined;
  const sheetMaxHeight: `${number}%` = isLandscape ? '92%' : '86%';

  const searchReserved = isTv ? 120 : isLandscape ? 110 : 180;
  const searchDropdownMaxHeight = Math.max(
    200 * scale,
    Math.min((isTv ? 420 : 540) * scale, height - searchReserved),
  );

  return {
    screenMode,
    isLandscape,
    isTv,
    isTablet,
    compactChrome,
    scale,
    headerMinHeight,
    headerPaddingTop,
    headerPaddingBottom,
    paddingLeft,
    paddingRight,
    filterPaddingVertical,
    summaryPaddingVertical,
    columnHeaderMinHeight,
    boardPadding,
    showEyebrow: !compactChrome,
    showCardHint: !compactChrome,
    sheetMaxWidth,
    sheetMaxHeight,
    searchDropdownMaxHeight,
  };
}

/** Device-aware layout for the KDS / BDS board and the settings page. */
export function useKdsLayout(): KdsLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const screenMode = useKdsLayoutStore((state) => state.screenMode);

  return useMemo(
    () => resolveKdsLayout({
      width,
      height,
      insetsTop: insets.top,
      insetsBottom: insets.bottom,
      insetsLeft: insets.left,
      insetsRight: insets.right,
      screenMode,
    }),
    [width, height, insets.top, insets.bottom, insets.left, insets.right, screenMode],
  );
}

/** True when the running device behaves like a fixed TV panel (no rotation). */
export const useIsLargeDisplay = () => {
  const { width, height } = useWindowDimensions();
  const screenMode = useKdsLayoutStore((state) => state.screenMode);
  if (screenMode === 'tv') return true;                 // explicit Setting wins
  if (screenMode === 'phone') return false;             // explicit Setting wins
  if (Platform.isTV) return true;                       // Android TV / tvOS build
  return looksLikeTv(width, height);
};
