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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../services/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkerRecord {
  UserId: number | string;
  UserName: string;
  LoginName: string;
  ContNo: string;
  GroupId: string | number;
  Enable: number | boolean;
  assignedFloors?: string[] | string;
}

interface TableGroupOption {
  GroupId: number | string;
  GroupName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManageAccessScreen() {
  const router      = useRouter();
  const managerUser = useAuthStore((state) => state.user);

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = getDynamicStyles(width, height, insets.bottom);

  // ── State ──────────────────────────────────────────────────────────────────
  const [waiterName, setWaiterName] = useState('');

  const [userGroups,        setUserGroups]        = useState<{ GroupId: string; GroupDes: string }[]>([]);
  const [userGroupsLoading, setUserGroupsLoading] = useState<boolean>(true);
  const [userGroupsError,   setUserGroupsError]   = useState<string | null>(null);
  const [selectedGroupId,   setSelectedGroupId]   = useState<string>('');

  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);

  const [tableGroups,        setTableGroups]        = useState<TableGroupOption[]>([]);
  const [tableGroupsLoading, setTableGroupsLoading] = useState<boolean>(false);
  const [tableGroupsError,   setTableGroupsError]   = useState<string | null>(null);

  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [activeWaiter,       setActiveWaiter]       = useState<WorkerRecord | null>(null);
  const [floorAccessMap,     setFloorAccessMap]     = useState<Record<string, (number | string)[]>>({});

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedGroupDes = useMemo(
    () => userGroups.find((g) => g.GroupId === selectedGroupId)?.GroupDes ?? '',
    [userGroups, selectedGroupId],
  );

  const normalizeGroupId = (value: unknown): string => {
    const str = String(value ?? '').trim();
    if (!str) return '';
    const num = Number(str);
    return Number.isFinite(num) ? String(num) : str;
  };

  const filteredWorkers = useMemo(
    () => workers.filter(
      (worker) => normalizeGroupId(worker.GroupId) === normalizeGroupId(selectedGroupId),
    ),
    [workers, selectedGroupId],
  );

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const fetchWorkers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getWorkers();
        if (!isMounted) return;
        if (response.ok && Array.isArray(response.data)) {
          setWorkers(response.data as WorkerRecord[]);
        } else {
          setError(response.error || 'Failed to load workers.');
        }
      } catch {
        if (isMounted) setError('Failed to load workers.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchWorkers();
    return () => { isMounted = false; };
  }, []);

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
      } catch {
        if (isMounted) setUserGroupsError('Failed to load user groups.');
      } finally {
        if (isMounted) setUserGroupsLoading(false);
      }
    };
    fetchUserGroups();
    return () => { isMounted = false; };
  }, []);

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
      } catch {
        if (isMounted) setTableGroupsError('Failed to load floor groups.');
      } finally {
        if (isMounted) setTableGroupsLoading(false);
      }
    };
    fetchTableGroups();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (workers.length === 0 || tableGroups.length === 0) return;
    // Normalize key: trim whitespace + lowercase so "Ground Floor " === "ground floor"
    const normalizeKey = (s: string) => String(s ?? '').trim().toLowerCase();
    const nameToId = new Map<string, number | string>();
    tableGroups.forEach((g) => nameToId.set(normalizeKey(g.GroupName), g.GroupId));
    const initialMap: Record<string, (number | string)[]> = {};
    workers.forEach((w) => {
      if (!w.assignedFloors) return;
      let names: string[] = [];
      try {
        names = Array.isArray(w.assignedFloors)
          ? w.assignedFloors
          : JSON.parse(w.assignedFloors);
      } catch { names = []; }
      const ids = names
        .map((name) => nameToId.get(normalizeKey(name)))
        .filter((id): id is number | string => id !== undefined);
      initialMap[String(w.UserId)] = ids;
    });
    setFloorAccessMap(initialMap);
  }, [workers, tableGroups]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddWaiter = () => {
    if (!waiterName.trim()) return;
    setWaiterName('');
  };

  const handleManage = (waiter: WorkerRecord) => {
    setActiveWaiter(waiter);
    setManageModalVisible(true);
  };

  const closeManageModal = () => setManageModalVisible(false);

  const toggleFloorAccess = (groupId: number | string) => {
    if (!activeWaiter) return;
    const waiterId = String(activeWaiter.UserId);
    setFloorAccessMap((prev) => {
      const current         = prev[waiterId] ?? [];
      const alreadySelected = current.some((id) => String(id) === String(groupId));
      const updated         = alreadySelected
        ? current.filter((id) => String(id) !== String(groupId))
        : [...current, groupId];
      return { ...prev, [waiterId]: updated };
    });
  };

  const handleSaveFloorAccess = async () => {
    if (!activeWaiter) return;
    const waiterId         = String(activeWaiter.UserId);
    const selectedGroupIds = floorAccessMap[waiterId] ?? [];
    try {
      const response = await apiClient.saveUserFloorAccess({
        UserId:        activeWaiter.UserId,
        TableGroupIds: selectedGroupIds,
        AssignedBy:    managerUser?.userId ?? '',
      });
      if (response.ok) {
        const selectedGroupNames = tableGroups
          .filter((g) => selectedGroupIds.some((id) => String(id) === String(g.GroupId)))
          .map((g) => g.GroupName);
        Alert.alert('Success', `Floor access updated for ${activeWaiter.UserName}.`);
        setWorkers((prev) =>
          prev.map((w) =>
            w.UserId === activeWaiter.UserId
              ? { ...w, assignedFloors: selectedGroupNames }
              : w,
          ),
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

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />

      {/* HEADER */}
      <View style={[s.header, { paddingTop: insets.top, height: s.header.height + insets.top }]}>
        <View style={s.headerTopRow}>
          <TouchableOpacity style={s.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Image
              source={require('../../assets/icons/back.png')}
              style={s.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={s.headerTitle}>Manage Floor Access</Text>
          <View style={s.headerSpacer} />
        </View>
      </View>

      {/* USER GROUP CHIPS */}
      <View style={s.groupSectionContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.horizontalScroll}
        >
          {userGroups.map((group) => {
            const isSelected = selectedGroupId === group.GroupId;
            return (
              <TouchableOpacity
                key={group.GroupId}
                style={[s.groupChip, isSelected && s.groupChipActive]}
                onPress={() => setSelectedGroupId(group.GroupId)}
                activeOpacity={0.8}
              >
                <Text style={[s.groupChipText, isSelected && s.groupChipTextActive]}>
                  {group.GroupDes}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* LIST HEADER */}
      <View style={s.listHeaderContainer}>
        <Text style={s.listHeaderLabel}>Manage Access</Text>
        <View style={s.divider} />
      </View>

      {/* WORKERS LIST */}
      {loading ? (
        <View style={s.centeredFill}>
          <ActivityIndicator size="small" color="#002748" />
        </View>
      ) : error ? (
        <View style={s.errorWrap}>
          <Text style={s.errorBodyText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredWorkers}
          keyExtractor={(item) => String(item.UserId)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={<Text style={s.emptyText}>No workers found in this group.</Text>}
          renderItem={({ item }) => (
            <View style={s.waiterRow}>
              <View style={s.waiterInfo}>
                <Text style={s.waiterName}>{item.UserName}</Text>
                <Text style={s.waiterGroupTag}>{selectedGroupDes}</Text>
              </View>

              <View style={s.actionGroup}>
                <TouchableOpacity
                  style={s.iconBtn}
                  activeOpacity={0.6}
                  onPress={() => setWorkers(workers.filter((w) => w.UserId !== item.UserId))}
                >
                  <Image
                    source={require('../../assets/icons/trash.png')}
                    style={s.trashIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.manageBtn}
                  onPress={() => handleManage(item)}
                  activeOpacity={0.8}
                >
                  <Text style={s.manageBtnText}>Manage</Text>
                  <Image
                    source={require('../../assets/icons/arrow-right.png')}
                    style={s.arrowIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* FLOOR ACCESS MODAL */}
      <Modal
        visible={manageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeManageModal}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>
              Floor Access{activeWaiter ? ` — ${activeWaiter.UserName}` : ''}
            </Text>

            <ScrollView style={s.modalOptionsList}>
              {tableGroupsLoading && (
                <ActivityIndicator size="small" color="#002748" style={s.modalLoader} />
              )}

              {!tableGroupsLoading && tableGroupsError && (
                <Text style={s.modalErrorText}>{tableGroupsError}</Text>
              )}

              {!tableGroupsLoading && !tableGroupsError && tableGroups.length === 0 && (
                <Text style={s.modalEmptyText}>No floor groups found.</Text>
              )}

              {!tableGroupsLoading && !tableGroupsError && tableGroups.map((group) => {
                const waiterId  = activeWaiter ? String(activeWaiter.UserId) : '';
                const isChecked = (floorAccessMap[waiterId] ?? []).some(
                  (id) => String(id) === String(group.GroupId),
                );
                return (
                  <TouchableOpacity
                    key={String(group.GroupId)}
                    style={s.modalOptionRow}
                    onPress={() => toggleFloorAccess(group.GroupId)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.checkbox, isChecked && s.checkboxChecked]}>
                      {isChecked && <Text style={s.checkmark}>✓</Text>}
                    </View>
                    <Text style={s.modalOptionText}>{group.GroupName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={s.modalActionsRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeManageModal} activeOpacity={0.8}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveFloorAccess} activeOpacity={0.8}>
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Dynamic Styles Factory ───────────────────────────────────────────────────
function getDynamicStyles(width: number, height: number, bottomInset: number) {
  const isTablet = width >= 600;
  const isSmall  = height < 700;

  const BASE_WIDTH = isTablet ? 768 : 375;
  const scale = (size: number): number => (width / BASE_WIDTH) * size;

  // ── 3-Tier Conditional Benchmarks ─────────────────────────────────────────

  // Header
  const headerH        = isTablet ? 220  : isSmall ? 90   : 200;
  const headerTopMT    = isTablet ? 14   : isSmall ?  6   : 10;
  const hPad           = isTablet ? 24   : isSmall ? 12   : 16;
  const titleFs        = isTablet ? 32   : isSmall ? 20   : 24;
  const backIconSize   = isTablet ? 56   : isSmall ? 36   : 44;
  const backBtnSize    = isTablet ? 60   : isSmall ? 36   : 44;

  // Group chips row
  const groupSectionMT = isTablet ? 22   : isSmall ? 10   : 16;
  const groupSectionH  = isTablet ? 56   : isSmall ? 34   : 40;
  const chipScrollGap  = isTablet ? 12   : isSmall ?  5   :  8;
  const chipPadH       = isTablet ? 22   : isSmall ? 12   : 16;
  const chipPadV       = isTablet ? 12   : isSmall ?  6   :  8;
  const chipRadius     = isTablet ? 28   : isSmall ? 16   : 20;
  const chipFs         = isTablet ? 17   : isSmall ? 11   : 13;

  // List header
  const listHdrMT      = isTablet ? 32   : isSmall ? 14   : 24;
  const listHdrMB      = isTablet ? 22   : isSmall ? 10   : 16;
  const listLabelMB    = isTablet ? 12   : isSmall ?  5   :  8;
  const listLabelFs    = isTablet ? 20   : isSmall ? 13   : 16;

  // FlatList content
  const listPadB       = isTablet ? 160  : isSmall ? 80   : 120;

  // Worker row
  const rowPadV        = isTablet ? 20   : isSmall ? 10   : 14;
  const rowPadH        = isTablet ? 22   : isSmall ? 12   : 16;
  const rowRadius      = isTablet ? 16   : isSmall ?  9   : 12;
  const rowMB          = isTablet ? 14   : isSmall ?  6   : 10;
  const rowShadH       = isTablet ?  2   : isSmall ?  1   :  1;
  const rowShadR       = isTablet ?  4   : isSmall ?  1   :  2;
  const rowInfoGap     = isTablet ?  6   : isSmall ?  2   :  4;
  const nameFs         = isTablet ? 20   : isSmall ? 13   : 16;
  const tagFs          = isTablet ? 14   : isSmall ?  9   : 11;
  const tagPadH        = isTablet ? 10   : isSmall ?  4   :  6;
  const tagPadV        = isTablet ?  4   : isSmall ?  1   :  2;
  const tagRadius      = isTablet ?  6   : isSmall ?  3   :  4;
  const actionGroupGap = isTablet ? 20   : isSmall ? 10   : 14;
  const iconBtnPad     = isTablet ?  8   : isSmall ?  2   :  4;
  const trashSz        = isTablet ? 28   : isSmall ? 16   : 20;
  const managePadH     = isTablet ? 18   : isSmall ?  9   : 12;
  const managePadV     = isTablet ? 10   : isSmall ?  4   :  6;
  const manageRadius   = isTablet ? 12   : isSmall ?  6   :  8;
  const manageGap      = isTablet ? 10   : isSmall ?  4   :  6;
  const manageBtnFs    = isTablet ? 16   : isSmall ? 10   : 12;
  const arrowSz        = isTablet ? 14   : isSmall ?  8   : 10;

  // Error / empty / loading states
  const errorWrapPT    = isTablet ? 36   : isSmall ? 16   : 24;
  const emptyMT        = isTablet ? 36   : isSmall ? 14   : 24;
  const stateTextFs    = isTablet ? 16   : isSmall ? 12   : 14;

  // Modal overlay
  const overlayPadH    = isTablet ? 48   : isSmall ? 16   : 24;

  // Modal sheet
  const modalMaxW      = isTablet ? 560  : 420;
  const modalPadT      = isTablet ? 28   : isSmall ? 14   : 20;
  const modalPadH      = isTablet ? 28   : isSmall ? 14   : 20;
  const modalPadB      = isTablet ? 22   : isSmall ? 10   : 16;
  const modalRadius    = isTablet ? 22   : isSmall ? 12   : 16;
  const modalShadH     = isTablet ?  4   : isSmall ?  1   :  2;
  const modalShadR     = isTablet ? 10   : isSmall ?  4   :  6;

  // Modal title
  const modalTitleFs   = isTablet ? 22   : isSmall ? 13   : 16;
  const modalTitleMB   = isTablet ? 18   : isSmall ?  8   : 12;

  // Modal options list
  const optionsMaxH    = isTablet ? 440  : isSmall ? 220  : 320;
  const optionsMB      = isTablet ? 18   : isSmall ?  8   : 12;
  const loaderMV       = isTablet ? 24   : isSmall ?  8   : 16;
  const msgPadV        = isTablet ? 18   : isSmall ?  8   : 12;
  const optionRowPadV  = isTablet ? 14   : isSmall ?  7   : 10;
  const optionRowGap   = isTablet ? 16   : isSmall ?  8   : 12;
  const optionTextFs   = isTablet ? 18   : isSmall ? 12   : 14;
  const checkboxSz     = isTablet ? 28   : isSmall ? 16   : 20;
  const checkboxRadius = isTablet ?  6   : isSmall ?  3   :  4;
  const checkmarkFs    = isTablet ? 18   : isSmall ? 10   : 13;

  // Modal actions row
  const actionsGap     = isTablet ? 18   : isSmall ?  8   : 12;
  const actionsPadT    = isTablet ? 12   : isSmall ?  6   :  8;
  const cancelPadH     = isTablet ? 24   : isSmall ? 12   : 16;
  const cancelPadV     = isTablet ? 14   : isSmall ?  7   : 10;
  const cancelRadius   = isTablet ? 12   : isSmall ?  6   :  8;
  const cancelFs       = isTablet ? 17   : isSmall ? 11   : 13;
  const savePadH       = isTablet ? 26   : isSmall ? 14   : 18;
  const savePadV       = isTablet ? 14   : isSmall ?  7   : 10;
  const saveRadius     = isTablet ? 12   : isSmall ?  6   :  8;
  const saveFs         = isTablet ? 17   : isSmall ? 11   : 13;

  // ── StyleSheet ─────────────────────────────────────────────────────────────
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F4F6F8',
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      backgroundColor: '#002748',
      justifyContent: 'center',
      height: scale(headerH), // insets.top added inline in JSX
      paddingHorizontal: scale(hPad),
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
      marginTop: scale(headerTopMT),
    },
    backButton: {
      width: scale(backBtnSize),
      height: scale(backBtnSize),
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    backIcon: {
      width: scale(backIconSize),
      height: scale(backIconSize),
      tintColor: '#FFF',
    },
    headerTitle: {
      fontWeight: '500',
      color: '#FFF',
      textAlign: 'center',
      flex: 1,
      fontFamily: 'Roboto',
      fontSize: scale(titleFs),
    },
    headerSpacer: {
      width: scale(backBtnSize),
    },

    // ── Group chips ──────────────────────────────────────────────────────────
    groupSectionContainer: {
      marginTop: scale(groupSectionMT),
      height: scale(groupSectionH),
    },
    horizontalScroll: {
      gap: scale(chipScrollGap),
      alignItems: 'center',
      paddingHorizontal: scale(hPad),
    },
    groupChip: {
      paddingHorizontal: scale(chipPadH),
      paddingVertical: scale(chipPadV),
      borderRadius: scale(chipRadius),
      backgroundColor: '#E4E8EC',
      borderWidth: 1,
      borderColor: 'rgba(0,39,72,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    groupChipActive: {
      backgroundColor: '#002748',
      borderColor: '#002748',
    },
    groupChipText: {
      fontSize: scale(chipFs),
      color: '#002748',
      fontWeight: '500',
      fontFamily: 'Roboto',
    },
    groupChipTextActive: {
      color: '#FFF',
    },

    // ── List header ──────────────────────────────────────────────────────────
    listHeaderContainer: {
      marginTop: scale(listHdrMT),
      marginBottom: scale(listHdrMB),
      paddingHorizontal: scale(hPad),
    },
    listHeaderLabel: {
      color: '#000',
      fontWeight: '300',
      fontFamily: 'Roboto',
      marginBottom: scale(listLabelMB),
      fontSize: scale(listLabelFs),
    },
    divider: {
      width: '100%',
      height: 1,
      backgroundColor: 'rgba(0,0,0,0.2)',
    },

    // ── FlatList content ─────────────────────────────────────────────────────
    listContent: {
      paddingHorizontal: scale(hPad),
      paddingBottom: scale(listPadB) + bottomInset,
    },

    // ── Worker row ───────────────────────────────────────────────────────────
    waiterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#FFF',
      paddingVertical: scale(rowPadV),
      paddingHorizontal: scale(rowPadH),
      borderRadius: scale(rowRadius),
      marginBottom: scale(rowMB),
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: scale(rowShadH) },
      shadowOpacity: 0.1,
      shadowRadius: scale(rowShadR),
    },
    waiterInfo: {
      flexDirection: 'column',
      gap: scale(rowInfoGap),
    },
    waiterName: {
      color: '#000',
      fontWeight: '400',
      fontFamily: 'Roboto',
      fontSize: scale(nameFs),
    },
    waiterGroupTag: {
      fontSize: scale(tagFs),
      color: '#666',
      fontWeight: '500',
      fontFamily: 'Roboto',
      backgroundColor: '#F0F2F5',
      paddingHorizontal: scale(tagPadH),
      paddingVertical: scale(tagPadV),
      borderRadius: scale(tagRadius),
      alignSelf: 'flex-start',
    },
    actionGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(actionGroupGap),
    },
    iconBtn: {
      padding: scale(iconBtnPad),
      justifyContent: 'center',
      alignItems: 'center',
    },
    trashIcon: {
      width: scale(trashSz),
      height: scale(trashSz),
      tintColor: 'rgba(0,0,0,0.5)',
    },
    manageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#D9D9D9',
      paddingHorizontal: scale(managePadH),
      paddingVertical: scale(managePadV),
      borderRadius: scale(manageRadius),
      gap: scale(manageGap),
    },
    manageBtnText: {
      color: '#000',
      fontSize: scale(manageBtnFs),
      fontWeight: '400',
      fontFamily: 'Roboto',
    },
    arrowIcon: {
      width: scale(arrowSz),
      height: scale(arrowSz),
      tintColor: '#000',
    },

    // ── Loading / error / empty ──────────────────────────────────────────────
    centeredFill: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorWrap: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: scale(hPad),
      paddingTop: scale(errorWrapPT),
    },
    errorBodyText: {
      color: '#B00020',
      textAlign: 'center',
      fontFamily: 'Roboto',
      fontSize: scale(stateTextFs),
    },
    emptyText: {
      color: '#666',
      textAlign: 'center',
      marginTop: scale(emptyMT),
      fontFamily: 'Roboto',
      fontSize: scale(stateTextFs),
    },

    // ── Modal overlay ────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: scale(overlayPadH),
    },

    // ── Modal sheet ──────────────────────────────────────────────────────────
    modalSheet: {
      width: '100%',
      maxWidth: scale(modalMaxW),
      maxHeight: '70%',
      backgroundColor: '#FFF',
      borderRadius: scale(modalRadius),
      paddingTop: scale(modalPadT),
      paddingHorizontal: scale(modalPadH),
      paddingBottom: scale(modalPadB),
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: scale(modalShadH) },
      shadowOpacity: 0.2,
      shadowRadius: scale(modalShadR),
    },
    modalTitle: {
      fontSize: scale(modalTitleFs),
      fontWeight: '500',
      color: '#002748',
      fontFamily: 'Roboto',
      marginBottom: scale(modalTitleMB),
    },

    // ── Modal options ────────────────────────────────────────────────────────
    modalOptionsList: {
      maxHeight: scale(optionsMaxH),
      marginBottom: scale(optionsMB),
    },
    modalLoader: {
      marginVertical: scale(loaderMV),
    },
    modalErrorText: {
      color: '#B00020',
      fontFamily: 'Roboto',
      paddingVertical: scale(msgPadV),
      textAlign: 'center',
      fontSize: scale(optionTextFs),
    },
    modalEmptyText: {
      color: '#666',
      fontFamily: 'Roboto',
      paddingVertical: scale(msgPadV),
      textAlign: 'center',
      fontSize: scale(optionTextFs),
    },
    modalOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: scale(optionRowPadV),
      gap: scale(optionRowGap),
    },
    checkbox: {
      width: scale(checkboxSz),
      height: scale(checkboxSz),
      borderRadius: scale(checkboxRadius),
      borderWidth: 1.5,
      borderColor: 'rgba(0,39,72,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: '#002748',
      borderColor: '#002748',
    },
    checkmark: {
      color: '#FFF',
      fontSize: scale(checkmarkFs),
      fontWeight: '700',
    },
    modalOptionText: {
      fontSize: scale(optionTextFs),
      color: '#000',
      fontFamily: 'Roboto',
    },

    // ── Modal actions ────────────────────────────────────────────────────────
    modalActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: scale(actionsGap),
      paddingTop: scale(actionsPadT),
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.08)',
    },
    cancelBtn: {
      paddingHorizontal: scale(cancelPadH),
      paddingVertical: scale(cancelPadV),
      borderRadius: scale(cancelRadius),
      backgroundColor: '#E4E8EC',
    },
    cancelBtnText: {
      color: '#002748',
      fontSize: scale(cancelFs),
      fontWeight: '500',
      fontFamily: 'Roboto',
    },
    saveBtn: {
      paddingHorizontal: scale(savePadH),
      paddingVertical: scale(savePadV),
      borderRadius: scale(saveRadius),
      backgroundColor: '#002748',
    },
    saveBtnText: {
      color: '#FFF',
      fontSize: scale(saveFs),
      fontWeight: '500',
      fontFamily: 'Roboto',
    },
  });
}