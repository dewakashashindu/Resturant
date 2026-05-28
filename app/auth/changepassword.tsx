import PasswordUpdatedModal from '@/components/PasswordUpdatedModal';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { apiClient } from '../../services/api';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [oldPassword,     setOldPassword]     = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld,     setShowOld]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [oldPasswordError, setOldPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmError,     setConfirmError]     = useState('');

  // ─── Breakpoints ──────────────────────────────────────────────────────────
  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  const logoW        = isTablet ? 280 : isSmall ? 160 : Math.min(212, width * 0.7);
  const logoH        = isTablet ? 90  : isSmall ? 50  : 75;
  const logoMT       = isTablet ? 80  : isSmall ? 30  : 60;
  const titleFs      = isTablet ? 28  : isSmall ? 18  : 22;
  const subtitleFs   = isTablet ? 16  : isSmall ? 12  : 13;
  const headerMT     = isTablet ? 40  : isSmall ? 20  : 32;
  const inputH       = isTablet ? 62  : isSmall ? 48  : 54;
  const inputFs      = isTablet ? 20  : isSmall ? 14  : 16;
  const inputMT      = isTablet ? 24  : isSmall ? 14  : 20;
  const inputRadius  = isTablet ? 16  : 12;
  const eyeSize      = isTablet ? 26  : 22;
  const btnH         = isTablet ? 62  : isSmall ? 48  : 54;
  const btnFs        = isTablet ? 22  : isSmall ? 17  : 20;
  const btnMT        = isTablet ? 32  : isSmall ? 20  : 24;
  const btnRadius    = isTablet ? 16  : 12;
  const hPad         = isTablet ? 40  : 16;
  const backIconSize = isTablet ? 56  : 44;

  // ─── Pattern ──────────────────────────────────────────────────────────────
  const passwordPattern = /^[A-Za-z0-9!@#]+$/;

  // ─── Validators (real-time) ───────────────────────────────────────────────
  const validateOldPassword = (value: string): boolean => {
    if (!value) {
      setOldPasswordError('');
      return false;
    }
    if (!passwordPattern.test(value)) {
      setOldPasswordError('Password can only contain letters, numbers, and ! @ #');
      return false;
    }
    if (value.length < 4) {
      setOldPasswordError('Password must be at least 4 characters.');
      return false;
    }
    if (value.length > 8) {
      setOldPasswordError('Password must be no more than 8 characters.');
      return false;
    }
    setOldPasswordError('');
    return true;
  };

  const validateNewPassword = (value: string): boolean => {
    if (!value) {
      setNewPasswordError('');
      return false;
    }
    if (!passwordPattern.test(value)) {
      setNewPasswordError('Password can only contain letters, numbers, and ! @ #');
      return false;
    }
    if (value.length < 4) {
      setNewPasswordError('Password must be at least 4 characters.');
      return false;
    }
    if (value.length > 8) {
      setNewPasswordError('Password must be no more than 8 characters.');
      return false;
    }
    setNewPasswordError('');
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

    if (!oldPassword.trim()) {
      setOldPasswordError('Please enter your current password.');
      valid = false;
    } else if (!validateOldPassword(oldPassword)) {
      valid = false;
    }

    if (!newPassword.trim()) {
      setNewPasswordError('Please enter a new password.');
      valid = false;
    } else if (!validateNewPassword(newPassword)) {
      valid = false;
    }

    if (!confirmPassword.trim()) {
      setConfirmError('Please confirm your new password.');
      valid = false;
    } else if (!validateConfirm(confirmPassword, newPassword)) {
      valid = false;
    }

    return valid;
  };

  // ─── Submit handler ───────────────────────────────────────────────────────
  const handleSetPassword = async () => {
    if (!validateAll()) return;

    try {
      const username = await AsyncStorage.getItem('username');

      if (!username) {
        setOldPasswordError('Session expired. Please sign in again.');
        return;
      }

      const result = await apiClient.changePassword(username, oldPassword, newPassword);

      if (!result.ok) {
        const msg: string = result.data?.message ?? '';
        if (
          msg.toLowerCase().includes('current password') ||
          msg.toLowerCase().includes('incorrect')
        ) {
          setOldPasswordError('Current password is incorrect.');
        } else {
          setNewPasswordError(msg || 'Failed to change password. Please try again.');
        }
        return;
      }

      setModalVisible(true);
    } catch (e) {
      const err: any = e as any;
      console.error('Change password error:', err);
      setNewPasswordError('Something went wrong. Please try again.');
    }
  };

  const EyeIcon = ({ visible }: { visible: boolean }) => (
    <Ionicons
      name={visible ? 'eye' : 'eye-off'}
      size={eyeSize}
      color="rgba(0,0,0,0.5)"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    />
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { paddingHorizontal: hPad }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* BACK BUTTON */}
      <TouchableOpacity style={styles.backButtonAbsolute} onPress={() => router.back()}>
        <Image
          source={require('../../assets/icons/blackback.png')}
          style={{ width: backIconSize, height: backIconSize }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* DECORATIVE CIRCLES */}
      <View style={[styles.topCircle, {
        width:  isTablet ? 220 : 146,
        height: isTablet ? 220 : 146,
        top:    isTablet ? 120 : 80,
      }]} />
      <View style={[styles.bottomCircle, {
        width:  isTablet ? 240 : 182,
        height: isTablet ? 240 : 182,
      }]} />

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
        <Text style={[styles.title, { fontSize: titleFs }]}>Change Password</Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Set a new password for your account.
        </Text>
      </View>

      {/* ── OLD PASSWORD ── */}
      <View style={{ marginTop: inputMT }}>
        <View
          style={[
            styles.inputWrapper,
            {
              height:       inputH,
              borderRadius: inputRadius,
              borderColor:  oldPasswordError ? '#D32F2F' : '#0062AA',
            },
          ]}
        >
          <TextInput
            placeholder="Old Password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showOld}
            style={[styles.input, { fontSize: inputFs }]}
            value={oldPassword}
            onChangeText={(text) => {
              setOldPassword(text);
              validateOldPassword(text);
            }}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowOld(!showOld)}>
            <EyeIcon visible={showOld} />
          </TouchableOpacity>
        </View>
        {oldPasswordError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{oldPasswordError}</Text>
          </View>
        ) : null}
      </View>

      {/* ── NEW PASSWORD ── */}
      <View style={{ marginTop: inputMT }}>
        <View
          style={[
            styles.inputWrapper,
            {
              height:       inputH,
              borderRadius: inputRadius,
              borderColor:  newPasswordError ? '#D32F2F' : '#0062AA',
            },
          ]}
        >
          <TextInput
            placeholder="New Password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showNew}
            style={[styles.input, { fontSize: inputFs }]}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              validateNewPassword(text);
              if (confirmPassword) validateConfirm(confirmPassword, text);
            }}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
            <EyeIcon visible={showNew} />
          </TouchableOpacity>
        </View>
        {newPasswordError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{newPasswordError}</Text>
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
            style={[styles.input, { fontSize: inputFs }]}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              validateConfirm(text, newPassword);
            }}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
            <EyeIcon visible={showConfirm} />
          </TouchableOpacity>
        </View>
        {confirmError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color="#D32F2F" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{confirmError}</Text>
          </View>
        ) : null}
      </View>

      {/* ── SET PASSWORD BUTTON ── */}
      <TouchableOpacity
        style={[styles.button, { height: btnH, borderRadius: btnRadius, marginTop: btnMT }]}
        onPress={handleSetPassword}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, { fontSize: btnFs }]}>Set Password</Text>
      </TouchableOpacity>

      <PasswordUpdatedModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSignIn={() => router.push('/auth/login')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#FFFFFF' },

  backButtonAbsolute: { position: 'absolute', top: 50, left: 16, zIndex: 10 },

  topCircle:    { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(97,145,185,0.54)', left: -58 },
  bottomCircle: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(97,145,185,0.54)', bottom: -40, right: -50 },

  logoContainer: { alignItems: 'center' },

  title:    { fontWeight: '600', color: '#000', marginBottom: 8 },
  subtitle: { color: '#555' },

  inputWrapper: {
    width:             '100%',
    borderWidth:       1.5,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    backgroundColor:   '#fff',
  },

  input: {
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

  button: {
    width:           '100%',
    backgroundColor: 'rgba(0,98,170,0.56)',
    justifyContent:  'center',
    alignItems:      'center',
    flexDirection:   'row',
    gap:             10,
  },

  buttonText: { color: '#FFF', fontWeight: '700' },
});