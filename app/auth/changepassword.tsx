import PasswordUpdatedModal from '@/components/PasswordUpdatedModal';
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

  // BREAKPOINTS 
  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  // RESPONSIVE VALUES (matches auth screens) 
  const logoW       = isTablet ? 280 : isSmall ? 160 : Math.min(212, width * 0.7);
  const logoH       = isTablet ? 90  : isSmall ? 50  : 75;
  const logoMT      = isTablet ? 80  : isSmall ? 30  : 60;

  const titleFs     = isTablet ? 28  : isSmall ? 18  : 22;
  const subtitleFs  = isTablet ? 16  : isSmall ? 12  : 13;
  const headerMT    = isTablet ? 40  : isSmall ? 20  : 32;

  const inputH      = isTablet ? 62  : isSmall ? 48  : 54;
  const inputFs     = isTablet ? 20  : isSmall ? 14  : 16;
  const inputMT     = isTablet ? 24  : isSmall ? 14  : 20;
  const inputRadius = isTablet ? 16  : 12;
  const eyeSize     = isTablet ? 26  : 22;

  const btnH        = isTablet ? 62  : isSmall ? 48  : 54;
  const btnFs       = isTablet ? 22  : isSmall ? 17  : 20;
  const btnMT       = isTablet ? 32  : isSmall ? 20  : 24;
  const btnRadius   = isTablet ? 16  : 12;

  const hPad        = isTablet ? 40  : 16;

  const handleSetPassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    // show confirmation modal instead of native alert
    setModalVisible(true);
  };

  // EYE ICON (show/hide password)
  const EyeIcon = ({ visible }: { visible: boolean }) => (
    <Ionicons
      name={visible ? 'eye' : 'eye-off'}
      size={eyeSize}
      color="rgba(0,0,0,0.5)"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { paddingHorizontal: hPad }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

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

      {/*HEADER */}
      <View style={{ marginTop: headerMT }}>
        <Text style={[styles.title, { fontSize: titleFs }]}>
          Change Password
        </Text>
        <Text style={[styles.subtitle, { fontSize: subtitleFs }]}>
          Set a new password for your account.
        </Text>
      </View>

      {/* OLD PASSWORD */}
      <View style={{ marginTop: inputMT }}>
        <View style={[styles.inputWrapper, { height: inputH, borderRadius: inputRadius }]}>
          <TextInput
            placeholder="Old Password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showOld}
            style={[styles.input, { fontSize: inputFs }]}
            value={oldPassword}
            onChangeText={setOldPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowOld(!showOld)}
          >
            <EyeIcon visible={showOld} />
          </TouchableOpacity>
        </View>
      </View>

      {/* NEW PASSWORD */}
      <View style={{ marginTop: inputMT }}>
        <View style={[styles.inputWrapper, { height: inputH, borderRadius: inputRadius }]}>
          <TextInput
            placeholder="New Password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showNew}
            style={[styles.input, { fontSize: inputFs }]}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowNew(!showNew)}
          >
            <EyeIcon visible={showNew} />
          </TouchableOpacity>
        </View>
      </View>

      {/*CONFIRM PASSWORD */}
      <View style={{ marginTop: inputMT }}>
        <View style={[styles.inputWrapper, { height: inputH, borderRadius: inputRadius }]}>
          <TextInput
            placeholder="Confirm Password"
            placeholderTextColor="rgba(0,0,0,0.4)"
            secureTextEntry={!showConfirm}
            style={[styles.input, { fontSize: inputFs }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowConfirm(!showConfirm)}
          >
            <EyeIcon visible={showConfirm} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SET PASSWORD BUTTON */}
      <TouchableOpacity
        style={[
          styles.button,
          { height: btnH, borderRadius: btnRadius, marginTop: btnMT },
        ]}
        onPress={handleSetPassword}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, { fontSize: btnFs }]}>
          Set Password
        </Text>
        
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  
  topCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(97,145,185,0.54)',
    left: -58,
  },
  bottomCircle: {
    position: 'absolute',
    borderRadius: 9999,
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

  
  inputWrapper: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#0062AA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    color: '#000',
    height: '100%',
  },
  eyeBtn: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  
  button: {
    width: '100%',
    backgroundColor: 'rgba(0,98,170,0.56)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
  },
  buttonIcon: {
    fontSize: 20,
  },
});