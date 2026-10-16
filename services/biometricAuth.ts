import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { storage } from './storage';

const BIOMETRIC_SESSION_KEY = 'restaurant_biometric_session_v1';
const BIOMETRIC_ENABLED_KEY = 'restaurant_biometric_enabled_v1';
// Settings can explicitly turn the feature off. A simple "Not now" at login
// does not change this preference, so the user may be asked again later.
const BIOMETRIC_PROMPT_ENABLED_KEY = 'restaurant_biometric_prompt_enabled_v1';

type BiometricUser = {
  userName: string;
  userId: string | number;
  groupId: string | number;
  assignedFloors?: string[];
  picture?: string | null;
  locCode?: string | null;
  stationType?: 'K' | 'B' | null;
};

export type BiometricSession = {
  token: string;
  user: BiometricUser;
};

export type BiometricAvailability = {
  available: boolean;
  label: 'Use Fingerprint' | 'Use Face Unlock' | 'Use Biometrics';
};

const tokenIsExpired = (token: string) => {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized));
    return Number(payload?.exp ?? 0) * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export const getBiometricAvailability = async (): Promise<BiometricAvailability> => {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hasHardware || !enrolled) return { available: false, label: 'Use Biometrics' };

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return { available: true, label: 'Use Face Unlock' };
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return { available: true, label: 'Use Fingerprint' };
    }
    return { available: true, label: 'Use Biometrics' };
  } catch (error) {
    console.log('[Biometric] availability check failed', error);
    return { available: false, label: 'Use Biometrics' };
  }
};

export const isBiometricLoginEnabled = () =>
  storage.getString(BIOMETRIC_ENABLED_KEY) === '1';

export const isBiometricPromptEnabled = () =>
  storage.getString(BIOMETRIC_PROMPT_ENABLED_KEY) !== '0';

export const setBiometricPromptEnabled = (enabled: boolean) => {
  storage.set(BIOMETRIC_PROMPT_ENABLED_KEY, enabled ? '1' : '0');
};

/** Save only the existing seven-day JWT session in device-protected storage.
 * The password is never stored. SecureStore itself requests Face/Fingerprint
 * verification each time this session is read. */
export const enableBiometricLogin = async (session: BiometricSession) => {
  const availability = await getBiometricAvailability();
  if (!availability.available) return { ok: false, message: 'No fingerprint or face unlock is configured on this device.' };

  try {
    await SecureStore.setItemAsync(BIOMETRIC_SESSION_KEY, JSON.stringify(session), {
      requireAuthentication: true,
      authenticationPrompt: 'Confirm to enable biometric sign in',
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    storage.set(BIOMETRIC_ENABLED_KEY, '1');
    setBiometricPromptEnabled(true);
    return { ok: true, message: '' };
  } catch (error) {
    console.log('[Biometric] enable failed', error);
    return { ok: false, message: 'Could not enable biometric sign in.' };
  }
};

export const unlockBiometricSession = async (): Promise<{ session: BiometricSession | null; message: string }> => {
  const availability = await getBiometricAvailability();
  if (!availability.available) {
    return { session: null, message: 'Fingerprint or face unlock is not available on this device.' };
  }

  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_SESSION_KEY, {
      requireAuthentication: true,
      authenticationPrompt: availability.label,
    });
    if (!raw) return { session: null, message: 'Biometric sign in was cancelled or is not enabled.' };

    const session = JSON.parse(raw) as BiometricSession;
    if (!session?.token || !session?.user || tokenIsExpired(session.token)) {
      await clearBiometricLogin();
      return { session: null, message: 'Your biometric session has expired. Please sign in with your password.' };
    }
    return { session, message: '' };
  } catch (error) {
    console.log('[Biometric] unlock failed', error);
    return { session: null, message: 'Fingerprint or face verification was not successful.' };
  }
};

export const clearBiometricLogin = async () => {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY);
  } catch (error) {
    console.log('[Biometric] secure session removal failed', error);
  } finally {
    storage.set(BIOMETRIC_ENABLED_KEY, '0');
  }
};
