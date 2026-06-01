import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useAuthStore } from '../../services/authStore';

function CustomBottomBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const { height } = useWindowDimensions();
const { width } = useWindowDimensions();
const isTablet = width >= 600;
const iconSize = isTablet ? 32 : 22;
const textSize = isTablet ? 16 : 12;
const navHeight = isTablet ? 100 : 80;

  const handleLogout = async () => {
    await clearSession();
    router.replace('/auth/login');
  };

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate(state.routeNames[0])}
      >
        <Ionicons name="home" size={iconSize} color="#0f2940" />
        <Text style={[styles.navText, { fontSize: textSize }]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Logout',
              style: 'destructive',
              onPress: () => {
                void handleLogout();
              },
            },
          ]);
        }}
      >
        <MaterialCommunityIcons name="logout" size={iconSize} color="#0f2940" />
        <Text style={[styles.navText, { fontSize: textSize }]}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomBottomBar {...props} />}
      
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 80,
    backgroundColor: 'rgb(66, 118, 164)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  navItem: {
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  navText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
