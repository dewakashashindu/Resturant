import React from 'react';
import {
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ModeSelectionScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F3F3" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Mode Selection</Text>
      </View>

      {/* Main Card */}
      <View style={styles.mainCard}>
        <View style={styles.grid}>

          {/* Dining */}
          <TouchableOpacity style={[styles.modeCard, { backgroundColor: '#B9A0D5' }]}>
            <Image
              source={require('../../assets/images/dining.png')}
              style={styles.icon}
              resizeMode="contain"
            />

            <View style={styles.labelContainer}>
              <Text style={styles.label}>Dining</Text>
            </View>
          </TouchableOpacity>

          {/* Take Away */}
          <TouchableOpacity style={[styles.modeCard, { backgroundColor: '#8D9ED4' }]}>
            <Image
              source={require('../../assets/images/takeaway.png')}
              style={styles.icon}
              resizeMode="contain"
            />

            <View style={styles.labelContainer}>
              <Text style={styles.label}>Take Away</Text>
            </View>
          </TouchableOpacity>

          {/* Delivery */}
          <TouchableOpacity style={[styles.modeCard, { backgroundColor: '#A9ABCF' }]}>
            <Image
              source={require('../../assets/images/delivery.png')}
              style={styles.icon}
              resizeMode="contain"
            />

            <View style={styles.labelContainer}>
              <Text style={styles.label}>Delivery</Text>
            </View>
          </TouchableOpacity>

          {/* Pickup */}
          <TouchableOpacity style={[styles.modeCard, { backgroundColor: '#BC8EB6' }]}>
            <Image
              source={require('../../assets/images/pickup.png')}
              style={styles.icon}
              resizeMode="contain"
            />

            <View style={styles.labelContainer}>
              <Text style={styles.label}>Pickup</Text>
            </View>
          </TouchableOpacity>

        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⌂</Text>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>↪</Text>
          <Text style={styles.navText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 16,
  },

  backButton: {
    marginRight: 12,
  },

  backText: {
    fontSize: 28,
    color: '#000',
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '500',
    color: '#000',
  },

  mainCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 40,
    borderRadius: 12,
    paddingVertical: 30,
    elevation: 4,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    rowGap: 24,
  },

  modeCard: {
    width: 139,
    height: 153,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  icon: {
    width: 65,
    height: 65,
    marginBottom: 20,
  },

  labelContainer: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },

  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 76,
    backgroundColor: 'rgba(66,119,164,0.5)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  navItem: {
    alignItems: 'center',
  },

  navIcon: {
    fontSize: 24,
    color: '#000',
    marginBottom: 4,
  },

  navText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
  },
});