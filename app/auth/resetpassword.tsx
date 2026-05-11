import PasswordUpdatedModal from '@/components/PasswordUpdatedModal';
import { Ionicons } from '@expo/vector-icons';
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
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [modalVisible,    setModalVisible]    = useState(false);

  const router = useRouter();
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

  const isPasswordLengthValid = password.length >= 4 && password.length <= 8;
  const showMismatchMessage   = confirmPassword.length > 0 && password !== confirmPassword;

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

      {/*PASSWORD*/}
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

      {/* CONFIRM PASSWORD */}
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

      {/* RESET BUTTON */}
      <TouchableOpacity
        style={[styles.button, { height: btnH, borderRadius: btnRadius, marginTop: btnMT }]}
        onPress={() => {
          if (!isPasswordLengthValid || password !== confirmPassword) return;
          setModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, { fontSize: btnFs }]}>Reset Password</Text>
      </TouchableOpacity>

      <PasswordUpdatedModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSignIn={() => router.push('/auth/login')}
      />

      {/* SIGN UP LINK — unchanged */}
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
  container:    { flex: 1, backgroundColor: '#FFFFFF' },
  topCircle:    { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(98,145,185,0.35)', left: -70 },
  bottomCircle: { position: 'absolute', borderRadius: 110, backgroundColor: 'rgba(98,145,185,0.35)', bottom: -60, right: -70 },
  logoContainer:{ alignItems: 'center' },
  title:        { fontWeight: '600', color: '#000', marginBottom: 8 },
  subtitle:     { color: '#555' },

  // PASSWORD WRAPPER with eye button 
  inputWrapper: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#0062AA',
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

  button:         { width: '100%', backgroundColor: '#0062AA', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  buttonText:     { color: '#fff', fontWeight: '700' },
  validationText: { marginTop: 8, color: '#D64545', fontSize: 13, fontWeight: '500' },
  mismatchText:   { marginTop: 8, color: '#D64545', fontSize: 13, fontWeight: '500' },
  signupContainer:{ flexDirection: 'row', justifyContent: 'center' },
  signupText:     { color: '#3B4054' },
  signupLink:     { color: '#075EA7', fontWeight: '600' },
});