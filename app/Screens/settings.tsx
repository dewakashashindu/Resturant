import { OperationalColors } from '../../constants/operationalTheme';
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
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import {
  clearBiometricLogin,
  enableBiometricLogin,
  getBiometricAvailability,
  isBiometricLoginEnabled,
  setBiometricPromptEnabled,
} from '../../services/biometricAuth';
import { useAuthStore } from '../../services/authStore';
import useItemStore from '../../services/itemStore';
import {
  DONE_WINDOW_OPTIONS,
  doneWindowOption,
  useKdsSettingsStore,
  type DoneWindowMinutes,
} from '../../services/kdsSettings';
import {
  SCREEN_MODE_OPTIONS,
  screenModeOption,
  useKdsLayout,
  useKdsLayoutStore,
  type ScreenMode,
  type KdsLayout,
} from '../../services/kdsLayout';
import { useNotificationStore } from '../../services/notificationStore';

// ─── Component ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router  = useRouter();
  const { width, height } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  // Landscape / TV aware styling: same page, two different geometries.
  const layout  = useKdsLayout();
  const s       = getDynamicStyles(width, height, insets.bottom, layout);
  // One style for every content block once the page switches to two columns.
  const landscapeCell = layout.compactChrome ? s.cell : undefined;

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,          setActiveTab]          = useState<'personal' | 'system'>('personal');
  const [selectedFloors,     setSelectedFloors]     = useState<string[]>([]);
  const [pictureUploading,   setPictureUploading]   = useState(false);
  const [photoActionVisible, setPhotoActionVisible] = useState(false);
  const [viewPhotoVisible,   setViewPhotoVisible]   = useState(false);
  const [biometricEnabled,   setBiometricEnabled]   = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricBusy,      setBiometricBusy]      = useState(false);
  const [donePickerVisible,  setDonePickerVisible]  = useState(false);
  const [modePickerVisible,  setModePickerVisible]  = useState(false);

  // ── Store ──────────────────────────────────────────────────────────────────
  const isSyncing    = useItemStore((s) => s.isSyncing);
  const lastSyncTime = useItemStore((s) => s.lastSyncTime) ?? 'Never';
  const syncError    = useItemStore((s) => s.syncError);
  const syncProgress = useItemStore((s) => s.syncProgress);
  const syncStage    = useItemStore((s) => s.syncStage);
  const syncMenuData = useItemStore((s) => s.syncMenuData);
  const hydrateItems = useItemStore((s) => s.hydrateItems);
  const isHydrated   = useItemStore((s) => s.isHydrated);
  const doneWindowMinutes      = useKdsSettingsStore((s) => s.doneWindowMinutes);
  const setDoneWindowMinutes   = useKdsSettingsStore((s) => s.setDoneWindowMinutes);
  const doneWindowLabel        = doneWindowOption(doneWindowMinutes).label;
  const screenMode             = useKdsLayoutStore((s) => s.screenMode);
  const setScreenMode          = useKdsLayoutStore((s) => s.setScreenMode);
  const screenModeLabel        = screenModeOption(screenMode).label;
  const user         = useAuthStore((s) => s.user);
  const token        = useAuthStore((s) => s.token);
  const updatePicture= useAuthStore((s) => s.updatePicture);
  const notificationPreferences = useNotificationStore((s) => s.preferences);
  const updateNotificationPreferences = useNotificationStore((s) => s.updatePreferences);

  console.log('Current User Group ID is:', user?.groupId);

  // ── Effects ────────────────────────────────────────────────────────────────
  const [floors, setFloors] = useState<string[]>([]);

  useEffect(() => {
    const fetchFloors = async () => {
      if (!user?.userId) return;
      console.log('[Settings] Fetching floors directly from DB (bypassing authStore)');
      const res = await apiClient.getUserFloorAccess(String(user.userId));
      if (res.ok && res.data?.assignedFloors) {
        setFloors(res.data.assignedFloors);
      }
    };
    fetchFloors();
  }, [user?.userId]);

  useEffect(() => {
    if (user?.assignedFloors) setSelectedFloors(user.assignedFloors);
  }, [user]);

  useEffect(() => {
    if (!isHydrated) hydrateItems().catch(() => {});
  }, [hydrateItems, isHydrated]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const availability = await getBiometricAvailability();
      if (!mounted) return;
      setBiometricAvailable(availability.available);
      setBiometricEnabled(availability.available && isBiometricLoginEnabled());
    })();
    return () => { mounted = false; };
  }, []);

  const handleBiometricToggle = async (nextEnabled: boolean) => {
    if (biometricBusy) return;
    if (!nextEnabled) {
      setBiometricBusy(true);
      try {
        setBiometricPromptEnabled(false);
        await clearBiometricLogin();
        setBiometricEnabled(false);
      } finally {
        setBiometricBusy(false);
      }
      return;
    }

    if (!biometricAvailable || !token || !user) {
      Alert.alert('Biometrics unavailable', 'Set up a fingerprint or face unlock in phone Settings, then sign in with your password.');
      return;
    }

    setBiometricBusy(true);
    try {
      const result = await enableBiometricLogin({ token, user });
      if (!result.ok) {
        Alert.alert('Biometric setup', result.message);
        return;
      }
      setBiometricEnabled(true);
      Alert.alert('Biometrics enabled', 'Fingerprint or face unlock can now be used from the login screen.');
    } finally {
      setBiometricBusy(false);
    }
  };

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
      <StatusBar backgroundColor={OperationalColors.header} barStyle="dark-content" />

      {/* ── HEADER ── */}
      <View style={[s.header, { paddingTop: insets.top, height: s.header.height + insets.top }]}>
        <View pointerEvents="none" style={s.headerCircle} />
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
                    <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(114,86,60,0.08)' }]}>
                      <Ionicons name="eye-outline" size={22} color={OperationalColors.primary} />
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
                    <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(114,86,60,0.08)' }]}>
                      <Ionicons name="images-outline" size={22} color={OperationalColors.primary} />
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
                    <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(114,86,60,0.08)' }]}>
                      <Ionicons name="camera-outline" size={22} color={OperationalColors.primary} />
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
            <View style={[s.profileCard, landscapeCell]}>
              <TouchableOpacity
                style={s.avatarWrapper}
                activeOpacity={0.88}
                onPress={() => setPhotoActionVisible(true)}
                disabled={pictureUploading}
              >
                {pictureUploading ? (
                  <View style={s.avatarLoading}>
                    <ActivityIndicator size="large" color={OperationalColors.primary} />
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
                    ? <ActivityIndicator size="small" color={OperationalColors.onPrimary} />
                    : <Ionicons name="camera" size={16} color={OperationalColors.onPrimary} />
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
                <Ionicons name="key-outline" size={18} color={OperationalColors.onPrimary} />
                <Text style={s.changePwText}>Change Password</Text>
              </TouchableOpacity>
            </View>

            {/* ── Manage Access (admin only) ── */}
            {(user?.groupId == 3 || String(user?.groupId) === '3') && (
              <View style={landscapeCell}>
                <Text style={s.sectionLabel}>Administration</Text>
                <TouchableOpacity
                  style={s.actionCard}
                  onPress={() => router.push('/Screens/manageaccess')}
                  activeOpacity={0.85}
                >
                  <View style={[s.actionCardIcon, { backgroundColor: 'rgba(114,86,60,0.1)' }]}>
                    <Ionicons name="settings-outline" size={22} color={OperationalColors.primary} />
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
            <View style={landscapeCell}>
              <Text style={s.sectionLabel}>Assigned Floors</Text>
              {floors.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyText}>No floors assigned yet.</Text>
                </View>
              ) : (
                <View style={s.chipGrid}>
                  {floors.map((floor, i) => (
                    <View key={i} style={s.chip}>
                      <Text style={s.chipText}>✓  {floor}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>

        ) : (
          /* ════ SYSTEM TAB ════ */
          <>
            <View style={landscapeCell}>
            <Text style={s.sectionLabel}>System Setting</Text>
            <View style={s.notificationSettingsCard}>
              <TouchableOpacity
                style={s.notificationSettingRow}
                onPress={() => setDonePickerVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Done column time window, currently ${doneWindowLabel}`}
              >
                <View style={s.notificationSettingIcon}>
                  <Ionicons name="timer-outline" size={21} color={OperationalColors.primary} />
                </View>
                <View style={s.notificationSettingText}>
                  <Text style={s.notificationSettingLabel}>Done Column Time</Text>
                  <Text style={s.notificationSettingSub}>
                    How long a finished item stays in the KDS / BDS DONE column
                  </Text>
                </View>
                {/* Drop-down trigger: shows the value the board is using now. */}
                <View style={s.dropdownValue}>
                  <Text style={s.dropdownValueText}>{doneWindowLabel}</Text>
                  <Ionicons name="chevron-down" size={16} color={OperationalColors.primary} />
                </View>
              </TouchableOpacity>
              <View style={s.notificationSettingsDivider} />
              <TouchableOpacity
                style={s.notificationSettingRow}
                onPress={() => setModePickerVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Screen mode, currently ${screenModeLabel}`}
              >
                <View style={s.notificationSettingIcon}>
                  <Ionicons name="tv-outline" size={21} color={OperationalColors.primary} />
                </View>
                <View style={s.notificationSettingText}>
                  <Text style={s.notificationSettingLabel}>Screen Mode</Text>
                  <Text style={s.notificationSettingSub}>
                    Phone, or the kitchen TV driven by an Android box
                  </Text>
                </View>
                <View style={s.dropdownValue}>
                  <Text style={s.dropdownValueText}>{screenModeLabel}</Text>
                  <Ionicons name="chevron-down" size={16} color={OperationalColors.primary} />
                </View>
              </TouchableOpacity>
            </View>
            </View>

            <View style={landscapeCell}>
            <Text style={s.sectionLabel}>Data Synchronization</Text>

            <TouchableOpacity
              style={s.actionCard}
              onPress={handleCoreSync}
              disabled={isSyncing}
              activeOpacity={0.85}
            >
              <View style={[s.actionCardIcon, { backgroundColor: 'rgba(114,86,60,0.1)' }]}>
                {isSyncing
                  ? <ActivityIndicator size="small" color={OperationalColors.primary} />
                  : <Ionicons name="sync-outline" size={22} color={OperationalColors.primary} />
                }
              </View>
              <View style={s.actionCardText}>
                <Text style={s.actionCardLabel}>Sync Menu Data</Text>
                <Text style={s.actionCardSub}>
                  {isSyncing ? syncStage || 'Starting menu sync...' : 'Refresh all menu items from server'}
                </Text>
              </View>
              {!isSyncing && <Text style={s.actionCardArrow}>›</Text>}
            </TouchableOpacity>

            {isSyncing ? (
              <View style={s.syncProgressCard}>
                <View style={s.syncProgressHeader}>
                  <Text style={s.syncProgressStage} numberOfLines={1}>{syncStage || 'Starting menu sync...'}</Text>
                  <Text style={s.syncProgressPercent}>{syncProgress}%</Text>
                </View>
                <View style={s.syncProgressTrack}>
                  <View style={[s.syncProgressFill, { width: `${Math.max(0, Math.min(100, syncProgress))}%` }]} />
                </View>
                <Text style={s.syncProgressHint}>Please keep this screen open until the sync finishes.</Text>
              </View>
            ) : null}

            <View style={s.syncInfoCard}>
              <Text style={s.syncInfoLabel}>Last Sync</Text>
              <Text style={s.syncInfoValue}>{lastSyncTime}</Text>
            </View>
            </View>

            <View style={landscapeCell}>
            <Text style={s.sectionLabel}>Security</Text>
            <View style={s.notificationSettingsCard}>
              <View style={s.notificationSettingRow}>
                <View style={s.notificationSettingIcon}>
                  <Ionicons name="finger-print-outline" size={22} color={OperationalColors.primary} />
                </View>
                <View style={s.notificationSettingText}>
                  <Text style={s.notificationSettingLabel}>Biometric Sign In</Text>
                  <Text style={s.notificationSettingSub}>
                    {biometricAvailable
                      ? 'Use fingerprint or face unlock from the login screen'
                      : 'Set up fingerprint or face unlock in phone Settings'}
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={(enabled) => void handleBiometricToggle(enabled)}
                  disabled={!biometricAvailable || biometricBusy}
                  trackColor={{ false: OperationalColors.border, true: OperationalColors.primary }}
                  thumbColor={biometricEnabled ? OperationalColors.primary : OperationalColors.onPrimary}
                />
              </View>
            </View>

            </View>

            <View style={landscapeCell}>
            <Text style={s.sectionLabel}>Notification Alerts</Text>
            <View style={s.notificationSettingsCard}>
              <View style={s.notificationSettingRow}>
                <View style={s.notificationSettingIcon}>
                  <Ionicons name="volume-high-outline" size={21} color={OperationalColors.primary} />
                </View>
                <View style={s.notificationSettingText}>
                  <Text style={s.notificationSettingLabel}>Notification Sound</Text>
                  <Text style={s.notificationSettingSub}>Play a sound for new alerts</Text>
                </View>
                <Switch
                  value={notificationPreferences.soundEnabled}
                  onValueChange={(soundEnabled) => updateNotificationPreferences({ soundEnabled })}
                  trackColor={{ false: OperationalColors.border, true: OperationalColors.primary }}
                  thumbColor={notificationPreferences.soundEnabled ? OperationalColors.primary : OperationalColors.onPrimary}
                />
              </View>
              <View style={s.notificationSettingsDivider} />
              <View style={s.notificationSettingRow}>
                <View style={s.notificationSettingIcon}>
                  <Ionicons name="phone-portrait-outline" size={21} color={OperationalColors.primary} />
                </View>
                <View style={s.notificationSettingText}>
                  <Text style={s.notificationSettingLabel}>Vibration</Text>
                  <Text style={s.notificationSettingSub}>Vibrate when a new alert arrives</Text>
                </View>
                <Switch
                  value={notificationPreferences.vibrationEnabled}
                  onValueChange={(vibrationEnabled) => updateNotificationPreferences({ vibrationEnabled })}
                  trackColor={{ false: OperationalColors.border, true: OperationalColors.primary }}
                  thumbColor={notificationPreferences.vibrationEnabled ? OperationalColors.primary : OperationalColors.onPrimary}
                />
              </View>
            </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Done window picker ── */}
      <Modal
        transparent
        animationType="fade"
        visible={donePickerVisible}
        onRequestClose={() => setDonePickerVisible(false)}
      >
        <TouchableOpacity
          style={s.pickerOverlay}
          activeOpacity={1}
          onPress={() => setDonePickerVisible(false)}
        >
          <View style={[s.pickerSheet, layout.compactChrome && s.pickerSheetLandscape]}>
            <View style={s.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.pickerTitle}>Done Column Time</Text>
                <Text style={s.pickerSubtitle}>Applies to this display only</Text>
              </View>
              <TouchableOpacity onPress={() => setDonePickerVisible(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={OperationalColors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={layout.compactChrome ? s.pickerOptionsLandscape : undefined}
              contentContainerStyle={layout.compactChrome ? s.pickerOptionsGrid : undefined}
              showsVerticalScrollIndicator={false}
            >
            {DONE_WINDOW_OPTIONS.map((option) => {
              const selected = option.value === doneWindowMinutes;
              return (
                <TouchableOpacity
                  key={String(option.value)}
                  style={[s.pickerOption, layout.compactChrome && s.pickerOptionLandscape, selected && s.pickerOptionSelected]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setDoneWindowMinutes(option.value as DoneWindowMinutes);
                    setDonePickerVisible(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                >
                  <Text style={[s.pickerOptionText, selected && s.pickerOptionTextSelected]}>
                    {option.label}
                  </Text>
                  {selected
                    ? <Ionicons name="checkmark-circle" size={20} color={OperationalColors.primary} />
                    : <Ionicons name="ellipse-outline" size={20} color={OperationalColors.border} />}
                </TouchableOpacity>
              );
            })}
            </ScrollView>

            <Text style={s.pickerHint}>
              The DONE column shows a small “LAST …” label so staff can see which window is active.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Screen mode picker (phone / TV) ── */}
      <Modal
        transparent
        animationType="fade"
        visible={modePickerVisible}
        onRequestClose={() => setModePickerVisible(false)}
      >
        <TouchableOpacity
          style={s.pickerOverlay}
          activeOpacity={1}
          onPress={() => setModePickerVisible(false)}
        >
          <View style={[s.pickerSheet, layout.compactChrome && s.pickerSheetLandscape]}>
            <View style={s.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.pickerTitle}>Screen Mode</Text>
                <Text style={s.pickerSubtitle}>How this display lays itself out</Text>
              </View>
              <TouchableOpacity onPress={() => setModePickerVisible(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={OperationalColors.primary} />
              </TouchableOpacity>
            </View>

            {SCREEN_MODE_OPTIONS.map((option) => {
              const selected = option.value === screenMode;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[s.pickerOption, layout.compactChrome && s.pickerOptionLandscape, selected && s.pickerOptionSelected]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setScreenMode(option.value as ScreenMode);
                    setModePickerVisible(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                >
                  <Text style={[s.pickerOptionText, selected && s.pickerOptionTextSelected]}>
                    {option.label}
                  </Text>
                  {selected
                    ? <Ionicons name="checkmark-circle" size={20} color={OperationalColors.primary} />
                    : <Ionicons name="ellipse-outline" size={20} color={OperationalColors.border} />}
                </TouchableOpacity>
              );
            })}

            <Text style={s.pickerHint}>
              Choose “TV / Large screen” when this device is a TV driven by an Android box: the
              header and the filter bar stay thin so all three columns fit, and the TV keeps a
              wide edge margin for overscan.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Dynamic Styles Factory ───────────────────────────────────────────────────
function getDynamicStyles(width: number, height: number, bottomInset: number, layout?: KdsLayout) {
  // Landscape phone and TV use their own tier: the width-based factor below
  // would balloon every padding (a landscape phone is ~800 dp wide) and the
  // portrait "small" tier would still leave a 170 dp header on a 375 dp screen.
  const isLandscapeTier = layout ? layout.compactChrome : width > height;
  const isTv            = layout ? layout.isTv : false;
  const isTablet   = isLandscapeTier ? false : width >= 600;
  const isSmall    = isLandscapeTier ? true  : height < 700;
  const BASE_WIDTH = isLandscapeTier ? (isTv ? 500 : 720) : isTablet ? 768 : 375;
  const scale      = (size: number): number =>
    (isLandscapeTier ? Math.min(1.15, Math.max(0.72, height / BASE_WIDTH)) : width / BASE_WIDTH) * size;

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
  const sheet: any = StyleSheet.create({

    // ── Root ────────────────────────────────────────────────────────────────
    container: {
      flex: 1,
      backgroundColor: OperationalColors.canvas,
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      backgroundColor: OperationalColors.header,
      height: scale(headerH),
      paddingHorizontal: scale(hPad),
      justifyContent: 'space-between',
      overflow: 'hidden',
    },
    // Shared header decoration used throughout the operational app.
    headerCircle: {
      position: 'absolute',
      width: scale(220),
      height: scale(220),
      borderRadius: scale(110),
      top: scale(-60),
      right: scale(-60),
      backgroundColor: 'rgba(255,253,250,0.18)',
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
      tintColor: OperationalColors.primary,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: OperationalColors.primary,
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
      backgroundColor: OperationalColors.canvas,
    },
    tabText: {
      fontSize: scale(tabFs),
      fontFamily: 'Roboto',
      fontWeight: '500',
    },
    tabTextActive: {
      color: OperationalColors.primary,
    },
    tabTextInactive: {
      color: 'rgba(107,80,56,0.8)',
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
      color: OperationalColors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: scale(sectionMT),
      marginBottom: scale(sectionMB),
      marginLeft: scale(sectionML),
    },

    // ── Profile Card ─────────────────────────────────────────────────────────
    profileCard: {
      borderWidth: 1,
      borderColor: OperationalColors.border,
      backgroundColor: OperationalColors.surface,
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
      borderColor: OperationalColors.primary,
    },
    avatarPlaceholder: {
      width: scale(avatarSz),
      height: scale(avatarSz),
      borderRadius: scale(avatarSz / 2),
      backgroundColor: OperationalColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: {
      fontSize: scale(avatarSz * 0.38),
      color: OperationalColors.onPrimary,
      fontWeight: '700',
    },
    avatarLoading: {
      width: scale(avatarSz),
      height: scale(avatarSz),
      borderRadius: scale(avatarSz / 2),
      backgroundColor: OperationalColors.canvas,
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
      backgroundColor: OperationalColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: badgeBW,
      borderColor: OperationalColors.onPrimary,
      elevation: 4,
    },

    // ── User Name ────────────────────────────────────────────────────────────
    userName: {
      fontSize: scale(userNameFs),
      fontWeight: '600',
      color: OperationalColors.primary,
      fontFamily: 'Roboto',
      marginBottom: scale(userNameMB),
    },

    // ── Loc Code Badge ───────────────────────────────────────────────────────
    locCodeBadge: {
      backgroundColor: 'rgba(114,86,60,0.08)',
      paddingHorizontal: scale(locBadgePadH),
      paddingVertical: scale(locBadgePadV),
      borderRadius: scale(locBadgeBR),
      marginBottom: scale(locBadgeMB),
    },
    locCodeText: {
      fontSize: scale(locCodeFs),
      color: OperationalColors.primary,
      fontWeight: '600',
    },

    // ── Card Divider ─────────────────────────────────────────────────────────
    cardDivider: {
      width: '100%',
      height: 1,
      backgroundColor: OperationalColors.canvas,
      marginVertical: scale(cardDividerMV),
    },

    // ── Change Password Button ───────────────────────────────────────────────
    changePwBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(changePwGap),
      width: '100%',
      height: scale(changePwH),
      backgroundColor: OperationalColors.primary,
      borderRadius: scale(changePwBR),
      justifyContent: 'center',
    },
    changePwText: {
      fontSize: scale(changePwFs),
      color: OperationalColors.onPrimary,
      fontWeight: '600',
      fontFamily: 'Roboto',
    },

    // ── Action Card ──────────────────────────────────────────────────────────
    actionCard: {
      borderWidth: 1,
      borderColor: OperationalColors.border,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: OperationalColors.surface,
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
      color: OperationalColors.primary,
    },
    actionCardSub: {
      fontSize: scale(actionSubFs),
      color: OperationalColors.muted,
      marginTop: scale(actionSubMT),
    },
    actionCardArrow: {
      fontSize: scale(actionArrowFs),
      color: OperationalColors.muted,
      fontWeight: '300',
    },

    // ── Chip Grid ────────────────────────────────────────────────────────────
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(chipGridGap),
    },
    chip: {
      backgroundColor: OperationalColors.canvas,
      borderRadius: scale(chipBR),
      paddingHorizontal: scale(chipPadH),
      paddingVertical: scale(chipPadV),
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      borderWidth: 1,
      borderColor: 'rgba(114,86,60,0.15)',
    },
    chipText: {
      fontSize: scale(chipFs),
      color: OperationalColors.primary,
      fontWeight: '600',
    },

    // ── Empty Box ────────────────────────────────────────────────────────────
    emptyBox: {
      backgroundColor: OperationalColors.canvas,
      borderRadius: scale(emptyBR),
      padding: scale(emptyPad),
      alignItems: 'center',
      elevation: 1,
    },
    emptyText: {
      fontSize: scale(emptyFs),
      color: OperationalColors.muted,
    },

    // ── Live Menu Sync Progress ──────────────────────────────────────────────
    syncProgressCard: {
      backgroundColor: OperationalColors.canvas,
      borderRadius: scale(syncCardBR),
      padding: scale(syncCardPad),
      borderWidth: 1,
      borderColor: 'rgba(114,86,60,0.10)',
    },
    syncProgressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: scale(8),
    },
    syncProgressStage: {
      flex: 1,
      fontSize: scale(actionSubFs),
      color: OperationalColors.muted,
      fontWeight: '600',
    },
    syncProgressPercent: {
      fontSize: scale(actionSubFs),
      color: OperationalColors.primary,
      fontWeight: '800',
    },
    syncProgressTrack: {
      height: scale(isSmall ? 7 : 9),
      borderRadius: scale(10),
      overflow: 'hidden',
      backgroundColor: OperationalColors.canvas,
      marginTop: scale(isSmall ? 8 : 11),
    },
    syncProgressFill: {
      height: '100%',
      borderRadius: scale(10),
      backgroundColor: OperationalColors.primary,
    },
    syncProgressHint: {
      marginTop: scale(isSmall ? 7 : 9),
      fontSize: scale(isSmall ? 10 : 12),
      color: OperationalColors.muted,
    },

    // ── Sync Info Card ───────────────────────────────────────────────────────
    syncInfoCard: {
      backgroundColor: OperationalColors.canvas,
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
      color: OperationalColors.muted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: scale(syncLabelMB),
    },
    syncInfoValue: {
      fontSize: scale(syncValFs),
      color: OperationalColors.primary,
      fontWeight: '700',
      fontFamily: 'Roboto',
    },

    // ── Notification Preferences ─────────────────────────────────────────────
    notificationSettingsCard: {
      backgroundColor: OperationalColors.canvas,
      borderRadius: scale(syncCardBR),
      paddingHorizontal: scale(syncCardPad),
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    notificationSettingRow: {
      minHeight: scale(isSmall ? 66 : 74),
      flexDirection: 'row',
      alignItems: 'center',
    },
    notificationSettingIcon: {
      width: scale(isSmall ? 36 : 42),
      height: scale(isSmall ? 36 : 42),
      marginRight: scale(isSmall ? 10 : 12),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: scale(12),
      backgroundColor: 'rgba(114,86,60,0.10)',
    },
    notificationSettingText: { flex: 1, paddingRight: scale(8) },
    notificationSettingLabel: { fontSize: scale(isSmall ? 13 : 15), fontWeight: '700', color: OperationalColors.primary },
    notificationSettingSub: { fontSize: scale(isSmall ? 10 : 12), color: OperationalColors.muted, marginTop: scale(3) },
    notificationSettingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: OperationalColors.canvas },
    dropdownValue: { flexDirection: 'row', alignItems: 'center', gap: scale(6), paddingHorizontal: scale(10), paddingVertical: scale(7), borderRadius: scale(9), borderWidth: 1, borderColor: OperationalColors.border, backgroundColor: OperationalColors.surface },
    dropdownValueText: { fontSize: scale(isSmall ? 11 : 13), fontWeight: '800', color: OperationalColors.primary },
    pickerOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: scale(22), backgroundColor: 'rgba(0,0,0,0.45)' },
    pickerSheet: { borderRadius: scale(20), padding: scale(18), backgroundColor: OperationalColors.surface },
    pickerHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: scale(10) },
    pickerTitle: { fontSize: scale(isSmall ? 15 : 18), fontWeight: '900', color: OperationalColors.primary },
    pickerSubtitle: { fontSize: scale(isSmall ? 10 : 12), color: OperationalColors.muted, marginTop: scale(2) },
    pickerOption: { minHeight: scale(46), marginTop: scale(7), paddingHorizontal: scale(13), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: scale(12), borderWidth: 1, borderColor: OperationalColors.border, backgroundColor: OperationalColors.canvas },
    pickerOptionSelected: { borderColor: OperationalColors.primary, borderWidth: 1.5, backgroundColor: OperationalColors.selected },
    pickerOptionText: { fontSize: scale(isSmall ? 12 : 14), fontWeight: '700', color: OperationalColors.text },
    pickerOptionTextSelected: { fontWeight: '900', color: OperationalColors.primary },
    pickerHint: { fontSize: scale(isSmall ? 9 : 11), lineHeight: scale(isSmall ? 13 : 16), color: OperationalColors.muted, marginTop: scale(12) },

    // ── Photo Action Sheet ───────────────────────────────────────────────────
    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: OperationalColors.canvas,
      borderTopLeftRadius: scale(24),
      borderTopRightRadius: scale(24),
      paddingHorizontal: scale(sheetPadH),
      paddingTop: scale(sheetPadT),
      paddingBottom: scale(sheetPadB) + bottomInset,
    },
    sheetHandle: {
      width: scale(40),
      height: scale(4),
      backgroundColor: OperationalColors.border,
      borderRadius: scale(2),
      alignSelf: 'center',
      marginBottom: scale(sheetHandleMB),
    },
    sheetTitle: {
      fontSize: scale(sheetTitleFs),
      fontWeight: '700',
      color: OperationalColors.primary,
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
      color: OperationalColors.primary,
    },
    sheetOptionSub: {
      fontSize: scale(sheetOptSubFs),
      color: OperationalColors.muted,
      marginTop: scale(sheetOptSubMT),
    },
    sheetDivider: {
      height: 1,
      backgroundColor: OperationalColors.surfaceAlt,
    },
    sheetCancel: {
      marginTop: scale(sheetCancelMT),
      backgroundColor: OperationalColors.surfaceAlt,
      borderRadius: scale(sheetCancelBR),
      height: scale(sheetCancelH),
      justifyContent: 'center',
      alignItems: 'center',
    },
    sheetCancelText: {
      fontSize: scale(sheetCancelFs),
      color: OperationalColors.muted,
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
      backgroundColor: OperationalColors.text,
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewerNoPhotoText: {
      color: OperationalColors.muted,
      fontSize: scale(viewerNoPhotoFs),
    },
    viewerDismiss: {
      color: 'rgba(248,247,245,0.4)',
      fontSize: scale(viewerDismissFs),
      marginTop: scale(viewerDismissMT),
    },

    // ── Landscape / TV helpers ──────────────────────────────────────────────
    // One grid cell: two cells fit side by side, so a card never stretches
    // across a whole television panel.
    cell: {
      flexGrow: 0,
      flexShrink: 0,
      width: '48.5%',
      flexDirection: 'column',
    },
    pickerSheetLandscape: {
      width: '100%',
      maxWidth: isTv ? 760 : 620,
      maxHeight: layout ? layout.sheetMaxHeight : '92%',
      alignSelf: 'center',
    },
    pickerOptionsLandscape: {
      flexGrow: 0,
      marginTop: scale(6),
    },
    pickerOptionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: scale(8),
      rowGap: scale(4),
    },
    pickerOptionLandscape: {
      width: '48.5%',
      marginTop: 0,
      minHeight: scale(38),
    },
  });

  if (!isLandscapeTier) return sheet;

  // Landscape / TV: shrink the header and the tab bar, and let the content
  // container wrap its blocks into two columns.
  const flat = (style: any): Record<string, any> =>
    (StyleSheet.flatten(style) ?? {}) as Record<string, any>;
  const patch = (style: any, extra: Record<string, any>) => ({ ...flat(style), ...extra });

  return {
    ...sheet,
    // The header is height-locked and clips its children, so the back button,
    // the title and the tab bar have to shrink together.
    header: patch(sheet.header, { height: isTv ? 96 : 72 }),
    headerTopRow: patch(sheet.headerTopRow, { marginTop: isTv ? 6 : 2 }),
    backButton: patch(sheet.backButton, { width: isTv ? 40 : 28, height: isTv ? 40 : 28 }),
    backIcon: patch(sheet.backIcon, { width: isTv ? 28 : 20, height: isTv ? 28 : 20 }),
    headerTitle: patch(sheet.headerTitle, { fontSize: isTv ? 21 : 16 }),
    tabBarContainer: patch(sheet.tabBarContainer, { gap: 8, paddingBottom: isTv ? 6 : 3 }),
    tabButton: patch(sheet.tabButton, { height: isTv ? 36 : 26 }),
    tabText: patch(sheet.tabText, { fontSize: isTv ? 13 : 11 }),
    content: patch(sheet.content, {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      columnGap: isTv ? 18 : 10,
      rowGap: isTv ? 12 : 8,
      paddingTop: isTv ? 16 : 10,
      paddingHorizontal: isTv ? 24 : 12,
      paddingBottom: 18,
    }),
    sectionLabel: patch(sheet.sectionLabel, { fontSize: isTv ? 12 : 10 }),
    // The profile card is a tall portrait block; on a wide screen it reads
    // better as the left column of the first row.
    profileCard: patch(sheet.profileCard, { width: '48.5%', flexGrow: 0, flexShrink: 0 }),
    avatarWrapper: patch(sheet.avatarWrapper, { width: isTv ? 96 : 76, height: isTv ? 96 : 76 }),
    avatarImage: patch(sheet.avatarImage, { width: isTv ? 96 : 76, height: isTv ? 96 : 76 }),
    avatarPlaceholder: patch(sheet.avatarPlaceholder, { width: isTv ? 96 : 76, height: isTv ? 96 : 76 }),
    avatarInitial: patch(sheet.avatarInitial, { fontSize: isTv ? 34 : 26 }),
  };
}