import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


function CustomBottomBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();

  return (
    <View style={styles.bottomNav}>
     <TouchableOpacity
  style={styles.navItem}
  onPress={() => navigation.navigate(state.routeNames[0])}
>
  <Ionicons name="home" size={22} color="#0f2940" />
  <Text style={styles.navText}>Home</Text>
</TouchableOpacity>

<TouchableOpacity
  style={styles.navItem}
 onPress={() => {
  Alert.alert('Logout', 'Are you sure you want to logout?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Logout',
      style: 'destructive',
      onPress: () => router.replace('/auth/login'),
    },
  ]);
}}
>
  <MaterialCommunityIcons name="logout" size={22} color="#0f2940" />
  <Text style={styles.navText}>Logout</Text>
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
    backgroundColor: 'rgba(66,119,164,0.5)',
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