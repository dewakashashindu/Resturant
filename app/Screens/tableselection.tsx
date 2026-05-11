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
  useWindowDimensions,
  View
} from 'react-native';

type TableStatus = 'occupied' | 'reserved' | 'available';
type TableItem = { id: string; status: TableStatus };

export default function TableSelectionScreen() {
  const router = useRouter();
  const [selectedFloor, setSelectedFloor] = useState('Ground Floor');
  const { width, height } = useWindowDimensions();

  // ── BREAKPOINTS ────────────────────────────────
  const isTablet = width >= 600;
  const isSmall  = height < 700;

  // ── RESPONSIVE VALUES ──────────────────────────
  const hPad          = isTablet ? 24 : 16;
  const headerTitleFs = isTablet ? 32 : 24;
  const backIconSize  = isTablet ? 56 : 44;
  const floorFont     = isTablet ? 24: 13;
  const bannerH       = isTablet ? 56 : isSmall ? 38 : 44;
  const bannerFs      = isTablet ? 24 : 13;
  const statNumFs     = isTablet ? 26 : isSmall ? 18 : 22;
  const statLabelFs   = isTablet ? 16 : isSmall ? 10 : 11;
  const sectionFs     = isTablet ? 24 : 12;
  const cardFont      = isTablet ? 24 : isSmall ? 11 : 16;
  const emojiFs       = isTablet ?36 : isSmall ? 16 : 20;
  const plusFs        = isTablet ? 36 : isSmall ? 18 : 24;

  // ── CARD WIDTH — only declared once ───────────
  const cardGap   = isTablet ? 14 : 10;
  const cardWidth = (width - hPad * 2 - cardGap * 3) / 4;

  const floors = [
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  'Beach Wing 1',
  'Beach Wing 2',
  'Private Front',
  'Private Sealed'
];


const floorTables: Record<string, TableItem[]> = {
  'Ground Floor': [
    { id: 'GF 1', status: 'available' },
    { id: 'GF 2', status: 'occupied' },
    { id: 'GF 3', status: 'reserved' },
    { id: 'GF 4', status: 'available' },
  ],

  '1st Floor': [
    { id: 'F1 1', status: 'occupied' },
    { id: 'F1 2', status: 'available' },
    { id: 'F1 3', status: 'reserved' },
    { id: 'F1 4', status: 'occupied' },
  ],

  '2nd Floor': [
    { id: 'F2 1', status: 'available' },
    { id: 'F2 2', status: 'available' },
    { id: 'F2 3', status: 'reserved' },
  ],

  '3rd Floor': [
    { id: 'F3 1', status: 'occupied' },
    { id: 'F3 2', status: 'reserved' },
    { id: 'F3 3', status: 'available' },
  ],

  'Beach Wing 1': [
    { id: 'BW1 1', status: 'available' },
    { id: 'BW1 2', status: 'occupied' },
  ],

  'Beach Wing 2': [
    { id: 'BW2 1', status: 'reserved' },
    { id: 'BW2 2', status: 'available' },
  ],

  'Private Front': [
    { id: 'PF 1', status: 'occupied' },
  ],

  'Private Sealed': [
    { id: 'PS 1', status: 'available' },
  ],
};
const tables = floorTables[selectedFloor] || [];

  const occupiedCount  = tables.filter(t => t.status === 'occupied').length;
  const reservedCount  = tables.filter(t => t.status === 'reserved').length;
  const availableCount = tables.filter(t => t.status === 'available').length;

  const getTableColor = (status: TableStatus) => {
    switch (status) {
      case 'occupied': return '#E6A46B';
      case 'reserved': return '#4E8EC4';
      default:         return '#FFFFFF';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingHorizontal: hPad }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Image
            source={require('../../assets/icons/back.png')}
            style={{ width: backIconSize, height: backIconSize, tintColor: '#FFF' }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { fontSize: headerTitleFs }]}>
          Table Selection
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── FLOOR TABS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.floorContainer,
            { paddingHorizontal: hPad, paddingTop: isSmall ? 10 : 16 },
          ]}
        >
          {floors.map((floor) => (
            <TouchableOpacity
              key={floor}
              style={[
                styles.floorButton,
                selectedFloor === floor && styles.activeFloorButton,
                { paddingVertical: isTablet ? 10 : isSmall ? 7 : 9 },
              ]}
              onPress={() => setSelectedFloor(floor)}
            >
              <Text
                style={[
                  styles.floorText,
                  selectedFloor === floor && styles.activeFloorText,
                  { fontSize: floorFont },
                ]}
              >
                {floor}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── BANNER ── */}
        <TouchableOpacity
          style={[styles.banner, { height: bannerH, marginHorizontal: hPad }]}
          onPress={() => router.push('/Screens/definetable')}
          activeOpacity={0.8}
        >
          <Image
            source={require('../../assets/images/Table.png')}
            style={{ width: isTablet ? 28 : 22, height: isTablet ? 28 : 22 }}
            resizeMode="contain"
          />
          <Text style={[styles.bannerText, { fontSize: bannerFs }]}>
            DEFINED TABLE
          </Text>
        </TouchableOpacity>

        {/* ── STATUS BOXES ── */}
        <View style={[styles.statusContainer, { paddingHorizontal: hPad }]}>
          <View style={[styles.statusBox, { backgroundColor: '#E6A46B' }]}>
            <Text style={[styles.statusNumber, { fontSize: statNumFs }]}>
              {occupiedCount}
            </Text>
            <Text style={[styles.statusLabel, { fontSize: statLabelFs }]}>
              OCCUPIED
            </Text>
          </View>

          <View style={[styles.statusBox, { backgroundColor: '#4E8EC4' }]}>
            <Text style={[styles.statusNumber, { fontSize: statNumFs }]}>
              {reservedCount}
            </Text>
            <Text style={[styles.statusLabel, { fontSize: statLabelFs }]}>
              RESERVED
            </Text>
          </View>

          <View style={[styles.statusBox, styles.availableBox]}>
            <Text style={[styles.statusNumber, { fontSize: statNumFs }]}>
              {availableCount}
            </Text>
            <Text style={[styles.statusLabel, { fontSize: statLabelFs }]}>
              AVAILABLE
            </Text>
          </View>
        </View>

        {/* ── SECTION TITLE ── */}
        <Text style={[
          styles.sectionTitle,
          { fontSize: sectionFs, paddingHorizontal: hPad },
        ]}>
          {selectedFloor.toUpperCase()} - {tables.length} TABLES
        </Text>

        {/* ── TABLE GRID ── */}
        <View style={[styles.grid, { paddingHorizontal: hPad, gap: cardGap }]}>
          {tables.map((table) => (
            <TouchableOpacity
              key={table.id}
              style={[
                styles.tableCard,
                {
                  backgroundColor: getTableColor(table.status),
                  width: cardWidth,
                  height: cardWidth,
                  marginBottom: isTablet ? 18 : 10,
                },
                table.status === 'available' && styles.tableCardAvailable,
              ]}
              onPress={() => {
                if (table.status === 'occupied') {
                  router.push('/Screens/selectitems');
                  return;
                }

                if (table.status === 'reserved') {
                  router.push('/Screens/paxcount');
                  return;
                }

                router.push('/Screens/paxcount');
              }}
            >
              {table.status === 'available' ? (
                <Text style={[styles.plusIcon, { fontSize: plusFs }]}>+</Text>
              ) : (
                <Text style={{ fontSize: emojiFs, marginBottom: 4 }}>
                  {table.status === 'occupied' ? '👥' : '📅'}
                </Text>
              )}
              <Text
                style={[
                  styles.tableText,
                  { fontSize: cardFont },
                  table.status === 'reserved' && { color: '#FFF' },
                ]}
              >
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
    backgroundColor: '#F4F6F8',
  },

  // ── HEADER ────────────────────────────────────
  header: {
    backgroundColor: '#002748',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    height: 200,
  },
  backButton: {
    marginRight: 16,
    marginTop: -50,
  },
  headerTitle: {
    fontWeight: '700',
    color: '#FFF',
    marginTop: -50,
  },

  // ── FLOOR TABS ────────────────────────────────
  floorContainer: {
    paddingBottom: 8,
    gap: 10,
  },
  floorButton: {
    minWidth: 90,
    paddingHorizontal: 16,
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
    fontWeight: '700',
    color: '#555',
  },
  activeFloorText: {
    color: '#000',
  },

  // ── BANNER ────────────────────────────────────
  banner: {
    marginTop: 10,
    backgroundColor: '#7FAFD2',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bannerText: {
    color: '#FFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── STATUS ────────────────────────────────────
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  statusBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  availableBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  statusNumber: {
    fontWeight: '800',
    color: '#000',
  },
  statusLabel: {
    fontWeight: '700',
    color: '#111',
    marginTop: 2,
  },

  // ── SECTION TITLE ─────────────────────────────
  sectionTitle: {
    marginTop: 14,
    marginBottom: 10,
    fontWeight: '700',
    color: '#666',
  },

  // ── TABLE GRID ────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tableCard: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tableCardAvailable: {
    borderWidth: 1.5,
    borderColor: '#DDD',
  },
  plusIcon: {
    fontWeight: '300',
    color: '#333',
    marginBottom: 2,
  },
  tableText: {
    fontWeight: '800',
    color: '#000',
  },
});