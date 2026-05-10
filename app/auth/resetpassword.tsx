import { useRouter } from 'expo-router';
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

export default function ResetPasswordScreen() {
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // ── BREAKPOINTS ────────────────────────────────
  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  // ── RESPONSIVE VALUES (matches login/signup/forgot) ──
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

  const signupFs    = isTablet ? 24 : isSmall ? 13  : 14;
  const signupMT    = isTablet ? 24  : isSmall ? 14  : 20;
  const hPad        = isTablet ? 40  : 20;
  const isPasswordLengthValid = password.length >= 4 && password.length <= 8;
  const showMismatchMessage = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <SafeAreaView style={[styles.container, { paddingHorizontal: hPad }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── DECORATIVE CIRCLES ── */}
      <View style={[styles.topCircle, {
        width:  isTablet ? 220 : 160,
        height: isTablet ? 220 : 160,
        top:    isTablet ? 120 : 80,
      }]} />
      <View style={[styles.bottomCircle, {
        width:  isTablet ? 240 : 190,
        height: isTablet ? 240 : 190,
      }]} />

      {/* ── LOGO ── */}
      <View style={[styles.logoContainer, { marginTop: logoMT }]}>
        <Image
          source={require('../../assets/images/CAPTURE 1.png')}
          style={{ width: logoW, height: logoH }}
          resizeMode="contain"
        />
      </View>

      {/* ── HEADER ── */}
      <View style={{ marginTop: headerMT }}>
        <Text style={[styles.title, { fontSize: titleFs }]}>
          Reset Password
        </Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Set a new password for your account.
        </Text>
      </View>

      {/* ── PASSWORD ── */}
      <View style={{ marginTop: inputMT }}>
        <TextInput
          placeholder="Password"
          placeholderTextColor="rgba(0,0,0,0.4)"
          secureTextEntry
          style={[
            styles.input,
            { height: inputH, fontSize: inputFs, borderRadius: inputRadius },
          ]}
          value={password}
          onChangeText={setPassword}
        />
        {!isPasswordLengthValid && password.length > 0 && (
          <Text style={styles.validationText}>Password must be 4 to 8 characters.</Text>
        )}
      </View>

      {/* ── CONFIRM PASSWORD ── */}
      <View style={{ marginTop: inputMT }}>
        <TextInput
          placeholder="Confirm Password"
          placeholderTextColor="rgba(0,0,0,0.4)"
          secureTextEntry
          style={[
            styles.input,
            { height: inputH, fontSize: inputFs, borderRadius: inputRadius },
          ]}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        {showMismatchMessage && (
          <Text style={styles.mismatchText}>Passwords do not match.</Text>
        )}
      </View>

      {/* ── RESET BUTTON ── */}
      <TouchableOpacity
        style={[
          styles.button,
          { height: btnH, borderRadius: btnRadius, marginTop: btnMT },
        ]}
        onPress={() => {
          if (!isPasswordLengthValid || password !== confirmPassword) return;
          router.push('/auth/login');
        }}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, { fontSize: btnFs }]}>
          Reset Password
        </Text>
      </TouchableOpacity>

      {/* ── SIGN UP LINK ── */}
      <View style={[styles.signupContainer, { marginTop: signupMT }]}>
        <Text style={[styles.signupText, { fontSize: signupFs }]}>
          Don't have an account?
        </Text>
        <TouchableOpacity onPress={() => router.push('/auth/signup')}>
          <Text style={[styles.signupLink, { fontSize: signupFs }]}>
            {' '}Sign Up
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── DECORATIVE CIRCLES ──────────────────────────
  topCircle: {
    position: 'absolute',
    borderRadius: 110,
    backgroundColor: 'rgba(98,145,185,0.35)',
    left: -70,
  },
  bottomCircle: {
    position: 'absolute',
    borderRadius: 110,
    backgroundColor: 'rgba(98,145,185,0.35)',
    bottom: -60,
    right: -70,
  },

  // ── LOGO ────────────────────────────────────────
  logoContainer: {
    alignItems: 'center',
  },

  // ── TEXT ────────────────────────────────────────
  title: {
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    color: '#555',
  },

  // ── INPUT ───────────────────────────────────────
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#0062AA',
    paddingHorizontal: 16,
    color: '#000',
    backgroundColor: '#fff',
  },

  // ── BUTTON ──────────────────────────────────────
  button: {
    width: '100%',
    backgroundColor: '#0062AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  mismatchText: {
    marginTop: 8,
    color: '#D64545',
    fontSize: 13,
    fontWeight: '500',
  },
  validationText: {
    marginTop: 8,
    color: '#D64545',
    fontSize: 13,
    fontWeight: '500',
  },

  // ── SIGN UP ─────────────────────────────────────
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    color: '#3B4054',
  },
  signupLink: {
    color: '#075EA7',
    fontWeight: '600',
  },
});