import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type TableStatus = 'occupied' | 'reserved' | 'available';

type TableItem = {
  id: string;
  status: TableStatus;
};

export default function TableSelectionScreen() {
  const router = useRouter();

  const [selectedFloor, setSelectedFloor] = useState('Ground');

  const floors = ['Ground', '1st Floor', '2nd Floor', '3rd Floor'];

  const tables: TableItem[] = [
    { id: 'GF 1', status: 'available' },
    { id: 'GF 2', status: 'occupied' },
    { id: 'GF 3', status: 'occupied' },
    { id: 'GF 4', status: 'occupied' },
    { id: 'GF 5', status: 'reserved' },
    { id: 'GF 6', status: 'available' },
    { id: 'GF 7', status: 'occupied' },
    { id: 'GF 8', status: 'reserved' },
    { id: 'GF 9', status: 'occupied' },
    { id: 'GF 10', status: 'reserved' },
    { id: 'GF 11', status: 'available' },
    { id: 'GF 12', status: 'occupied' },
    { id: 'GF 13', status: 'occupied' },
    { id: 'GF 14', status: 'available' },
    { id: 'GF 15', status: 'occupied' },
    { id: 'GF 16', status: 'occupied' },
  ];

  const getTableColor = (status: TableStatus) => {
    switch (status) {
      case 'occupied':
        return '#E6A46B';

      case 'reserved':
        return '#4E8EC4';

      default:
        return '#FFFFFF';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        backgroundColor="#002748"
        barStyle="light-content"
      />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/Screens/operation')}
        >
          <Image
            source={require('../../assets/icons/back.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Table Selection
        </Text>
      </View>

      {/* CONTENT */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* FLOOR TABS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.floorContainer}
        >
          {floors.map((floor) => (
            <TouchableOpacity
              key={floor}
              style={[
                styles.floorButton,
                selectedFloor === floor &&
                  styles.activeFloorButton,
              ]}
              onPress={() => setSelectedFloor(floor)}
            >
              <Text
                style={[
                  styles.floorText,
                  selectedFloor === floor &&
                    styles.activeFloorText,
                ]}
              >
                {floor}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* BANNER */}
      <TouchableOpacity
  style={styles.banner}
  onPress={() => router.push('/Screens/definetable')}
  activeOpacity={0.8}
>
  <Image
    source={require('../../assets/images/Table.png')}
    style={styles.bannerIconImage}
    resizeMode="contain"
  />

  <Text style={styles.bannerText}>
    DEFINED TABLE
  </Text>
</TouchableOpacity>

        {/* STATUS */}
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusBox,
                { backgroundColor: '#E6A46B' },
              ]}
            >
              <Text style={styles.statusNumber}>9</Text>

              <Text style={styles.statusLabel}>
                OCCUPIED
              </Text>
            </View>
          </View>

          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusBox,
                { backgroundColor: '#4E8EC4' },
              ]}
            >
              <Text style={styles.statusNumber}>3</Text>

              <Text style={styles.statusLabel}>
                RESERVED
              </Text>
            </View>
          </View>

          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusBox,
                styles.availableBox,
              ]}
            >
              <Text style={styles.statusNumber}>4</Text>

              <Text style={styles.statusLabel}>
                AVAILABLE
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION */}
        <Text style={styles.sectionTitle}>
          GROUND FLOOR - 16 TABLES
        </Text>

        {/* TABLE GRID */}
        <View style={styles.grid}>
          {tables.map((table) => (
            <TouchableOpacity
              key={table.id}
              style={[
                styles.tableCard,
                {
                  backgroundColor: getTableColor(
                    table.status
                  ),
                },
              ]}
            >
              <Text style={styles.tableIcon}>
                {table.status === 'available'
                  ? '+'
                  : table.status === 'occupied'
                  ? '👥'
                  : '📅'}
              </Text>

              <Text style={styles.tableText}>
                {table.id}
              </Text>
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
    backgroundColor: '#FFFFFF',
  },

  header: {
    backgroundColor: '#002748',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    height: 120,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },

  backIcon: {
    width: 22,
    height: 22,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },

  content: {
    paddingBottom: 110,
  },

  floorContainer: {
    paddingTop: 18,
    paddingBottom: 6,
    paddingHorizontal: 16,
    gap: 10,
  },

  floorButton: {
    minWidth: 110,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#B7C1CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  activeFloorButton: {
    backgroundColor: '#FFFFFF',
  },

  floorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2B2B2B',
  },

  activeFloorText: {
    color: '#000',
  },

  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#7FAFD2',
    borderRadius: 12,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  bannerIconImage: {
    width: 24,
    height: 24,
  },

  bannerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
  },

  statusItem: {
    width: '31%',
    alignItems: 'center',
  },

  statusBox: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    marginBottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },

  availableBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
  },

  statusNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    lineHeight: 22,
  },

  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    lineHeight: 14,
  },

  sectionTitle: {
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },

  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  tableCard: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },

  tableIcon: {
    fontSize: 20,
    marginBottom: 4,
  },

  tableText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
});