import { Ionicons } from '@expo/vector-icons';
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

  const isTablet = width >= 600;
  const isSmall  = height < 680;

  // ── RESPONSIVE VALUES ─────────────────────────────────────────────────────
  const headerH        = isTablet ? height * 0.25 : isSmall ? height * 0.28 : height * 0.25;
  const logoW          = isTablet ? 260            : isSmall ? 160           : Math.min(200, width * 0.6);
  const logoH          = isTablet ? 110            : isSmall ? 55            : 65;
  const greetSize      = isTablet ? 20             : isSmall ? 12            : 16;
  const nameSize       = isTablet ? 32             : isSmall ? 20            : 28;
  const dateSize       = isTablet ? 23             : isSmall ? 10            : 12;
  const sectionSize    = isTablet ? 32             : isSmall ? 18            : 20;
  const headerPaddingTop = isTablet ? 60           : isSmall ? 30            : 55;

  // ── CARD GRID VALUES ──────────────────────────────────────────────────────
  const contentOverlap = isTablet ? -18 : isSmall ? -10  : -25;
  const cardPadding    = isTablet ? 16  : 16;
  const cardGap        = isTablet ? 10  : 6;
  const cardWidth      = (width - cardPadding * 2 - cardGap) / 2;
  const cardHeight     = isTablet ? cardWidth * 0.62 : 160;
  const iconSize       = isTablet ? 50  : 42;
  const iconBox        = isTablet ? 74  : 60;
  const cardTitle      = isTablet ? 24  : 15;
  const cardSub        = isTablet ? 16  : 12;

  const cards: {
    title: string;
    subtitle: string;
    color: string;
    iconBg: string;
    route: string;
    ionIcon: React.ComponentProps<typeof Ionicons>['name'];
  }[] = [
    {
      title: 'Order Taking',
      subtitle: 'Table POS',
      color: 'rgba(255,153,142,0.5)',
      iconBg: 'rgba(255,153,142,0.6)',
      route: '/Screens/operation',
      ionIcon: 'receipt-outline',
    },
    {
      title: 'Dashboard',
      subtitle: 'Live Overview',
      color: 'rgba(151,173,210,0.5)',
      iconBg: 'rgba(151,173,210,0.6)',
      route: '/Screens/Dashboard',
      ionIcon: 'grid-outline',
    },
    {
      title: 'Menu Card',
      subtitle: 'Items & Pricing',
      color: 'rgba(255,248,131,0.5)',
      iconBg: 'rgba(255,248,131,0.6)',
      route: '/Screens/menutbl_selection',
      ionIcon: 'restaurant-outline',
    },
    {
      title: 'Feedback Collector',
      subtitle: 'Guest Feedback',
      color: 'rgba(129,113,183,0.5)',
      iconBg: 'rgba(129,113,183,0.6)',
      route: '/Screens/white',
      ionIcon: 'chatbubble-ellipses-outline',
    },
    {
      title: 'Sales Report',
      subtitle: 'Revenue Report',
      color: 'rgba(144,123,22,0.5)',
      iconBg: 'rgba(144,123,22,0.6)',
      route: '/Screens/white',
      ionIcon: 'bar-chart-outline',
    },
    {
      title: 'Settings',
      subtitle: 'System Controls',
      color: 'rgba(66,119,164,0.5)',
      iconBg: 'rgba(66,119,164,0.6)',
      route: '/Screens/settings',
      ionIcon: 'settings-outline',
    },
    {
  title: 'KDS',
  subtitle: 'Kitchen Display',
  color: 'rgba(34,139,87,0.5)',
  iconBg: 'rgba(34,139,87,0.6)',
  route: '/Screens/KDSHomeScreen',
  ionIcon: 'flame-outline',
},
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#002748" />

      {/* HEADER - fixed, not scrollable */}
      <View
        style={[
          styles.header,
          {
            height:            headerH,
            paddingHorizontal: cardPadding,
            paddingTop:        headerPaddingTop,  // ← updated
            paddingBottom:     isTablet ? 28 : isSmall ? 20 : 32,
          },
        ]}
      >
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
          <View style={styles.greetingBlock}>
            <Text style={[styles.greeting, { fontSize: greetSize }]}>{greetingText}</Text>
            <Text
              style={[styles.name, { fontSize: nameSize }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {displayName}
            </Text>
          </View>

          <View style={styles.dateContainer}>
            <Text style={[styles.dateText, { fontSize: dateSize }]}>{formattedDate}</Text>
          </View>
        </View>
      </View>

      {/* CONTENT - only Quick Access + cards scroll */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: cardPadding, marginTop: contentOverlap },
        ]}
        style={styles.content}
      >
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
                  width:           cardWidth,
                  height:          cardHeight,
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
                    width:           iconBox,
                    height:          iconBox,
                    borderRadius:    Math.round(iconBox * 0.27),
                  },
                ]}
              >
                <Ionicons name={item.ionIcon} size={iconSize} color="#002748" />
              </View>

              {/* TEXT BLOCK */}
              <View>
                <Text style={[styles.cardTitle,    { fontSize: cardTitle }]}>{item.title}</Text>
                <Text style={[styles.cardSubtitle, { fontSize: cardSub   }]}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
    paddingBottom: 10,
  },

  // ── HEADER ──────────────────────────────────
  header: {
    backgroundColor: '#002748',
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
  greetingBlock: {
    flex: 1,
    marginRight: 10,
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
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 30,
    marginBottom: 20,
  },

  // ── GRID ────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 30,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    justifyContent: 'space-between',
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
    color: '#111827',
  },
  cardSubtitle: {
    color: '#6B7280',
    marginTop: 2,
  },
});