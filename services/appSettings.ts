import { create } from 'zustand';
import { storage } from './storage';

// ─── App settings ────────────────────────────────────────────────────────────
// Device-level switches chosen in Settings -> System Setting. They are kept in
// MMKV so the choice survives an app restart, and they are read straight from
// the store wherever they are needed (no prop drilling, no re-fetch).

const APP_SETTINGS_KEY = 'app_settings_v1';

export type AppSettings = {
  /**
   * Sign the user out as soon as the customer details popup is answered.
   *
   * It only applies to the popup that opens by itself after an order is
   * confirmed, never to one opened by hand from the bill header. Off unless
   * someone turns it on.
   */
  autoLogoutAfterCustomerPrompt: boolean;
  /**
   * Hide the photo above every item tile on the item selection screen.
   *
   * Off by default: the tile shows the item photo when one is cached on this
   * device. Turning it on leaves the same tiles with the name, the price and
   * the buttons only - the card size control keeps working either way.
   */
  hideItemImages: boolean;
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  autoLogoutAfterCustomerPrompt: false,
  hideItemImages: false,
};

const readSettings = (): AppSettings => {
  try {
    const raw = storage.getString(APP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_APP_SETTINGS };
    // Anything unreadable falls back to off: a corrupt value must never start
    // signing people out on its own.
    return {
      autoLogoutAfterCustomerPrompt: (parsed as any).autoLogoutAfterCustomerPrompt === true,
      hideItemImages: (parsed as any).hideItemImages === true,
    };
  } catch (error) {
    console.log('[AppSettings] failed to read settings', error);
    return { ...DEFAULT_APP_SETTINGS };
  }
};

const persistSettings = (settings: AppSettings) => {
  try {
    storage.set(APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.log('[AppSettings] failed to save settings', error);
  }
};

type AppSettingsState = AppSettings & {
  setAutoLogoutAfterCustomerPrompt: (value: boolean) => void;
  setHideItemImages: (value: boolean) => void;
};

const initialSettings = readSettings();

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  ...initialSettings,

  setAutoLogoutAfterCustomerPrompt: (value) => {
    const next = value === true;
    persistSettings({ ...get(), autoLogoutAfterCustomerPrompt: next });
    set({ autoLogoutAfterCustomerPrompt: next });
  },

  setHideItemImages: (value) => {
    const next = value === true;
    persistSettings({ ...get(), hideItemImages: next });
    set({ hideItemImages: next });
  },
}));
