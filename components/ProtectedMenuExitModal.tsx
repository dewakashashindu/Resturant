import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { apiClient } from '../services/api';
import { getBiometricAvailability, isBiometricLoginEnabled, unlockBiometricSession } from '../services/biometricAuth';
import { useCartStore } from '../services/cartStore';
import { useMenuSessionStore } from '../services/menuSessionStore';

type ProtectedMenuExitModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ProtectedMenuExitModal({ visible, onClose }: ProtectedMenuExitModalProps) {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const clearDiningSession = useMenuSessionStore((state) => state.clearDiningSession);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<'Use Fingerprint' | 'Use Face Unlock' | 'Use Biometrics'>('Use Biometrics');

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    void (async () => {
      const availability = await getBiometricAvailability();
      if (!mounted) return;
      setBiometricLabel(availability.label);
      setBiometricEnabled(availability.available && isBiometricLoginEnabled());
    })();
    return () => { mounted = false; };
  }, [visible]);

  const resetAndClose = () => {
    setPassword('');
    setError('');
    setBiometricVerified(false);
    onClose();
  };

  const completeExit = (mode: 'clear' | 'confirm') => {
    setPassword('');
    setBiometricVerified(false);
    onClose();

    if (mode === 'clear') {
      clearCart();
      clearDiningSession();
      router.replace('/(tabs)');
      return;
    }

    // There is intentionally no Keep & Exit path. Confirm sends the customer
    // to the real Menu Cart, where the order must be confirmed before leaving.
    router.push('/menu/menu_cart');
  };

  const handleExit = async (mode: 'clear' | 'confirm') => {
    if (biometricVerified) {
      completeExit(mode);
      return;
    }

    const value = password.trim();
    if (!value) {
      setError('Enter your current password or use biometrics to continue.');
      return;
    }

    setVerifying(true);
    setError('');
    try {
      const result = await apiClient.verifyCurrentPassword(value);
      if (!result.ok || !result.data?.ok) {
        setError(result.data?.message || 'Password verification failed.');
        return;
      }
      completeExit(mode);
    } catch {
      setError('Unable to verify password. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleBiometricVerification = async () => {
    if (verifying) return;
    setVerifying(true);
    setError('');
    try {
      const result = await unlockBiometricSession();
      if (!result.session) {
        setError(result.message);
        return;
      }
      setPassword('');
      setBiometricVerified(true);
    } catch {
      setError('Biometric verification failed. Please use your password.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={resetAndClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={verifying ? undefined : resetAndClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView style={styles.card} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="lock-closed-outline" size={21} color="#FFFFFF" />
                </View>
                <View style={styles.headerCopy}>
                  <Text style={styles.title}>Exit Menu Card?</Text>
                  <Text style={styles.subtitle}>Clear the customer cart or confirm the order.</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={resetAndClose} disabled={verifying}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <Text style={styles.description}>
                  You cannot keep this customer cart for later. Clear it, or continue to order confirmation.
                </Text>

                {biometricVerified ? (
                  <View style={styles.biometricVerifiedRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#258354" />
                    <Text style={styles.biometricVerifiedText}>Biometric verification complete</Text>
                  </View>
                ) : (
                  <>
                    <View style={[styles.passwordWrap, Boolean(error) && styles.passwordWrapError]}>
                      <Ionicons name="key-outline" size={19} color="#8AA0AE" />
                      <TextInput
                        style={styles.passwordInput}
                        value={password}
                        onChangeText={(text) => { setPassword(text); if (error) setError(''); }}
                        placeholder="Current password / PIN"
                        placeholderTextColor="#92A1AA"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!verifying}
                        returnKeyType="done"
                      />
                    </View>
                    {biometricEnabled ? (
                      <TouchableOpacity
                        style={styles.biometricButton}
                        onPress={() => void handleBiometricVerification()}
                        disabled={verifying}
                        activeOpacity={0.85}
                      >
                        {verifying ? <ActivityIndicator size="small" color="#1B1B1B" /> : <Ionicons name={biometricLabel === 'Use Face Unlock' ? 'scan-outline' : 'finger-print-outline'} size={20} color="#1B1B1B" />}
                        <Text style={styles.biometricButtonText}>{biometricLabel}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.actionButton, styles.confirmButton]}
                  onPress={() => void handleExit('confirm')}
                  disabled={verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionTitle}>Confirm Order</Text>
                    <Text style={styles.actionDescription}>Continue to Menu Cart and confirm before leaving.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.clearButton]}
                  onPress={() => void handleExit('clear')}
                  disabled={verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? <ActivityIndicator color="#B54F48" /> : <Ionicons name="trash-outline" size={19} color="#B54F48" />}
                  <View style={styles.actionCopy}>
                    <Text style={[styles.actionTitle, styles.clearTitle]}>Clear & Exit</Text>
                    <Text style={[styles.actionDescription, styles.clearDescription]}>Remove this table data and all cart items.</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
  },
  header: {
    minHeight: 91,
    paddingHorizontal: 18,
    backgroundColor: '#1B1B1B',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(171,119,60,0.95)',
    marginRight: 11,
  },
  headerCopy: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.63)', fontSize: 12, marginTop: 4 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 18 },
  description: { color: '#647782', fontSize: 13, lineHeight: 19, marginBottom: 15 },
  passwordWrap: {
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#DCE4E8',
    borderRadius: 13,
    backgroundColor: '#F7F9FA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  passwordWrapError: { borderColor: '#D96A64' },
  passwordInput: { flex: 1, color: '#263D49', fontSize: 14, height: '100%' },
  error: { color: '#C7554E', fontSize: 12, marginTop: 7, marginBottom: -3 },
  actionButton: {
    minHeight: 67,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmButton: { backgroundColor: '#3D8C5E' },
  clearButton: { backgroundColor: '#FFF2F0', borderWidth: 1, borderColor: '#F0D5D2' },
  biometricButton: {
    minHeight: 43,
    marginTop: 10,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B9CDD8',
    backgroundColor: '#F3F8FA',
  },
  biometricButtonText: { color: '#1B1B1B', fontSize: 13, fontWeight: '800' },
  biometricVerifiedRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    borderRadius: 13,
    backgroundColor: '#EFFAF3',
    borderWidth: 1,
    borderColor: '#CBEBD6',
  },
  biometricVerifiedText: { color: '#258354', fontSize: 13, fontWeight: '800' },
  actionCopy: { flex: 1 },
  actionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  actionDescription: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 3 },
  clearTitle: { color: '#B54F48' },
  clearDescription: { color: '#9B706C' },
});
