import { Ionicons } from '@expo/vector-icons'; // ← ADD
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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

export default function SignUpScreen() {
  const [username,         setUsername]         = useState('');
  const [phoneNumber,      setPhoneNumber]      = useState('');
  const [password,         setPassword]         = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showPassword,     setShowPassword]     = useState(false); // ← ADD
  const [showConfirm,      setShowConfirm]      = useState(false); // ← ADD

  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  const logoW       = isTablet ? 280 : isSmall ? 160 : Math.min(220, width * 0.7);
  const logoH       = isTablet ? 90  : isSmall ? 50  : 75;
  const logoMT      = isTablet ? 60  : isSmall ? 24  : 40;
  const titleFs     = isTablet ? 48  : isSmall ? 20  : 24;
  const subtitleFs  = isTablet ? 24  : isSmall ? 13  : 14;
  const headerMT    = isTablet ? 50  : isSmall ? 16  : 28;
  const inputH      = isTablet ? 72  : isSmall ? 44  : 54;
  const inputFs     = isTablet ? 24  : isSmall ? 14  : 16;
  const inputMT     = isTablet ? 24  : isSmall ? 12  : 16;
  const inputRadius = isTablet ? 16  : 12;
  const btnH        = isTablet ? 72  : isSmall ? 44  : 54;
  const btnFs       = isTablet ? 24  : isSmall ? 17  : 20;
  const btnMT       = isTablet ? 32  : isSmall ? 16  : 24;
  const btnRadius   = isTablet ? 16  : 12;
  const signupFs    = isTablet ? 24  : isSmall ? 13  : 14;
  const signupMT    = isTablet ? 24  : isSmall ? 14  : 20;
  const hPad        = isTablet ? 40  : 20;
  const eyeSize     = isTablet ? 26  : 22; // ← ADD

  const isPasswordLengthValid  = password.length >= 4 && password.length <= 8;
  const showMismatchMessage    = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSignUp = () => {
    if (!username || !password || !confirmPassword || !phoneNumber) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (!isPasswordLengthValid) {
      Alert.alert('Error', 'Password must be 4 to 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    Alert.alert('Success', 'Account Created Successfully');
    router.push('/auth/login');
  };

  return (
    <SafeAreaView style={[styles.container, { paddingHorizontal: hPad }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={[styles.topCircle, {
        width:  isTablet ? 220 : 150,
        height: isTablet ? 220 : 150,
        top:    isTablet ? 120 : 80,
      }]} />
      <View style={[styles.bottomCircle, {
        width:  isTablet ? 240 : 180,
        height: isTablet ? 240 : 180,
      }]} />

      <View style={[styles.logoContainer, { marginTop: logoMT }]}>
        <Image
          source={require('../../assets/images/CAPTURE 1.png')}
          style={{ width: logoW, height: logoH }}
          resizeMode="contain"
        />
      </View>

      <View style={{ marginTop: headerMT }}>
        <Text style={[styles.title, { fontSize: titleFs }]}>Create Account</Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Enter your details to sign up.
        </Text>
      </View>

      {/* ── USERNAME — unchanged ── */}
      <View style={{ marginTop: inputMT }}>
        <TextInput
          placeholder="Username"
          placeholderTextColor="rgba(0,0,0,0.4)"
          style={[styles.input, { height: inputH, fontSize: inputFs, borderRadius: inputRadius }]}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
      </View>

      {/* ── PHONE — unchanged ── */}
      <View style={{ marginTop: inputMT }}>
        <TextInput
          placeholder="Phone Number"
          placeholderTextColor="rgba(0,0,0,0.4)"
          keyboardType="phone-pad"
          style={[styles.input, { height: inputH, fontSize: inputFs, borderRadius: inputRadius }]}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
      </View>

      {/* ── PASSWORD — added eye button ── */}
      <View style={{ marginTop: inputMT }}>
        <View style={[styles.inputWrapper, { height: inputH, borderRadius: inputRadius }]}>
          <TextInput
            placeholder="Password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showPassword}
            style={[styles.inputInner, { fontSize: inputFs }]}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(v => !v)}
          >
            <Ionicons
              name={showPassword ? 'eye' : 'eye-off'}
              size={eyeSize}
              color="rgba(0,0,0,0.5)"
            />
          </TouchableOpacity>
        </View>
        {!isPasswordLengthValid && password.length > 0 && (
          <Text style={styles.validationText}>Password must be 4 to 8 characters.</Text>
        )}
      </View>

      {/* ── CONFIRM PASSWORD — added eye button ── */}
      <View style={{ marginTop: inputMT }}>
        <View style={[styles.inputWrapper, { height: inputH, borderRadius: inputRadius }]}>
          <TextInput
            placeholder="Confirm Password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showConfirm}
            style={[styles.inputInner, { fontSize: inputFs }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowConfirm(v => !v)}
          >
            <Ionicons
              name={showConfirm ? 'eye' : 'eye-off'}
              size={eyeSize}
              color="rgba(0,0,0,0.5)"
            />
          </TouchableOpacity>
        </View>
        {showMismatchMessage && (
          <Text style={styles.mismatchText}>Passwords do not match.</Text>
        )}
      </View>

      {/* ── SIGN UP BUTTON — unchanged ── */}
      <TouchableOpacity
        style={[styles.signUpButton, { height: btnH, borderRadius: btnRadius, marginTop: btnMT }]}
        onPress={handleSignUp}
        activeOpacity={0.85}
      >
        <Text style={[styles.signUpText, { fontSize: btnFs }]}>Sign Up</Text>
      </TouchableOpacity>

      {/* ── SIGN IN LINK — unchanged ── */}
      <View style={[styles.footerContainer, { marginTop: signupMT }]}>
        <Text style={[styles.footerText, { fontSize: signupFs }]}>
          Already have an account?
        </Text>
        <TouchableOpacity onPress={() => router.push('/auth/login')}>
          <Text style={[styles.signInText, { fontSize: signupFs }]}>{' '}Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FFFFFF' },
  topCircle:    { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(97,145,185,0.54)', left: -60 },
  bottomCircle: { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(97,145,185,0.54)', bottom: -50, right: -60 },
  logoContainer:{ alignItems: 'center' },
  title:        { fontWeight: '600', color: '#000', marginBottom: 6 },
  subtitle:     { color: '#555' },

  // ── PLAIN INPUT (username & phone) — unchanged ──
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#075EA7',
    paddingHorizontal: 16,
    color: '#000',
    backgroundColor: '#fff',
  },

  // ── PASSWORD WRAPPER with eye button ────────────
  inputWrapper: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#075EA7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  inputInner: {
    flex: 1,
    color: '#000',
    height: '100%',
  },
  eyeBtn: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  signUpButton:   { width: '100%', backgroundColor: '#0062AA', justifyContent: 'center', alignItems: 'center' },
  signUpText:     { color: '#fff', fontWeight: '700' },
  validationText: { marginTop: 8, color: '#D64545', fontSize: 13, fontWeight: '500' },
  mismatchText:   { marginTop: 8, color: '#D64545', fontSize: 13, fontWeight: '500' },
  footerContainer:{ flexDirection: 'row', justifyContent: 'center' },
  footerText:     { color: '#3B4054' },
  signInText:     { color: '#075EA7', fontWeight: '600' },
});