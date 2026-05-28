import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { apiClient } from '../../services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const { width, height } = useWindowDimensions();

  // ── BREAKPOINTS ────────────────────────────────
  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  // ── RESPONSIVE VALUES (matches login/signup) ───
  const logoW       = isTablet ? 280 : isSmall ? 160 : Math.min(212, width * 0.7);
  const logoH       = isTablet ? 90  : isSmall ? 50  : 75;
  const logoMT      = isTablet ? 80  : isSmall ? 30  : 60;

  const titleFs     = isTablet ? 48 : isSmall ? 18  : 22;
  const subtitleFs  = isTablet ? 24  : isSmall ? 12  : 13;
  const headerMT    = isTablet ? 50 : isSmall ? 20  : 32;

  const noteFs      = isTablet ? 20  : isSmall ? 12  : 14;
  const noteMT      = isTablet ? 40  : isSmall ? 24  : 36;

  const inputH      = isTablet ? 72  : isSmall ? 48  : 54;
  const inputFs     = isTablet ? 24  : isSmall ? 14  : 16;
  const inputMT     = isTablet ? 32  : isSmall ? 20  : 28;
  const inputRadius = isTablet ? 16  : 12;

  const btnH        = isTablet ? 72  : isSmall ? 48  : 54;
  const btnFs       = isTablet ? 24  : isSmall ? 17  : 20;
  const btnMT       = isTablet ? 24  : isSmall ? 14  : 20;
  const btnRadius   = isTablet ? 16  : 12;

  const signupFs    = isTablet ? 24  : isSmall ? 13  : 14;
  const signupMT    = isTablet ? 24  : isSmall ? 14  : 18;
  const hPad        = isTablet ? 40  : 20;

  const [phoneNumber, setPhoneNumber] = useState('');
const [message, setMessage] = useState('');

  useEffect(() => {
    if (!username.trim()) {
      setMessage('');
      setPhoneNumber('');
      return;
    }

    const validateUsername = async () => {
      try {
        const response = await apiClient.forgotPassword(username);
          if (response.ok) {
            setPhoneNumber(response.data.phoneNumber);
            setMessage(`Please verify your account using the OTP that will be sent to ${response.data.phoneNumber}.`);
          } else {
            setMessage('Please enter valid username');
            setPhoneNumber('');
          }
        } catch (e) {
          const error: any = e as any;
          setMessage('Please enter valid username');
          setPhoneNumber('');
      }
    };

    validateUsername();
  }, [username]);

  return (
    <SafeAreaView style={[styles.container, { paddingHorizontal: hPad }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/*  DECORATIVE CIRCLES  */}
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
        <Text style={[styles.title, { fontSize: titleFs }]}>
          Forgot Password?
        </Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Enter your username to reset password.
        </Text>
      </View>

      {/* USERNAME INPUT */}
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

      {/* OTP NOTE */}
     {message !== '' && (
  <View style={[styles.noteContainer, { marginTop: noteMT }]}>
    <Text style={[styles.noteText, { fontSize: noteFs }]}>{message}</Text>
  </View>
)}

      {/* RESET PASSWORD BUTTON - Only show if valid username */}
      {phoneNumber && (
        <TouchableOpacity
          style={[
            styles.button,
            { height: btnH, borderRadius: btnRadius, marginTop: btnMT },
          ]}
          onPress={() => router.push({
            pathname: '/auth/resetpassword',
            params: { username },
          })}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, { fontSize: btnFs }]}>
            Proceed to Reset
          </Text>
        </TouchableOpacity>
      )}

      {/*  SIGN UP LINK */}
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

  
  topCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(97,145,185,0.54)',
    left: -58,
  },
  bottomCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(97,145,185,0.54)',
    bottom: -40,
    right: -50,
  },

  
  logoContainer: {
    alignItems: 'center',
  },

  
  title: {
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    color: '#555',
  },

  
  noteContainer: {
    alignItems: 'center',
  },
  noteText: {
    color: '#000',
    textAlign: 'center',
    lineHeight: 24,
  },
  boldText: {
    fontWeight: '700',
  },

 
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#075EA7',
    paddingHorizontal: 16,
    color: '#000',
    backgroundColor: '#fff',
  },

  
  button: {
    width: '100%',
    backgroundColor: '#0062AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
  },

  
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