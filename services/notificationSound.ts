import { Audio } from 'expo-av';

const notificationChime = require('../assets/sounds/notification-chime.wav');
let audioModeReady = false;

/**
 * Plays the bundled chime directly through the foreground app audio channel.
 * This avoids relying solely on Android's notification-channel sound, which
 * some devices suppress while the app itself is active.
 */
export const playForegroundNotificationSound = async (): Promise<boolean> => {
  let sound: Audio.Sound | null = null;
  try {
    if (!audioModeReady) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      audioModeReady = true;
    }

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
