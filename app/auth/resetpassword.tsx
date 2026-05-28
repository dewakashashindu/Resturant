import PasswordUpdatedModal from '@/components/PasswordUpdatedModal';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    SafeAreaView,
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

  const logoW       = isTablet ? 280 : isSmall ? 160 : Math.min(220, width * 0.7);
  const logoH       = isTablet ? 90  : isSmall ? 50  : 75;
  const logoMT      = isTablet ? 80  : isSmall ? 30  : 60;
  const titleFs     = isTablet ? 48  : isSmall ? 18  : 22;
  const subtitleFs  = isTablet ? 24  : isSmall ? 12  : 13;
  const headerMT    = isTablet ? 40  : isSmall ? 20  : 32;
  const inputH      = isTablet ? 72  : isSmall ? 48  : 54;
  const inputFs     = isTablet ? 24  : isSmall ? 14  : 16;
  const inputMT     = isTablet ? 24  : isSmall ? 14  : 20;
  const inputRadius = isTablet ? 16  : 12;
  const btnH        = isTablet ? 72  : isSmall ? 48  : 54;
  const btnFs       = isTablet ? 24  : isSmall ? 17  : 20;
  const btnMT       = isTablet ? 32  : isSmall ? 20  : 24;
  const btnRadius   = isTablet ? 16  : 12;
  const signupFs    = isTablet ? 24  : isSmall ? 13  : 14;
  const signupMT    = isTablet ? 24  : isSmall ? 14  : 20;
  const hPad        = isTablet ? 40  : 20;
  const eyeSize     = isTablet ? 26  : 22;

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
    <SafeAreaView style={[styles.container, { paddingHorizontal: hPad }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={[styles.topCircle, {
        width:  isTablet ? 220 : 160,
        height: isTablet ? 220 : 160,
        top:    isTablet ? 120 : 80,
      }]} />
      <View style={[styles.bottomCircle, {
        width:  isTablet ? 240 : 190,
        height: isTablet ? 240 : 190,
      }]} />

      <View style={[styles.logoContainer, { marginTop: logoMT }]}>
        <Image
          source={require('../../assets/images/CAPTURE 1.png')}
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
        <View
          style={[
            styles.inputWrapper,
            {
              height:       inputH,
              borderRadius: inputRadius,
              borderColor:  passwordError ? '#D32F2F' : '#0062AA',
            },
          ]}
        >
          <TextInput
            placeholder="Password"
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
        <View
          style={[
            styles.inputWrapper,
            {
              height:       inputH,
              borderRadius: inputRadius,
              borderColor:  confirmError ? '#D32F2F' : '#0062AA',
            },
          ]}
        >
          <TextInput
            placeholder="Confirm Password"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#FFFFFF' },
  topCircle:     { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(98,145,185,0.35)', left: -70 },
  bottomCircle:  { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(98,145,185,0.35)', bottom: -60, right: -70 },
  logoContainer: { alignItems: 'center' },
  title:         { fontWeight: '600', color: '#000', marginBottom: 8 },
  subtitle:      { color: '#555' },

  inputWrapper: {
    width:             '100%',
    borderWidth:       1.5,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    backgroundColor:   '#fff',
  },

  inputInner: {
    flex:   1,
    color:  '#000',
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

  button:         { width: '100%', backgroundColor: '#0062AA', justifyContent: 'center', alignItems: 'center' },
  buttonText:     { color: '#fff', fontWeight: '700' },
  signupContainer:{ flexDirection: 'row', justifyContent: 'center' },
  signupText:     { color: '#3B4054' },
  signupLink:     { color: '#075EA7', fontWeight: '600' },
});