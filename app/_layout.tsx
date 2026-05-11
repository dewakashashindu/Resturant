import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: 'auth/login',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      
       <Stack initialRouteName="auth/login">
  <Stack.Screen name="auth/login" options={{ headerShown: false }} />
  <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="auth/forgotpassword" options={{ headerShown: false }} />
   <Stack.Screen name="auth/resetpassword" options={{ headerShown: false }} />
  <Stack.Screen name="Screens/operation" options={{ headerShown: false }} />
  <Stack.Screen name="Screens/tableselection" options={{ headerShown: false }} />
  <Stack.Screen name="Screens/definetable" options={{ headerShown: false }} />
   <Stack.Screen name="Screens/paxcount" options={{ headerShown: false }} />
    <Stack.Screen name="Screens/selectitems" options={{ headerShown: false }} />
    <Stack.Screen name="Screens/cart" options={{ headerShown: false }} />
    <Stack.Screen name="Screens/settings" options={{ headerShown: false }} />
    <Stack.Screen name="auth/changepassword" options={{ headerShown: false }} />
<Stack.Screen name="Screens/BillingScreen" options={{ headerShown: false }} />

</Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
