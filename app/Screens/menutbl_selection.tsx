import React from 'react';
import {
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.timeText}>11:07</Text>
        <View style={styles.statusIcons}>
          <View style={styles.iconWrapper}>
            <View style={styles.wifiIcon} />
          </View>
          <View style={styles.iconWrapper}>
            <View style={styles.signalIcon} />
          </View>
          <View style={styles.iconWrapper}>
            <View style={styles.batteryIcon} />
          </View>
        </View>
      </View>

      {/* Blue Circle Top Left */}
      <View style={styles.circleTopLeft} />

      {/* Blue Circle Bottom Right */}
      <View style={styles.circleBottomRight} />

      {/* Description Text */}
      <Text style={styles.descriptionText}>
        Please ensure to save {'\n'}
        the current floor and table configuration{'\n'}
        before accessing the menu.
      </Text>

      {/* Current Table Group Label */}
      <Text style={styles.labelText}>Current Table Group</Text>

      {/* Table Group Card */}
      <View style={styles.card}>
        <Text style={styles.cardText}>Ground Floor</Text>
        <Text style={styles.arrowText}>{'>'}</Text>
      </View>

      {/* Current Table Label */}
      <Text style={[styles.labelText, styles.tableLabel]}>Current Table</Text>

      {/* Table Card */}
      <View style={[styles.card, styles.tableCard]}>
        <Text style={styles.cardText}>T 10</Text>
        <Text style={styles.arrowText}>{'>'}</Text>
      </View>

      {/* Confirm Button */}
      <View style={styles.confirmButton}>
        <Text style={styles.confirmText}>Conform</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 402,
    height: 874,
    backgroundColor: 'white',
    overflow: 'hidden',
    position: 'relative',
  },

  // Status Bar
  statusBar: {
    width: 370,
    height: 32,
    paddingHorizontal: 8,
    paddingVertical: 4,
    left: 16,
    top: 19,
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: 'black',
    fontSize: 12,
    fontFamily: 'Roboto',
    fontWeight: '500',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconWrapper: {
    width: 16,
    height: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wifiIcon: {
    width: 16,
    height: 11.33,
    backgroundColor: 'black',
  },
  signalIcon: {
    width: 13.33,
    height: 13.33,
    backgroundColor: 'black',
  },
  batteryIcon: {
    width: 6.67,
    height: 13.33,
    backgroundColor: 'black',
  },

  // Decorative Circles
  circleTopLeft: {
    width: 146,
    height: 145,
    left: -58,
    top: 136,
    position: 'absolute',
    backgroundColor: 'rgba(98, 145, 185, 0.54)',
    borderRadius: 9999,
  },
  circleBottomRight: {
    width: 182,
    height: 181,
    left: 268,
    top: 748,
    position: 'absolute',
    backgroundColor: 'rgba(98, 145, 185, 0.54)',
    borderRadius: 9999,
  },

  // Description
  descriptionText: {
    left: 24,
    top: 206,
    position: 'absolute',
    color: 'black',
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '400',
    lineHeight: 22,
  },

  // Labels
  labelText: {
    left: 24,
    top: 335,
    position: 'absolute',
    opacity: 0.5,
    color: 'black',
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: '400',
  },
  tableLabel: {
    top: 447,
  },

  // Cards
  card: {
    width: 354,
    height: 47,
    left: 24,
    top: 369,
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  tableCard: {
    top: 476,
  },
  cardText: {
    color: 'black',
    fontSize: 20,
    fontFamily: 'Inter',
    fontWeight: '400',
  },
  arrowText: {
    color: 'black',
    fontSize: 24,
    fontFamily: 'Inter',
    fontWeight: '400',
  },

  // Confirm Button
  confirmButton: {
    width: 203,
    height: 47,
    left: 100,
    top: 583,
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmText: {
    color: 'black',
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: '600',
  },
});

export default App;