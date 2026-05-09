import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useWindowDimensions } from 'react-native';

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

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const logoWidth = isTablet ? 280 : Math.min(220, width * 0.7);
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.logoContainer}>
  <Image
    source={require('../../assets/images/CAPTURE 1.png')}
    style={[styles.logoImage, { width: logoWidth }]}
    resizeMode="contain"
  />
</View>
      <View style={styles.topCircle} />
      <View style={styles.bottomCircle} />

      <View style={styles.headerContainer}>
        <Text style={styles.title}>Welcome !</Text>
        <Text style={styles.subtitle}>Enter your details to sign in.</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Username"
          placeholderTextColor="rgba(0,0,0,0.5)"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
        />
      </View>

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

      <TouchableOpacity onPress={() => router.push('/auth/forgotpassword')}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
  style={styles.loginButton}
  onPress={() => router.replace('/(tabs)')}
>
  <Text style={styles.loginText}>Login</Text>
</TouchableOpacity>

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't have an account?</Text>
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
    width:220,
    height:80,
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
    borderColor: '#075EA7',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginTop: 20,
  },
  forgotText: {
    fontSize: 15,
    color: '#075EA7',
    fontWeight: '500',
  },
  loginButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#0062AA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  loginText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
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
