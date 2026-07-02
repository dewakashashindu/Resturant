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
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../services/authStore';
import useItemStore from '../../services/itemStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Selected tab state: 'personal' or 'system'
  const [activeTab, setActiveTab] = useState<'personal' | 'system'>('personal');
  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  
  const isSyncing = useItemStore((s) => s.isSyncing);
  const lastSyncTime = useItemStore((s) => s.lastSyncTime) ?? 'Never';
  const syncError = useItemStore((s) => s.syncError);
  const syncMenuData = useItemStore((s) => s.syncMenuData);
  const hydrateItems = useItemStore((s) => s.hydrateItems);
  const isHydrated = useItemStore((s) => s.isHydrated);

  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  // Layout parameters matching the updated banner spec
  const headerH      = isTablet ? 240 : isSmall ? 180 : 210;
  const titleFs      = isTablet ? 30  : isSmall ? 20  : 24;
  const backIconSize = isTablet ? 32  : isSmall ? 20  : 44;
  const backBtnSize  = isTablet ? 48  : isSmall ? 36  : 44;
  const hPad         = isTablet ? 24  : 16;
  const avatarSize   = isTablet ? 120 : isSmall ? 80  : 100;
  const nameFs       = isTablet ? 22  : isSmall ? 16  : 18;
  const sectionFs    = isTablet ? 18  : isSmall ? 14  : 16;
  const floorFs      = isTablet ? 18  : isSmall ? 14  : 16;
  const changePwFs   = isTablet ? 18  : isSmall ? 14  : 16;
  const changePwH    = isTablet ? 50  : isSmall ? 38  : 44;
  const manageBtnH   = isTablet ? 46  : isSmall ? 34  : 40;
  const manageFs     = isTablet ? 16  : isSmall ? 13  : 14;
const user = useAuthStore((state) => state.user);
console.log("Current User Group ID is:", user?.groupId);

useEffect(() => {
    if (user && user.assignedFloors) {
      setSelectedFloors(user.assignedFloors);
    }
  }, [user]);

  // Connect to itemStore sync engine
  // NOTE: handleCoreSync calls syncMenuData() only — no need to call hydrateItems()
  // first because syncMenuData already merges into the live store and persists to MMKV.
  const handleCoreSync = async () => {
    try {
      const synced = await syncMenuData();

      if (synced) {
        Alert.alert('Sync Complete', 'Menu data was refreshed successfully.');
      } else {
        Alert.alert('Sync Failed', syncError || 'Unable to refresh menu data right now.');
      }
    } catch (err) {
      console.log('Sync failed:', err);
    }
  };

  useEffect(() => {
    // Ensure store is hydrated when visiting Settings
    if (!isHydrated) {
      hydrateItems().catch(() => {});
    }
  }, [hydrateItems, isHydrated]);

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
            Settings
          </Text>

          {/* Spacer to achieve perfect geometric centering */}
          <View style={{ width: backBtnSize }} />
        </View>



        {/* Tab Selection Row Bar */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'personal' && styles.tabButtonActive]}
            onPress={() => setActiveTab('personal')}
            activeOpacity={0.9}
          >
            <Text style={[styles.tabText, activeTab === 'personal' ? styles.tabTextActive : styles.tabTextInactive]}>
              Personal Settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'system' && styles.tabButtonActive]}
            onPress={() => setActiveTab('system')}
            activeOpacity={0.9}
          >
            <Text style={[styles.tabText, activeTab === 'system' ? styles.tabTextActive : styles.tabTextInactive]}>
              System Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SCREEN MAIN CONTENT CONTROLLER ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: hPad, paddingBottom: 120 + insets.bottom }]}
      >
        {activeTab === 'personal' ? (
          <>
            {/* User Details Section Card */}
            <View style={[styles.profileCard, { padding: isTablet ? 28 : 20 }]}>
              <View style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} />
              <Text style={[styles.nameLabel, { fontSize: isTablet ? 13 : 11 }]}>Name</Text>
             
              <Text style={[styles.nameText, { fontSize: nameFs }]}>
                {user?.userName || 'Unknown User'}
              </Text>

              <View style={styles.nameDivider} />
              
              <TouchableOpacity
                style={[styles.changePwBtn, { height: changePwH }]}
                onPress={() => router.push('/auth/changepassword' as any)}
                activeOpacity={0.85}
              >
                <Text style={[styles.changePwText, { fontSize: changePwFs }]}>
                  Change Password
                </Text>
              </TouchableOpacity>
            </View>


            
          {/* ── Manage Access Section ── */}
{(user?.groupId == 3 || String(user?.groupId) === '3') && (
  <View style={{ width: '100%', marginVertical: 10 }}>
    <Text style={[styles.sectionTitle, { fontSize: sectionFs, marginTop: isTablet ? 28 : 20 }]}>
      Manage Floors
    </Text>
    
    <TouchableOpacity
      style={[styles.manageBtn, { height: manageBtnH, backgroundColor: '#002748' }]} 
      onPress={() => router.push('/Screens/manageaccess')} 
      activeOpacity={0.85}
    >
      <Text style={[styles.manageBtnText, { fontSize: manageFs, color: '#FFF' }]}>
        ⚙  Manage Floor Access
      </Text>
    </TouchableOpacity>
  </View>
)}
            {/* Selected Active View Only Grid List */}
            <Text style={[styles.sectionTitle, { fontSize: sectionFs, marginTop: isTablet ? 24 : 18 }]}>
              Floor Selection
            </Text>

            {selectedFloors.length === 0 ? (
              <View style={styles.noFloorBox}>
                <Text style={[styles.noFloorText, { fontSize: floorFs }]}>
                  No floors selected. Tap Manage Floor Access to add.
                </Text>
              </View>
            ) : (
              <View style={styles.accessGrid}>
                {selectedFloors.map((floor, i) => (
                  <View key={i} style={styles.accessChip}>
                    <Text style={[styles.accessChipText, { fontSize: isTablet ? 15 : 13 }]}>
                      ✓  {floor}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </> 
        ) : (
          <>
            {/* ── SYSTEM SETTINGS CONTENT TAB ── */}
            <Text style={[styles.sectionTitle, { fontSize: sectionFs, marginTop: isTablet ? 8 : 4 }]}>
              Data Synchronization
            </Text>
            
            <TouchableOpacity
              style={[styles.manageBtn, { height: manageBtnH }]}
              onPress={handleCoreSync}
              disabled={isSyncing}
              activeOpacity={0.85}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={[styles.manageBtnText, { fontSize: manageFs }]}>
                  🔄  Sync Menu Data
                </Text>
              )}
            </TouchableOpacity>

            {/* Timestamp status display tracker box */}
            <View style={styles.syncStatusBox}>
              <Text style={[styles.syncStatusLabel, { fontSize: isTablet ? 14 : 12 }]}>
                Last Sync Date & Time
              </Text>
              <Text style={[styles.syncStatusTimestamp, { fontSize: isTablet ? 18 : 15 }]}>
                {lastSyncTime}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F3F3F3' },
  
  // Header styles updated to layout content exactly as sketched 
  header:           { backgroundColor: '#002748', justifyContent: 'space-between' },
  headerTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, marginTop: 10 },
  backButton:       { justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle:      { fontWeight: '500', color: '#FFF', textAlign: 'center', flex: 1, fontFamily: 'Roboto' },
  
  // Fixed tracking horizontal selection tab bar
  tabBarContainer:  { flexDirection: 'row', width: '100%', paddingBottom: 12, gap: 8 },
  tabButton:        { flex: 1, height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  tabButtonActive:  { backgroundColor: '#F3F3F3' },
  tabText:          { fontSize: 14, fontFamily: 'Roboto', fontWeight: '500' },
  tabTextActive:    { color: '#000000' },
  tabTextInactive:  { color: '#FFFFFF' },

  content:          { paddingTop: 24 },
  profileCard:      { backgroundColor: '#FFF', borderRadius: 12, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  avatar:           { backgroundColor: '#D9D9D9', marginBottom: 10 },
  nameLabel:        { color: '#888', fontWeight: '500', alignSelf: 'flex-start', marginBottom: 2 },
  nameText:         { color: '#000', fontWeight: '500', alignSelf: 'flex-start', fontFamily: 'Roboto' },
  nameDivider:      { width: '100%', height: 1, backgroundColor: 'rgba(0,0,0,0.15)', marginVertical: 14 },
  changePwBtn:      { width: '100%', backgroundColor: 'rgba(66,119,164,0.5)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  changePwText:     { color: '#FFF', fontWeight: '500', fontFamily: 'Roboto' },
  sectionTitle:     { fontWeight: '500', color: '#000', marginBottom: 10, fontFamily: 'Roboto' },
  manageBtn:        { backgroundColor: '#002748', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  manageBtnText:    { color: '#FFF', fontWeight: '600' },
  accessGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  accessChip:       { backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, borderWidth: 1, borderColor: 'rgba(0,39,72,0.2)' },
  accessChipText:   { color: '#002748', fontWeight: '600' },
  noFloorBox:       { backgroundColor: '#FFF', borderRadius: 12, padding: 20, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  noFloorText:      { color: '#888', fontWeight: '400', textAlign: 'center' },

  // System Sync panel layout tracking styles
  syncStatusBox:    { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginTop: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  syncStatusLabel:  { color: '#666', fontWeight: '500', marginBottom: 4, fontFamily: 'Roboto' },
  syncStatusTimestamp: { color: '#002748', fontWeight: '700', fontFamily: 'Roboto' }
});