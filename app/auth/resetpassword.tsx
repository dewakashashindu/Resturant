import AuthFormLayout from '../../components/AuthFormLayout';
import { OperationalColors } from '../../constants/operationalTheme';
import PasswordUpdatedModal from '@/components/PasswordUpdatedModal';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,

    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { apiClient } from '../../services/api';

export default function ResetPasswordScreen() {
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [modalVisible,    setModalVisible]    = useState(false);

  const [passwordError, setPasswordError] = useState('');
  const [confirmError,  setConfirmError]  = useState('');

  const router = useRouter();
  const params = useLocalSearchParams();
  const username = params.username as string;

  const { width, height } = useWindowDimensions();

  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  const logoW = Math.min(340, width * 0.78);
  const logoH = isTablet ? 122 : isSmall ? 82 : 98;
  const logoMT = isSmall ? 16 : 24;
  const titleFs = isTablet ? 32 : 27;
  const subtitleFs = 13;
  const headerMT = 22;
  const inputH = 54;
  const inputFs = 14;
  const inputMT = 22;
  const inputRadius = 14;
  const btnH = 54;
  const btnFs = 16;
  const btnMT = 26;
  const btnRadius = 13;
  const signupFs = 12;
  const signupMT = 22;
  const hPad = width < 360 ? 20 : 26;
  const eyeSize = 20;

  // ─── Patterns ─────────────────────────────────────────────────────────────
  const passwordPattern = /^[A-Za-z0-9!@#]+$/;

  // ─── Validators (real-time) ───────────────────────────────────────────────
  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('');
      return false;
    }
    if (!passwordPattern.test(value)) {
      setPasswordError('Password can only contain letters, numbers, and ! @ #');
      return false;
    }
    if (value.length < 4) {
      setPasswordError('Password must be at least 4 characters.');
      return false;
    }
    if (value.length > 8) {
      setPasswordError('Password must be no more than 8 characters.');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirm = (value: string, pw: string): boolean => {
    if (!value) {
      setConfirmError('');
      return false;
    }
    if (value !== pw) {
      setConfirmError('Passwords do not match.');
      return false;
    }
    setConfirmError('');
    return true;
  };

  // ─── Final check on tap (catches empty fields) ────────────────────────────
  const validateAll = (): boolean => {
    let valid = true;

    if (!password.trim()) {
      setPasswordError('Please enter a new password.');
      valid = false;
    } else if (!validatePassword(password)) {
      valid = false;
    }

    if (!confirmPassword.trim()) {
      setConfirmError('Please confirm your password.');
      valid = false;
    } else if (!validateConfirm(confirmPassword, password)) {
      valid = false;
    }

    return valid;
  };

  // ─── Reset handler ────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!validateAll()) return;

    try {
      const response = await apiClient.resetPassword(username, password);

      if (!response.ok) {
        setPasswordError(response.data?.message || 'Failed to reset password. Please try again.');
        return;
      }

      setModalVisible(true);
    } catch (e) {
      const err: any = e as any;
      setPasswordError('Something went wrong. Please try again.');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AuthFormLayout padding={hPad}>
      <StatusBar barStyle="dark-content" backgroundColor={OperationalColors.canvas} />


      <View style={[styles.logoContainer, { marginTop: logoMT }]}>
        <Image
          source={require('../../assets/images/millamirissa.png')}
          style={{ width: logoW, height: logoH }}
          resizeMode="contain"
        />
      </View>

      <View style={{ marginTop: headerMT }}>
        <Text style={[styles.title, { fontSize: titleFs }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Set a new password for your account.
        </Text>
      </View>

      {/* ── PASSWORD ── */}
      <View style={{ marginTop: inputMT }}>
        <Text style={styles.fieldLabel}>Password</Text>
        <View
          style={[
            styles.inputWrapper,
            {
              height:       inputH,
              borderRadius: inputRadius,
              borderColor:  passwordError ? '#D32F2F' : OperationalColors.border,
            },
          ]}
        >
          <TextInput
            placeholder="Enter your password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showPassword}
            style={[styles.inputInner, { fontSize: inputFs }]}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              validatePassword(text);
              if (confirmPassword) validateConfirm(confirmPassword, text);
            }}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            <Ionicons
              name={showPassword ? 'eye' : 'eye-off'}
              size={eyeSize}
              color="rgba(0,0,0,0.5)"
            />
          </TouchableOpacity>
        </View>
        {passwordError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{passwordError}</Text>
          </View>
        ) : null}
      </View>

      {/* ── CONFIRM PASSWORD ── */}
      <View style={{ marginTop: inputMT }}>
        <Text style={styles.fieldLabel}>Confirm Password</Text>
        <View
          style={[
            styles.inputWrapper,
            {
              height:       inputH,
              borderRadius: inputRadius,
              borderColor:  confirmError ? '#D32F2F' : OperationalColors.border,
            },
          ]}
        >
          <TextInput
            placeholder="Re-enter your password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showConfirm}
            style={[styles.inputInner, { fontSize: inputFs }]}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              validateConfirm(text, password);
            }}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
            <Ionicons
              name={showConfirm ? 'eye' : 'eye-off'}
              size={eyeSize}
              color="rgba(0,0,0,0.5)"
            />
          </TouchableOpacity>
        </View>
        {confirmError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{confirmError}</Text>
          </View>
        ) : null}
      </View>

      {/* ── RESET BUTTON ── */}
      <TouchableOpacity
        style={[styles.button, { height: btnH, borderRadius: btnRadius, marginTop: btnMT }]}
        onPress={handleReset}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, { fontSize: btnFs }]}>Reset Password</Text>
      </TouchableOpacity>

      <PasswordUpdatedModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSignIn={() => router.push('/auth/login')}
      />

      {/* ── SIGN UP LINK ── */}
      <View style={[styles.signupContainer, { marginTop: signupMT }]}>
        <Text style={[styles.signupText, { fontSize: signupFs }]}>
          Don't have an account?
        </Text>
        <TouchableOpacity onPress={() => router.push('/auth/signup')}>
          <Text style={[styles.signupLink, { fontSize: signupFs }]}>{' '}Sign Up</Text>
        </TouchableOpacity>
      </View>
    </AuthFormLayout>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { color: OperationalColors.primary, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  container:     { flex: 1, backgroundColor: OperationalColors.canvas },
  topCircle:     { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(168,139,98,0.35)', left: -70 },
  bottomCircle:  { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(168,139,98,0.35)', bottom: -60, right: -70 },
  logoContainer: { alignItems: 'center' },
  title:         { fontWeight: '600', color: OperationalColors.text, marginBottom: 8 },
  subtitle:      { color: OperationalColors.muted },

  inputWrapper: {
    width:             '100%',
    borderWidth: 1,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    backgroundColor:   OperationalColors.surface,
  },

  inputInner: {
    flex:   1,
    color:  OperationalColors.text,
    height: '100%',
  },

  eyeBtn: {
    paddingLeft:    8,
    justifyContent: 'center',
    alignItems:     'center',
  },

  errorRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           4,
    marginTop:     6,
    paddingLeft:   2,
  },

  errorText: {
    color:    '#D32F2F',
    fontSize: 13,
    flex:     1,
    flexWrap: 'wrap',
  },

  button:         { width: '100%', backgroundColor: OperationalColors.primary, justifyContent: 'center', alignItems: 'center' },
  buttonText:     { color: OperationalColors.onPrimary, fontWeight: '700' },
  signupContainer:{ flexDirection: 'row', justifyContent: 'center' },
  signupText:     { color: OperationalColors.text },
  signupLink:     { color: OperationalColors.primary, fontWeight: '600' },
});