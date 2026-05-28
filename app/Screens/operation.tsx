import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

export default function ModeSelectionScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 600;
  const isSmall = height < 700;

  const hPad = isTablet ? 24 : 16;
  const headerMT = Platform.OS === 'android' ? (isTablet ? 20 : 16) : 10;
  const headerTitleFs = isTablet ? 32 : 24;
  const backIconSize = isTablet ? 56 : 44;

  const cardW = isTablet ? width * 0.9 : width - hPad * 2;

  const innerPad = isTablet ? 24 : 16;
  const modeGap = isTablet ? 20 : 14;
  const modeCardW = (cardW - innerPad * 2 - modeGap) / 2;
  const modeCardH = isTablet ? modeCardW * 0.72 : modeCardW * 0.8;

  const iconSize = isTablet ? modeCardW * 0.45 : modeCardW * 0.48;
  const labelFs = isTablet ? 18 : 12;
  const labelPadH = isTablet ? 32 : 16;
  const labelPadV = isTablet ? 8 : 4;

  const modes = [
    {
      label: 'Dining',
      color: '#B9A0D5',
      image: require('../../assets/images/dining.png'),
      route: '/Screens/tableselection',
    },
    {
      label: 'Take Away',
      color: '#8D9ED4',
      image: require('../../assets/images/takeaway.png'),
      route: null,
    },
    {
      label: 'Delivery',
      color: '#A9ABCF',
      image: require('../../assets/images/delivery.png'),
      route: null,
    },
    {
      label: 'Pickup',
      color: '#BC8EB6',
      image: require('../../assets/images/pickup.png'),
      route: null,
    },
  ];

  const handleBillPress = () => {
    router.push('/Screens/BillingScreen');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F3F3" />

      {/* BACK BUTTON */}
      <TouchableOpacity
        style={styles.backButtonAbsolute}
        onPress={() => router.back()}
      >
        <Image
          source={require('../../assets/icons/blackback.png')}
          style={{ width: backIconSize, height: backIconSize }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <View style={styles.contentWrapper}>
        {/* HEADER */}
        <View
          style={[
            styles.header,
            {
              marginTop: headerMT,
              paddingHorizontal: hPad,
            },
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              {
                fontSize: headerTitleFs,
              },
            ]}
          >
            Mode Selection
          </Text>
        </View>

        {/* MAIN CARD */}
        <View
          style={[
            styles.mainCard,
            {
              width: cardW,
              padding: innerPad,
            },
          ]}
        >
          <View style={[styles.grid, { gap: modeGap }]}>
            {modes.map((mode, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.82}
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: mode.color,
                    width: modeCardW,
                    height: modeCardH,
                  },
                ]}
                onPress={() => {
                  if (mode.route) router.push(mode.route as any);
                }}
              >
                <Image
                  source={mode.image}
                  style={{
                    width: iconSize,
                    height: iconSize,
                    marginBottom: isTablet ? 16 : 12,
                  }}
                  resizeMode="contain"
                />

                <View
                  style={[
                    styles.labelContainer,
                    {
                      paddingHorizontal: labelPadH,
                      paddingVertical: labelPadV,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        fontSize: labelFs,
                      },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* BILL BUTTON */}
        <TouchableOpacity
          style={[
            styles.billButton,
            {
              width: cardW,
              marginTop: 18,
            },
          ]}
          onPress={handleBillPress}
        >
          <Text style={styles.billText}>Bill</Text>
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

  backButtonAbsolute: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 12 : 8,
    left: 12,
    zIndex: 10,
    padding: 8,
  },

  header: {
    alignItems: 'center',
    marginBottom: 18,
  },

  headerTitle: {
    fontWeight: '600',
    color: '#000',
    fontSize: 22,
  },

  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 16,

    elevation: 5,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  modeCard: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  labelContainer: {
    backgroundColor: '#000',
    borderRadius: 20,
  },

  label: {
    color: '#fff',
    fontWeight: '600',
  },

  billButton: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#002748',
    alignItems: 'center',
    justifyContent: 'center',
  },

  billText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});