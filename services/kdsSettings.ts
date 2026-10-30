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
