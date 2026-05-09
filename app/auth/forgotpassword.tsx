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
} from 'react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Background Circles */}
      <View style={styles.topCircle} />
      <View style={styles.bottomCircle} />

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/CAPTURE 1.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Forgot Password?</Text>

        <Text style={styles.subtitle}>
          Enter your username to reset password.
        </Text>
      </View>

      {/* OTP Note */}
      <View style={styles.noteContainer}>
        <Text style={styles.noteText}>
          Please verify your account using{'\n'}
          the OTP that will be sent to{' '}
          <Text style={styles.boldText}>07*****131.</Text>
        </Text>
      </View>

      {/* Username Input */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Username"
          placeholderTextColor="rgba(0,0,0,0.5)"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
        />
      </View>

      {/* Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/auth/resetpassword')}
      >
        <Text style={styles.buttonText}>Check Username</Text>
      </TouchableOpacity>

      {/* Signup */}
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
    width: 146,
    height: 145,
    borderRadius: 999,
    backgroundColor: 'rgba(97,145,185,0.54)',
    top: 136,
    left: -58,
  },

  bottomCircle: {
    position: 'absolute',
    width: 182,
    height: 181,
    borderRadius: 999,
    backgroundColor: 'rgba(97,145,185,0.54)',
    bottom: -40,
    right: -50,
  },

  logoContainer: {
    alignItems: 'center',
    marginTop: 90,
  },

  logo: {
    width: 212,
    height: 80,
  },

  headerContainer: {
    marginTop: 40,
  },

  title: {
    fontSize: 20,
    fontWeight: '500',
    color: '#000',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#000',
  },

  noteContainer: {
    marginTop: 50,
    alignItems: 'center',
  },

  noteText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    lineHeight: 22,
  },

  boldText: {
    fontWeight: '700',
  },

  inputContainer: {
    marginTop: 40,
  },

  input: {
    width: '100%',
    height: 54,
    borderWidth: 1,
    borderColor: '#075EA7',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
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
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },

  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
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