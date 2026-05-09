import React from 'react';
import { useWindowDimensions } from 'react-native';

import {
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';


export default function HomeScreen() {
const { width, height } = useWindowDimensions();
const isTablet = Math.max(width, height) >= 768;

const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;

const horizontalPadding = scale(16);
const headerHeight = Math.round(height * (isTablet ? 0.28 : 0.36));
const logoWidth = Math.round(Math.min(240, width * (isTablet ? 0.35 : 0.5)));
const cardWidth = isTablet ? (width - horizontalPadding * 2 - scale(12)) / 2 : (width - horizontalPadding * 2 - scale(12)) / 2;

  const logoTopMargin = isTablet ? 80 : 32;
const headerRowTopMargin = isTablet ? 18 : 8;
  const cards = [
    {
      title: 'Order Taking',
      subtitle: 'Table POS',
      color: 'rgba(255,153,142,0.5)',
      iconBg: 'rgba(255,153,142,0.6)',
    },
    {
      title: 'Dashboard',
      subtitle: 'Live Overview',
      color: 'rgba(151,173,210,0.5)',
      iconBg: 'rgba(151,173,210,0.6)',
    },
    {
      title: 'Menu Card',
      subtitle: 'Items & Pricing',
      color: 'rgba(255,248,131,0.5)',
      iconBg: 'rgba(255,248,131,0.6)',
    },
    {
      title: 'NPS Collector',
      subtitle: 'Guest Feedback',
      color: 'rgba(129,113,183,0.5)',
      iconBg: 'rgba(129,113,183,0.6)',
    },
    {
      title: 'Sales Report',
      subtitle: 'Revenue Report',
      color: 'rgba(144,123,22,0.5)',
      iconBg: 'rgba(144,123,22,0.6)',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#002748" />

     
        {/* HEADER */}
        <View style={[styles.header, { height: headerHeight, paddingHorizontal: horizontalPadding }] }>
          <View style={styles.circle} />

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/CAPTURE 1.png')}
              style={[styles.logoImage, { width: logoWidth }]}
              resizeMode="contain"
            />
          </View>

          {/* Greeting */}
         <View style={styles.headerRow}>
  <View style={styles.greetingContainer}>
    <Text style={styles.greeting}>Good Morning,</Text>
    <Text style={styles.name}>Mr. Perera</Text>
  </View>

  <View style={styles.dateContainer}>
    <Text style={styles.dateText}>Tuesday, May 05 2026</Text>
  </View>
</View>
        </View>

        {/* QUICK ACCESS */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Quick Access</Text>

          <View style={styles.grid}>
            {cards.slice(0, 4).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.card, { backgroundColor: item.color, width: cardWidth }]}
                activeOpacity={0.8}
              >
                <View style={styles.cardCircle} />
                <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}> 
                  <Text style={styles.icon}>⬛</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.lastRow}>
            <TouchableOpacity
              style={[
                styles.card,
                { backgroundColor: cards[4].color, width: cardWidth, alignSelf: 'center' },
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.cardCircle} />
              <View style={[styles.iconBox, { backgroundColor: cards[4].iconBg }]}> 
                <Text style={styles.icon}>⬛</Text>
              </View>
              <Text style={styles.cardTitle}>{cards[4].title}</Text>
              <Text style={styles.cardSubtitle}>{cards[4].subtitle}</Text>
            </TouchableOpacity>
          </View>
        </View>
    

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  header: {
    backgroundColor: '#002748',
    paddingTop: 30,
    overflow: 'hidden',
  },

  circle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 100,
    backgroundColor: 'rgba(0,98,170,0.22)',
    top: -40,
    right: -40,
  },

  logoContainer: {
    alignItems: 'center',
    marginTop: 70,
  },

 
  logoImage: {
    width:220,
    height:80,
  },

 greetingContainer: {
  marginTop: 0,
},

  greeting: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },

  name: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },

 dateContainer: {
  marginTop: 0,
  alignSelf: 'flex-end',
  backgroundColor: 'rgba(255,255,255,0.2)',
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
},

  dateText: {
    color: '#fff',
    fontSize: 13,
  },
headerRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  card: {
    height: 150,
    borderRadius: 16,
    marginBottom: 18,
    padding: 12,
    overflow: 'hidden',
    
  },
  lastRow: {
    flexDirection: 'row',
    justifyContent: 'center',
},

  cardCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    top: -20,
    right: -20,
  },

  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  icon: {
    fontSize: 18,
  },

  cardTitle: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },

  cardSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
  },

});