import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import useItemStore from '../../services/itemStore';

// ─── Component ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router  = useRouter();
  const { width, height } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  const s       = getDynamicStyles(width, height, insets.bottom);

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,          setActiveTab]          = useState<'personal' | 'system'>('personal');
  const [selectedFloors,     setSelectedFloors]     = useState<string[]>([]);
  const [pictureUploading,   setPictureUploading]   = useState(false);
  const [photoActionVisible, setPhotoActionVisible] = useState(false);
  const [viewPhotoVisible,   setViewPhotoVisible]   = useState(false);

  // ── Store ──────────────────────────────────────────────────────────────────
  const isSyncing    = useItemStore((s) => s.isSyncing);
  const lastSyncTime = useItemStore((s) => s.lastSyncTime) ?? 'Never';
  const syncError    = useItemStore((s) => s.syncError);
  const syncMenuData = useItemStore((s) => s.syncMenuData);
  const hydrateItems = useItemStore((s) => s.hydrateItems);
  const isHydrated   = useItemStore((s) => s.isHydrated);
  const user         = useAuthStore((s) => s.user);
  const updatePicture= useAuthStore((s) => s.updatePicture);

  console.log('Current User Group ID is:', user?.groupId);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.assignedFloors) setSelectedFloors(user.assignedFloors);
  }, [user]);

  useEffect(() => {
    if (!isHydrated) hydrateItems().catch(() => {});
  }, [hydrateItems, isHydrated]);

  // ── Photo helpers ──────────────────────────────────────────────────────────
  const pickFromLibrary = async () => {
    setPhotoActionVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    await uploadPhoto(result);
  };

  const takePhoto = async () => {
    setPhotoActionVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    await uploadPhoto(result);
  };

  const uploadPhoto = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const base64  = result.assets[0].base64!;
    const locCode = user?.locCode;
    const userId  = user?.userId;
    if (!locCode || !userId) {
      Alert.alert('Error', 'User info missing. Please re-login.');
      return;
    }
    setPictureUploading(true);
    try {
      const res = await apiClient.updateProfilePicture(userId, locCode, base64);
      if (res.ok) {
        updatePicture(base64);
        Alert.alert('Success', 'Profile picture updated!');
      } else {
        Alert.alert('Failed', res.message || 'Could not update picture.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setPictureUploading(false);
    }
  };

  // ── Sync handler ───────────────────────────────────────────────────────────
  const handleCoreSync = async () => {
    try {
      const synced = await syncMenuData();
      if (synced) Alert.alert('Sync Complete', 'Menu data refreshed successfully.');
      else        Alert.alert('Sync Failed',   syncError || 'Unable to refresh menu data.');
    } catch (err) {
      console.log('Sync failed:', err);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />

      {/* ── HEADER ── */}
      <View style={[s.header, { paddingTop: insets.top, height: s.header.height + insets.top }]}>
        <View style={s.headerTopRow}>
          <TouchableOpacity style={s.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Image
              source={require('../../assets/icons/back.png')}
              style={s.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Settings</Text>
          <View style={s.headerSpacer} />
        </View>

        {/* Tab bar */}
        <View style={s.tabBarContainer}>
          {(['personal', 'system'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tabButton, activeTab === tab && s.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.9}
            >
              <Text style={[s.tabText, activeTab === tab ? s.tabTextActive : s.tabTextInactive]}>
                {tab === 'personal' ? 'Personal' : 'System'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── CONTENT ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {/* ════ PERSONAL TAB ════ */}
        {activeTab === 'personal' ? (
          <>
            {/* ── Photo Action Sheet Modal ── */}
            <Modal
              visible={photoActionVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setPhotoActionVisible(false)}
            >
              <TouchableOpacity
                style={s.sheetOverlay}
                activeOpacity={1}
                onPress={() => setPhotoActionVisible(false)}
              >
                <View style={s.sheetContainer}>
                  <View style={s.sheetHandle} />

                  <Text style={s.sheetTitle}>Profile Photo</Text>

                  <TouchableOpacity
                    style={s.sheetOption}
                    activeOpacity={0.75}
                    onPress={() => {
                      setPhotoActionVisible(false);
                      setTimeout(() => setViewPhotoVisible(true), 200);
                    }}
                  >
                    <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(0,39,72,0.08)' }]}>
                      <Ionicons name="eye-outline" size={22} color="#002748" />
                    </View>
                    <View style={s.sheetOptionText}>
                      <Text style={s.sheetOptionLabel}>View Photo</Text>
                      <Text style={s.sheetOptionSub}>See your current profile picture</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={s.sheetDivider} />

                  <TouchableOpacity
                    style={s.sheetOption}
                    activeOpacity={0.75}
                    onPress={pickFromLibrary}
                  >
                    <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(0,39,72,0.08)' }]}>
                      <Ionicons name="images-outline" size={22} color="#002748" />
                    </View>
                    <View style={s.sheetOptionText}>
                      <Text style={s.sheetOptionLabel}>Choose from Gallery</Text>
                      <Text style={s.sheetOptionSub}>Pick a photo from your device</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={s.sheetDivider} />

                  <TouchableOpacity
                    style={s.sheetOption}
                    activeOpacity={0.75}
                    onPress={takePhoto}
                  >
                    <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(0,39,72,0.08)' }]}>
                      <Ionicons name="camera-outline" size={22} color="#002748" />
                    </View>
                    <View style={s.sheetOptionText}>
                      <Text style={s.sheetOptionLabel}>Take a Photo</Text>
                      <Text style={s.sheetOptionSub}>Use your camera right now</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.sheetCancel}
                    activeOpacity={0.75}
                    onPress={() => setPhotoActionVisible(false)}
                  >
                    <Text style={s.sheetCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* ── Full-screen Photo Viewer Modal ── */}
            <Modal
              visible={viewPhotoVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setViewPhotoVisible(false)}
            >
              <TouchableOpacity
                style={s.viewerOverlay}
                activeOpacity={1}
                onPress={() => setViewPhotoVisible(false)}
              >
                <View style={s.viewerContainer}>
                  {user?.picture ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${user.picture}` }}
                      style={s.viewerPhoto}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={s.viewerNoPhoto}>
                      <Text style={s.viewerNoPhotoText}>No photo set</Text>
                    </View>
                  )}
                  <Text style={s.viewerDismiss}>Tap anywhere to close</Text>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* ── Profile Card ── */}
            <View style={s.profileCard}>
              <TouchableOpacity
                style={s.avatarWrapper}
                activeOpacity={0.88}
                onPress={() => setPhotoActionVisible(true)}
                disabled={pictureUploading}
              >
                {pictureUploading ? (
                  <View style={s.avatarLoading}>
                    <ActivityIndicator size="large" color="#002748" />
                  </View>
                ) : user?.picture ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${user.picture}` }}
                    style={s.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={s.avatarPlaceholder}>
                    <Text style={s.avatarInitial}>
                      {(user?.userName || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={s.cameraBadge}>
                  {pictureUploading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Ionicons name="camera" size={16} color="#FFF" />
                  }
                </View>
              </TouchableOpacity>

              <Text style={s.userName}>{user?.userName || 'Unknown User'}</Text>

              {user?.locCode ? (
                <View style={s.locCodeBadge}>
                  <Text style={s.locCodeText}>Location: {user.locCode}</Text>
                </View>
              ) : null}

              <View style={s.cardDivider} />

              <TouchableOpacity
                style={s.changePwBtn}
                onPress={() => router.push('/auth/changepassword' as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="key-outline" size={18} color="#FFF" />
                <Text style={s.changePwText}>Change Password</Text>
              </TouchableOpacity>
            </View>

            {/* ── Manage Access (admin only) ── */}
            {(user?.groupId == 3 || String(user?.groupId) === '3') && (
              <View>
                <Text style={s.sectionLabel}>Administration</Text>
                <TouchableOpacity
                  style={s.actionCard}
                  onPress={() => router.push('/Screens/manageaccess')}
                  activeOpacity={0.85}
                >
                  <View style={[s.actionCardIcon, { backgroundColor: 'rgba(0,39,72,0.1)' }]}>
                    <Ionicons name="settings-outline" size={22} color="#002748" />
                  </View>
                  <View style={s.actionCardText}>
                    <Text style={s.actionCardLabel}>Manage Floor Access</Text>
                    <Text style={s.actionCardSub}>Assign floors to staff members</Text>
                  </View>
                  <Text style={s.actionCardArrow}>›</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Assigned Floors ── */}
            <Text style={s.sectionLabel}>Assigned Floors</Text>
            {selectedFloors.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No floors assigned yet.</Text>
              </View>
            ) : (
              <View style={s.chipGrid}>
                {selectedFloors.map((floor, i) => (
                  <View key={i} style={s.chip}>
                    <Text style={s.chipText}>✓  {floor}</Text>
                  </View>
                ))}
              </View>
            )}
          </>

        ) : (
          /* ════ SYSTEM TAB ════ */
          <>
            <Text style={s.sectionLabel}>Data Synchronization</Text>

            <TouchableOpacity
              style={s.actionCard}
              onPress={handleCoreSync}
              disabled={isSyncing}
              activeOpacity={0.85}
            >
              <View style={[s.actionCardIcon, { backgroundColor: 'rgba(0,39,72,0.1)' }]}>
                {isSyncing
                  ? <ActivityIndicator size="small" color="#002748" />
                  : <Ionicons name="sync-outline" size={22} color="#002748" />
                }
              </View>
              <View style={s.actionCardText}>
                <Text style={s.actionCardLabel}>Sync Menu Data</Text>
                <Text style={s.actionCardSub}>Refresh all menu items from server</Text>
              </View>
              {!isSyncing && <Text style={s.actionCardArrow}>›</Text>}
            </TouchableOpacity>

            <View style={s.syncInfoCard}>
              <Text style={s.syncInfoLabel}>Last Sync</Text>
              <Text style={s.syncInfoValue}>{lastSyncTime}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Dynamic Styles Factory ───────────────────────────────────────────────────
function getDynamicStyles(width: number, height: number, bottomInset: number) {
  const isTablet   = width >= 600;
  const isSmall    = height < 700;
  const BASE_WIDTH = isTablet ? 768 : 375;
  const scale      = (size: number): number => (width / BASE_WIDTH) * size;

  // ── 3-Tier Conditional Benchmarks ─────────────────────────────────────────

  // Header
  const headerH          = isTablet ? 220  : isSmall ? 170  : 200;
  const hPad             = isTablet ?  24  : isSmall ?  14  :  18;
  const headerTopMT      = isTablet ?  14  : isSmall ?   8  :  10;

  // Back button
  const backSz           = isTablet ?  84  : isSmall ?  32  :  54;

  // Header title
  const titleFs          = isTablet ?  32  : isSmall ?  18  :  24;

  // Tab bar
  const tabH             = isTablet ?  52  : isSmall ?  34  :  42;
  const tabRadius        = isTablet ?  14  : isSmall ?   8  :  11;
  const tabFs            = isTablet ?  20  : isSmall ?  12  :  14;
  const tabGap           = isTablet ?  12  : isSmall ?   6  :   8;
  const tabBarPadB       = isTablet ?  16  : isSmall ?   8  :  12;

  // Scroll content
  const contentPadT      = isTablet ?  32  : isSmall ?  16  :  24;
  const contentPadB      = isTablet ? 160  : isSmall ?  80  : 120;
  const contentGap       = isTablet ?  14  : isSmall ?   6  :  10;

  // Section label
  const sectionFs        = isTablet ?  20  : isSmall ?  11  :  12;
  const sectionMT        = isTablet ?   8  : isSmall ?   4  :   6;
  const sectionMB        = isTablet ?   6  : isSmall ?   2  :   4;
  const sectionML        = isTablet ?   6  : isSmall ?   3  :   4;

  // Profile card
  const profileCardBR    = isTablet ?  28  : isSmall ?  14  :  20;
  const profileCardPadH  = isTablet ?  28  : isSmall ?  14  :  20;
  const profileCardPadT  = isTablet ?  36  : isSmall ?  18  :  28;
  const profileCardPadB  = isTablet ?  28  : isSmall ?  14  :  20;

  // Avatar
  const avatarSz         = isTablet ? 220  : isSmall ?  80  : 100;
  const avatarMB         = isTablet ?  20  : isSmall ?   8  :  14;
  const avatarBW         = isTablet ?   4  : isSmall ?   2  :   3;

  // Camera badge
  const badgeSz          = isTablet ?  38  : isSmall ?  24  :  32;
  const badgeBW          = isTablet ?   3  : isSmall ?   2  : 2.5;

  // User name
  const userNameFs       = isTablet ?  32  : isSmall ?  16  :  18;
  const userNameMB       = isTablet ?   8  : isSmall ?   4  :   6;

  // Loc code badge
  const locBadgePadH     = isTablet ?  16  : isSmall ?   8  :  12;
  const locBadgePadV     = isTablet ?   6  : isSmall ?   3  :   4;
  const locBadgeBR       = isTablet ?  28  : isSmall ?  14  :  20;
  const locBadgeMB       = isTablet ?   6  : isSmall ?   2  :   4;
  const locCodeFs        = isTablet ?  14  : isSmall ?   9  :  11;

  // Card divider
  const cardDividerMV    = isTablet ?  22  : isSmall ?  10  :  16;

  // Change password button
  const changePwH        = isTablet ?  58  : isSmall ?  38  :  46;
  const changePwBR       = isTablet ?  16  : isSmall ?   8  :  12;
  const changePwFs       = isTablet ?  18  : isSmall ?  12  :  15;
  const changePwGap      = isTablet ?  12  : isSmall ?   5  :   8;

  // Action card
  const actionCardBR     = isTablet ?  18  : isSmall ?  10  :  14;
  const actionCardPad    = isTablet ?  18  : isSmall ?  10  :  14;
  const actionCardGap    = isTablet ?  18  : isSmall ?  10  :  14;
  const actionIconSz     = isTablet ?  56  : isSmall ?  36  :  44;
  const actionIconBR     = isTablet ?  16  : isSmall ?   8  :  12;
  const actionLabelFs    = isTablet ?  18  : isSmall ?  11  :  14;
  const actionSubFs      = isTablet ?  14  : isSmall ?   9  :  12;
  const actionSubMT      = isTablet ?   4  : isSmall ?   1  :   2;
  const actionArrowFs    = isTablet ?  28  : isSmall ?  16  :  22;

  // Chips
  const chipGridGap      = isTablet ?  12  : isSmall ?   5  :   8;
  const chipPadH         = isTablet ?  18  : isSmall ?  10  :  14;
  const chipPadV         = isTablet ?  12  : isSmall ?   5  :   8;
  const chipBR           = isTablet ?  28  : isSmall ?  14  :  20;
  const chipFs           = isTablet ?  18  : isSmall ?  11  :  13;

  // Empty box
  const emptyBR          = isTablet ?  18  : isSmall ?  10  :  14;
  const emptyPad         = isTablet ?  28  : isSmall ?  14  :  20;
  const emptyFs          = isTablet ?  18  : isSmall ?  11  :  14;

  // Sync info card
  const syncCardBR       = isTablet ?  18  : isSmall ?  10  :  14;
  const syncCardPad      = isTablet ?  22  : isSmall ?  11  :  16;
  const syncLabelFs      = isTablet ?  14  : isSmall ?   9  :  11;
  const syncLabelMB      = isTablet ?   6  : isSmall ?   2  :   4;
  const syncValFs        = isTablet ?  24  : isSmall ?  13  :  15;

  // Sheet (photo action bottom sheet)
  const sheetPadH        = isTablet ?  28  : isSmall ?  14  :  20;
  const sheetPadT        = isTablet ?  16  : isSmall ?   8  :  12;
  const sheetPadB        = isTablet ?  48  : isSmall ?  20  :  32;
  const sheetHandleMB    = isTablet ?  22  : isSmall ?  10  :  16;
  const sheetTitleFs     = isTablet ?  22  : isSmall ?  12  :  16;
  const sheetTitleMB     = isTablet ?  28  : isSmall ?  14  :  20;
  const sheetOptionPadV  = isTablet ?  18  : isSmall ?  10  :  14;
  const sheetOptionGap   = isTablet ?  18  : isSmall ?  10  :  14;
  const sheetIconSz      = isTablet ?  60  : isSmall ?  38  :  48;
  const sheetIconBR      = isTablet ?  18  : isSmall ?  10  :  14;
  const sheetOptLabelFs  = isTablet ?  18  : isSmall ?  12  :  15;
  const sheetOptSubFs    = isTablet ?  14  : isSmall ?   9  :  12;
  const sheetOptSubMT    = isTablet ?   4  : isSmall ?   1  :   2;
  const sheetCancelMT    = isTablet ?  20  : isSmall ?   8  :  14;
  const sheetCancelBR    = isTablet ?  16  : isSmall ?   8  :  12;
  const sheetCancelH     = isTablet ?  60  : isSmall ?  38  :  48;
  const sheetCancelFs    = isTablet ?  18  : isSmall ?  12  :  15;

  // Viewer
  const viewerNoPhotoFs  = isTablet ?  22  : isSmall ?  12  :  16;
  const viewerDismissFs  = isTablet ?  16  : isSmall ?  10  :  13;
  const viewerDismissMT  = isTablet ?  24  : isSmall ?  10  :  16;
  const viewerBR         = isTablet ?  28  : isSmall ?  14  :  20;

  // ── StyleSheet ─────────────────────────────────────────────────────────────
  return StyleSheet.create({

    // ── Root ────────────────────────────────────────────────────────────────
    container: {
      flex: 1,
      backgroundColor: '#F0F2F5',
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      backgroundColor: '#002748',
      height: scale(headerH),
      paddingHorizontal: scale(hPad),
      justifyContent: 'space-between',
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
      marginTop: scale(headerTopMT),
    },
    backButton: {
      width: scale(backSz),
      height: scale(backSz),
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    backIcon: {
      width: scale(backSz * 0.7),
      height: scale(backSz * 0.7),
      tintColor: '#FFF',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: '#FFF',
      fontSize: scale(titleFs),
      fontWeight: '600',
      fontFamily: 'Roboto',
    },
    headerSpacer: {
      width: scale(backSz),
    },

    // ── Tab Bar ─────────────────────────────────────────────────────────────
    tabBarContainer: {
      flexDirection: 'row',
      gap: scale(tabGap),
      paddingBottom: scale(tabBarPadB),
    },
    tabButton: {
      flex: 1,
      height: scale(tabH),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: scale(tabRadius),
    },
    tabButtonActive: {
      backgroundColor: '#F0F2F5',
    },
    tabText: {
      fontSize: scale(tabFs),
      fontFamily: 'Roboto',
      fontWeight: '500',
    },
    tabTextActive: {
      color: '#002748',
    },
    tabTextInactive: {
      color: 'rgba(255,255,255,0.75)',
    },

    // ── Scroll Content ───────────────────────────────────────────────────────
    content: {
      paddingTop: scale(contentPadT),
      paddingBottom: scale(contentPadB) + bottomInset,
      paddingHorizontal: scale(hPad),
      gap: scale(contentGap),
    },

    // ── Section Label ────────────────────────────────────────────────────────
    sectionLabel: {
      fontSize: scale(sectionFs),
      fontWeight: '700',
      color: '#6B7280',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: scale(sectionMT),
      marginBottom: scale(sectionMB),
      marginLeft: scale(sectionML),
    },

    // ── Profile Card ─────────────────────────────────────────────────────────
    profileCard: {
      backgroundColor: '#FFF',
      borderRadius: scale(profileCardBR),
      paddingHorizontal: scale(profileCardPadH),
      paddingTop: scale(profileCardPadT),
      paddingBottom: scale(profileCardPadB),
      alignItems: 'center',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },

    // ── Avatar ───────────────────────────────────────────────────────────────
    avatarWrapper: {
      width: scale(avatarSz),
      height: scale(avatarSz),
      marginBottom: scale(avatarMB),
    },
    avatarImage: {
      width: scale(avatarSz),
      height: scale(avatarSz),
      borderRadius: scale(avatarSz / 2),
      borderWidth: avatarBW,
      borderColor: '#002748',
    },
    avatarPlaceholder: {
      width: scale(avatarSz),
      height: scale(avatarSz),
      borderRadius: scale(avatarSz / 2),
      backgroundColor: '#002748',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: {
      fontSize: scale(avatarSz * 0.38),
      color: '#FFF',
      fontWeight: '700',
    },
    avatarLoading: {
      width: scale(avatarSz),
      height: scale(avatarSz),
      borderRadius: scale(avatarSz / 2),
      backgroundColor: '#F0F2F5',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Camera Badge ─────────────────────────────────────────────────────────
    cameraBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: scale(badgeSz),
      height: scale(badgeSz),
      borderRadius: scale(badgeSz / 2),
      backgroundColor: '#002748',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: badgeBW,
      borderColor: '#FFF',
      elevation: 4,
    },

    // ── User Name ────────────────────────────────────────────────────────────
    userName: {
      fontSize: scale(userNameFs),
      fontWeight: '600',
      color: '#111827',
      fontFamily: 'Roboto',
      marginBottom: scale(userNameMB),
    },

    // ── Loc Code Badge ───────────────────────────────────────────────────────
    locCodeBadge: {
      backgroundColor: 'rgba(0,39,72,0.08)',
      paddingHorizontal: scale(locBadgePadH),
      paddingVertical: scale(locBadgePadV),
      borderRadius: scale(locBadgeBR),
      marginBottom: scale(locBadgeMB),
    },
    locCodeText: {
      fontSize: scale(locCodeFs),
      color: '#002748',
      fontWeight: '600',
    },

    // ── Card Divider ─────────────────────────────────────────────────────────
    cardDivider: {
      width: '100%',
      height: 1,
      backgroundColor: '#F0F2F5',
      marginVertical: scale(cardDividerMV),
    },

    // ── Change Password Button ───────────────────────────────────────────────
    changePwBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(changePwGap),
      width: '100%',
      height: scale(changePwH),
      backgroundColor: '#002748',
      borderRadius: scale(changePwBR),
      justifyContent: 'center',
    },
    changePwText: {
      fontSize: scale(changePwFs),
      color: '#FFF',
      fontWeight: '600',
      fontFamily: 'Roboto',
    },

    // ── Action Card ──────────────────────────────────────────────────────────
    actionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF',
      borderRadius: scale(actionCardBR),
      padding: scale(actionCardPad),
      gap: scale(actionCardGap),
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    actionCardIcon: {
      width: scale(actionIconSz),
      height: scale(actionIconSz),
      borderRadius: scale(actionIconBR),
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionCardText: {
      flex: 1,
    },
    actionCardLabel: {
      fontSize: scale(actionLabelFs),
      fontWeight: '600',
      color: '#111827',
    },
    actionCardSub: {
      fontSize: scale(actionSubFs),
      color: '#6B7280',
      marginTop: scale(actionSubMT),
    },
    actionCardArrow: {
      fontSize: scale(actionArrowFs),
      color: '#9CA3AF',
      fontWeight: '300',
    },

    // ── Chip Grid ────────────────────────────────────────────────────────────
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(chipGridGap),
    },
    chip: {
      backgroundColor: '#FFF',
      borderRadius: scale(chipBR),
      paddingHorizontal: scale(chipPadH),
      paddingVertical: scale(chipPadV),
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      borderWidth: 1,
      borderColor: 'rgba(0,39,72,0.15)',
    },
    chipText: {
      fontSize: scale(chipFs),
      color: '#002748',
      fontWeight: '600',
    },

    // ── Empty Box ────────────────────────────────────────────────────────────
    emptyBox: {
      backgroundColor: '#FFF',
      borderRadius: scale(emptyBR),
      padding: scale(emptyPad),
      alignItems: 'center',
      elevation: 1,
    },
    emptyText: {
      fontSize: scale(emptyFs),
      color: '#9CA3AF',
    },

    // ── Sync Info Card ───────────────────────────────────────────────────────
    syncInfoCard: {
      backgroundColor: '#FFF',
      borderRadius: scale(syncCardBR),
      padding: scale(syncCardPad),
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    syncInfoLabel: {
      fontSize: scale(syncLabelFs),
      color: '#9CA3AF',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: scale(syncLabelMB),
    },
    syncInfoValue: {
      fontSize: scale(syncValFs),
      color: '#002748',
      fontWeight: '700',
      fontFamily: 'Roboto',
    },

    // ── Photo Action Sheet ───────────────────────────────────────────────────
    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: '#FFF',
      borderTopLeftRadius: scale(24),
      borderTopRightRadius: scale(24),
      paddingHorizontal: scale(sheetPadH),
      paddingTop: scale(sheetPadT),
      paddingBottom: scale(sheetPadB) + bottomInset,
    },
    sheetHandle: {
      width: scale(40),
      height: scale(4),
      backgroundColor: '#D1D5DB',
      borderRadius: scale(2),
      alignSelf: 'center',
      marginBottom: scale(sheetHandleMB),
    },
    sheetTitle: {
      fontSize: scale(sheetTitleFs),
      fontWeight: '700',
      color: '#111827',
      textAlign: 'center',
      marginBottom: scale(sheetTitleMB),
    },
    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(sheetOptionGap),
      paddingVertical: scale(sheetOptionPadV),
    },
    sheetIconCircle: {
      width: scale(sheetIconSz),
      height: scale(sheetIconSz),
      borderRadius: scale(sheetIconBR),
      justifyContent: 'center',
      alignItems: 'center',
    },
    sheetOptionText: {
      flex: 1,
    },
    sheetOptionLabel: {
      fontSize: scale(sheetOptLabelFs),
      fontWeight: '600',
      color: '#111827',
    },
    sheetOptionSub: {
      fontSize: scale(sheetOptSubFs),
      color: '#6B7280',
      marginTop: scale(sheetOptSubMT),
    },
    sheetDivider: {
      height: 1,
      backgroundColor: '#F3F4F6',
    },
    sheetCancel: {
      marginTop: scale(sheetCancelMT),
      backgroundColor: '#F3F4F6',
      borderRadius: scale(sheetCancelBR),
      height: scale(sheetCancelH),
      justifyContent: 'center',
      alignItems: 'center',
    },
    sheetCancelText: {
      fontSize: scale(sheetCancelFs),
      color: '#6B7280',
      fontWeight: '600',
    },

    // ── Full-screen Photo Viewer ─────────────────────────────────────────────
    viewerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewerContainer: {
      width: '88%',
      alignItems: 'center',
    },
    viewerPhoto: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: scale(viewerBR),
    },
    viewerNoPhoto: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: scale(viewerBR),
      backgroundColor: '#1F2937',
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewerNoPhotoText: {
      color: '#6B7280',
      fontSize: scale(viewerNoPhotoFs),
    },
    viewerDismiss: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: scale(viewerDismissFs),
      marginTop: scale(viewerDismissMT),
    },
  });
}