import AuthFormLayout from '../../components/AuthFormLayout';
import { OperationalColors } from '../../constants/operationalTheme';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Image,

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
  const logoW = Math.min(340, width * 0.78);
  const logoH = isTablet ? 122 : isSmall ? 82 : 98;
  const logoMT = isSmall ? 16 : 24;

  const titleFs = isTablet ? 32 : 27;
  const subtitleFs = 13;
  const headerMT = 22;

  const noteFs      = isTablet ? 20  : isSmall ? 12  : 14;
  const noteMT      = isTablet ? 40  : isSmall ? 24  : 36;

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
    <AuthFormLayout padding={hPad}>
      <StatusBar barStyle="dark-content" backgroundColor={OperationalColors.canvas} />

      {/*  DECORATIVE CIRCLES  */}

      {/* LOGO */}
      <View style={[styles.logoContainer, { marginTop: logoMT }]}>
        <Image
          source={require('../../assets/images/millamirissa.png')}
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
        <Text style={styles.fieldLabel}>Username</Text>
        <TextInput
          placeholder="Enter your username"
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
    </AuthFormLayout>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { color: OperationalColors.primary, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  container: {
    flex: 1,
    backgroundColor: OperationalColors.canvas,
  },

  
  topCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(168,139,98,0.54)',
    left: -58,
  },
  bottomCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(168,139,98,0.54)',
    bottom: -40,
    right: -50,
  },

  
  logoContainer: {
    alignItems: 'center',
  },

  
  title: {
    fontWeight: '600',
    color: OperationalColors.text,
    marginBottom: 8,
  },
  subtitle: {
    color: OperationalColors.muted,
  },

  
  noteContainer: {
    alignItems: 'center',
  },
  noteText: {
    color: OperationalColors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  boldText: {
    fontWeight: '700',
  },

 
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: OperationalColors.border,
    paddingHorizontal: 16,
    color: OperationalColors.text,
    backgroundColor: OperationalColors.surface,
  },

  
  button: {
    width: '100%',
    backgroundColor: OperationalColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: OperationalColors.onPrimary,
    fontWeight: '700',
  },

  
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    color: OperationalColors.text,
  },
  signupLink: {
    color: OperationalColors.primary,
    fontWeight: '600',
  },
});