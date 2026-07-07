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

import { apiClient, setBackendIP } from '../../services/api';
import { useAuthStore } from '../../services/authStore';
import { getUniqueDeviceId } from '../../services/deviceIdService';
import useItemStore from '../../services/itemStore';
import { AUTH_SESSION_KEYS, storage } from '../../services/storage';

export default function LoginScreen() {
  const [username, setUsername]           = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);

  const [devIP, setDevIP] = useState((global as any).backendIP || '192.168.8.100');

  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const setSession = useAuthStore((state) => state.setSession);
  const prefetchMenuBootstrapData = useItemStore((state) => state.prefetchMenuBootstrapData);

  const isTablet = width >= 600;
  const isSmall  = height < 700;

  const logoW       = isTablet ? 280 : isSmall ? 160 : Math.min(220, width * 0.7);
  const logoH       = isTablet ? 90  : isSmall ? 55  : 75;
  const logoMT      = isTablet ? 80  : isSmall ? 40  : 60;
  const titleFs     = isTablet ? 48  : isSmall ? 20  : 24;
  const subtitleFs  = isTablet ? 24  : isSmall ? 13  : 14;
  const headerMT    = isTablet ? 50  : isSmall ? 24  : 36;
  const inputH      = isTablet ? 72  : isSmall ? 48  : 54;
  const inputFs     = isTablet ? 24  : isSmall ? 14  : 16;
  const inputMT     = isTablet ? 24  : isSmall ? 14  : 20;
  const inputRadius = isTablet ? 16  : 12;
  const btnH        = isTablet ? 72  : isSmall ? 48  : 54;
  const btnFs       = isTablet ? 24  : isSmall ? 17  : 20;
  const btnMT       = isTablet ? 40  : isSmall ? 20  : 32;
  const btnRadius   = isTablet ? 16  : 12;
  const forgotFs    = isTablet ? 24  : isSmall ? 13  : 15;
  const forgotMT    = isTablet ? 16  : isSmall ? 10  : 14;
  const signupFs    = isTablet ? 24  : isSmall ? 13  : 14;
  const signupMT    = isTablet ? 28  : isSmall ? 16  : 22;
  const hPad        = isTablet ? 40  : 20;
  const eyeSize     = isTablet ? 26  : 22;

  const usernamePattern = /^[A-Za-z0-9]+$/;
  const passwordPattern = /^[A-Za-z0-9!@#]+$/;

  // ─── VALIDATION ──────────────────────────────────────────────────────────────
  const validateUsername = (value: string): boolean => {
    if (!value.trim()) {
      setUsernameError('Please enter your username.');
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
    if (!usernamePattern.test(value)) {
      setUsernameError('Username can only contain letters and numbers. Symbols are not allowed.');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (!value.trim()) {
      setPasswordError('Please enter your password.');
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

  // ─── MAIN LOGIN HANDLER ───────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!(global as any).backendIP) {
      const fallbackIP = devIP.trim() || '192.168.8.100';
      setBackendIP(fallbackIP);
      console.log('[Login] Auto-configured backendIP on login:', fallbackIP);
    }

    console.log('[Login] submit pressed', {
      username,
      passwordLength: password.length,
      hasStoredToken: Boolean(storage.getString(AUTH_SESSION_KEYS.token)),
      hasStoredUsername: Boolean(storage.getString(AUTH_SESSION_KEYS.username)),
    });

    const isUsernameValid = validateUsername(username);
    const isPasswordValid = validatePassword(password);

    console.log('[Login] validation result', {
      isUsernameValid,
      isPasswordValid,
      usernameError,
      passwordError,
    });

    if (!isUsernameValid || !isPasswordValid) {
      console.log('[Login] stopped before API call because validation failed');
      return;
    }

    // ─── DEVICE CHECK ───────────────────────────────────────────────────────────
    try {
      console.log('[Login] Fetching Unique Device ID...');
      const deviceId = await getUniqueDeviceId();

      if (!deviceId) {
        Alert.alert(
          'Device Error',
          'Could not identify this device. Please check app permissions and try again.'
        );
        return;
      }

      console.log('[Login] Calling device check-in...');

      // ✅ SINGLE call only — removed duplicate apiClient.checkDeviceStatus()
      // Previously two calls were made causing a race condition:
      //   Call 1: apiClient.checkDeviceStatus(deviceId) → POST /check-in (result ignored)
      //   Call 2: fetch('/check-in') → same endpoint (result used)
      // Race condition: Call 1 inserts device as "pending", Call 2 reads it as "pending"
      // Fix: Remove Call 1 entirely, use only Call 2 result
      const baseIP = (global as any).backendIP || devIP.trim() || '192.168.8.100';
      let deviceData: any = null;
      let deviceCheckOk   = false;

      try {
        const deviceCheckResponse = await fetch(
          `http://${baseIP}:3000/api/devices/check-in`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ deviceId }),
          }
        );
        deviceData    = await deviceCheckResponse.json();
        deviceCheckOk = deviceCheckResponse.ok;

        console.log('[Login] Device check-in response received:', {
          httpStatus:   deviceCheckResponse.status,
          deviceData,
          deviceCheckOk,
        });

      } catch (fetchError) {
        console.log('[Login] Device check-in fetch failed (server unreachable):', fetchError);
        Alert.alert(
          'Connection Error',
          'Unable to reach the server. Please check your network connection and try again.'
        );
        return;
      }

      // ✅ Approval status check from the SINGLE call result
      if (!deviceCheckOk || deviceData?.status === 'pending') {
        Alert.alert(
          'Approval Pending',
          `This device has been successfully registered in the system.\n\nYour Device ID:\n${deviceId}\n\nPlease inform your manager to approve this device to proceed.`
        );
        return;
      }

      // ✅ Reaches here only when deviceData.allowed === true (Admin Approved)
      console.log('[Login] Device authorized! Proceeding to user authentication.');

    } catch (deviceError) {
      console.log('[Login] Device Check Error:', deviceError);
      Alert.alert(
        'Connection Error',
        'Unable to verify device identity. Please ensure the backend server is running.'
      );
      return;
    }
    // ─── END DEVICE CHECK ───────────────────────────────────────────────────────

    // ─── USER AUTHENTICATION ────────────────────────────────────────────────────
    try {
      console.log('[Login] calling apiClient.login');
      const result = await apiClient.login(username, password);

      console.log('[Login] apiClient.login response', {
        ok:                 result.ok,
        hasData:            Boolean(result.data),
        tokenPresent:       Boolean(result.data?.token),
        username:           result.data?.user?.user ?? username,
        error:              result.error,
        message:            result.data?.message,
        menuBootstrapCount: result.data?.user?.menuBootstrapData
          ? result.data.user.menuBootstrapData.length
          : 0,
      });

      if (!result.ok) {
        const msg: string = result.data?.message ?? result.error ?? '';

        console.log('[Login] API returned non-ok response', {
          message:  msg,
          rawData:  result.data,
          rawError: result.error,
        });

        if (
          msg.toLowerCase().includes('user not found') ||
          msg.toLowerCase().includes('invalid credentials')
        ) {
          setPasswordError('Incorrect username or password. Please try again.');
        } else if (msg.toLowerCase().includes('network request failed')) {
          setPasswordError('Cannot connect to server. Check backend is running.');
        } else {
          setPasswordError(msg || 'Login failed. Please try again.');
        }
        return;
      }

      if (result.data?.token) {
        const loggedInUserName = String(
          result.data?.user?.username ?? username
        ).trim();

        const loggedInUserId =
          result.data?.user?.userId   ??
          result.data?.user?.UserId   ??
          result.data?.user?.UserCode ??
          result.data?.user?.userCode ??
          result.data?.user?.LogId    ??
          result.data?.user?.StaffId  ??
          result.data?.user?.EmpId    ??
          '999';

        const loggedInGroupId =
          result.data?.user?.GroupId ??
          result.data?.user?.groupId ??
          result.data?.groupId       ??
          '1';

        console.log('[Login Success Check] Extracted Group ID:', loggedInGroupId);

        setSession({
          token: result.data.token,
          user: {
            userName:       result.data.user?.userName || loggedInUserName,
            userId:         loggedInUserId,
            groupId:        loggedInGroupId,
            assignedFloors:
              result.data.assignedFloors      ||
              result.data.user?.assignedFloors ||
              [],
            picture:  result.data.user?.picture  || null,
            locCode:  result.data.user?.locCode  || null,
          },
        });

        void prefetchMenuBootstrapData().catch((error) => {
          console.log('[Login] menu prefetch failed (non-fatal, cache used)', error);
        });

        router.replace('/(tabs)');
        return;

      } else {
        setPasswordError('Login succeeded but no token was returned.');
        return;
      }

    } catch (e) {
      console.log('[Login] caught error during login flow', e);
      setPasswordError(
        'Cannot connect to server. Check backend URL and server status.'
      );
    }
    // ─── END USER AUTHENTICATION ─────────────────────────────────────────────────
  };

  // ─── DEV IP CONFIRM ──────────────────────────────────────────────────────────
  const handleConfirmIP = () => {
    const formattedIP = devIP.trim();
    if (!formattedIP) {
      Alert.alert('IP Error', 'Please enter a valid IP address.');
      return;
    }
    setBackendIP(formattedIP);
    Alert.alert('IP Configured', `Backend IP set to: ${formattedIP}`);
  };

  const EyeIcon = ({ visible }: { visible: boolean }) => (
    <Ionicons
      name={visible ? 'eye' : 'eye-off'}
      size={eyeSize}
      color="rgba(0,0,0,0.5)"
    />
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { paddingHorizontal: hPad }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View
        style={[
          styles.topCircle,
          {
            width:  isTablet ? 220 : 160,
            height: isTablet ? 220 : 160,
            top:    isTablet ? 120 : 80,
          },
        ]}
      />
      <View
        style={[
          styles.bottomCircle,
          {
            width:  isTablet ? 240 : 190,
            height: isTablet ? 240 : 190,
          },
        ]}
      />

      {/* LOGO */}
      <View style={[styles.logoContainer, { marginTop: logoMT }]}>
        <Image
          source={require('../../assets/images/CAPTURE 1.png')}
          style={{ width: logoW, height: logoH }}
          resizeMode="contain"
        />
      </View>

      {/* HEADER */}
      <View style={{ marginTop: headerMT }}>
        <Text style={[styles.title, { fontSize: titleFs }]}>Welcome !</Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Enter your details to sign in.
        </Text>
      </View>

      {/* USERNAME */}
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
            setUsername(text);
            if (usernameError) validateUsername(text);
          }}
          onBlur={async () => {
            const localOk = validateUsername(username);
            if (!localOk) return;

            setUsernameChecking(true);
            try {
              const result = await apiClient.checkUsername(username);
              if (result.status === 'found') {
                setUsernameError('');
              } else if (result.status === 'not_found') {
                setUsernameError('Username not found. Please check and try again.');
              } else if (result.status === 'server_unreachable') {
                setUsernameError('Cannot reach server. Check your network or backend IP.');
              } else if (result.status === 'db_error') {
                setUsernameError('Database error. Please try again later.');
              }
            } catch (_) {
              setUsernameError('Cannot reach server. Check your network or backend IP.');
            } finally {
              setUsernameChecking(false);
            }
          }}
        />
        {usernameChecking ? (
          <View style={styles.errorRow}>
            <Text style={[styles.errorText, { color: '#075EA7' }]}>
              Checking username…
            </Text>
          </View>
        ) : usernameError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{usernameError}</Text>
          </View>
        ) : null}
      </View>

      {/* PASSWORD */}
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
              if (passwordError) validatePassword(text);
            }}
            onBlur={() => validatePassword(password)}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword((v) => !v)}
          >
            <EyeIcon visible={showPassword} />
          </TouchableOpacity>
        </View>
        {passwordError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{passwordError}</Text>
          </View>
        ) : null}
      </View>

      {/* FORGOT PASSWORD */}
      <TouchableOpacity
        style={{ marginTop: forgotMT, alignSelf: 'flex-end' }}
        onPress={() => router.push('/auth/forgotpassword')}
      >
        <Text style={[styles.forgotText, { fontSize: forgotFs }]}>
          Forgot Password?
        </Text>
      </TouchableOpacity>

      {/* LOGIN BUTTON */}
      <TouchableOpacity
        style={[
          styles.loginButton,
          { height: btnH, borderRadius: btnRadius, marginTop: btnMT },
        ]}
        onPress={handleLogin}
      >
        <Text style={[styles.loginText, { fontSize: btnFs }]}>Login</Text>
      </TouchableOpacity>

      {/* SIGN UP */}
      <View style={[styles.signupContainer, { marginTop: signupMT }]}>
        <Text style={[styles.signupText, { fontSize: signupFs }]}>
          Don't have an account?
        </Text>
        <TouchableOpacity onPress={() => router.push('/auth/signup')}>
          <Text style={[styles.signupLink, { fontSize: signupFs }]}>{' '}Sign Up</Text>
        </TouchableOpacity>
      </View>

      {/* DEV IP CONFIG */}
      <View style={[styles.devContainer, { marginTop: signupMT }]}>
        <TextInput
          placeholder="Dev IP (e.g. 192.168.1.50)"
          placeholderTextColor="rgba(0,0,0,0.3)"
          style={[
            styles.devInput,
            {
              height:       Math.max(42, inputH * 0.8),
              borderRadius: inputRadius,
            },
          ]}
          value={devIP}
          onChangeText={setDevIP}
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[
            styles.devConfirmBtn,
            {
              height:       Math.max(42, inputH * 0.8),
              borderRadius: inputRadius,
            },
          ]}
          onPress={handleConfirmIP}
        >
          <Text style={styles.devBtnText}>Confirm</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#FFFFFF',
  },

  topCircle: {
    position:        'absolute',
    borderRadius:    110,
    backgroundColor: 'rgba(98,145,185,0.35)',
    left:            -70,
  },

  bottomCircle: {
    position:        'absolute',
    borderRadius:    110,
    backgroundColor: 'rgba(98,145,185,0.35)',
    bottom:          -60,
    right:           -70,
  },

  logoContainer: {
    alignItems: 'center',
  },

  title: {
    fontWeight:   '600',
    color:        '#000',
    marginBottom: 6,
  },

  subtitle: {
    color: '#555',
  },

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

  forgotText: {
    color:      '#075EA7',
    fontWeight: '500',
  },

  loginButton: {
    width:           '100%',
    backgroundColor: '#0062AA',
    justifyContent:  'center',
    alignItems:      'center',
  },

  loginText: {
    color:      '#fff',
    fontWeight: '700',
  },

  signupContainer: {
    flexDirection:  'row',
    justifyContent: 'center',
  },

  signupText: {
    color: '#3B4054',
  },

  signupLink: {
    color:      '#075EA7',
    fontWeight: '600',
  },

  devContainer: {
    flexDirection:  'row',
    width:          '100%',
    gap:            10,
    alignItems:     'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop:     15,
  },

  devInput: {
    flex:              2.2,
    borderWidth:       1.5,
    borderColor:       '#B0BEC5',
    paddingHorizontal: 14,
    color:             '#000',
    backgroundColor:   '#F8FAFC',
    fontSize:          14,
  },

  devConfirmBtn: {
    flex:            1,
    backgroundColor: '#334155',
    justifyContent:  'center',
    alignItems:      'center',
  },

  devBtnText: {
    color:      '#fff',
    fontWeight: '600',
    fontSize:   14,
  },
});