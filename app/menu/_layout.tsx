import { Stack } from 'expo-router';
import { CartProvider } from './CartContext';

export default function MenuLayout() {
  return (
    <CartProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CartProvider>
  );
}