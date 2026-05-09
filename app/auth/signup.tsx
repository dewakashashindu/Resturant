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
    TouchableOpacity, useWindowDimensions, View
} from 'react-native';

export default function SignUpScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const logoWidth = isTablet ? 280 : Math.min(220, width * 0.7);


  const handleSignUp = () => {
    if (!username || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    Alert.alert('Success', 'Account Created Successfully');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#fff"
      />
<View style={styles.logoContainer}>
  <Image
    source={require('../../assets/images/CAPTURE 1.png')}
    style={[styles.logoImage, { width: logoWidth }]}
    resizeMode="contain"
  />
</View>
      {/* Background Circles */}
      <View style={styles.topCircle} />
      <View style={styles.bottomCircle} />

    

      {/* Heading */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Create Account</Text>

        <Text style={styles.subtitle}>
          Enter your details to sign up.
        </Text>
      </View>

      {/* Username */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Username"
          placeholderTextColor="rgba(0,0,0,0.5)"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
        />
      </View>

      {/* Password */}
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

      {/* Sign Up Button */}
      <TouchableOpacity
        style={styles.signUpButton}
        onPress={handleSignUp}
      >
        <Text style={styles.signUpText}>Sign Up</Text>
      </TouchableOpacity>

      {/* Sign In */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>
          Already have an account?
        </Text>

        <TouchableOpacity onPress={() => router.push('/auth/login')}>
          <Text style={styles.signInText}> Sign In</Text>
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
    width: 150,
    height: 150,
    borderRadius: 100,
    backgroundColor: 'rgba(97,145,185,0.54)',
    top: 120,
    left: -60,
  },

  bottomCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 100,
    backgroundColor: 'rgba(97,145,185,0.54)',
    bottom: -50,
    right: -60,
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
    marginTop: 40,
  },

  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
  },

  subtitle: {
    marginTop: 8,
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

  signUpButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#0062AA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },

  signUpText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },

  footerText: {
    fontSize: 14,
    color: '#000',
  },

  signInText: {
    fontSize: 14,
    color: '#075EA7',
    fontWeight: '500',
  },
});