import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../services/authStore';

import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

// ══════════════════════════════════════
// TYPES
// ══════════════════════════════════════
interface TableGroup {
  id: string;
  label: string;
}

interface TableItem {
  id: string;
  label: string;
}


const EMPTY_ASSIGNED_FLOORS: string[] = [];
// ══════════════════════════════════════
// RESPONSIVE SCALE UTILITIES
// ══════════════════════════════════════
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const scaleW = (size: number) => (SCREEN_WIDTH / BASE_WIDTH) * size;
const scaleH = (size: number) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;
const scaleFont = (size: number) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(newSize);
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// ══════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════
const TableSelectionScreen = () => {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;

  // ── Responsive Metrics ──
  const paddingH = isTablet ? scaleW(32) : scaleW(20);
  const circleSize = width * 0.38;
  const modalWidth = clamp(width * 0.88, scaleW(280), scaleW(420));
  const modalMaxHeight = height * 0.65;
  // ── State ──
  // The data comes from the same table APIs used by Dining; only the UI is a dropdown.
  const { user } = useAuthStore();
  const assignedFloors = user?.assignedFloors ?? EMPTY_ASSIGNED_FLOORS;
  const [groups, setGroups] = useState<TableGroup[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<TableGroup | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [groupDropdownVisible, setGroupDropdownVisible] = useState(false);
  const [tableDropdownVisible, setTableDropdownVisible] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [tableError, setTableError] = useState('');

  useEffect(() => {
    const loadGroups = async () => {
      setLoadingGroups(true);
      setGroupError('');
      try {
        const result = await apiClient.getFloors();
        const records: any[] = Array.isArray(result.data)
          ? result.data
          : Array.isArray(result.data?.floors)
            ? result.data.floors
            : [];
        if (!result.ok) {
          setGroupError(result.data?.message || 'Unable to load table groups.');
          return;
        }

        const allowedNames = assignedFloors.map((floor) => String(floor).trim());
        setGroups(records
          .map((floor: any) => ({
            id: String(floor.GroupId ?? floor.groupId ?? floor.GroupName ?? floor.groupName ?? '').trim(),
            label: String(floor.GroupName ?? floor.groupName ?? floor).trim(),
          }))
          .filter((floor: TableGroup) => floor.id && floor.label)
          .filter((floor: TableGroup) => allowedNames.includes(floor.label)));
      } catch {
        setGroupError('Unable to load table groups.');
      } finally {
        setLoadingGroups(false);
      }
    };
    void loadGroups();
  }, [assignedFloors]);

  const loadTables = async (group: TableGroup) => {
    setLoadingTables(true);
    setTableError('');
    setTables([]);
    try {
      const result = await apiClient.getTables(group.label);
      if (!result.ok) {
        setTableError(result.data?.message || 'Unable to load tables.');
        return;
      }
      const records: any[] = Array.isArray(result.data?.tables) ? result.data.tables : [];
      setTables(records
        .map((table: any): TableItem => ({
          id: String(table.TableNo ?? '').trim(),
          label: String(table.TableNo ?? '').trim(),
        }))
        .filter((table) => Boolean(table.id)));
    } catch {
      setTableError('Unable to load tables.');
    } finally {
      setLoadingTables(false);
    }
  };

  // ── Handlers ──
  const handleGroupSelect = (group: TableGroup): void => {
    setSelectedGroup(group);
    setSelectedTable(null);
    setGroupDropdownVisible(false);
    void loadTables(group);
  };

  const handleTableSelect = (table: TableItem): void => {
    setSelectedTable(table);
    setTableDropdownVisible(false);
  };

  const handleConfirm = (): void => {
    if (!selectedGroup || !selectedTable) return;
    router.push({
      pathname: '/Screens/paxcount',
      params: {
        menuFlow: '1',
        groupId: selectedGroup.id,
        groupLabel: selectedGroup.label,
        tableId: selectedTable.id,
        tableName: selectedTable.id,
        tableNo: selectedTable.id,
        floor: selectedGroup.label,
      },
    });
  };

  // ── Renderers ──
  const renderGroupItem = ({ item }: { item: TableGroup }) => (
    <TouchableOpacity
      style={[
        styles.dropdownItem,
        selectedGroup?.id === item.id && styles.selectedItem,
      ]}
      onPress={() => handleGroupSelect(item)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.dropdownItemText,
          selectedGroup?.id === item.id && styles.selectedItemText,
        ]}
      >
        {item.label}
      </Text>
      {selectedGroup?.id === item.id && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  const renderTableItem = ({ item }: { item: TableItem }) => (
    <TouchableOpacity
      style={[
        styles.tableItem,
        selectedTable?.id === item.id && styles.selectedTableItem,
      ]}
      onPress={() => handleTableSelect(item)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.tableItemText,
          selectedTable?.id === item.id && styles.selectedTableItemText,
        ]}
      >
        {item.label}
      </Text>
      {selectedTable?.id === item.id && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* ── Decorative Circles ── */}
      <View
        style={[
          styles.circle,
          styles.circleTopLeft,
          {
            width: circleSize,
            height: circleSize,
            top: height * 0.1,
            left: -circleSize * 0.35,
          },
        ]}
      />
      <View
        style={[
          styles.circle,
          styles.circleBottomRight,
          {
            width: circleSize * 1.2,
            height: circleSize * 1.2,
            bottom: -circleSize * 0.2,
            right: -circleSize * 0.3,
          },
        ]}
      />

      {/* ── Main Content ── */}
      <View style={[styles.content, { paddingHorizontal: paddingH }]}>
        <Text style={styles.descriptionText}>
          Please ensure to save {'\n'}
          the current floor and table configuration{'\n'}
          before accessing the menu.
        </Text>

        <View style={styles.formSection}>
          <Text style={styles.labelText}>Current Table Group</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => setGroupDropdownVisible(true)}
            activeOpacity={0.8}
            disabled={loadingGroups}
          >
            <Text
              style={[
                styles.cardText,
                !selectedGroup && styles.placeholderText,
              ]}
            >
              {loadingGroups ? 'Loading table groups…' : selectedGroup ? selectedGroup.label : 'Select Table Group'}
            </Text>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>

          <Text style={styles.labelText}>Current Table</Text>
          <TouchableOpacity
            style={[styles.card, !selectedGroup && styles.disabledCard]}
            onPress={() => selectedGroup && setTableDropdownVisible(true)}
            activeOpacity={0.8}
            disabled={!selectedGroup || loadingTables}
          >
            <Text
              style={[
                styles.cardText,
                !selectedTable && styles.placeholderText,
              ]}
            >
              {loadingTables ? 'Loading tables…' : selectedTable ? selectedTable.label : 'Select Table'}
            </Text>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!selectedGroup || !selectedTable) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          activeOpacity={0.8}
          disabled={!selectedGroup || !selectedTable}
        >
          <Text style={styles.confirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════
          TABLE GROUP DROPDOWN MODAL
      ══════════════════════════════════════ */}
      <Modal
        visible={groupDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGroupDropdownVisible(false)}
        >
          <View
            style={[
              styles.dropdownContainer,
              { width: modalWidth, maxHeight: modalMaxHeight },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Table Group</Text>
              <TouchableOpacity onPress={() => setGroupDropdownVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingGroups ? (
              <View style={styles.dropdownState}><ActivityIndicator color="#6291B9" /></View>
            ) : groupError ? (
              <Text style={styles.dropdownStateText}>{groupError}</Text>
            ) : (
              <FlatList<TableGroup>
                data={groups}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={renderGroupItem}
                ListEmptyComponent={<Text style={styles.dropdownStateText}>No table groups are assigned to this user.</Text>}
                contentContainerStyle={{ paddingBottom: scaleH(12) }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ══════════════════════════════════════
          TABLE DROPDOWN MODAL
      ══════════════════════════════════════ */}
      <Modal
        visible={tableDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTableDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTableDropdownVisible(false)}
        >
          <View
            style={[
              styles.dropdownContainer,
              { width: modalWidth, maxHeight: modalMaxHeight },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Table</Text>
                {selectedGroup && (
                  <Text style={styles.modalSubTitle}>
                    {selectedGroup.label}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setTableDropdownVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingTables ? (
              <View style={styles.dropdownState}><ActivityIndicator color="#6291B9" /></View>
            ) : tableError ? (
              <Text style={styles.dropdownStateText}>{tableError}</Text>
            ) : (
              <FlatList<TableItem>
                data={tables}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={renderTableItem}
                ListEmptyComponent={<Text style={styles.dropdownStateText}>No enabled tables found for this table group.</Text>}
                contentContainerStyle={{ paddingBottom: scaleH(12) }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// ══════════════════════════════════════
// STYLES
// ══════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    overflow: 'hidden',
  },

  // ── Decorative Circles ──
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(98, 145, 185, 0.38)',
    borderRadius: 9999,
  },
  circleTopLeft: {},
  circleBottomRight: {},

  // ── Main Content ──
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: scaleH(40),
  },
  descriptionText: {
    color: '#1D3444',
    fontSize: scaleFont(14),
    fontWeight: '500',
    lineHeight: scaleH(22),
    marginBottom: scaleH(32),
  },

  // ── Form Section ──
  formSection: {
    gap: scaleH(8),
    marginBottom: scaleH(32),
  },
  labelText: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: scaleFont(16),
    fontWeight: '400',
    marginBottom: scaleH(6),
  },

  // ── Cards ──
  card: {
    width: '100%',
    height: scaleH(52),
    backgroundColor: 'white',
    borderRadius: scaleW(12),
    borderWidth: 1,
    borderColor: '#EDF1F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleW(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: scaleH(16),
  },
  disabledCard: { opacity: 0.5 },
  cardText: {
    color: 'black',
    fontSize: scaleFont(16),
    fontWeight: '400',
  },
  placeholderText: {
    color: '#aaa',
    fontSize: scaleFont(14),
  },
  arrowText: {
    color: '#6291B9',
    fontSize: scaleFont(28),
    fontWeight: '300',
  },

  // ── Confirm Button ──
  confirmButton: {
    width: '60%',
    maxWidth: scaleW(240),
    height: scaleH(52),
    alignSelf: 'center',
    backgroundColor: '#6291B9',
    borderRadius: scaleW(12),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmButtonDisabled: {
    backgroundColor: '#aaa',
    elevation: 0,
    shadowOpacity: 0,
  },
  confirmText: {
    color: 'white',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: 'white',
    borderRadius: scaleW(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleW(20),
    paddingVertical: scaleH(14),
    backgroundColor: '#6291B9',
  },
  modalTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: 'white',
  },
  modalSubTitle: {
    fontSize: scaleFont(12),
    color: 'rgba(255,255,255,0.8)',
    marginTop: scaleH(2),
  },
  closeBtn: {
    fontSize: scaleFont(18),
    color: 'white',
    fontWeight: '600',
  },

  // ── Dropdown Items ──
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleH(14),
    paddingHorizontal: scaleW(20),
    borderRadius: scaleW(8),
    marginHorizontal: scaleW(8),
  },
  dropdownItemText: {
    fontSize: scaleFont(15),
    color: '#333',
    fontWeight: '400',
  },
  selectedItem: { backgroundColor: 'rgba(98, 145, 185, 0.15)' },
  selectedItemText: { color: '#6291B9', fontWeight: '700' },
  checkmark: {
    color: '#6291B9',
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: scaleW(16),
  },

  // ── Table Dropdown List ──
  tableItem: {
    minHeight: scaleH(52),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: scaleW(8),
    marginHorizontal: scaleW(8),
    paddingHorizontal: scaleW(20),
  },
  selectedTableItem: {
    backgroundColor: 'rgba(98, 145, 185, 0.15)',
  },
  tableItemText: {
    fontSize: scaleFont(15),
    color: '#333',
    fontWeight: '500',
  },
  selectedTableItemText: {
    color: '#6291B9',
    fontWeight: '700',
  },
  dropdownState: {
    minHeight: scaleH(120),
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownStateText: {
    minHeight: scaleH(96),
    paddingHorizontal: scaleW(20),
    textAlign: 'center',
    textAlignVertical: 'center',
    color: 'rgba(0,0,0,0.62)',
    fontSize: scaleFont(14),
  },
});

export default TableSelectionScreen;