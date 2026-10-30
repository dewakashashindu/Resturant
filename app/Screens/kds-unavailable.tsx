import { OperationalColors } from '../../constants/operationalTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
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
  /** Single-letter main group: F = Foods, B = Beverages, S = Siga, O = Others. */
  category: string;
  /** Level1 description from the menu card (Vw_MenuAssignment.L1Des). */
  subCategory: string;
  subCategoryOrder: number;
  itemAvailable: boolean;
};

// Main-category tabs, in the same order the menu card uses
// (/api/menu/main-categories): F, B, S, O, then anything unexpected.
const MAIN_CATEGORIES: { code: string; label: string; order: number }[] = [
  { code: 'F', label: 'Foods', order: 1 },
  { code: 'B', label: 'Beverages', order: 2 },
  { code: 'S', label: 'Siga', order: 3 },
  { code: 'O', label: 'Others', order: 4 },
];

const mainCategoryOf = (category: string) => String(category ?? '').trim().toUpperCase().slice(0, 1);

const mainCategoryLabel = (code: string) => (
  MAIN_CATEGORIES.find((entry) => entry.code === code)?.label ?? (code || 'Uncategorised')
);

const mainCategoryOrder = (code: string) => (
  MAIN_CATEGORIES.find((entry) => entry.code === code)?.order ?? 99
);

type PendingAvailability = Record<string, boolean>;

const COLORS = {
  navy: OperationalColors.primary,
  blue: OperationalColors.primary,
  background: OperationalColors.canvas,
  white: OperationalColors.onPrimary,
  text: OperationalColors.primary,
  muted: OperationalColors.muted,
  border: OperationalColors.border,
  available: '#2B9662',
  unavailable: '#D85A52',
  unavailableSoft: '#FCE4E1',
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
    category: mainCategoryOf(String(row?.Category ?? row?.category ?? '').trim()),
    subCategory: String(row?.SubCategory ?? row?.subCategory ?? row?.L1Des ?? '').trim(),
    subCategoryOrder: Number(row?.SubCategoryOrder ?? row?.subCategoryOrder ?? 0) || 0,
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

  // ── Tabs (main category) + accordions (sub-category) ──────────────────────
  const [activeCategory, setActiveCategory] = useState('');
  // Every sub-category accordion starts closed, as asked: the supervisor opens
  // only the group they are working on.
  const [openSubCategories, setOpenSubCategories] = useState<Record<string, boolean>>({});
  const hasSearch = searchText.trim().length > 0;

  const itemsByMainCategory = useMemo(() => {
    const groups = new Map<string, MenuAvailabilityItem[]>();
    items.forEach((item) => {
      const code = mainCategoryOf(item.category);
      const group = groups.get(code);
      if (group) group.push(item);
      else groups.set(code, [item]);
    });
    return groups;
  }, [items]);

  const categoryTabs = useMemo(() => [...itemsByMainCategory.entries()]
    .map(([code, rows]) => ({
      code,
      label: mainCategoryLabel(code),
      count: rows.length,
      unavailableCount: rows.filter((item) => !(pendingChanges[item.menuItemId] ?? item.itemAvailable)).length,
    }))
    .sort((left, right) => mainCategoryOrder(left.code) - mainCategoryOrder(right.code) || left.code.localeCompare(right.code)),
  [itemsByMainCategory, pendingChanges]);

  // The selected tab falls back to the first tab whenever the current one has
  // no rows (first load, or a search that only matches another category).
  const selectedCategory = categoryTabs.some((tab) => tab.code === activeCategory)
    ? activeCategory
    : categoryTabs[0]?.code ?? '';

  const subCategoryGroups = useMemo(() => {
    const rows = itemsByMainCategory.get(selectedCategory) ?? [];
    const groups = new Map<string, MenuAvailabilityItem[]>();
    rows.forEach((item) => {
      const name = item.subCategory || 'Other items';
      const group = groups.get(name);
      if (group) group.push(item);
      else groups.set(name, [item]);
    });
    return [...groups.entries()]
      .map(([name, groupRows]) => ({
        name,
        rows: groupRows,
        // Menu-card listing order first, alphabetical only as a tie-break.
        order: Math.min(...groupRows.map((item) => item.subCategoryOrder || Number.MAX_SAFE_INTEGER)),
        unavailableCount: groupRows.filter((item) => !(pendingChanges[item.menuItemId] ?? item.itemAvailable)).length,
      }))
      .sort((left, right) => (left.order - right.order) || left.name.localeCompare(right.name));
  }, [itemsByMainCategory, pendingChanges, selectedCategory]);

  const subCategoryKey = (name: string) => `${selectedCategory}|${name}`;

  // A search always expands every matching sub-category, otherwise the result
  // would stay folded inside a closed accordion.
  const isSubCategoryOpen = (name: string) => hasSearch || Boolean(openSubCategories[subCategoryKey(name)]);

  const toggleSubCategory = (name: string) => {
    if (hasSearch) return;
    const key = subCategoryKey(name);
    setOpenSubCategories((current) => ({ ...current, [key]: !current[key] }));
  };

  type AvailabilityRow =
    | { kind: 'header'; key: string; name: string; count: number; unavailableCount: number; open: boolean }
    | { kind: 'item'; key: string; item: MenuAvailabilityItem };

  // A flat render list keeps the FlatList (and its recycling) while still
  // drawing one collapsible header per sub-category.
  const availabilityRows = useMemo<AvailabilityRow[]>(() => {
    const rows: AvailabilityRow[] = [];
    subCategoryGroups.forEach((group) => {
      const open = isSubCategoryOpen(group.name);
      rows.push({
        kind: 'header',
        key: `sub:${group.name}`,
        name: group.name,
        count: group.rows.length,
        unavailableCount: group.unavailableCount,
        open,
      });
      if (!open) return;
      group.rows.forEach((item) => {
        rows.push({ kind: 'item', key: `item:${item.menuItemId}`, item });
      });
    });
    return rows;
  }, [subCategoryGroups, hasSearch, openSubCategories, selectedCategory]);

  const selectedTab = categoryTabs.find((tab) => tab.code === selectedCategory);

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
          placeholderTextColor={OperationalColors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search menu items"
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearSearch} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={19} color={OperationalColors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
          keyboardShouldPersistTaps="handled"
        >
          {categoryTabs.map((tab) => {
            const isActive = tab.code === selectedCategory;
            return (
              <TouchableOpacity
                key={tab.code}
                style={[styles.tab, isActive && styles.tabActive]}
                activeOpacity={0.82}
                onPress={() => setActiveCategory(tab.code)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab.label}, ${tab.count} items`}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{tab.count}</Text>
                </View>
                {tab.unavailableCount > 0 ? <View style={styles.tabAlertDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.listCaption}>
        <Text style={styles.listCaptionText}>
          {isLoading
            ? 'Loading items…'
            : `${selectedTab?.count ?? 0} menu item${(selectedTab?.count ?? 0) === 1 ? '' : 's'} · ${subCategoryGroups.length} sub-categor${subCategoryGroups.length === 1 ? 'y' : 'ies'}`}
        </Text>
        {visibleUnavailableCount > 0 ? <Text style={styles.unavailableCount}>{visibleUnavailableCount} unavailable</Text> : null}
      </View>

      <FlatList
        data={availabilityRows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={items.length === 0 && !isLoading ? styles.emptyList : styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshing={isRefreshing}
        onRefresh={() => void loadItems(searchText, true)}
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return (
              <TouchableOpacity
                style={[styles.categoryHeader, row.open && styles.categoryHeaderOpen]}
                activeOpacity={0.8}
                onPress={() => toggleSubCategory(row.name)}
                accessibilityRole="button"
                accessibilityState={{ expanded: row.open }}
                accessibilityLabel={`${row.name}, ${row.count} items, ${row.open ? 'collapse' : 'expand'}`}
              >
                <Ionicons
                  name={row.open ? 'chevron-down' : 'chevron-forward'}
                  size={16}
                  color={COLORS.blue}
                />
                <Text style={styles.categoryName} numberOfLines={1}>{row.name}</Text>
                <View style={styles.categoryCount}><Text style={styles.categoryCountText}>{row.count}</Text></View>
                {row.unavailableCount > 0 ? (
                  <View style={styles.categoryUnavailable}>
                    <Text style={styles.categoryUnavailableText}>{row.unavailableCount} unavailable</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }
          const item = row.item;
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
            <Ionicons name="search-outline" size={34} color={OperationalColors.muted} />
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
  backButton: { width: 42, height: 42, marginRight: 11, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: 'rgba(248,247,245,0.13)' },
  headerText: { flex: 1 },
  eyebrow: { color: OperationalColors.accentSoft, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: COLORS.white, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  introCard: { marginHorizontal: 14, marginTop: 15, padding: 13, flexDirection: 'row', alignItems: 'flex-start', borderRadius: 15, backgroundColor: COLORS.white, borderWidth: 1, borderColor: OperationalColors.surfaceAlt },
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
  tabBar: { paddingTop: 11, borderBottomWidth: 1, borderBottomColor: OperationalColors.border, backgroundColor: COLORS.white },
  tabBarContent: { paddingHorizontal: 14, paddingBottom: 9, gap: 7 },
  tab: { minHeight: 36, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: OperationalColors.border },
  tabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  tabLabel: { color: COLORS.text, fontSize: 12, fontWeight: '900' },
  tabLabelActive: { color: COLORS.white },
  tabCount: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center', borderRadius: 6, backgroundColor: OperationalColors.surfaceAlt },
  tabCountActive: { backgroundColor: 'rgba(248,247,245,0.22)' },
  tabCountText: { color: COLORS.muted, fontSize: 9, fontWeight: '900' },
  tabCountTextActive: { color: COLORS.white },
  tabAlertDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.unavailable },
  categoryHeader: { minHeight: 42, marginTop: 4, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, backgroundColor: OperationalColors.surfaceAlt, borderWidth: 1, borderColor: OperationalColors.border },
  categoryHeaderOpen: { backgroundColor: COLORS.white },
  categoryName: { flex: 1, minWidth: 0, color: COLORS.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  categoryCount: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: OperationalColors.border },
  categoryCountText: { color: COLORS.muted, fontSize: 9, fontWeight: '900' },
  categoryUnavailable: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: COLORS.unavailableSoft },
  categoryUnavailableText: { color: COLORS.unavailable, fontSize: 8, fontWeight: '900' },
  itemRow: { minHeight: 69, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: OperationalColors.border, borderRadius: 14, backgroundColor: COLORS.white },
  itemRowUnavailable: { borderColor: '#F0C9C4', backgroundColor: '#FFF8F7' },
  itemRowPending: { borderColor: '#E7B978', borderWidth: 1.5 },
  checkbox: { width: 28, height: 28, marginRight: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: OperationalColors.border, borderRadius: 8, backgroundColor: COLORS.white },
  checkboxChecked: { borderColor: COLORS.unavailable, backgroundColor: COLORS.unavailable },
  itemInfo: { flex: 1, minWidth: 0, paddingRight: 8 },
  itemName: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  itemNameUnavailable: { color: '#974A44' },
  itemDetailRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  itemCode: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  itemCategory: { color: OperationalColors.muted, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: OperationalColors.surfaceAlt },
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
  saveBar: { minHeight: 78, paddingTop: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: OperationalColors.border, backgroundColor: COLORS.white },
  saveCopy: { flex: 1, paddingRight: 10 },
  saveCount: { color: COLORS.text, fontSize: 12, fontWeight: '900' },
  saveDescription: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  saveButton: { minWidth: 94, minHeight: 43, paddingHorizontal: 13, gap: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: COLORS.navy },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
});
