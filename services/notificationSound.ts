import { Audio } from 'expo-av';

const notificationChime = require('../assets/sounds/notification_chime.wav');
// The To Do alert used by the KDS / BDS board: a metal bell struck three times
// ("Alarm Bell ×3"). It is deliberately sharper than the notification chime so
// it still cuts through kitchen fan / exhaust noise.
const newOrderAlert = require('../assets/sounds/new_order_alert.wav');

let audioModeReady = false;

/**
 * Screen-scoped mute.
 *
 * A board (KDS / BDS) asks for silence while it is on screen and clears it the
 * moment it loses focus, so a steward can stop the ringing for a moment without
 * touching the permanent Settings > Notification Sound switch. Nothing here is
 * persisted: leaving the screen always restores the sound.
 */
let screenSoundMuted = false;

export const setScreenSoundMuted = (muted: boolean): void => {
  screenSoundMuted = Boolean(muted);
};

export const isScreenSoundMuted = (): boolean => screenSoundMuted;

// Several To Do lines can arrive in the same poll. One alarm per burst is
// enough — a second one within this window would just be noise.
const NEW_ORDER_ALERT_GAP_MS = 2000;
let lastNewOrderAlertAt = 0;
// The alert currently playing, so a repeat can cut it instead of overlapping.
let activeAlertSound: Audio.Sound | null = null;

const ensureAudioMode = async (duckAndroid: boolean): Promise<void> => {
  // Ducking is intentionally OFF for the queue alert: when another app is
  // talking, the bell must still be heard at full level.
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: duckAndroid,
    playThroughEarpieceAndroid: false,
  });
  audioModeReady = true;
};

/**
 * Plays the bundled chime directly through the foreground app audio channel.
 * This avoids relying solely on Android's notification-channel sound, which
 * some devices suppress while the app itself is active.
 */
export const playForegroundNotificationSound = async (): Promise<boolean> => {
  let sound: Audio.Sound | null = null;
  try {
    if (screenSoundMuted) return false;
    if (!audioModeReady) await ensureAudioMode(true);

    const result = await Audio.Sound.createAsync(notificationChime, {
      shouldPlay: true,
      volume: 1,
      isLooping: false,
    });
    sound = result.sound;

    // Release native playback memory after the short alert file finishes.
    setTimeout(() => {
      void sound?.unloadAsync().catch(() => {});
    }, 1800);
    return true;
  } catch (error) {
    console.log('[Notifications] foreground sound failed', error);
    if (sound) void sound.unloadAsync().catch(() => {});
    return false;
  }
};

/**
 * The KDS / BDS "new order in To Do" alarm — Alarm Bell ×3.
 *
 * Silent when the current screen is muted. Repeats inside NEW_ORDER_ALERT_GAP_MS
 * are skipped, so five orders arriving at once ring once, not five times.
 * `force` is only for the Settings preview button.
 */
export const playNewOrderAlert = async (options?: { force?: boolean }): Promise<boolean> => {
  if (screenSoundMuted && !options?.force) return false;

  const now = Date.now();
  if (!options?.force && now - lastNewOrderAlertAt < NEW_ORDER_ALERT_GAP_MS) return false;
  lastNewOrderAlertAt = now;

  try {
    await ensureAudioMode(false);
    // A bell that is still ringing is replaced, never stacked.
    if (activeAlertSound) {
      const previous = activeAlertSound;
      activeAlertSound = null;
      void previous.stopAsync().catch(() => {});
      void previous.unloadAsync().catch(() => {});
    }
    const result = await Audio.Sound.createAsync(newOrderAlert, {
      shouldPlay: true,
      volume: 1,
      isLooping: false,
    });
    const sound = result.sound;
    activeAlertSound = sound;
    // The file is 1.0 s; give playback a little room, then free the native memory.
    setTimeout(() => {
      if (activeAlertSound === sound) activeAlertSound = null;
      void sound.unloadAsync().catch(() => {});
    }, 2200);
    return true;
  } catch (error) {
    console.log('[Notifications] new order alert failed', error);
    activeAlertSound = null;
    return false;
  }
};

/** Stops a ringing queue alert (used when the board is muted mid-ring). */
export const stopNewOrderAlert = (): void => {
  if (!activeAlertSound) return;
  const sound = activeAlertSound;
  activeAlertSound = null;
  void sound.stopAsync().catch(() => {});
  void sound.unloadAsync().catch(() => {});
};
