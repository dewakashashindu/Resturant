import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { useCartStore } from '../../services/cartStore';

export default function ModeSelectionScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const getHeldTables = useCartStore((state) => state.getHeldTables);
  const loadHeldOrderForTable = useCartStore((state) => state.loadHeldOrderForTable);

  const [billOverlayVisible, setBillOverlayVisible] = useState(false);
  const [heldTables, setHeldTables] = useState<string[]>([]);

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
      route: '/Screens/TakeAway',
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

  const refreshHeldTables = () => {
    setHeldTables(getHeldTables());
  };

  useEffect(() => {
    if (billOverlayVisible) {
      refreshHeldTables();
    }
  }, [billOverlayVisible, getHeldTables]);

  const handleBillPress = () => {
    refreshHeldTables();
    setBillOverlayVisible(true);
  };

  const handleHeldTableSelect = (tableNumber: string) => {
    const heldOrder = loadHeldOrderForTable(tableNumber);
    setBillOverlayVisible(false);

    router.replace({
      pathname: '/Screens/BillingScreen',
      params: {
        tableName: tableNumber,
        localPax: String(heldOrder?.lPax ?? 0),
        foreignPax: String(heldOrder?.fPax ?? 0),
      },
    });
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

      <Modal visible={billOverlayVisible} transparent animationType="fade" onRequestClose={() => setBillOverlayVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setBillOverlayVisible(false)}>
          <View style={styles.overlayBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.overlayCard, { width: isTablet ? Math.min(width * 0.78, 620) : width - 32 }]}>
                <View style={styles.overlayHeader}>
                  <Text style={styles.overlayTitle}>Listed Bills</Text>
                  <TouchableOpacity onPress={() => setBillOverlayVisible(false)} style={styles.overlayCloseBtn}>
                    <Text style={styles.overlayCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.overlaySubtitle}>Select a listed bill to view or modify it</Text>

                {heldTables.length > 0 ? (
                  <FlatList
                    data={heldTables}
                    keyExtractor={(item) => item}
                    contentContainerStyle={styles.heldTableList}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.heldTableRow} activeOpacity={0.82} onPress={() => handleHeldTableSelect(item)}>
                        <View>
                          <Text style={styles.heldTableLabel}>Table {item}</Text>
                          <Text style={styles.heldTableHint}>Tap to continue this order</Text>
                        </View>
                        <Text style={styles.heldTableChevron}>›</Text>
                      </TouchableOpacity>
                    )}
                  />
                ) : (
                  <View style={styles.emptyStateWrap}>
                    <Text style={styles.emptyStateTitle}>No listed bills</Text>
                    <Text style={styles.emptyStateText}>Start a new order to create a listed bill here.</Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    top: Platform.OS === 'android' ? 44 : 8,
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
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  overlayCard: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 18,
    maxHeight: '78%',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayTitle: {
    color: '#002748',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  overlayCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,39,72,0.08)',
  },
  overlayCloseText: {
    color: '#002748',
    fontSize: 18,
    fontWeight: '800',
  },
  overlaySubtitle: {
    marginTop: 8,
    marginBottom: 14,
    color: 'rgba(0,39,72,0.68)',
    fontSize: 13,
    fontWeight: '500',
  },
  heldTableList: {
    paddingBottom: 2,
  },
  heldTableRow: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F4F7FB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,39,72,0.08)',
  },
  heldTableLabel: {
    color: '#002748',
    fontSize: 16,
    fontWeight: '800',
  },
  heldTableHint: {
    color: 'rgba(0,39,72,0.58)',
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  heldTableChevron: {
    color: '#002748',
    fontSize: 28,
    fontWeight: '300',
    marginLeft: 8,
  },
  emptyStateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  emptyStateTitle: {
    color: '#002748',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyStateText: {
    color: 'rgba(0,39,72,0.68)',
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
});