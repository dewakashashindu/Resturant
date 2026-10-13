import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient } from '../../services/api';
import { useAuthStore } from '../../services/authStore';

type MenuAvailabilityItem = {
  menuItemId: string;
  description: string;
  category: string;
  itemAvailable: boolean;
};

type PendingAvailability = Record<string, boolean>;

const COLORS = {
  navy: '#002748',
  blue: '#0B6AAE',
  background: '#F2F6F8',
  white: '#FFFFFF',
  text: '#1E293B',
  muted: '#64748B',
  border: '#DCE6ED',
  available: '#2B9662',
  unavailable: '#D85A52',
  unavailableSoft: '#FFF3F1',
};

const asItem = (row: any): MenuAvailabilityItem | null => {
  const menuItemId = String(row?.MenuItmId ?? row?.menuItmId ?? row?.MenuItemCode ?? '').trim();
  const description = String(row?.MenuItmDes ?? row?.menuItmDes ?? row?.description ?? '').trim();
  if (!menuItemId || !description) return null;
  const rawUnavailable = row?.ItemNotAvailable ?? row?.itemNotAvailable;
  const rawAvailable = row?.ItemAvailable ?? row?.itemAvailable ?? 1;
  const hasUnavailableFlag = rawUnavailable === true || rawUnavailable === false
    || rawUnavailable === 1 || rawUnavailable === 0 || rawUnavailable === '1' || rawUnavailable === '0';
  return {
    menuItemId,
    description,
    category: String(row?.Category ?? row?.category ?? '').trim(),
    itemAvailable: hasUnavailableFlag
      ? !(rawUnavailable === true || rawUnavailable === 1 || rawUnavailable === '1')
      : rawAvailable === true || rawAvailable === 1 || rawAvailable === '1',
  };
};

export default function KdsUnavailableScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.user);
  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState<MenuAvailabilityItem[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingAvailability>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const requestSequence = useRef(0);

  const loadItems = useCallback(async (search: string, refresh = false) => {
    const sequence = ++requestSequence.current;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await apiClient.getKdsMenuItems(search);
      if (sequence !== requestSequence.current) return;
      if (!response.ok || !response.data?.ok) {
        throw new Error(response.data?.message || 'Unable to load menu items.');
      }
      const itemsById = new Map<string, MenuAvailabilityItem>();
      (Array.isArray(response.data.items) ? response.data.items : [])
        .map(asItem)
        .filter((item: MenuAvailabilityItem | null): item is MenuAvailabilityItem => Boolean(item))
        .forEach((item: MenuAvailabilityItem) => {
          // One availability control per real menu item, even if the source
          // view returns several assignment rows for that MenuItmId.
          if (!itemsById.has(item.menuItemId)) itemsById.set(item.menuItemId, item);
        });
      setItems([...itemsById.values()]);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      console.log('[KDS Unavailable] load failed', error);
      Alert.alert('Unable to load items', 'Please check the connection and try again.');
    } finally {
      if (sequence === requestSequence.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadItems(searchText);
    }, searchText ? 250 : 0);
    return () => clearTimeout(timeout);
  }, [loadItems, searchText]);

  const toggleItem = (item: MenuAvailabilityItem) => {
    if (isSaving) return;
    const currentlyAvailable = pendingChanges[item.menuItemId] ?? item.itemAvailable;
    const nextAvailable = !currentlyAvailable;
    setPendingChanges((current) => {
      // Returning to the original database value removes the staged change.
      if (nextAvailable === item.itemAvailable) {
        const { [item.menuItemId]: _removed, ...remaining } = current;
        return remaining;
      }
      return { ...current, [item.menuItemId]: nextAvailable };
    });
  };

  const saveChanges = async () => {
    const updates = Object.entries(pendingChanges).map(([menuItemId, itemAvailable]) => ({ menuItemId, itemAvailable }));
    if (updates.length === 0 || isSaving) return;

    setIsSaving(true);
    try {
      const editedBy = currentUser?.userName || String(currentUser?.userId ?? 'KDS');
      const response = await apiClient.saveKdsMenuItemAvailabilityChanges(updates, editedBy);
      if (!response.ok || !response.data?.ok) {
        throw new Error(response.data?.message || 'Unable to save the availability changes.');
      }

      setItems((current) => current.map((item) => Object.prototype.hasOwnProperty.call(pendingChanges, item.menuItemId)
        ? { ...item, itemAvailable: pendingChanges[item.menuItemId] }
        : item));
      setPendingChanges({});

      const unavailableCount = Array.isArray(response.data?.unavailableItems)
        ? response.data.unavailableItems.length
        : 0;
      Alert.alert(
        'Saved',
        unavailableCount > 0
          ? `${updates.length} item change${updates.length === 1 ? '' : 's'} saved. One IT notification was sent to all devices with ${unavailableCount} unavailable item${unavailableCount === 1 ? '' : 's'}.`
          : `${updates.length} item change${updates.length === 1 ? '' : 's'} saved.`,
      );
    } catch (error) {
      console.log('[KDS Unavailable] batch save failed', error);
      Alert.alert('Changes not saved', error instanceof Error ? error.message : 'Please check the connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const visibleUnavailableCount = useMemo(
    () => items.filter((item) => !(pendingChanges[item.menuItemId] ?? item.itemAvailable)).length,
    [items, pendingChanges],
  );
  const pendingCount = Object.keys(pendingChanges).length;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 9) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Kitchen Display"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>KITCHEN DISPLAY</Text>
          <Text style={styles.title}>Unavailable Items</Text>
        </View>
      </View>

      <View style={styles.introCard}>
        <View style={styles.introIcon}>
          <Ionicons name="notifications-outline" size={21} color={COLORS.unavailable} />
        </View>
        <View style={styles.introCopy}>
          <Text style={styles.introTitle}>Select first, then save once</Text>
          <Text style={styles.introText}>A checked item means unavailable. Save creates one IT item notification containing the full selected-item list for every device.</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={21} color={COLORS.muted} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by item name or code"
          placeholderTextColor="#8C9BA8"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search menu items"
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearSearch} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={19} color="#94A6B5" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.listCaption}>
        <Text style={styles.listCaptionText}>{isLoading ? 'Loading items…' : `${items.length} menu item${items.length === 1 ? '' : 's'}`}</Text>
        {visibleUnavailableCount > 0 ? <Text style={styles.unavailableCount}>{visibleUnavailableCount} unavailable</Text> : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.menuItemId}
        contentContainerStyle={items.length === 0 && !isLoading ? styles.emptyList : styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshing={isRefreshing}
        onRefresh={() => void loadItems(searchText, true)}
        renderItem={({ item }) => {
          const itemAvailable = pendingChanges[item.menuItemId] ?? item.itemAvailable;
          const isUnavailable = !itemAvailable;
          const hasPendingChange = Object.prototype.hasOwnProperty.call(pendingChanges, item.menuItemId);
          return (
            <TouchableOpacity
              activeOpacity={0.82}
              style={[styles.itemRow, isUnavailable && styles.itemRowUnavailable, hasPendingChange && styles.itemRowPending]}
              onPress={() => toggleItem(item)}
              disabled={isSaving}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isUnavailable, disabled: isSaving }}
              accessibilityLabel={`${item.description}, ${isUnavailable ? 'unavailable' : 'available'}`}
            >
              <View style={[styles.checkbox, isUnavailable && styles.checkboxChecked]}>
                {isUnavailable ? <Ionicons name="checkmark" size={18} color={COLORS.white} /> : null}
              </View>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, isUnavailable && styles.itemNameUnavailable]}>{item.description}</Text>
                <View style={styles.itemDetailRow}>
                  <Text style={styles.itemCode}>{item.menuItemId}</Text>
                  {item.category ? <Text style={styles.itemCategory}>{item.category}</Text> : null}
                  {hasPendingChange ? <Text style={styles.pendingText}>NOT SAVED</Text> : null}
                </View>
              </View>
              <View style={[styles.statusPill, isUnavailable ? styles.statusPillUnavailable : styles.statusPillAvailable]}>
                <Text style={[styles.statusText, isUnavailable ? styles.statusTextUnavailable : styles.statusTextAvailable]}>
                  {isUnavailable ? 'Unavailable' : 'Available'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={!isLoading ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={34} color="#A6B5C0" />
            <Text style={styles.emptyTitle}>No menu items found</Text>
            <Text style={styles.emptyText}>Try a different item name or code.</Text>
          </View>
        ) : null}
        ListFooterComponent={isLoading ? <ActivityIndicator style={styles.loader} color={COLORS.blue} /> : null}
      />

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.saveCopy}>
          <Text style={styles.saveCount}>{pendingCount === 0 ? 'No pending changes' : `${pendingCount} change${pendingCount === 1 ? '' : 's'} ready`}</Text>
          <Text style={styles.saveDescription}>Notification sends only after Save.</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, (pendingCount === 0 || isSaving) && styles.saveButtonDisabled]}
          onPress={() => void saveChanges()}
          disabled={pendingCount === 0 || isSaving}
          accessibilityRole="button"
          accessibilityLabel="Save unavailable item changes"
        >
          {isSaving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="save-outline" size={18} color={COLORS.white} />}
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { minHeight: 82, paddingHorizontal: 16, paddingBottom: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy },
  backButton: { width: 42, height: 42, marginRight: 11, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.13)' },
  headerText: { flex: 1 },
  eyebrow: { color: '#8FB8D7', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: COLORS.white, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  introCard: { marginHorizontal: 14, marginTop: 15, padding: 13, flexDirection: 'row', alignItems: 'flex-start', borderRadius: 15, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E0E9EE' },
  introIcon: { width: 37, height: 37, marginRight: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 11, backgroundColor: COLORS.unavailableSoft },
  introCopy: { flex: 1 },
  introTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  introText: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  searchWrap: { minHeight: 51, marginHorizontal: 14, marginTop: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: COLORS.white },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 9, color: COLORS.text, fontSize: 14 },
  clearSearch: { padding: 3 },
  listCaption: { minHeight: 39, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center' },
  listCaptionText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  unavailableCount: { marginLeft: 'auto', color: COLORS.unavailable, fontSize: 11, fontWeight: '900' },
  listContent: { paddingHorizontal: 14, paddingBottom: 122, gap: 8 },
  emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 130 },
  itemRow: { minHeight: 69, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DFE8EE', borderRadius: 14, backgroundColor: COLORS.white },
  itemRowUnavailable: { borderColor: '#F0C9C4', backgroundColor: '#FFF8F7' },
  itemRowPending: { borderColor: '#E7B978', borderWidth: 1.5 },
  checkbox: { width: 28, height: 28, marginRight: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#A5B6C2', borderRadius: 8, backgroundColor: COLORS.white },
  checkboxChecked: { borderColor: COLORS.unavailable, backgroundColor: COLORS.unavailable },
  itemInfo: { flex: 1, minWidth: 0, paddingRight: 8 },
  itemName: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  itemNameUnavailable: { color: '#974A44' },
  itemDetailRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  itemCode: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  itemCategory: { color: '#52718A', fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: '#EAF3F8' },
  pendingText: { color: '#A86518', fontSize: 8, fontWeight: '900', letterSpacing: 0.25 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7 },
  statusPillAvailable: { backgroundColor: '#EBF8F0' },
  statusPillUnavailable: { backgroundColor: '#FCE4E1' },
  statusText: { fontSize: 9, fontWeight: '900' },
  statusTextAvailable: { color: COLORS.available },
  statusTextUnavailable: { color: COLORS.unavailable },
  emptyState: { alignItems: 'center', paddingHorizontal: 30 },
  emptyTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  loader: { marginTop: 28 },
  saveBar: { minHeight: 78, paddingTop: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#DCE6ED', backgroundColor: COLORS.white },
  saveCopy: { flex: 1, paddingRight: 10 },
  saveCount: { color: COLORS.text, fontSize: 12, fontWeight: '900' },
  saveDescription: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  saveButton: { minWidth: 94, minHeight: 43, paddingHorizontal: 13, gap: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: COLORS.navy },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
});
