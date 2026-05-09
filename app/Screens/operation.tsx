import { useRouter } from 'expo-router';
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
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F3F3" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Image
            source={require('../../assets/icons/blackback.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Mode Selection</Text>
      </View>

      {/* Main Card */}
      <View style={styles.cardContainer}>
        <View style={styles.mainCard}>
          <View style={styles.grid}>

            {/* Dining */}
            <TouchableOpacity onPress={() => router.push('/Screens/tableselection')}
              style={[styles.modeCard, { backgroundColor: '#B9A0D5' }]}
            >
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
            <TouchableOpacity
              style={[styles.modeCard, { backgroundColor: '#8D9ED4' }]}
            >
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
            <TouchableOpacity
              style={[styles.modeCard, { backgroundColor: '#A9ABCF' }]}
            >
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
            <TouchableOpacity
              style={[styles.modeCard, { backgroundColor: '#BC8EB6' }]}
            >
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
    marginTop: 40,
    paddingHorizontal: 16,
  },

  backButton: {
    marginRight: 12,
  },

  backText: {
    fontSize: 30,
    color: '#000',
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '500',
    color: '#000',
  },

  cardContainer: {
    alignItems: 'center',
    marginTop: 60,
  },

  mainCard: {
    width: 370,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 30,

    elevation: 4,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
    marginBottom: 18,
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
  backIcon: {
    width: 30,
    height: 30,
  },
});