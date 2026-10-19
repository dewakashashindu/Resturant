import AuthFormLayout from '../../components/AuthFormLayout';
import { OperationalColors } from '../../constants/operationalTheme';
import { apiClient } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,

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
        <Text style={[styles.title, { fontSize: titleFs }]}>Set Password</Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Enter your username and registered contact number to set your password.
        </Text>
      </View>

      {/* ── USERNAME ── */}
      <View style={{ marginTop: inputMT }}>
        <Text style={styles.fieldLabel}>Username</Text>
        <TextInput
          placeholder="Enter your username"
          placeholderTextColor="rgba(0,0,0,0.4)"
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            {
              height:       inputH,
              fontSize:     inputFs,
              borderRadius: inputRadius,
              borderColor:  usernameError ? '#D32F2F' : OperationalColors.border,
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
        <Text style={styles.fieldLabel}>Phone Number</Text>
        <TextInput
          placeholder="Registered phone number"
          placeholderTextColor="rgba(0,0,0,0.4)"
          keyboardType="number-pad"
          maxLength={10}
          style={[
            styles.input,
            {
              height:       inputH,
              fontSize:     inputFs,
              borderRadius: inputRadius,
              borderColor:  phoneError ? '#D32F2F' : OperationalColors.border,
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
    </AuthFormLayout>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { color: OperationalColors.primary, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  container:     { flex: 1, backgroundColor: OperationalColors.canvas },
  topCircle:     { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(168,139,98,0.54)', left: -60 },
  bottomCircle:  { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(168,139,98,0.54)', bottom: -50, right: -60 },
  logoContainer: { alignItems: 'center' },
  title:         { fontWeight: '600', color: OperationalColors.text, marginBottom: 6 },
  subtitle:      { color: OperationalColors.muted },

  input: {
    width:             '100%',
    borderWidth: 1,
    paddingHorizontal: 16,
    color:             OperationalColors.text,
    backgroundColor:   OperationalColors.surface,
  },

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

  signUpButton:    { width: '100%', backgroundColor: OperationalColors.primary, justifyContent: 'center', alignItems: 'center' },
  signUpText:      { color: OperationalColors.onPrimary, fontWeight: '700' },
  footerContainer: { flexDirection: 'row', justifyContent: 'center' },
  footerText:      { color: OperationalColors.text },
  signInText:      { color: OperationalColors.primary, fontWeight: '600' },
});