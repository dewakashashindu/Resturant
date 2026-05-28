import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useAuthStore } from '../../services/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
 
  const [currentDate, setCurrentDate] = useState(new Date());

  const userName = useAuthStore((state) => state.user?.userName);
  const displayName = userName ? `Mr. ${userName}` : 'Mr. Perera';

  useEffect(() => {
    const id = setInterval(() => setCurrentDate(new Date()), 60 * 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const formattedDate = currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' });
  const getGreeting = (d: Date) => {
    const h = d.getHours();
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };
  const greetingText = getGreeting(currentDate);
  const isTablet  = width >= 600;
  const isSmall   = height < 680;

  // ── RESPONSIVE VALUES ─────────────────────────
  const headerH     = isTablet ? height * 0.22 : height * 0.35;
  const logoW       = isTablet ? 260 : Math.min(200, width * 0.6);
  const logoH       = isTablet ? 70  : 55;
  const greetSize   = isTablet ? 20  : 15;
  const nameSize    = isTablet ? 32  : 24;
  const dateSize    = isTablet ? 13  : 10;
  const sectionSize = isTablet ? 22  : 18;

  // Card: 2 columns with gap
  const cardPadding = isTablet ? 20 : 16;
  const cardGap     = isTablet ? 16 : 12;
  const cardWidth   = (width - cardPadding * 2 - cardGap) / 2;
  const cardHeight  = isTablet ? cardWidth * 0.42 : 140;

  const iconSize    = isTablet ? 40 : 28;
  const iconBox     = isTablet ? 64 : 50;
  const cardTitle   = isTablet ? 20 : 15;
  const cardSub     = isTablet ? 15 : 12;

  const cards = [
    {
      title: 'Order Taking',
      subtitle: 'Table POS',
      color: 'rgba(255,153,142,0.5)',
      iconBg: 'rgba(255,153,142,0.6)',
      route: '/Screens/operation',
      icon: require('../../assets/icons/ordertaking.png'),
    },
    {
      title: 'Dashboard',
      subtitle: 'Live Overview',
      color: 'rgba(151,173,210,0.5)',
      iconBg: 'rgba(151,173,210,0.6)',
      route: '/Screens/dashboard',
      icon: require('../../assets/icons/dashboard.png'),
    },
    {
      title: 'Menu Card',
      subtitle: 'Items & Pricing',
      color: 'rgba(255,248,131,0.5)',
      iconBg: 'rgba(255,248,131,0.6)',
      route: '/Screens/menu',
      icon: require('../../assets/icons/menu.png'),
    },
    {
      title: 'NPS Collector',
      subtitle: 'Guest Feedback',
      color: 'rgba(129,113,183,0.5)',
      iconBg: 'rgba(129,113,183,0.6)',
      route: '/Screens/nps',
      icon: require('../../assets/icons/nps.png'),
    },
    {
      title: 'Sales Report',
      subtitle: 'Revenue Report',
      color: 'rgba(144,123,22,0.5)',
      iconBg: 'rgba(144,123,22,0.6)',
      route: '/Screens/salesreport',
      icon: require('../../assets/icons/salesreports.png'),
    },
    {
      title: 'Settings',
      subtitle: 'System Controls',
      color: 'rgba(66,119,164,0.5)',
      iconBg: 'rgba(66,119,164,0.6)',
      route: '/Screens/settings',
      icon: require('../../assets/icons/settings.png'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#002748" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={[styles.header, { height: headerH, paddingHorizontal: cardPadding }]}>
          <View style={styles.circle} />

          {/* LOGO */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/CAPTURE 1.png')}
              style={{ width: logoW, height: logoH }}
              resizeMode="contain"
            />
          </View>

          {/* GREETING ROW */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.greeting, { fontSize: greetSize }]}>{greetingText}</Text>
              <Text style={[styles.name, { fontSize: nameSize }]}>{displayName}</Text>
            </View>

            <View style={styles.dateContainer}>
              <Text style={[styles.dateText, { fontSize: dateSize }]}>{formattedDate}</Text>
            </View>
          </View>
        </View>

        {/* CONTENT */}
        <View style={[styles.content, { paddingHorizontal: cardPadding }]}>
          <Text style={[styles.sectionTitle, { fontSize: sectionSize }]}>
            Quick Access
          </Text>

          {/* GRID */}
          <View style={[styles.grid, { gap: cardGap }]}>
            {cards.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.card,
                  {
                    backgroundColor: item.color,
                    width: cardWidth,
                    height: cardHeight,
                  },
                ]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={styles.cardCircle} />

                {/* ICON BOX */}
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: item.iconBg,
                      width: iconBox,
                      height: iconBox,
                      borderRadius: isTablet ? 16 : 12,
                    },
                  ]}
                >
                  <Image
                    source={item.icon}
                    style={{ width: iconSize, height: iconSize }}
                    resizeMode="contain"
                  />
                </View>

                <Text style={[styles.cardTitle, { fontSize: cardTitle }]}>
                  {item.title}
                </Text>
                <Text style={[styles.cardSubtitle, { fontSize: cardSub }]}>
                  {item.subtitle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },

  // ── HEADER ──────────────────────────────────
header: {
  backgroundColor: '#002748',
  paddingTop: 100,    // ← reduce this (try 25-35)
  paddingBottom: 40,
  justifyContent: 'space-between',
},
  circle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0,98,170,0.2)',
    top: -60,
    right: -60,
  },
  logoContainer: {
    alignItems: 'center',
    
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  greeting: {
    color: '#fff',
    
  },
  name: {
    color: '#fff',
    fontWeight: '700',
  },
  dateContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: {
    color: '#fff',
  },

  // ── CONTENT ─────────────────────────────────
  content: {
    backgroundColor: '#fff',
    marginTop: -25,
    paddingTop: 30,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 20,
  },

  // ── GRID ────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end', // push text to bottom
  },
  cardCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.15)',
    top: -15,
    right: -15,
  },
  iconBox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontWeight: '600',
    color: '#111',
  },
  cardSubtitle: {
    opacity: 0.6,
    color: '#111',
    marginTop: 2,
  },
});