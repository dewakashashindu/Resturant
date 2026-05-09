import { useRouter } from 'expo-router';
import React from 'react';
import {
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // Responsive logic
  const isTablet = width >= 768;
  const headerHeight = height * (isTablet ? 0.3 : 0.4);
  const cardWidth = (width - 44) / 2; // 16 padding on each side + 12 gap

  const cards = [
    { title: 'Order Taking', subtitle: 'Table POS', color: 'rgba(255,153,142,0.5)', iconBg: 'rgba(255,153,142,0.6)', route: '/Screens/operation', icon: require('../../assets/icons/ordertaking.png') },
    { title: 'Dashboard', subtitle: 'Live Overview', color: 'rgba(151,173,210,0.5)', iconBg: 'rgba(151,173,210,0.6)', route: '/Screens/dashboard', icon: require('../../assets/icons/dashboard.png') },
    { title: 'Menu Card', subtitle: 'Items & Pricing', color: 'rgba(255,248,131,0.5)', iconBg: 'rgba(255,248,131,0.6)', route: '/Screens/menu', icon: require('../../assets/icons/menu.png') },
    { title: 'NPS Collector', subtitle: 'Guest Feedback', color: 'rgba(129,113,183,0.5)', iconBg: 'rgba(129,113,183,0.6)', route: '/Screens/nps', icon: require('../../assets/icons/nps.png') },
    { title: 'Sales Report', subtitle: 'Revenue Report', color: 'rgba(144,123,22,0.5)', iconBg: 'rgba(144,123,22,0.6)', route: '/Screens/salesreport', icon: require('../../assets/icons/salesreports.png') },
    { title: 'Settings', subtitle: 'System Controls', color: 'rgba(66,119,164,0.5)', iconBg: 'rgba(66,119,164,0.6)', route: '/Screens/settings', icon: require('../../assets/icons/settings.png') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#002748" />

      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.header, { height: headerHeight }]}>
          <View style={styles.circle} />
          
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/CAPTURE 1.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Good Morning,</Text>
              <Text style={styles.name}>Mr. Perera</Text>
            </View>

            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>Tuesday, May 05 2026</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.grid}>
            {cards.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.card, { backgroundColor: item.color, width: cardWidth }]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={styles.cardCircle} />
                <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                  <Image source={item.icon} style={styles.cardIcon} resizeMode="contain" />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, paddingBottom: 100 }, 
  header: {
    backgroundColor: '#002748',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  circle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,98,170,0.2)',
    top: -50,
    right: -50,
  },
  logoContainer: { alignItems: 'center' },
  logoImage: { width: 200, height: 60 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  greeting: { 
    color: '#fff',
     fontSize: 16 
    },
  name: { color: '#fff', fontSize: 26, fontWeight: '700' },
  dateContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: { color: '#fff', fontSize: 10 },
  content: {
    backgroundColor: '#fff',
    marginTop: -25,

    paddingHorizontal: 16,
    paddingTop: 30,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { height: 140, borderRadius: 20, marginBottom: 15, padding: 15, overflow: 'hidden' },
  cardCircle: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -10,
    right: -10,
  },
  iconBox: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardIcon: { width: 24, height: 24 },
  cardTitle: { marginTop: 15, fontSize: 15, fontWeight: '600' },
  cardSubtitle: { fontSize: 12, opacity: 0.6 },
});