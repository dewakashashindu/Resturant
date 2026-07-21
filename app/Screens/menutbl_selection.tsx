import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
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

// ══════════════════════════════════════
// DATA
// ══════════════════════════════════════
const TABLE_GROUPS: TableGroup[] = [
  { id: 'A', label: 'A. GROUND FLOOR' },
  { id: 'B', label: 'B. FIRST FLOOR' },
  { id: 'C', label: 'C. SECOND FLOOR' },
  { id: 'D', label: 'D. SMALL TABLES' },
  { id: 'E', label: 'E. ROOM SERVICE' },
  { id: 'F', label: 'F. UBER EATS' },
  { id: 'G', label: 'G. EATS' },
  { id: 'P', label: 'P. PICK ME FOOD' },
  { id: 'S', label: 'SPECIAL BUFFET' },
];

const generateTables = (groupId: string): TableItem[] => {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `${groupId}-T${i + 1}`,
    label: `Table ${i + 1}`,
  }));
};

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
  const statusBarTop =
    Platform.OS === 'android' ? StatusBar.currentHeight || scaleH(24) : 0;

  // ── State ──
  const [selectedGroup, setSelectedGroup] = useState<TableGroup | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [groupDropdownVisible, setGroupDropdownVisible] =
    useState<boolean>(false);
  const [tableDropdownVisible, setTableDropdownVisible] =
    useState<boolean>(false);

  const tables: TableItem[] = selectedGroup
    ? generateTables(selectedGroup.id)
    : [];

  // ── Handlers ──
  const handleGroupSelect = (group: TableGroup): void => {
    setSelectedGroup(group);
    setSelectedTable(null);
    setGroupDropdownVisible(false);
  };

  const handleTableSelect = (table: TableItem): void => {
    setSelectedTable(table);
    setTableDropdownVisible(false);
  };

  const handleConfirm = (): void => {
    if (!selectedGroup || !selectedTable) {
      alert('Please select both a Table Group and a Table.');
      return;
    }
    router.push({
      pathname: '/menu/menu_welcome',
      params: {
        groupId: selectedGroup.id,
        groupLabel: selectedGroup.label,
        tableId: selectedTable.id,
        tableLabel: selectedTable.label,
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* ── Mock Status Bar ── */}
      <View
        style={[
          styles.statusBar,
          {
            top: statusBarTop + scaleH(8),
            paddingHorizontal: paddingH,
          },
        ]}
      >
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
          >
            <Text
              style={[
                styles.cardText,
                !selectedGroup && styles.placeholderText,
              ]}
            >
              {selectedGroup ? selectedGroup.label : 'Select Table Group'}
            </Text>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>

          <Text style={styles.labelText}>Current Table</Text>
          <TouchableOpacity
            style={[styles.card, !selectedGroup && styles.disabledCard]}
            onPress={() => selectedGroup && setTableDropdownVisible(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.cardText,
                !selectedTable && styles.placeholderText,
              ]}
            >
              {selectedTable ? selectedTable.label : 'Select Table'}
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
            <FlatList<TableGroup>
              data={TABLE_GROUPS}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={renderGroupItem}
              contentContainerStyle={{ paddingBottom: scaleH(12) }}
              showsVerticalScrollIndicator={false}
            />
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
            <FlatList<TableItem>
              data={tables}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.tableGrid}
              ItemSeparatorComponent={() => (
                <View style={{ height: scaleH(10) }} />
              )}
              renderItem={renderTableItem}
              contentContainerStyle={{ paddingBottom: scaleH(12) }}
              showsVerticalScrollIndicator={false}
            />
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

  // ── Status Bar ──
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: scaleH(32),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  timeText: {
    color: 'black',
    fontSize: scaleFont(12),
    fontWeight: '500',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleW(4),
  },
  iconWrapper: {
    width: scaleW(16),
    height: scaleW(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  wifiIcon: {
    width: scaleW(16),
    height: scaleW(11.33),
    backgroundColor: 'black',
  },
  signalIcon: {
    width: scaleW(13.33),
    height: scaleW(13.33),
    backgroundColor: 'black',
  },
  batteryIcon: {
    width: scaleW(6.67),
    height: scaleW(13.33),
    backgroundColor: 'black',
  },

  // ── Decorative Circles ──
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(98, 145, 185, 0.54)',
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
    color: 'black',
    fontSize: scaleFont(14),
    fontWeight: '400',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleW(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
    shadowOpacity: 0.25,
    shadowRadius: 10,
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

  // ── Table Grid ──
  tableGrid: {
    justifyContent: 'space-around',
    paddingHorizontal: scaleW(12),
  },
  tableItem: {
    width: '45%',
    height: scaleH(48),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: scaleW(10),
    borderWidth: 1.5,
    borderColor: '#6291B9',
    backgroundColor: 'white',
  },
  selectedTableItem: {
    backgroundColor: '#6291B9',
    borderColor: '#6291B9',
  },
  tableItemText: {
    fontSize: scaleFont(14),
    color: '#6291B9',
    fontWeight: '500',
  },
  selectedTableItemText: {
    color: 'white',
    fontWeight: '700',
  },
});

export default TableSelectionScreen;