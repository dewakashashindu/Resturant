import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getHomeLayout } from '../../constants/homeLayout';
import { OperationalColors as C } from '../../constants/operationalTheme';
import { useAuthStore } from '../../services/authStore';
import { useCartStore } from '../../services/cartStore';
import { useMenuSessionStore } from '../../services/menuSessionStore';
import { useOrderStore } from '../../services/orderStore';

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [currentDate, setCurrentDate] = useState(new Date());

  const userName = useAuthStore((state) => state.user?.userName);
  const stationType = useAuthStore((state) => state.user?.stationType);
  const savedMenuSession = useMenuSessionStore((state) => state.diningSession);
  const clearMenuSession = useMenuSessionStore((state) => state.clearDiningSession);
  const clearCart = useCartStore((state) => state.clearCart);
  const clearLastConfirmedOrder = useOrderStore((state) => state.clearLastConfirmedOrder);
  const displayName = userName ? `Mr. ${userName}` : 'Mr. Perera';

  useEffect(() => {
    const id = setInterval(() => setCurrentDate(new Date()), 60 * 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const formattedDate = currentDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });

  const getGreeting = (d: Date) => {
    const h = d.getHours();
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  const greetingText = getGreeting(currentDate);

  const openMenuCard = () => {
    if (!savedMenuSession) {
      router.push('/Screens/menutbl_selection' as any);
      return;
    }

    // Starting a new Menu Card order is an intentional choice, not a protected
    // exit. Therefore this prompt never asks for a staff password.
    Alert.alert(
      'Saved Menu Card',
      'A Menu Card order is already in progress. Would you like to continue it or clear it and start a new order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear & New',
          style: 'destructive',
          onPress: () => {
            clearCart();
            clearMenuSession();
            clearLastConfirmedOrder();
            router.push('/Screens/menutbl_selection' as any);
          },
        },
        {
          text: 'Continue Existing',
          onPress: () => router.push('/menu/menu_welcome' as any),
        },
      ],
    );
  };

  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = getHomeLayout(width - insets.left - insets.right, height, fontScale);

  const cards: {
    title: string;
    subtitle: string;
    visible: boolean;
    route: string;
    ionIcon: React.ComponentProps<typeof Ionicons>['name'];
  }[] = [
    {
      title: 'Order Taking',
      subtitle: 'Table POS',
      visible: true,
      route: '/Screens/operation',
      ionIcon: 'receipt-outline',
    },
    {
      title: 'Dashboard',
      subtitle: 'Live Overview',
      visible: false,
      route: '/Screens/Dashboard',
      ionIcon: 'grid-outline',
    },
    {
      title: 'Menu Card',
      subtitle: 'Items & Pricing',
      visible: true,
      route: '/Screens/menutbl_selection',
      ionIcon: 'restaurant-outline',
    },
    {
      title: 'Feedback Collector',
      subtitle: 'Guest Feedback',
      visible: false,
      route: '/Screens/white',
      ionIcon: 'chatbubble-ellipses-outline',
    },
    {
      title: 'Sales Report',
      subtitle: 'Revenue Report',
      visible: false,
      route: '/Screens/white',
      ionIcon: 'bar-chart-outline',
    },
    {
      title: 'Settings',
      subtitle: 'System Controls',
      visible: true,
      route: '/Screens/settings',
      ionIcon: 'settings-outline',
    },
    {
      title: 'KDS',
      subtitle: 'Kitchen Display',
      visible: true,
      route: '/Screens/KDSHomeScreen',
      ionIcon: 'flame-outline',
    },
    {
      title: 'BDS',
      subtitle: 'Bar Display',
      visible: true,
      route: '/Screens/BDSHomeScreen',
      ionIcon: 'wine-outline',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.header} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.headerInner, { paddingHorizontal: layout.padding }]}>
            <View pointerEvents="none" style={styles.circle} />
            <View style={styles.logoRow}>
              <Image
                source={require('../../assets/images/millamirissa.png')}
                style={{ width: layout.compact ? 126 : 164, height: layout.compact ? 48 : 64 }}
                resizeMode="contain"
                accessible accessibilityLabel="EChef Admin"
              />
            </View>
            <View style={[styles.headerRow, { flexDirection: layout.stackGreeting ? 'column' : 'row', alignItems: layout.stackGreeting ? 'flex-start' : 'flex-end' }]}>
              <View style={styles.greetingBlock}>
                <Text style={styles.greeting}>{greetingText}</Text>
                <Text style={[styles.name, { fontSize: layout.nameSize }]}>{displayName}</Text>
              </View>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={13} color={C.primary} />
                <Text style={styles.dateText}>{formattedDate}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={[styles.main, { paddingHorizontal: layout.padding }]}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <Text style={styles.sectionSubtitle}>Everything you need, in one place.</Text>
          <View style={[styles.grid, { gap: layout.gap }]}>
            {cards
              .filter((item) => item.visible)
              .filter((item) => item.title !== 'KDS' || stationType !== 'B')
              .filter((item) => item.title !== 'BDS' || stationType !== 'K')
              .map((item) => (
                <TouchableOpacity
                  key={item.title}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${item.subtitle}`}
                  style={[styles.card, { width: layout.cardWidth, minHeight: layout.cardMinHeight }, item.title === 'Order Taking' && styles.primaryCard]}
                  onPress={() => {
                    if (item.title === 'Menu Card') { openMenuCard(); return; }
                    router.push(item.route as any);
                  }}
                >
                  <View pointerEvents="none" style={styles.cardCircle} />
                  <View style={styles.cardTop}>
                    <View style={styles.iconBox}><Ionicons name={item.ionIcon} size={layout.iconSize} color={C.primary} /></View>
                    <Ionicons name="arrow-forward" size={16} color={C.muted} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { fontSize: layout.titleSize }]}>{item.title}</Text>
                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.header },
  content: { flex: 1, backgroundColor: C.canvas },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  header: { backgroundColor: C.header, borderBottomWidth: 1, borderBottomColor: C.border },
  headerInner: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingTop: 12, paddingBottom: 24, overflow: 'hidden' },
  logoRow: { width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  circle: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(255,253,250,0.18)', right: -70, top: -85 },
  headerRow: { gap: 12 },
  greetingBlock: { flexShrink: 1, minWidth: 0 },
  greeting: { color: C.primary, fontSize: 14, marginBottom: 5 },
  name: { color: C.text, fontWeight: '700' },
  dateContainer: { flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 1, backgroundColor: 'rgba(255,253,250,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 },
  dateText: { color: C.primary, fontSize: 11, flexShrink: 1 },
  main: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingTop: 24 },
  sectionTitle: { fontSize: 23, fontWeight: '700', color: C.text },
  sectionSubtitle: { fontSize: 13, color: C.muted, marginTop: 5, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  card: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, overflow: 'hidden', justifyContent: 'space-between' },
  primaryCard: { backgroundColor: C.surfaceAlt, borderColor: C.accent },
  cardCircle: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(213,192,156,0.10)', top: -30, right: -25 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  iconBox: { minWidth: 48, minHeight: 48, borderRadius: 14, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center', padding: 10 },
  cardText: { marginTop: 22 },
  cardTitle: { fontWeight: '700', color: C.text },
  cardSubtitle: { color: C.muted, fontSize: 12, marginTop: 5 },
});
