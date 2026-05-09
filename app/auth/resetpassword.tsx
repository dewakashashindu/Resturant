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
    View,
    useWindowDimensions,
} from 'react-native';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const router = useRouter();

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const logoWidth = isTablet ? 280 : Math.min(220, width * 0.7);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Background Circles */}
      <View style={styles.topCircle} />
      <View style={styles.bottomCircle} />

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/CAPTURE 1.png')}
          style={[styles.logoImage, { width: logoWidth }]}
          resizeMode="contain"
        />
      </View>

      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Reset Password</Text>

        <Text style={styles.subtitle}>
          Set a new password for your account.
        </Text>
      </View>

      {/* Password Input */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Password"
          placeholderTextColor="rgba(0,0,0,0.5)"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {/* Confirm Password */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Confirm Password"
          placeholderTextColor="rgba(0,0,0,0.5)"
          secureTextEntry
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>

      {/* Reset Button */}
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Reset Password</Text>
      </TouchableOpacity>

      {/* Sign Up */}
      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don’t have account?</Text>

        <TouchableOpacity onPress={() => router.push('/auth/signup')}>
          <Text style={styles.signupLink}> Sign Up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },

  topCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 100,
    backgroundColor: 'rgba(98,145,185,0.35)',
    top: 100,
    left: -70,
  },

  bottomCircle: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 100,
    backgroundColor: 'rgba(98,145,185,0.35)',
    bottom: -60,
    right: -70,
  },

  logoContainer: {
    alignItems: 'center',
    marginTop: 100,
  },

  logoImage: {
    width: 220,
    height: 80,
  },

  headerContainer: {
    marginTop: 50,
  },

  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: '#555',
  },

  inputContainer: {
    marginTop: 24,
  },

  input: {
    width: '100%',
    height: 54,
    borderWidth: 1,
    borderColor: '#0062AA',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },

  button: {
    width: '100%',
    height: 54,
    backgroundColor: '#0062AA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },

  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },

  signupText: {
    fontSize: 14,
    color: '#3B4054',
  },

  signupLink: {
    fontSize: 14,
    color: '#075EA7',
    fontWeight: '600',
  },
});