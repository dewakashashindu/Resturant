import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../services/authStore';

// Shape of a row coming back from GET /api/auth/workers
interface WorkerRecord {
  UserId: number | string;
  UserName: string;
  LoginName: string;
  ContNo: string;
  GroupId: string | number;
  Enable: number | boolean;
  assignedFloors?: string[] | string; 
}

// Shape of a row coming back from GET /api/table-groups (Tbl_TableGroup.GroupName)
interface TableGroupOption {
  GroupId: number | string;
  GroupName: string;
}

export default function ManageAccessScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const managerUser = useAuthStore((state) => state.user);

  // State Management
  const [waiterName, setWaiterName] = useState('');

  // ── User groups fetched from Tbl_UserGroups (GroupId + GroupDes) ──
  const [userGroups, setUserGroups] = useState<{ GroupId: string; GroupDes: string }[]>([]);
  const [userGroupsLoading, setUserGroupsLoading] = useState<boolean>(true);
  const [userGroupsError, setUserGroupsError] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const selectedGroupDes = useMemo(
    () => userGroups.find((g) => g.GroupId === selectedGroupId)?.GroupDes ?? '',
    [userGroups, selectedGroupId]
  );

  // ── Workers fetched from Tbl_UserDetailsTest ──
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Table Groups fetched from Tbl_TableGroup (used in the Manage dropdown) ──
  const [tableGroups, setTableGroups] = useState<TableGroupOption[]>([]);
  const [tableGroupsLoading, setTableGroupsLoading] = useState<boolean>(false);
  const [tableGroupsError, setTableGroupsError] = useState<string | null>(null);

  // ── Manage / Floor-Access multi-select modal state ──
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [activeWaiter, setActiveWaiter] = useState<WorkerRecord | null>(null);
  // Map of UserId -> array of selected GroupId values (multi-choice)
  const [floorAccessMap, setFloorAccessMap] = useState<Record<string, (number | string)[]>>({});

  const isTablet = width >= 600;
  const isSmall  = height < 700;

  // Responsive Layout Parameters
  const headerH      = isTablet ? 220 : isSmall ? 90  : 200;
  const titleFs      = isTablet ? 32  : isSmall ? 20  : 24;
  const backIconSize = isTablet ? 56  : isSmall ? 44  : 44;
  const backBtnSize  = isTablet ? 60  : isSmall ? 36  : 44;
  const hPad         = isTablet ? 24  : 16;
  
  const inputFs      = isTablet ? 18  : 16;
  const labelFs      = isTablet ? 20  : 16;
  const nameFs       = isTablet ? 20  : 16;

  // ── Fetch workers on mount ──
  useEffect(() => {
    let isMounted = true;

    const fetchWorkers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getWorkers();
        if (!isMounted) return;

        if (response.ok && Array.isArray(response.data)) {
          const rawWorkers = response.data as WorkerRecord[];
          setWorkers(rawWorkers);
          // floorAccessMap (GroupId-keyed) is built once tableGroups is available — see effect below.
        } else {
          setError(response.error || 'Failed to load workers.');
        }
      } catch (err) {
        if (isMounted) setError('Failed to load workers.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWorkers();
    return () => { isMounted = false; };
  }, []);

  // ── Fetch user groups (GroupId -> GroupDes mapping) on mount ──
  useEffect(() => {
    let isMounted = true;

    const fetchUserGroups = async () => {
      setUserGroupsLoading(true);
      setUserGroupsError(null);
      try {
        const response = await apiClient.getUserGroups();
        if (!isMounted) return;

        if (response.ok && Array.isArray(response.data)) {
          const groups = response.data as { GroupId: string; GroupDes: string }[];
          setUserGroups(groups);
          if (groups.length > 0) setSelectedGroupId(groups[0].GroupId);
        } else {
          setUserGroupsError('Failed to load user groups.');
        }
      } catch (err) {
        if (isMounted) setUserGroupsError('Failed to load user groups.');
      } finally {
        if (isMounted) setUserGroupsLoading(false);
      }
    };

    fetchUserGroups();
    return () => { isMounted = false; };
  }, []);

  // ── Fetch table groups (floor access options) on mount ──
  useEffect(() => {
    let isMounted = true;

    const fetchTableGroups = async () => {
      setTableGroupsLoading(true);
      setTableGroupsError(null);
      try {
        const response = await apiClient.getTableGroups();
        if (!isMounted) return;

        if (response.ok && Array.isArray(response.data)) {
          setTableGroups(response.data as TableGroupOption[]);
        } else {
          setTableGroupsError('Failed to load floor groups.');
        }
      } catch (err) {
        if (isMounted) setTableGroupsError('Failed to load floor groups.');
      } finally {
        if (isMounted) setTableGroupsLoading(false);
      }
    };

    fetchTableGroups();
    return () => { isMounted = false; };
  }, []);

  // ── Build floorAccessMap (UserId -> selected GroupIds) once both workers'
  //     assignedFloors (GroupName strings) and tableGroups (GroupId/GroupName) are loaded ──
  useEffect(() => {
    if (workers.length === 0 || tableGroups.length === 0) return;

    const nameToId = new Map<string, number | string>();
    tableGroups.forEach((g) => nameToId.set(g.GroupName, g.GroupId));

    const initialMap: Record<string, (number | string)[]> = {};
    workers.forEach((w) => {
      if (!w.assignedFloors) return;
      let names: string[] = [];
      try {
        names = Array.isArray(w.assignedFloors) ? w.assignedFloors : JSON.parse(w.assignedFloors);
      } catch {
        names = [];
      }
      const ids = names
        .map((name) => nameToId.get(name))
        .filter((id): id is number | string => id !== undefined);
      initialMap[String(w.UserId)] = ids;
    });
    setFloorAccessMap(initialMap);
  }, [workers, tableGroups]);

  const normalizeGroupId = (value: unknown): string => {
    const str = String(value ?? '').trim();
    if (!str) return '';
    const num = Number(str);
    return Number.isFinite(num) ? String(num) : str;
  };

  const filteredWorkers = useMemo(
    () => workers.filter((worker) => normalizeGroupId(worker.GroupId) === normalizeGroupId(selectedGroupId)),
    [workers, selectedGroupId]
  );

  // Handlers
  const handleAddWaiter = () => {
    if (!waiterName.trim()) return;
    setWaiterName('');
  };

  const handleManage = (waiter: WorkerRecord) => {
    setActiveWaiter(waiter);
    setManageModalVisible(true);
  };

  const closeManageModal = () => {
    setManageModalVisible(false);
  };

  const toggleFloorAccess = (groupId: number | string) => {
    if (!activeWaiter) return;
    const waiterId = String(activeWaiter.UserId);

    setFloorAccessMap((prev) => {
      const current = prev[waiterId] ?? [];
      const alreadySelected = current.some((id) => String(id) === String(groupId));
      const updated = alreadySelected
        ? current.filter((id) => String(id) !== String(groupId))
        : [...current, groupId];
      return { ...prev, [waiterId]: updated };
    });
  };

  
  const handleSaveFloorAccess = async () => {
    if (!activeWaiter) return;
    
    const waiterId = String(activeWaiter.UserId);
    const selectedGroupIds = floorAccessMap[waiterId] ?? [];

    try {
      
      const response = await apiClient.saveUserFloorAccess({
        UserId: activeWaiter.UserId,
        TableGroupIds: selectedGroupIds,
        AssignedBy: managerUser?.userId ?? '',
      });

      if (response.ok) {
        // workers list display uses GroupName, so map selected GroupIds back to names
        const selectedGroupNames = tableGroups
          .filter((g) => selectedGroupIds.some((id) => String(id) === String(g.GroupId)))
          .map((g) => g.GroupName);

        Alert.alert('Success', `Floor access updated for ${activeWaiter.UserName}.`);

        setWorkers(prev =>
          prev.map(w => w.UserId === activeWaiter.UserId ? { ...w, assignedFloors: selectedGroupNames } : w)
        );
      } else {
        Alert.alert('Error', response.error || 'Could not update floor access.');
      }
    } catch (err) {
      console.log('Failed to save floor access:', err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setManageModalVisible(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />

      <View 
        style={[
          styles.header, 
          { 
            height: headerH + insets.top, 
            paddingTop: insets.top, 
            paddingHorizontal: hPad 
          }
        ]}
      >
        <View style={[styles.headerTopRow, { flex: 1, alignItems: 'center' }]}>
          <TouchableOpacity
            style={[styles.backButton, { width: backBtnSize, height: backBtnSize }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Image
              source={require('../../assets/icons/back.png')}
              style={{ width: backIconSize, height: backIconSize, tintColor: '#FFF' }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { fontSize: titleFs }]}>
            Manage Floor Access
          </Text>

          <View style={{ width: backBtnSize }} />
        </View>
      </View>

      {/* ── HORIZONTAL USER GROUPS SELECTION ROW ── */}
      <View style={styles.groupSectionContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.horizontalScroll, { paddingHorizontal: hPad }]}
        >
          {userGroups.map((group) => {
            const isSelected = selectedGroupId === group.GroupId;
            return (
              <TouchableOpacity
                key={group.GroupId}
                style={[styles.groupChip, isSelected && styles.groupChipActive]}
                onPress={() => setSelectedGroupId(group.GroupId)}
                activeOpacity={0.8}
              >
                <Text style={[styles.groupChipText, isSelected && styles.groupChipTextActive]}>
                  {group.GroupDes}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── SECURE ACCESS MANAGEMENT DATA LIST ── */}
      <View style={[styles.listHeaderContainer, { paddingHorizontal: hPad }]}>
        <Text style={[styles.listHeaderLabel, { fontSize: labelFs }]}>Manage Access</Text>
        <View style={styles.divider} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#002748" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: hPad, paddingTop: 24 }}>
          <Text style={{ color: '#B00020', textAlign: 'center', fontFamily: 'Roboto' }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredWorkers}
          keyExtractor={(item) => String(item.UserId)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 120 + insets.bottom }}
          ListEmptyComponent={
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 24, fontFamily: 'Roboto' }}>
              No workers found in this group.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.waiterRow}>
              <View style={styles.waiterInfo}>
                <Text style={[styles.waiterName, { fontSize: nameFs }]}>{item.UserName}</Text>
                <Text style={styles.waiterGroupTag}>{selectedGroupDes}</Text>
              </View>
              
              <View style={styles.actionGroup}>
                <TouchableOpacity 
                  style={styles.iconBtn} 
                  activeOpacity={0.6}
                  onPress={() => setWorkers(workers.filter(w => w.UserId !== item.UserId))}
                >
                  <Image
                    source={require('../../assets/icons/trash.png')} 
                    style={styles.trashIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={() => handleManage(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manageBtnText}>Manage</Text>
                  <Image
                    source={require('../../assets/icons/arrow-right.png')}
                    style={styles.arrowIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* ── FLOOR ACCESS MULTI-SELECT DROPDOWN ── */}
      <Modal
        visible={manageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeManageModal}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>
              Floor Access{activeWaiter ? ` — ${activeWaiter.UserName}` : ''}
            </Text>

            <ScrollView style={modalStyles.optionsList}>
              {tableGroupsLoading && (
                <ActivityIndicator size="small" color="#002748" style={{ marginVertical: 16 }} />
              )}

              {!tableGroupsLoading && tableGroupsError && (
                <Text style={modalStyles.errorText}>{tableGroupsError}</Text>
              )}

              {!tableGroupsLoading && !tableGroupsError && tableGroups.length === 0 && (
                <Text style={modalStyles.emptyText}>No floor groups found.</Text>
              )}

              {!tableGroupsLoading && !tableGroupsError && tableGroups.map((group) => {
                const waiterId = activeWaiter ? String(activeWaiter.UserId) : '';
                const isChecked = (floorAccessMap[waiterId] ?? []).some(
                  (id) => String(id) === String(group.GroupId)
                );
                return (
                  <TouchableOpacity
                    key={String(group.GroupId)}
                    style={modalStyles.optionRow}
                    onPress={() => toggleFloorAccess(group.GroupId)}
                    activeOpacity={0.7}
                  >
                    <View style={[modalStyles.checkbox, isChecked && modalStyles.checkboxChecked]}>
                      {isChecked && <Text style={modalStyles.checkmark}>✓</Text>}
                    </View>
                    <Text style={modalStyles.optionText}>{group.GroupName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={modalStyles.actionsRow}>
              <TouchableOpacity style={modalStyles.cancelBtn} onPress={closeManageModal} activeOpacity={0.8}>
                <Text style={modalStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modalStyles.saveBtn} onPress={handleSaveFloorAccess} activeOpacity={0.8}>
                <Text style={modalStyles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: { backgroundColor: '#002748', justifyContent: 'center' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  backButton: { justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontWeight: '500', color: '#FFF', textAlign: 'center', flex: 1, fontFamily: 'Roboto' },
  groupSectionContainer: { marginTop: 16, height: 40 },
  horizontalScroll: { gap: 8, alignItems: 'center' },
  groupChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E4E8EC', borderWidth: 1, borderColor: 'rgba(0,39,72,0.1)', justifyContent: 'center', alignItems: 'center' },
  groupChipActive: { backgroundColor: '#002748', borderColor: '#002748' },
  groupChipText: { fontSize: 13, color: '#002748', fontWeight: '500', fontFamily: 'Roboto' },
  groupChipTextActive: { color: '#FFF' },
  listHeaderContainer: { marginTop: 24, marginBottom: 16 },
  listHeaderLabel: { color: '#000', fontWeight: '300', fontFamily: 'Roboto', marginBottom: 8 },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  waiterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  waiterInfo: { flexDirection: 'column', gap: 4 },
  waiterName: { color: '#000', fontWeight: '400', fontFamily: 'Roboto' },
  waiterGroupTag: { fontSize: 11, color: '#666', fontWeight: '500', fontFamily: 'Roboto', backgroundColor: '#F0F2F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  trashIcon: { width: 20, height: 20, tintColor: 'rgba(0,0,0,0.5)' },
  manageBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D9D9D9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 6 },
  manageBtnText: { color: '#000', fontSize: 12, fontWeight: '400', fontFamily: 'Roboto' },
  arrowIcon: { width: 10, height: 10, tintColor: '#000' }
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  sheet: { width: '100%', maxWidth: 420, maxHeight: '70%', backgroundColor: '#FFF', borderRadius: 16, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  title: { fontSize: 16, fontWeight: '500', color: '#002748', fontFamily: 'Roboto', marginBottom: 12 },
  optionsList: { maxHeight: 320, marginBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(0,39,72,0.4)', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#002748', borderColor: '#002748' },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  optionText: { fontSize: 14, color: '#000', fontFamily: 'Roboto' },
  errorText: { color: '#B00020', fontFamily: 'Roboto', paddingVertical: 12, textAlign: 'center' },
  emptyText: { color: '#666', fontFamily: 'Roboto', paddingVertical: 12, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#E4E8EC' },
  cancelBtnText: { color: '#002748', fontSize: 13, fontWeight: '500', fontFamily: 'Roboto' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: '#002748' },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '500', fontFamily: 'Roboto' }
});