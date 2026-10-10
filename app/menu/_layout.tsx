import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import NotificationToastBubble from '../../components/NotificationToastBubble';
import { CartProvider } from './CartContext';

export default function MenuLayout() {
  return (
    <CartProvider>
      <View style={styles.root}>
        <Stack screenOptions={{ headerShown: false }} />
        {/* Nested Menu Stack renders above the root navigator on Android.
            This local overlay keeps foreground alerts visible on every Menu
            Card screen, detail modal and customer-cart screen. */}
        <NotificationToastBubble allowMenu />
      </View>
    </CartProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });