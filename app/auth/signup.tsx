import { apiClient } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
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
  const [username,        setUsername]        = useState('');
  const [phoneNumber,     setPhoneNumber]     = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  const [usernameError,  setUsernameError]  = useState('');
  const [phoneError,     setPhoneError]     = useState('');
  const [passwordError,  setPasswordError]  = useState('');
  const [confirmError,   setConfirmError]   = useState('');

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
  const eyeSize     = isTablet ? 26  : 22;

  // ─── Patterns ────────────────────────────────────────────────────────────
  const usernamePattern = /^[A-Za-z0-9]+$/;
  const passwordPattern = /^[A-Za-z0-9!@#]+$/;
  const phonePattern    = /^[0-9]+$/;

  // ─── Validators (real-time) ───────────────────────────────────────────────
  const validateUsername = (value: string): boolean => {
    if (!value) {
      setUsernameError('');
      return false;
    }
    if (!usernamePattern.test(value)) {
      setUsernameError('Username can only contain letters and numbers. Symbols are not allowed.');
      return false;
    }
    if (value.length < 4) {
      setUsernameError('Username must be at least 4 characters.');
      return false;
    }
    if (value.length > 8) {
      setUsernameError('Username must be no more than 8 characters.');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const validatePhone = (value: string): boolean => {
    if (!value) {
      setPhoneError('');
      return false;
    }
    if (!phonePattern.test(value)) {
      setPhoneError('Phone number can only contain digits.');
      return false;
    }
    if (value.length < 10) {
      setPhoneError('Phone number must be exactly 10 digits.');
      return false;
    }
    setPhoneError('');
    return true;
  };

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

    if (!username.trim()) {
      setUsernameError('Please enter a username.');
      valid = false;
    } else if (!validateUsername(username)) {
      valid = false;
    }

    if (!phoneNumber.trim()) {
      setPhoneError('Please enter your phone number.');
      valid = false;
    } else if (!validatePhone(phoneNumber)) {
      valid = false;
    }

    if (!password.trim()) {
      setPasswordError('Please enter a password.');
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

  // ─── Sign up handler ──────────────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!validateAll()) return;

    try {
      const result = await apiClient.signup(username, password, phoneNumber);

      if (!result.ok) {
        const msg: string = result.data?.message ?? '';

        // Server returns 401 when username+phone don't match the same DB row
        if (
          msg.toLowerCase().includes('do not match') ||
          msg.toLowerCase().includes('contact number')
        ) {
          setUsernameError('Username and contact number do not match our records.');
          setPhoneError(' '); // highlights the phone field too
        } else if (msg.toLowerCase().includes('username')) {
          setUsernameError(msg);
        } else {
          setPasswordError(msg || 'Sign up failed. Please try again.');
        }
        return;
      }

      // Success — password has been saved; take user to login
      Alert.alert(
        'Password Set',
        'Your password has been saved successfully. You can now log in.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );
    } catch (_e) {
      setPasswordError('Something went wrong. Please try again.');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
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
        <Text style={[styles.title, { fontSize: titleFs }]}>Set Password</Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Enter your username and registered contact number to set your password.
        </Text>
      </View>

      {/* ── USERNAME ── */}
      <View style={{ marginTop: inputMT }}>
        <TextInput
          placeholder="Username"
          placeholderTextColor="rgba(0,0,0,0.4)"
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            {
              height:       inputH,
              fontSize:     inputFs,
              borderRadius: inputRadius,
              borderColor:  usernameError ? '#D32F2F' : '#075EA7',
            },
          ]}
          value={username}
          onChangeText={(text) => {
            // Block symbols from being typed at all
            const filtered = text.replace(/[^A-Za-z0-9]/g, '');
            // Block beyond 8 chars
            const trimmed = filtered.slice(0, 8);
            setUsername(trimmed);
            validateUsername(trimmed);
          }}
        />
        {usernameError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{usernameError}</Text>
          </View>
        ) : null}
      </View>

      {/* ── PHONE ── */}
      <View style={{ marginTop: inputMT }}>
        <TextInput
          placeholder="Phone Number"
          placeholderTextColor="rgba(0,0,0,0.4)"
          keyboardType="number-pad"
          maxLength={10}
          style={[
            styles.input,
            {
              height:       inputH,
              fontSize:     inputFs,
              borderRadius: inputRadius,
              borderColor:  phoneError ? '#D32F2F' : '#075EA7',
            },
          ]}
          value={phoneNumber}
          onChangeText={(text) => {
            // Strip any non-digit (safety net on top of number-pad)
            const digits = text.replace(/[^0-9]/g, '').slice(0, 10);
            setPhoneNumber(digits);
            validatePhone(digits);
          }}
        />
        {phoneError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{phoneError}</Text>
          </View>
        ) : null}
      </View>

      {/* ── PASSWORD ── */}
      <View style={{ marginTop: inputMT }}>
        <View
          style={[
            styles.inputWrapper,
            {
              height:       inputH,
              borderRadius: inputRadius,
              borderColor:  passwordError ? '#D32F2F' : '#075EA7',
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
              // Re-validate confirm if already typed
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
              borderColor:  confirmError ? '#D32F2F' : '#075EA7',
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

      {/* ── SIGN UP BUTTON ── */}
      <TouchableOpacity
        style={[styles.signUpButton, { height: btnH, borderRadius: btnRadius, marginTop: btnMT }]}
        onPress={handleSignUp}
        activeOpacity={0.85}
      >
        <Text style={[styles.signUpText, { fontSize: btnFs }]}>Sign Up</Text>
      </TouchableOpacity>

      {/* ── SIGN IN LINK ── */}
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
  container:     { flex: 1, backgroundColor: '#FFFFFF' },
  topCircle:     { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(97,145,185,0.54)', left: -60 },
  bottomCircle:  { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(97,145,185,0.54)', bottom: -50, right: -60 },
  logoContainer: { alignItems: 'center' },
  title:         { fontWeight: '600', color: '#000', marginBottom: 6 },
  subtitle:      { color: '#555' },

  input: {
    width:             '100%',
    borderWidth:       1.5,
    paddingHorizontal: 16,
    color:             '#000',
    backgroundColor:   '#fff',
  },

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

  signUpButton:    { width: '100%', backgroundColor: '#0062AA', justifyContent: 'center', alignItems: 'center' },
  signUpText:      { color: '#fff', fontWeight: '700' },
  footerContainer: { flexDirection: 'row', justifyContent: 'center' },
  footerText:      { color: '#3B4054' },
  signInText:      { color: '#075EA7', fontWeight: '600' },
});