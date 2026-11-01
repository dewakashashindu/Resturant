import { create } from 'zustand';
import { storage } from './storage';

// ─── KDS / BDS system settings ───────────────────────────────────────────────
// These are device-level preferences for the kitchen / bar displays. They are
// kept in MMKV so the board keeps the chosen window after an app restart, and
// the value is sent to the queue API on every poll.

const KDS_SETTINGS_KEY = 'kds_display_settings_v1';

/**
 * How long a finished line stays in the DONE column.
 *   0 = the whole POS business day (no time limit)
 *  >0 = that many minutes, measured with the SQL Server clock (ProDone).
 */
export type DoneWindowMinutes = 5 | 10 | 15 | 30 | 60 | 120 | 0;

export type DoneWindowOption = {
  value: DoneWindowMinutes;
  label: string;
  /** What the board prints under the DONE column title. */
  short: string;
};

export const DONE_WINDOW_OPTIONS: DoneWindowOption[] = [
  { value: 5, label: '5 minutes', short: '5 MIN' },
  { value: 10, label: '10 minutes', short: '10 MIN' },
  { value: 15, label: '15 minutes', short: '15 MIN' },
  { value: 30, label: '30 minutes', short: '30 MIN' },
  { value: 60, label: '1 hour', short: '1 HOUR' },
  { value: 120, label: '2 hours', short: '2 HOURS' },
  { value: 0, label: 'Full day', short: 'FULL DAY' },
];

export const DEFAULT_DONE_WINDOW: DoneWindowMinutes = 30;

export const isDoneWindow = (value: unknown): value is DoneWindowMinutes =>
  DONE_WINDOW_OPTIONS.some((option) => option.value === value);

export const doneWindowOption = (value: DoneWindowMinutes): DoneWindowOption =>
  DONE_WINDOW_OPTIONS.find((option) => option.value === value)
  ?? DONE_WINDOW_OPTIONS.find((option) => option.value === DEFAULT_DONE_WINDOW)!;

type KdsSettingsState = {
  doneWindowMinutes: DoneWindowMinutes;
  setDoneWindowMinutes: (value: DoneWindowMinutes) => void;
};

const readSettings = (): { doneWindowMinutes: DoneWindowMinutes } => {
  try {
    const raw = storage.getString(KDS_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const parsedWindow = Number(parsed?.doneWindowMinutes);
    return {
      doneWindowMinutes: isDoneWindow(parsedWindow) ? parsedWindow : DEFAULT_DONE_WINDOW,
    };
  } catch {
    return { doneWindowMinutes: DEFAULT_DONE_WINDOW };
  }
};

const persistSettings = (doneWindowMinutes: DoneWindowMinutes) => {
  try {
    storage.set(KDS_SETTINGS_KEY, JSON.stringify({ doneWindowMinutes }));
  } catch (error) {
    console.log('[KdsSettings] failed to save settings', error);
  }
};

const initialSettings = readSettings();

export const useKdsSettingsStore = create<KdsSettingsState>((set) => ({
  doneWindowMinutes: initialSettings.doneWindowMinutes,

  setDoneWindowMinutes: (value) => {
    const next = isDoneWindow(value) ? value : DEFAULT_DONE_WINDOW;
    persistSettings(next);
    set({ doneWindowMinutes: next });
  },
}));

// ─── Order Taking — item card size ──────────────────────────────────────────
// The tiled item cards are the busiest surface in the order flow, so staff can
// make them smaller (more items on screen) or bigger (easier to hit). The choice
// is made in Settings → System Setting, never on the order screen itself.
//
// A row is always divided evenly: the chosen size decides how many tiles fit in
// one row, and the row width is then split between them, so the grid has no
// leftover space on the right and no tile pushed off the edge. That also means
// each step of the control must land on a *different* column count — otherwise
// pressing + would do nothing visible. `itemCardOptionsFor()` returns exactly
// those sizes, one per achievable column count.
const ITEM_CARD_SIZE_KEY = 'order_item_card_size_v1';

/** Below this a tile is too small to read, so that column count is dropped. */
const ITEM_CARD_MIN_SIZE = 100;

/** Absolute ceiling on tiles per row, however wide the screen is. */
const ITEM_CARD_MAX_COLS = 10;

export type ItemCardDevice = 'small' | 'phone' | 'tablet';

/** Fallback widths, used only to label / scale a device before it has a grid. */
export const DEFAULT_ITEM_CARD_SIZE: Record<ItemCardDevice, number> = {
  small: 150,
  phone: 165,
  tablet: 195,
};

export const itemCardDeviceFor = (width: number, height: number): ItemCardDevice => {
  if (width >= 600) return 'tablet';
  return height < 700 ? 'small' : 'phone';
};

/** Gutter / padding the order screen uses for the item grid. */
export const itemCardGridFor = (width: number, height: number) => {
  const isTablet = width >= 600;
  const isSmall = height < 700;
  return {
    hPad: isTablet ? 24 : isSmall ? 12 : 16,
    gap: isTablet ? 16 : isSmall ? 10 : 12,
    inner: Math.max(120, width - (isTablet ? 24 : isSmall ? 12 : 16) * 2),
  };
};

/** Most tiles per row this width can show without the tiles getting unreadable. */
export const itemCardMaxColsFor = (inner: number, gap: number): number =>
  Math.max(1, Math.min(ITEM_CARD_MAX_COLS, Math.floor((inner + gap) / (ITEM_CARD_MIN_SIZE + gap))));

/** How many tiles fit in a row at this width. */
export const itemCardColsFor = (size: number, inner: number, gap: number): number =>
  Math.max(1, Math.min(itemCardMaxColsFor(inner, gap), Math.floor((inner + gap) / (size + gap))));

/**
 * One size per achievable column count, biggest card first:
 * `options[0]` = 1 tile per row, `options[1]` = 2 per row, and so on.
 */
export const itemCardOptionsFor = (
  inner: number,
  gap: number,
  minSize: number = ITEM_CARD_MIN_SIZE,
): number[] => {
  const sizes: number[] = [];
  for (let cols = 1; cols <= ITEM_CARD_MAX_COLS; cols += 1) {
    const widest = cols === 1 ? inner : Math.floor((inner - (cols - 1) * gap) / cols);
    if (widest >= minSize) sizes.push(widest);
  }
  return sizes;
};

export type ItemCardStop = {
  /** card width in dp for this stop */
  size: number;
  /** how many tiles fit in a row at this stop */
  cols: number;
  /** short name: XS / S / M / L / XL / XXL */
  label: string;
  /** true for the middle stop — this device's normal size */
  isDefault: boolean;
};

/**
 * The stops of the Settings slider: the device default sits exactly in the
 * middle, one stop to the left is smaller (one more tile per row) and one stop
 * to the right is bigger (one tile fewer per row). Only stops that actually
 * change the grid are included, and both sides are kept the same length so the
 * default really is in the middle of the bar.
 */
export const itemCardStopsFor = (width: number, height: number): ItemCardStop[] => {
  const { inner, gap } = itemCardGridFor(width, height);
  const device = itemCardDeviceFor(width, height);
  const defaultSize = DEFAULT_ITEM_CARD_SIZE[device];

  const widestFor = (cols: number): number =>
    cols === 1 ? inner : Math.floor((inner - (cols - 1) * gap) / cols);
  const maxCols = itemCardMaxColsFor(inner, gap);
  const usable = (cols: number): boolean =>
    cols >= 1 && cols <= maxCols && widestFor(cols) >= ITEM_CARD_MIN_SIZE;

  const defaultCols = itemCardColsFor(defaultSize, inner, gap);

  const smallerCols: number[] = []; // more tiles per row → smaller cards
  for (let cols = defaultCols + 1; usable(cols) && smallerCols.length < 2; cols += 1) {
    smallerCols.push(cols);
  }
  const biggerCols: number[] = []; // fewer tiles per row → bigger cards
  for (let cols = defaultCols - 1; usable(cols) && biggerCols.length < 2; cols -= 1) {
    biggerCols.push(cols);
  }

  // Same number of stops on both sides keeps the default dead centre.
  const reach = Math.min(smallerCols.length, biggerCols.length);
  // Edge case (screen so wide that the default is already the smallest layout):
  // keep whatever single side exists instead of showing a dead control.
  const leftReach = reach > 0 ? reach : smallerCols.length;
  const rightReach = reach > 0 ? reach : biggerCols.length;

  const stops: ItemCardStop[] = [];
  for (let i = leftReach; i >= 1; i -= 1) {
    const cols = smallerCols[i - 1];
    const size = widestFor(cols);
    stops.push({ size, cols, label: itemCardSizeLabel(size, device), isDefault: false });
  }
  stops.push({
    size: defaultSize,
    cols: defaultCols,
    label: itemCardSizeLabel(defaultSize, device),
    isDefault: true,
  });
  for (let i = 1; i <= rightReach; i += 1) {
    const cols = biggerCols[i - 1];
    const size = widestFor(cols);
    stops.push({ size, cols, label: itemCardSizeLabel(size, device), isDefault: false });
  }
  return stops;
};

/** Index of the stop closest to the size currently saved on this device. */
export const itemCardStopIndexFor = (stops: ItemCardStop[], size: number): number => {
  let best = 0;
  stops.forEach((stop, index) => {
    if (Math.abs(stop.size - size) < Math.abs(stops[best].size - size)) best = index;
  });
  return best;
};

/**
 * Move one row further out or in. `+` (direction 1) = bigger cards = one tile
 * fewer per row; `−` = smaller cards = one tile more per row. Because every
 * option is the widest size for its own column count, each press is guaranteed
 * to change the grid on screen — no dead presses.
 */
export const stepItemCardSizeIn = (
  currentSize: number,
  options: number[],
  direction: 1 | -1,
  inner: number,
  gap: number,
): number => {
  if (options.length === 0) return currentSize;
  const cols = itemCardColsFor(currentSize, inner, gap);
  const targetCols = Math.min(options.length, Math.max(1, cols - direction));
  return options[targetCols - 1] ?? currentSize;
};

export const itemCardSizeLabel = (size: number, device: ItemCardDevice = 'phone'): string => {
  const ratio = size / DEFAULT_ITEM_CARD_SIZE[device];
  if (ratio < 0.85) return 'XS';
  if (ratio < 0.95) return 'S';
  if (ratio <= 1.05) return 'M';
  if (ratio <= 1.45) return 'L';
  if (ratio <= 2.4) return 'XL';
  return 'XXL';
};

/** Stored override, or null when the device default should be used. */
export const readItemCardSize = (): number | null => {
  try {
    const parsed = Number(storage.getString(ITEM_CARD_SIZE_KEY));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
  } catch {
    return null;
  }
};

export const writeItemCardSize = (size: number | null): void => {
  try {
    if (size === null) storage.delete(ITEM_CARD_SIZE_KEY);
    else storage.set(ITEM_CARD_SIZE_KEY, String(Math.round(size)));
  } catch (error) {
    console.log('[KdsSettings] failed to save item card size', error);
  }
};

/**
 * Shared, reactive card size. Settings → System Setting changes it, the order
 * screen reads it live, so both stay in step without a reload.
 * `size === null` means "this device has never changed it" → device default.
 */
type ItemCardSizeState = {
  size: number | null;
  setSize: (size: number | null) => void;
  stepSize: (
    currentSize: number,
    direction: 1 | -1,
    options: number[],
    inner: number,
    gap: number,
  ) => number;
  resetSize: () => void;
};

export const useItemCardSizeStore = create<ItemCardSizeState>((set, get) => ({
  size: readItemCardSize(),

  setSize: (size) => {
    writeItemCardSize(size);
    set({ size: size === null ? null : Math.round(size) });
  },

  // `currentSize` is what the caller is showing right now (stored value, or this
  // device's default when nothing is stored), so the first press always moves
  // away from what the user can actually see on screen.
  stepSize: (currentSize, direction, options, inner, gap) => {
    const next = stepItemCardSizeIn(currentSize, options, direction, inner, gap);
    get().setSize(next);
    return next;
  },

  resetSize: () => {
    writeItemCardSize(null);
    set({ size: null });
  },
}));

/** Card width a screen should use, given its device default. */
export const itemCardSizeFor = (size: number | null, device: ItemCardDevice): number =>
  size ?? DEFAULT_ITEM_CARD_SIZE[device];
