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
  View
} from 'react-native';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // ── BREAKPOINTS ────────────────────────────────
  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  // ── RESPONSIVE VALUES ──────────────────────────
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

      {/* ── HEADER TEXT ── */}
      <View style={{ marginTop: headerMT }}>
        <Text style={[styles.title, { fontSize: titleFs }]}>
          Welcome !
        </Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Enter your details to sign in.
        </Text>
      </View>

      {/* ── USERNAME ── */}
      <View style={{ marginTop: inputMT }}>
        <TextInput
          placeholder="Username"
          placeholderTextColor="rgba(0,0,0,0.4)"
          style={[
            styles.input,
            { height: inputH, fontSize: inputFs, borderRadius: inputRadius },
          ]}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
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
      </View>

      {/* ── FORGOT PASSWORD ── */}
      <TouchableOpacity
        style={{ marginTop: forgotMT, alignSelf: 'flex-end' }}
        onPress={() => router.push('/auth/forgotpassword')}
      >
        <Text style={[styles.forgotText, { fontSize: forgotFs }]}>
          Forgot Password?
        </Text>
      </TouchableOpacity>

      {/* ── LOGIN BUTTON ── */}
      <TouchableOpacity
        style={[
          styles.loginButton,
          { height: btnH, borderRadius: btnRadius, marginTop: btnMT },
        ]}
        onPress={() => router.replace('/(tabs)')}
        activeOpacity={0.85}
      >
        <Text style={[styles.loginText, { fontSize: btnFs }]}>Login</Text>
      </TouchableOpacity>

      {/* ── SIGN UP ── */}
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
    marginBottom: 6,
  },
  subtitle: {
    color: '#555',
  },

  // ── INPUT ───────────────────────────────────────
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#075EA7',
    paddingHorizontal: 16,
    color: '#000',
    backgroundColor: '#fff',
  },

  // ── FORGOT ──────────────────────────────────────
  forgotText: {
    color: '#075EA7',
    fontWeight: '500',
  },

  // ── BUTTON ──────────────────────────────────────
  loginButton: {
    width: '100%',
    backgroundColor: '#0062AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#fff',
    fontWeight: '700',
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