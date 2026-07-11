import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../services/authStore';
import { useCartStore } from '../../services/cartStore';
import { storage } from '../../services/storage';

type TableStatus = 'occupied' | 'reserved' | 'available';
type TableItem   = { id: string; status: TableStatus };

const getApiBaseUrl = () => {
  const envBaseUrl = String((globalThis as any)?.process?.env?.EXPO_PUBLIC_API_BASE_URL ?? '').trim();
  if (envBaseUrl) return envBaseUrl;

  let ip = (global as any).backendIP;
  if (!ip) {
    try {
      ip = storage.getString('backend-ip');
    } catch (e) {}
  }
  ip = ip || '192.168.8.100';

  return `http://${ip}:3000`;
};

const getApiBase = () => getApiBaseUrl().replace(/\/$/, '');

export default function TableSelectionScreen() {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

 
  const { user } = useAuthStore();
  const assignedFloors = user?.assignedFloors || [];
  const userGroupId = user?.groupId;

  const [selectedFloor,  setSelectedFloor]  = useState('');
  const [floors,         setFloors]         = useState<string[]>([]);
  const [tables,         setTables]         = useState<TableItem[]>([]);
  const [loadingTables,  setLoadingTables]  = useState(false);
  const [tableError,     setTableError]     = useState('');

  // ── Global counts (all floors) ──────────────────────────────────────────
  const [availableCount, setAvailableCount] = useState(0);
  const [occupiedCount,  setOccupiedCount]  = useState(0);
  const [reservedCount,  setReservedCount]  = useState(0);
  const [loadingCounts,  setLoadingCounts]  = useState(true);
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);

  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  const hPad          = isTablet ? 24 : 16;
  const headerTitleFs = isTablet ? 32 : 24;
  const backIconSize  = isTablet ? 56 : 44;
  const floorFont     = isTablet ? 24 : 13;
  const bannerH       = isTablet ? 56 : isSmall ? 38 : 44;
  const bannerFs      = isTablet ? 24 : 13;
  const statNumFs     = isTablet ? 26 : isSmall ? 18 : 22;
  const statLabelFs   = isTablet ? 16 : isSmall ? 10 : 11;
  const sectionFs     = isTablet ? 24 : 12;
  const cardFont      = isTablet ? 24 : isSmall ? 11 : 16;
  const emojiFs       = isTablet ? 36 : isSmall ? 16 : 20;
  const plusFs        = isTablet ? 36 : isSmall ? 18 : 24;
  const cardGap       = isTablet ? 14 : 10;
  const cardWidth     = (width - hPad * 2 - cardGap * 3) / 4;

 // ── Fetch floors & Role Filter ───────────────────────────────────────────
  useEffect(() => {
    const loadFloors = async () => {
      try {
        const result = await apiClient.getFloors();
        const data = result.data;

        if (result.ok) {
          const records: any[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.floors)
            ? data.floors
            : [];

          const allNames = records.map(
            (f: any) => f.GroupName || f.groupName || String(f)
          );

          console.log('assignedFloors (from authStore):', JSON.stringify(assignedFloors));
          console.log('allNames (from /api/floors):', JSON.stringify(allNames));
          console.log('userGroupId:', userGroupId);

          //  Role Based Visibility Filter — everyone sees only their assigned floors
          const filteredFloors = allNames.filter(floorName => assignedFloors.includes(floorName));

          setFloors(filteredFloors);

          //  Default Floor Setup & Table Load
          if (filteredFloors.length > 0 && !selectedFloor) {
            const defaultFloor = filteredFloors[0];
            setSelectedFloor(defaultFloor);
            fetchTables(defaultFloor);
          }
        } else {
          console.error('Failed to load floors:', data);
        }
      } catch (error) {
        console.error('Failed to load floors:', error);
      }
    };

    loadFloors();
  }, [userGroupId, assignedFloors]);

  // ── Fetch counts for the currently selected floor and on focus 
  const isFocused = useIsFocused();

  const loadCounts = async (floor?: string) => {
    setLoadingCounts(true);
    try {
      const result = await apiClient.getTableCounts(floor);
      const data = result.data;

      if (result.ok) {
        setAvailableCount(data.VaccantCount ?? 0);
        setOccupiedCount(data.OccupiedCount ?? 0);
        setReservedCount(data.ReservedCount ?? 0);
      } else {
        console.error('Counts API error:', data);
      }
    } catch (e) {
      const err: any = e as any;
      console.error('Failed to load counts:', err);
    } finally {
      setLoadingCounts(false);
    }
  };

  // call when selectedFloor changes
  useEffect(() => { loadCounts(selectedFloor || undefined); }, [selectedFloor]);

  // call when screen becomes focused (e.g., after returning from child screens)
  useEffect(() => {
    if (isFocused) loadCounts(selectedFloor || undefined);
  }, [isFocused, selectedFloor]);

  // ── Fetch tables for selected floor ──────────────────────────────────────
  const fetchTables = async (floor: string) => {
    setLoadingTables(true);
    setTableError('');
    setTables([]);

    try {
      const result = await apiClient.getTables(floor);

      if (!result.ok) {
        setTableError(result.data?.message || 'Failed to load tables.');
        return;
      }

      const tableRows: any[] = Array.isArray(result.data?.tables) ? result.data.tables : [];

      const orderedRows = floor.trim().toUpperCase() === 'AREA A'
        ? [...tableRows].sort((a: any, b: any) => {
            const aNo = parseInt(String(a.TableNo || '').replace(/\D/g, ''), 10);
            const bNo = parseInt(String(b.TableNo || '').replace(/\D/g, ''), 10);
            if (!Number.isNaN(aNo) && !Number.isNaN(bNo)) return aNo - bNo;
            return String(a.TableNo || '').localeCompare(String(b.TableNo || ''));
          })
        : tableRows;

      const mapped: TableItem[] = orderedRows.map((t: any) => ({
        id: t.TableNo,
        status: (
          t.ResID && String(t.ResID).trim() !== ''
        ) ? 'reserved' : (t.Vaccant === 'Y' ? 'available' : 'occupied') as TableStatus,
      }));

      setTables(mapped);
    } catch {
      setTableError('Something went wrong loading tables.');
    } finally {
      setLoadingTables(false);
    }
  };

  const getTableColor = (status: TableStatus) => {
    switch (status) {
      case 'occupied': return '#E6A46B';
      case 'reserved': return '#4E8EC4';
      default:         return '#FFFFFF';
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />

      {/* FIXED HEADER */}
      <View style={[styles.header, { paddingHorizontal: hPad, paddingTop: insets.top, height: 200 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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

      {/* FIXED TOP CONTROLS CONTAINER */}
      <View style={styles.fixedTopContainer}>
        {/* FLOOR TABS */}
        <View>
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
                onPress={() => {
                  setSelectedFloor(floor);
                  fetchTables(floor);
                }}
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
        </View>

        {/* BANNER */}
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

        {/* STATUS BOXES */}
        <View style={[styles.statusContainer, { paddingHorizontal: hPad }]}>
          <View style={[styles.statusBox, styles.availableBox]}>
            {loadingCounts ? (
              <ActivityIndicator size="small" color="#002748" />
            ) : (
              <Text style={[styles.statusNumber, { fontSize: statNumFs }]}>
                {availableCount}
              </Text>
            )}
            <Text style={[styles.statusLabel, { fontSize: statLabelFs }]}>
              AVAILABLE
            </Text>
          </View>

          <View style={[styles.statusBox, { backgroundColor: '#E6A46B' }]}>
            {loadingCounts ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.statusNumber, { fontSize: statNumFs }]}>
                {occupiedCount}
              </Text>
            )}
            <Text style={[styles.statusLabel, { fontSize: statLabelFs }]}>
              OCCUPIED
            </Text>
          </View>

          <View style={[styles.statusBox, { backgroundColor: '#4E8EC4' }]}>
            {loadingCounts ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.statusNumber, { fontSize: statNumFs }]}>
                {reservedCount}
              </Text>
            )}
            <Text style={[styles.statusLabel, { fontSize: statLabelFs }]}>
              RESERVED
            </Text>
          </View>
        </View>

        {/* SECTION TITLE */}
        <Text style={[styles.sectionTitle, { fontSize: sectionFs, paddingHorizontal: hPad }]}>
          {selectedFloor
            ? `${selectedFloor.toUpperCase()} — ${tables.length} TABLES`
            : 'SELECT A FLOOR'}
        </Text>
      </View>

      {/* ISOLATED SCROLLABLE TABLE GRID */}
      <ScrollView
        style={styles.gridScrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 + insets.bottom }}
      >
        {loadingTables ? (
          <ActivityIndicator size="small" color="#002748" style={{ marginTop: 30 }} />
        ) : tableError ? (
          <View style={{ alignItems: 'center', marginTop: 30, gap: 10 }}>
            <Text style={{ color: '#D32F2F', fontSize: 14 }}>{tableError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchTables(selectedFloor)}
            >
              <Text style={styles.retryText}>Tap to Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !selectedFloor ? (
          <View style={{ alignItems: 'center', marginTop: 30 }}>
            <Text style={{ color: '#888', fontSize: 14 }}>
              Select a floor to view tables.
            </Text>
          </View>
        ) : tables.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 30 }}>
            <Text style={{ color: '#888', fontSize: 14 }}>
              No tables found for this floor.
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, { paddingHorizontal: hPad, gap: cardGap }]}>
              {tables.map((table) => (
              <TouchableOpacity
                key={table.id}
                style={[
                  styles.tableCard,
                  {
                    backgroundColor: getTableColor(table.status),
                    width:           cardWidth,
                    height:          cardWidth,
                    marginBottom:    isTablet ? 18 : 10,
                  },
                  table.status === 'available' && styles.tableCardAvailable,
                ]}
                onPress={() => {
                    const openTable = async () => {
                      if (table.status === 'occupied') {
                        try {
                          setOpeningTableId(table.id);
                          const activeBill = await apiClient.getActiveBillItems(table.id);
                          const data = activeBill.ok ? activeBill.data?.data : null;
                          const invoiceNo = String(data?.invoiceNo ?? '').trim();

                          if (!invoiceNo) {
                            Alert.alert('No active bill found', 'This table is marked occupied, but no open bill was returned.');
                            return;
                          }

                          router.push({
                            pathname: '/Screens/BillingScreen',
                            params: {
                              tableName: table.id,
                              tableNo: table.id,
                              floor: selectedFloor,
                              invoiceNo,
                              localPax: String(data?.lPax ?? '0'),
                              foreignPax: String(data?.fPax ?? '0'),
                            },
                          });
                          return;
                        } finally {
                          setOpeningTableId(null);
                        }
                      }

                      clearCart();
                      router.push({ pathname: '/Screens/paxcount', params: { tableName: table.id, floor: selectedFloor, status: table.status } });
                    };

                    void openTable();
                }}
                  disabled={openingTableId === table.id}
              >
                {table.status === 'available' ? (
                  <Text style={[styles.plusIcon, { fontSize: plusFs }]}>+</Text>
                  ) : openingTableId === table.id ? (
                    <ActivityIndicator size="small" color="#002748" />
                  ) : (
                  <Text style={{ fontSize: emojiFs, marginBottom: 4 }}>👥</Text>
                )}
                <Text style={[styles.tableText, { fontSize: cardFont }]}>
                  {table.id}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F4F6F8' },

  header:       { backgroundColor: '#002748', flexDirection: 'row', alignItems: 'center', paddingVertical: 16, height: 200 },
  backButton:   { marginRight: 16 },
  headerTitle: { fontWeight: '700', color: '#FFF' },

  fixedTopContainer: { backgroundColor: '#F4F6F8' },
  gridScrollContainer: { flex: 1 },

  floorContainer:    { paddingBottom: 8, gap: 10 },
  floorButton: { minWidth: 90, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#B7C1CC', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  floorText:         { fontWeight: '700', color: '#555' },
  activeFloorText:   { color: '#000' },
  activeFloorButton: {
    backgroundColor: '#fcfcfc',
    borderBlockColor: '#002748',
    borderWidth: 1.5,
  },
  banner:     { marginTop: 10, backgroundColor: '#7FAFD2', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bannerText: { color: '#FFF', fontWeight: '700', letterSpacing: 0.5 },

  statusContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  statusBox:       { flex: 1, borderRadius: 12, paddingVertical: 8, justifyContent: 'center', alignItems: 'center' },
  availableBox:    { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD' },
  statusNumber:    { fontWeight: '800', color: '#000' },
  statusLabel:     { fontWeight: '700', color: '#111', marginTop: 2 },

  sectionTitle: { marginTop: 14, marginBottom: 10, fontWeight: '700', color: '#666' },

  grid:               { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tableCard:          { borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  tableCardAvailable: { borderWidth: 1.5, borderColor: '#DDD' },
  plusIcon:           { fontWeight: '300', color: '#333', marginBottom: 2 },
  tableText:          { fontWeight: '800', color: '#000' },
  retryBtn:           { backgroundColor: '#002748', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText:          { color: '#FFF', fontWeight: '700', fontSize: 14 },
});