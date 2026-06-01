import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ImageSourcePropType,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, getCachedOrderDescriptions } from '../../services/api';
import { useCartStore } from '../../services/cartStore';
import useItemStore from '../../services/itemStore';
import { storage } from '../../services/storage';

type ViewMode = 'categories' | 'menu';

type DynamicCategory = {
  id: string;
  label: string;
  type: string;
  price: number;
  listingOrder: number;
  color: string;
  icon?: ImageSourcePropType;
};

type MenuRow = {
  Level: string;
  LDes: string;
  Type: 'C' | 'I';
  SalesPrice: string | number;
  icon?: ImageSourcePropType;
};

type MainTab = {
  code: string;
  label: string;
};

const normalizeMenuItemCode = (value: unknown) => String(value ?? '').trim();

const FALLBACK_TABS: MainTab[] = [
  { code: 'F', label: 'Foods' },
  { code: 'B', label: 'Bleverages' },
  { code: 'S', label: 'Siga' },
  { code: 'O', label: 'Others' },
];

interface ColorCardProps {
  label: string;
  color: string;
  icon?: ImageSourcePropType;
  onPress?: () => void;
}

const ColorCard = ({ label, color, icon, onPress }: ColorCardProps) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isSmall = height < 700;

  const cardW = (width - 32 - 24) / 2;
  const cardH = cardW * (isTablet ? 0.9 : 0.6);
  const imgSize = isTablet ? 56 : 46;
  const labelFs = isTablet ? 15 : isSmall ? 11 : 13;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[styles.colorCard, { backgroundColor: color || '#E3F2FD', width: cardW, height: cardH }]}
    >
      <View style={styles.colorCardDeco} />

      <View style={{ width: imgSize, height: imgSize, marginBottom: 8, borderRadius: Math.round(imgSize / 8), overflow: 'hidden' }}>
        <Image
          source={icon ? icon : require('../../assets/icons/blackback.png')}
          style={{ width: '100%', height: '100%', transform: [{ rotate: '180deg' }] }}
          resizeMode="cover"
        />
      </View>

      <Text style={[styles.colorCardText, { fontSize: labelFs }]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

interface ItemCardProps {
  label: string;
  price?: number;
  icon?: ImageSourcePropType;
  onAdd?: () => void;
  quantity?: number;
  remarks?: string;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onPressDetails?: () => void;
}

type SelectedItem = {
  key: string;
  label: string;
  price?: number;
  icon?: ImageSourcePropType;
};

const FALLBACK_REMARK_TAG_PRESETS = ['No Spicy', 'Less Spicy', 'Takeaway', 'No Onion', 'Extra Sauce', 'No Garlic'];

const LEVEL_KEYS = ['Level1', 'Level2', 'Level3', 'Level4', 'Level5', 'Level6', 'Level7'] as const;
const MENU_SNAPSHOT_KEY = 'menu_items_cache_v1';
const CACHED_CATEGORIES_KEY = 'cached_categories';
const CACHED_ITEMS_KEY = 'cached_items';

const getText = (value: unknown) => String(value ?? '').trim();

const getCategoryDisplayName = (category: Record<string, any>) => {
  const primary = getText(
    category.name
    ?? category.categoryName
    ?? category.category_name
    ?? category.CategoryName
    ?? category.CategoryLabel
    ?? category.label
    ?? category.LDes
    ?? category.L1Des
  );

  if (primary) return primary;

  return getText(category.id ?? category.categoryId ?? category.code ?? category.Level ?? '');
};

const getSubCategoryCode = (item: Record<string, any>) =>
  getText(item.Level1 ?? item.level1 ?? item.CategoryLevel1 ?? item.level ?? item.code ?? item.id ?? '');

const getSubCategoryLabel = (item: Record<string, any>) =>
  getText(
    item.L1DES
    ?? item.L1Des
    ?? item.LDes
    ?? item.name
    ?? item.categoryName
    ?? item.category_name
    ?? item.SubCategoryName
    ?? item.subCategoryName
    ?? item.label
  );

const isVisibleCachedItem = (item: Record<string, any>) => {
  const displayInFront = getText(item.DisplayInFront);
  const menuAssiEnable = getText(item.MenuAssiEnable);
  const menuItemEnable = getText(item.MenuItemEnable);

  const flags = [displayInFront, menuAssiEnable, menuItemEnable].filter(Boolean);
  if (flags.length === 0) return true;
  return flags.every((value) => value === '1' || value.toLowerCase() === 'true');
};

const getLevelValue = (item: Record<string, any>, level: number) => getText(item[LEVEL_KEYS[level - 1]]);

const getLevelDescription = (item: Record<string, any>, level: number) => {
  const key = `L${level}Des`;
  return getText(item[key] ?? item[`${key.toLowerCase()}`]);
};

const getMenuItemCode = (item: Record<string, any>) =>
  getText(item.MenuItemCode ?? item.ItemCode ?? item.ItemId ?? item.Level7 ?? item.Level ?? item.code);

const getMenuItemLabel = (item: Record<string, any>) =>
  getText(item.MenuItmDes ?? item.MenuItemDes ?? item.ItemName ?? item.itemName ?? item.label ?? item.LDes ?? getMenuItemCode(item));

const getMenuItemPrice = (item: Record<string, any>) => Number(item.SalesPrice ?? item.salesPrice ?? 0) || 0;

const toImageSource = (value: unknown): ImageSourcePropType | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const uri = value.trim();
    return uri ? { uri } : undefined;
  }
  return value as ImageSourcePropType;
};

const getMenuItemImageSource = (item: Record<string, any>) => toImageSource(
  item.ItemImageUrl
  ?? item.ImageUrl
  ?? item.imageUrl
  ?? item.PhotoUrl
  ?? item.photoUrl
  ?? item.Image
  ?? item.image
  ?? item.icon
);

const readCachedMenuItems = () => {
  try {
    const rawSnapshot = storage.getString(MENU_SNAPSHOT_KEY);
    if (rawSnapshot) {
      const snapshot = JSON.parse(rawSnapshot);
      if (Array.isArray(snapshot?.items)) {
        return snapshot.items;
      }
    }

    const rawItems = storage.getString(CACHED_ITEMS_KEY);
    if (rawItems) {
      const parsedItems = JSON.parse(rawItems);
      if (Array.isArray(parsedItems)) {
        return parsedItems;
      }
    }
  } catch (error) {
    console.log('[ItemSelection] Failed to read cached menu items', error);
  }

  return [];
};

const readCachedMenuCategories = () => {
  try {
    const rawCategories = storage.getString(CACHED_CATEGORIES_KEY);
    if (!rawCategories) return [];

    const parsedCategories = JSON.parse(rawCategories);
    return Array.isArray(parsedCategories) ? parsedCategories : [];
  } catch (error) {
    console.log('[ItemSelection] Failed to read cached menu categories', error);
    return [];
  }
};

const buildTabsFromItems = (items: Record<string, any>[]): MainTab[] => {
  const tabs = new Map<string, MainTab>();

  for (const item of items) {
    if (!isVisibleCachedItem(item)) continue;
    const code = getText(item.Category ?? item.CategoryCode ?? item.category);
    if (!code) continue;

    const label = getText(item.CategoryName ?? item.CategoryLabel ?? item.categoryName) || FALLBACK_TABS.find((tab) => tab.code === code)?.label || code;
    if (!tabs.has(code)) {
      tabs.set(code, { code, label });
    }
  }

  return Array.from(tabs.values());
};

const buildCategoriesFromItems = (items: Record<string, any>[], tabCode: string): DynamicCategory[] => {
  const categories = new Map<string, DynamicCategory>();

  for (const item of items) {
    if (!isVisibleCachedItem(item)) continue;
    if (tabCode && getText(item.Category ?? item.CategoryCode ?? item.category) !== tabCode) continue;

    const id = getSubCategoryCode(item);
    if (!id) continue;

    const label = getSubCategoryLabel(item) || id;
    if (!categories.has(id)) {
      categories.set(id, {
        id,
        label,
        type: 'C',
        price: Number(item.SalesPrice ?? 0) || 0,
        listingOrder: Number(item.L1LitingOrder ?? item.listingOrder ?? 0) || 0,
        color: String(item.color ?? '#E3F2FD'),
          icon: getMenuItemImageSource(item),
      });
    }
  }

  return Array.from(categories.values()).sort((a, b) => a.listingOrder - b.listingOrder || a.label.localeCompare(b.label));
};

const buildMenuRowsFromItems = (items: Record<string, any>[], codes: string[], level: number): MenuRow[] => {
  const rows = new Map<string, MenuRow>();
  const path = codes.filter(Boolean);

  for (const item of items) {
    if (!isVisibleCachedItem(item)) continue;

    let matchesPath = true;
    for (let i = 0; i < path.length; i += 1) {
      const code = i === 0 ? getSubCategoryCode(item) : getLevelValue(item, i + 1);
      if (String(code ?? '').trim() !== String(path[i] ?? '').trim()) {
        matchesPath = false;
        break;
      }
    }
    if (!matchesPath) continue;

    const nextLevel = level + 1;
    const nextLevelValue = getLevelValue(item, nextLevel);
    const nextLevelDescription = getLevelDescription(item, nextLevel);

    if (nextLevelValue) {
      if (!rows.has(nextLevelValue)) {
        rows.set(nextLevelValue, {
          Level: nextLevelValue,
          LDes: nextLevelDescription || nextLevelValue,
          Type: 'C',
          SalesPrice: '0',
        });
      }
      continue;
    }

    const itemCode = getMenuItemCode(item);
    if (!itemCode) continue;
    if (!rows.has(itemCode)) {
      rows.set(itemCode, {
        Level: itemCode,
        LDes: getMenuItemLabel(item),
        Type: 'I',
        SalesPrice: String(getMenuItemPrice(item)),
        icon: getMenuItemImageSource(item),
      });
    }
  }

  return Array.from(rows.values());
};

const splitRemarkTags = (value?: string) =>
  String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const normalizeRemarkTags = (values: string[]) =>
  values
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);

const ItemCard = ({ label, price, icon, onAdd, quantity, remarks, onIncrement, onDecrement, onPressDetails }: ItemCardProps) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isSmall = height < 700;
  const displayQuantity = quantity ?? 0;
  const remarkTags = normalizeRemarkTags(splitRemarkTags(remarks));

  const cardW = (width - 32 - 24) / 2;
  const imgSize = cardW - 4;
  const labelFs = isTablet ? 15 : isSmall ? 12 : 14;
  const priceFs = isTablet ? 13 : isSmall ? 10 : 11;
  const addFs = isTablet ? 12 : isSmall ? 10 : 11;

  return (
    <View style={[styles.itemCard, { width: cardW }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPressDetails} style={styles.itemTopArea}>
        <View style={[styles.itemImageBox, { width: imgSize, height: imgSize }]}> 
          {icon
            ? <Image source={icon} style={styles.fillImage} resizeMode="cover" />
            : <Image source={{ uri: 'https://placehold.co/112x112' }} style={styles.fillImage} resizeMode="cover" />
          }
        </View>
        <Text style={[styles.itemLabel, { fontSize: labelFs }]} numberOfLines={2}>{label}</Text>
      </TouchableOpacity>

      {price !== undefined && <Text style={[styles.itemPrice, { fontSize: priceFs }]}>Rs. {price}</Text>}

      {remarkTags.length > 0 && (
        <View style={styles.cardRemarksWrap}>
          {remarkTags.map((tag, index) => (
            <View key={`${tag}-${index}`} style={styles.cardRemarkChip}>
              <Text style={styles.cardRemarkText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.qtyRow}>
        {displayQuantity > 0 ? (
          <>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => {
                onDecrement?.();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.qtyBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={[styles.qtyNumber, { fontSize: addFs }]}>{displayQuantity}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => {
                onIncrement?.();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.qtyAddBtn}
            onPress={() => {
              onAdd?.();
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.addBtnText, { fontSize: addFs }]}>ADD +</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function ItemSelection() {
  const router = useRouter();
  const { tableName, localPax, foreignPax, status, floor } = useLocalSearchParams<{ tableName: string; localPax: string; foreignPax: string; status?: string; floor?: string; }>();
  const { width, height } = useWindowDimensions();
  const storeItems = useItemStore((state) => state.items);
  const storeHydrated = useItemStore((state) => state.isHydrated);
  const hydrateItems = useItemStore((state) => state.hydrateItems);
  const [cachedItems, setCachedItems] = useState<Record<string, any>[]>([]);
  const [cachedCategories, setCachedCategories] = useState<Record<string, any>[]>([]);
  const [isCacheHydrated, setIsCacheHydrated] = useState(false);

  const [tabsList, setTabsList] = useState<MainTab[]>([]);
  const [selectedTabCode, setSelectedTabCode] = useState('');
  const [categoriesList, setCategoriesList] = useState<DynamicCategory[]>([]);
  const [menuRows, setMenuRows] = useState<MenuRow[]>([]);
  const [loadingTabs, setLoadingTabs] = useState<boolean>(false);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [menuLoading, setMenuLoading] = useState(false);

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [activeCategory, setActiveCategory] = useState<DynamicCategory | null>(null);
  const [menuLevel, setMenuLevel] = useState(1);
  const [menuCodes, setMenuCodes] = useState<string[]>([]);
  const [menuLabels, setMenuLabels] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [itemDetailsVisible, setItemDetailsVisible] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState<string[]>([]);
  const [currentTypedText, setCurrentTypedText] = useState('');
  const [isViewingPresets, setIsViewingPresets] = useState(false);
  const [remarkOptions, setRemarkOptions] = useState<string[]>(() => getCachedOrderDescriptions());
  const [loadingRemarkOptions, setLoadingRemarkOptions] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const cartItems = useCartStore((state) => state.cartItems);
  const addToCart = useCartStore((state) => state.addToCart);
  const upsertCartItem = useCartStore((state) => state.upsertCartItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  const isTablet = width >= 600;
  const isSmall = height < 700;

  useEffect(() => {
    try {
      setCachedItems(readCachedMenuItems());
      setCachedCategories(readCachedMenuCategories());
    } catch (error) {
      console.log('[ItemSelection] Failed to read MMKV menu cache', error);
      setCachedItems([]);
      setCachedCategories([]);
    } finally {
      setIsCacheHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (cachedItems.length > 0) return;
    if (storeItems.length > 0) {
      setCachedItems(storeItems);
      return;
    }

    if (storeHydrated) return;

    void hydrateItems().catch((error) => {
      console.log('[ItemSelection] hydrateItems failed', error);
    });
  }, [cachedItems.length, hydrateItems, storeHydrated, storeItems]);

  useEffect(() => {
    if (cachedItems.length === 0) {
      setTabsList([]);
      setSelectedTabCode('');
      if (cachedCategories.length > 0) {
        const mappedCategories = cachedCategories.map((cat) => ({
          id: String(cat.id ?? cat.Level ?? '').trim(),
          label: getSubCategoryLabel(cat) || String(cat.id ?? cat.Level ?? '').trim(),
          type: String(cat.type ?? cat.Type ?? 'C'),
          price: Number(cat.price ?? cat.SalesPrice ?? 0),
          listingOrder: Number(cat.listingOrder ?? cat.L1LitingOrder ?? 0),
          color: String(cat.color ?? '#E3F2FD'),
          icon: getMenuItemImageSource(cat),
        })).filter((cat) => Boolean(cat.id));
        setCategoriesList(mappedCategories);
      } else {
        setCategoriesList([]);
      }
      setMenuRows([]);
      return;
    }

    const visibleTabs = buildTabsFromItems(cachedItems);
    if (visibleTabs.length > 0) {
      setTabsList(visibleTabs);
      if (!selectedTabCode || !visibleTabs.some((tab) => tab.code === selectedTabCode)) {
        setSelectedTabCode(visibleTabs[0].code);
      }
    }
  }, [cachedItems]);

  useEffect(() => {
    if (!cachedItems.length) {
      setCategoriesList([]);
      return;
    }

    setCategoriesList(buildCategoriesFromItems(cachedItems, selectedTabCode));
  }, [cachedItems, selectedTabCode]);

  useEffect(() => {
    if (!cachedItems.length || viewMode !== 'menu' || menuCodes.length === 0) {
      if (!cachedItems.length) setMenuRows([]);
      return;
    }

    setMenuRows(buildMenuRowsFromItems(cachedItems, menuCodes, menuLevel));
  }, [cachedItems, menuCodes, menuLevel, viewMode]);

  useEffect(() => {
    // Read directly from lightning-fast MMKV local memory with zero delay.
    setRemarkOptions(getCachedOrderDescriptions());
  }, []);

  const prevTableRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevTableRef.current;
    if (prev !== undefined && prev !== tableName) {
      clearCart();
      setTabsList([]);
      setSelectedTabCode('');
      setCategoriesList([]);
      setMenuRows([]);
      setViewMode('categories');
    }
    prevTableRef.current = tableName;
  }, [tableName]);

  useEffect(() => {
    if (!selectedTabCode) {
      setCategoriesList([]);
      return;
    }

    setCategoriesList(buildCategoriesFromItems(cachedItems, selectedTabCode));
  }, [cachedItems, selectedTabCode]);

  const fetchMenuRows = async (level: number, codes: string[]) => {
    setMenuRows(buildMenuRowsFromItems(cachedItems, codes, level));
  };

  const openCategory = async (category: DynamicCategory) => { setActiveCategory(category); setMenuLevel(1); setMenuCodes([category.id]); setMenuLabels([category.label]); setViewMode('menu'); await fetchMenuRows(1, [category.id]); };

  const openMenuRow = async (row: MenuRow) => { if (row.Type !== 'C') return; const nextCodes = [...menuCodes, row.Level]; const nextLabels = [...menuLabels, row.LDes]; const nextLevel = menuLevel + 1; setMenuCodes(nextCodes); setMenuLabels(nextLabels); setMenuLevel(nextLevel); await fetchMenuRows(nextLevel, nextCodes); };

  const goBackOneMenuLevel = async () => { if (menuLevel <= 1) { setViewMode('categories'); setActiveCategory(null); setMenuRows([]); setMenuCodes([]); setMenuLabels([]); setMenuLevel(1); return; } const nextCodes = menuCodes.slice(0, -1); const nextLabels = menuLabels.slice(0, -1); const nextLevel = menuLevel - 1; setMenuCodes(nextCodes); setMenuLabels(nextLabels); setMenuLevel(nextLevel); await fetchMenuRows(nextLevel, nextCodes); };

  const headerH = isTablet ? 250 : isSmall ? 65 : 200;
  const titleSize = isTablet ? 32 : isSmall ? 16 : 24;
  const hPad = isTablet ? 20 : 16;
  const badgeFs = isTablet ? 16 : isSmall ? 11 : 12;
  const badgePadH = isTablet ? 16 : isSmall ? 10 : 12;
  const badgePadV = isTablet ? 12 : isSmall ? 5 : 6;
  const sectionFont = isTablet ? 20 : isSmall ? 10 : 12;
  const gridGap = isTablet ? 16 : isSmall ? 10 : 12;
  const breadFs = isTablet ? 14 : isSmall ? 11 : 12;

  const headerTitle = viewMode === 'categories' ? 'Item Selection' : menuLabels[menuLabels.length - 1] ?? activeCategory?.label ?? 'Menu';
  const sectionLabel = viewMode === 'categories' ? `CATEGORIES — ${categoriesList.length}` : `${menuLabels[menuLabels.length - 1]?.toUpperCase() ?? activeCategory?.label.toUpperCase() ?? 'MENU'} — ${menuRows.length} ITEMS`;

  const handleBack = () => { if (viewMode === 'categories') router.back(); else if (menuLevel > 1) goBackOneMenuLevel(); else { setViewMode('categories'); setActiveCategory(null); setMenuRows([]); setMenuCodes([]); setMenuLabels([]); setMenuLevel(1); } };

  const getCartQuantity = (menuItemCode: string) => {
    const normalizedCode = normalizeMenuItemCode(menuItemCode);
    return cartItems.find((item) => item.menuItemCode === normalizedCode)?.quantity ?? 0;
  };
  const getCartRemarks = (menuItemCode: string) => {
    const normalizedCode = normalizeMenuItemCode(menuItemCode);
    return cartItems.find((item) => item.menuItemCode === normalizedCode)?.itemRemarks ?? '';
  };
  const selectedItemCount: number = cartItems.reduce((sum: number, item) => sum + item.quantity, 0);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (value?: string) => !normalizedSearch || (value ?? '').toLowerCase().includes(normalizedSearch);

  const filteredCategories = categoriesList.filter((cat) => matchesSearch(cat.label) || matchesSearch(cat.id));
  const filteredMenuRows = menuRows.filter((row) => matchesSearch(row.LDes) || matchesSearch(row.Level) || matchesSearch(row.Type));
  const categoriesRows = filteredMenuRows.filter((r) => r.Type === 'C');
  const itemsRows = filteredMenuRows.filter((r) => r.Type === 'I');

  const tableInfo = [{ label: 'Table', value: tableName ?? '—' }, { label: 'Floor', value: floor ?? '—' }];

  const getStoredCartItem = (menuItemCode: string) => {
    const normalizedCode = normalizeMenuItemCode(menuItemCode);
    return cartItems.find((item) => item.menuItemCode === normalizedCode) ?? null;
  };

  const syncSelectedRemarksToCart = (remarks: string[], item = selectedItem) => {
    if (!item) return;

    const normalizedKey = normalizeMenuItemCode(item.key);
    const existingCartItem = getStoredCartItem(normalizedKey);
    const safeQuantity = Math.max(1, existingCartItem?.quantity ?? 1);

    upsertCartItem({
      menuItemCode: normalizedKey,
      menuItmDes: item.label,
      salesPrice: Number(item.price) || 0,
      itemRemarks: normalizeRemarkTags(remarks).join(', '),
      quantity: safeQuantity,
    });
  };

  const openItemDetails = (item: { key: string; label: string; price?: number; icon?: ImageSourcePropType }) => {
    const normalizedKey = normalizeMenuItemCode(item.key);
    const existingCartItem = getStoredCartItem(normalizedKey);

    if (!existingCartItem) {
      upsertCartItem({
        menuItemCode: normalizedKey,
        menuItmDes: item.label,
        salesPrice: Number(item.price) || 0,
        itemRemarks: '',
        quantity: 1,
      });
    }

    setSelectedItem({ ...item, key: normalizedKey });
    setSelectedRemarks(splitRemarkTags(existingCartItem?.itemRemarks));
    setCurrentTypedText('');
    setIsViewingPresets(false);
    setItemDetailsVisible(true);
  };
  const closeItemDetails = () => {
    setItemDetailsVisible(false);
    setSelectedItem(null);
    setSelectedRemarks([]);
    setCurrentTypedText('');
    setIsViewingPresets(false);
    setEditingTagIndex(null);
  };

  const loadRemarkOptions = async () => {
    setLoadingRemarkOptions(true);
    try {
      const descriptions = await apiClient.getOrderDescriptions();
      console.log('Fetched database remarks:', descriptions);
      if (descriptions.length > 0) {
        setRemarkOptions(descriptions);
      } else {
        console.log('No database remarks found, using fallback presets.');
        setRemarkOptions(FALLBACK_REMARK_TAG_PRESETS);
      }
    } catch (error) {
      console.log('Failed to fetch database remarks:', error);
      setRemarkOptions(FALLBACK_REMARK_TAG_PRESETS);
    } finally {
      setLoadingRemarkOptions(false);
    }
  };

  const editRemarkTag = (tag: string, index: number) => {
    setCurrentTypedText(tag);
    setEditingTagIndex(index);
    setSelectedRemarks((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const addRemarkTag = (tag: string) => {
    const trimmedTag = String(tag ?? '').trim();
    if (!trimmedTag) return;

    setSelectedRemarks((current) => {
      if (editingTagIndex !== null) {
        const nextRemarks = [...current];
        const insertAt = Math.max(0, Math.min(editingTagIndex, nextRemarks.length));
        nextRemarks.splice(insertAt, 0, trimmedTag);
        syncSelectedRemarksToCart(nextRemarks);
        return nextRemarks;
      }

      if (current.includes(trimmedTag)) return current;
      const nextRemarks = [...current, trimmedTag];
      syncSelectedRemarksToCart(nextRemarks);
      return nextRemarks;
    });

    setEditingTagIndex(null);
  };

  const removeRemarkTag = (tag: string) => {
    setSelectedRemarks((current) => {
      const nextRemarks = current.filter((entry) => entry !== tag);
      syncSelectedRemarksToCart(nextRemarks);
      return nextRemarks;
    });
  };

  const handleAddTypedTag = () => {
    const trimmedText = currentTypedText.trim();
    if (!trimmedText) return;

    addRemarkTag(trimmedText);
    setCurrentTypedText('');
  };

  const handlePresetRemarkSelect = (preset: string) => {
    addRemarkTag(preset);
    setCurrentTypedText('');
    setIsViewingPresets(false);
  };

  const handleSaveSelectedItem = () => {
    const trimmedText = currentTypedText.trim();
    const nextRemarks = [...selectedRemarks];

    if (trimmedText) {
      if (editingTagIndex !== null) {
        const insertAt = Math.max(0, Math.min(editingTagIndex, nextRemarks.length));
        nextRemarks.splice(insertAt, 0, trimmedText);
      } else {
        nextRemarks.push(trimmedText);
      }
    }

    const normalizedNextRemarks = normalizeRemarkTags(nextRemarks);

    if (selectedItem) {
      syncSelectedRemarksToCart(normalizedNextRemarks, selectedItem);
    }

    setSelectedRemarks(normalizedNextRemarks);
    setCurrentTypedText('');
    setIsViewingPresets(false);
    setEditingTagIndex(null);
    closeItemDetails();
  };

  const isInitialLoading = !isCacheHydrated;

  if (isInitialLoading) return (<SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#002748" /></SafeAreaView>);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />
      <View style={[styles.header, { height: headerH, paddingHorizontal: hPad }]}> 
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={[styles.backButton, { width: 40, height: 40, borderRadius: 20 }]} onPress={handleBack}>
            <Image source={require('../../assets/icons/back.png')} style={{ width: 40, height: 40, tintColor: '#FFF' }} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: titleSize }]} numberOfLines={1}>{headerTitle}</Text>
          <TouchableOpacity style={[styles.tableBadge, { paddingHorizontal: badgePadH, paddingVertical: badgePadV }]} onPress={() => setDropdownVisible(true)} activeOpacity={0.8}><Text style={[styles.tableBadgeText, { fontSize: badgeFs }]}>{tableName ?? 'Table'}</Text><View style={styles.dropdownArrow} /></TouchableOpacity>
        </View>
        <View style={styles.searchWrap}><TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder={viewMode === 'menu' ? 'Search menu row or item code' : 'Search'} placeholderTextColor="rgba(255,255,255,0.75)" style={[styles.searchInput, { fontSize: isTablet ? 16 : 14 }]} /></View>
      </View>

      <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.dropdown, { right: hPad, top: headerH + 8, minWidth: isTablet ? 240 : 200 }]}>
                <View style={styles.dropdownHeader}>
                  <Text style={[styles.dropdownTitle, { fontSize: isTablet ? 16 : 14 }]}>Table Info</Text>
                  <TouchableOpacity onPress={() => setDropdownVisible(false)}><Text style={[styles.dropdownClose, { fontSize: isTablet ? 16 : 14 }]}>✕</Text></TouchableOpacity>
                </View>
                <View style={styles.divider} />
                {tableInfo.map((item, i) => (
                  <View key={i} style={styles.dropdownRow}><Text style={[styles.dropdownLabel, { fontSize: isTablet ? 14 : 13 }]}>{item.label}</Text><Text style={[styles.dropdownValue, { fontSize: isTablet ? 14 : 13 }]}>{item.value}</Text></View>
                ))}
                <View style={styles.divider} />
                <TouchableOpacity style={[styles.changeTableBtn, { paddingVertical: isTablet ? 12 : 10 }]} onPress={() => { setDropdownVisible(false); router.push('/Screens/tableselection'); }}><Text style={[styles.changeTableText, { fontSize: isTablet ? 14 : 13 }]}>Change Table</Text></TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {viewMode === 'categories' && (
        <View style={styles.fixedTabsArea}>
          <View style={styles.scrollContainer}><View style={styles.horizontalTabsRow}>{tabsList.map((tab) => { const isActive = selectedTabCode === tab.code; return (<TouchableOpacity key={tab.code} activeOpacity={0.8} onPress={() => setSelectedTabCode(tab.code)} style={[styles.scrollTab, isActive && styles.scrollTabActive]}><Text style={[styles.scrollTabLabel, isActive && styles.scrollTabLabelActive]}>{tab.label}</Text></TouchableOpacity>); })}</View></View>
          <Text style={[styles.sectionTitle, { fontSize: sectionFont, marginTop: 10, marginBottom: 0 }]}>{normalizedSearch ? `SEARCH RESULTS — ${filteredCategories.length}` : sectionLabel}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingHorizontal: hPad, paddingBottom: isTablet ? 180 : 140 }]}>
        {viewMode === 'menu' && (
          <View style={styles.breadcrumbRow}>
            <TouchableOpacity onPress={() => { setViewMode('categories'); setActiveCategory(null); setMenuRows([]); setMenuCodes([]); setMenuLabels([]); setMenuLevel(1); }}><Text style={[styles.breadLink, { fontSize: breadFs }]}>All Categories</Text></TouchableOpacity>
            {menuLabels.map((label, index) => (<React.Fragment key={`${label}-${index}`}><Text style={[styles.breadSep, { fontSize: breadFs }]}> › </Text><TouchableOpacity onPress={async () => { const nextCodes = menuCodes.slice(0, index + 1); const nextLabels = menuLabels.slice(0, index + 1); setMenuCodes(nextCodes); setMenuLabels(nextLabels); const nextLevel = index + 1; setMenuLevel(nextLevel); await fetchMenuRows(nextLevel, nextCodes); }}><Text style={[index === menuLabels.length - 1 ? styles.breadActive : styles.breadLink, { fontSize: breadFs }]}>{label}</Text></TouchableOpacity></React.Fragment>))}
          </View>
        )}

        {normalizedSearch ? (
          <>
            <Text style={styles.searchScopeText}>Searching the current menu level</Text>
            <View style={[styles.grid, { gap: gridGap }]}>
              {viewMode === 'categories' ? filteredCategories.map((cat, i) => (<ColorCard key={cat.id || i} label={cat.label} color={cat.color} icon={cat.icon} onPress={() => { openCategory(cat); }} />)) : (<>
                {categoriesRows.map((row, i) => (<ColorCard key={`${row.Level}-cat-${i}`} label={row.LDes} color="#E3F2FD" onPress={() => openMenuRow(row)} />))}
                {itemsRows.map((row, i) => (<ItemCard key={`${row.Level}-item-${i}`} label={row.LDes} price={Number(row.SalesPrice) || 0} quantity={getCartQuantity(row.Level)} remarks={getCartRemarks(row.Level)} onPressDetails={() => openItemDetails({ key: row.Level, label: row.LDes, price: Number(row.SalesPrice) || 0 })} onAdd={() => addToCart({ menuItemCode: row.Level, menuItmDes: row.LDes, salesPrice: Number(row.SalesPrice) || 0, itemRemarks: '' })} onIncrement={() => updateQuantity(row.Level, 1)} onDecrement={() => updateQuantity(row.Level, -1)} />))}
              </>) }
            </View>
          </>
        ) : (
          <>
            {viewMode === 'categories' && (<View style={[styles.grid, { gap: gridGap }]}>{filteredCategories.map((cat, i) => (<ColorCard key={cat.id || i} label={cat.label} color={cat.color} icon={cat.icon} onPress={() => { openCategory(cat); }} />))}</View>)}

            {viewMode === 'menu' && (<View style={[styles.grid, { gap: gridGap }]}>{categoriesRows.map((row, i) => (<ColorCard key={`${row.Level}-cat-${i}`} label={row.LDes} color="#E3F2FD" icon={row.icon} onPress={() => openMenuRow(row)} />))}{itemsRows.map((row, i) => (<ItemCard key={`${row.Level}-item-${i}`} label={row.LDes} price={Number(row.SalesPrice) || 0} icon={row.icon} quantity={getCartQuantity(row.Level)} remarks={getCartRemarks(row.Level)} onPressDetails={() => openItemDetails({ key: row.Level, label: row.LDes, price: Number(row.SalesPrice) || 0, icon: row.icon })} onAdd={() => addToCart({ menuItemCode: row.Level, menuItmDes: row.LDes, salesPrice: Number(row.SalesPrice) || 0, itemRemarks: '' })} onIncrement={() => updateQuantity(row.Level, 1)} onDecrement={() => updateQuantity(row.Level, -1)} />))}{(categoriesRows.length + itemsRows.length) % 3 !== 0 && (<View style={{ width: (width - 32 - 24) / 3 }} />)}</View>)}
          </>
        )}
      </ScrollView>

      <View style={styles.goToCartPanel}><View style={styles.goToCartSpace} /><View style={styles.goToCartRow}><TouchableOpacity style={styles.goToCartBtn} activeOpacity={0.9} onPress={() => { router.push({ pathname: '/Screens/cart', params: { tableName: tableName || '', localPax: localPax || '0', foreignPax: foreignPax || '0', floor: floor || '', status: status || '' } }); }}><Text style={styles.goToCartText}>Go to Cart</Text><View style={styles.goToCartBadge}><Text style={styles.goToCartBadgeText}>{selectedItemCount}</Text></View></TouchableOpacity></View></View>

      <Modal visible={itemDetailsVisible} transparent animationType="fade" onRequestClose={closeItemDetails}>
        <TouchableWithoutFeedback onPress={closeItemDetails}>
          <View style={styles.centerDetailsOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.centerDetailsCard}>
                {!isViewingPresets ? (
                  <>
                    <View style={styles.centerDetailsHeader}>
                      <Text style={styles.centerDetailsHeaderText}>Item Details</Text>
                      <TouchableOpacity onPress={closeItemDetails} activeOpacity={0.8}>
                        <Ionicons name="close" size={22} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.centerDetailsBody}>
                      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.centerDetailsContent} style={styles.centerDetailsScroll}>
                        <View style={styles.sheetImageWrap}>
                          <Image source={selectedItem?.icon ?? { uri: 'https://placehold.co/402x176' }} style={styles.sheetImage} resizeMode="cover" />
                        </View>

                        <View style={styles.sheetBodyWrap}>
                          <Text style={styles.sheetTitle} numberOfLines={2}>{selectedItem?.label?.toUpperCase() ?? ''}</Text>

                          {selectedRemarks.length > 0 && (
                            <View style={styles.tagRowWrap}>
                              {selectedRemarks.map((tag, index) => (
                                <View key={`${tag}-${index}`} style={styles.tagChip}>
                                  <TouchableOpacity onPress={() => editRemarkTag(tag, index)} activeOpacity={0.8} style={styles.tagChipTextBtn}>
                                    <Text style={styles.tagChipText} numberOfLines={1}>{tag}</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => removeRemarkTag(tag)} activeOpacity={0.85} style={styles.tagChipRemoveBtn}>
                                    <Ionicons name="close" size={13} color="#FFF" />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}

                          <View style={styles.remarkSectionWrap}>
                            <View style={styles.remarkInputRow}>
                              <View style={styles.remarkInputShell}>
                                <TextInput
                                  value={currentTypedText}
                                  onChangeText={setCurrentTypedText}
                                  placeholder="Type a custom remark"
                                  placeholderTextColor="rgba(0,0,0,0.42)"
                                  style={styles.remarkInput}
                                  multiline={false}
                                  returnKeyType="done"
                                  onSubmitEditing={handleAddTypedTag}
                                />

                                <TouchableOpacity
                                  style={styles.remarkDropdownIconBtn}
                                  activeOpacity={0.8}
                                  onPress={() => setIsViewingPresets(true)}
                                >
                                  <Ionicons name="chevron-down" size={18} color="#0062AA" />
                                </TouchableOpacity>
                              </View>

                              <TouchableOpacity style={styles.addTagBtn} activeOpacity={0.9} onPress={handleAddTypedTag}>
                                <Text style={styles.addTagBtnText}>+ ADD TAG</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </ScrollView>

                      <TouchableOpacity style={styles.saveBtn} activeOpacity={0.9} onPress={handleSaveSelectedItem}>
                        <Text style={styles.saveBtnText}>SAVE REMARKS</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.presetsHeader}>
                      <TouchableOpacity onPress={() => setIsViewingPresets(false)} activeOpacity={0.8} style={styles.presetsBackBtn}>
                        <Ionicons name="arrow-back" size={20} color="#0F172A" />
                      </TouchableOpacity>
                      <Text style={styles.presetsHeaderText}>Select Preset Remark</Text>
                      <TouchableOpacity onPress={closeItemDetails} activeOpacity={0.8} style={styles.presetsCloseBtn}>
                        <Ionicons name="close" size={20} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.presetsDivider} />

                    {loadingRemarkOptions ? (
                      <View style={styles.centerModalLoaderWrap}>
                        <ActivityIndicator size="small" color="#002748" />
                      </View>
                    ) : (
                      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.presetsListContent}>
                        {remarkOptions.map((preset, index) => (
                          <TouchableOpacity
                            key={`${preset}-${index}`}
                            style={styles.presetsRow}
                            activeOpacity={0.85}
                            onPress={() => handlePresetRemarkSelect(preset)}
                          >
                            <Text style={styles.presetsRowText}>{preset}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: { backgroundColor: '#002748', justifyContent: 'center' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {},
  headerTitle: { fontWeight: '700', color: '#FFF', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  tableBadge: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, alignItems: 'center', gap: 6 },
  tableBadgeText: { color: '#FFF', fontWeight: '600' },
  dropdownArrow: { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFF' },
  searchWrap: { marginTop: 32 },
  searchInput: { width: '100%', height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', color: '#FFF', paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  fixedTabsArea: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 16 },
  scrollContainer: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 12 },
  horizontalTabsRow: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  scrollTab: { minHeight: 38, maxWidth: '31%', flexShrink: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  scrollTabActive: { backgroundColor: '#002748', borderColor: '#002748', shadowOpacity: 0.12, elevation: 3 },
  scrollTabLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', textAlign: 'center' },
  scrollTabLabelActive: { color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  dropdown: { position: 'absolute', backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 8, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  dropdownTitle: { fontWeight: '700', color: '#002748' },
  dropdownClose: { color: '#888', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 4 },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  dropdownLabel: { color: '#666', fontWeight: '500' },
  dropdownValue: { color: '#000', fontWeight: '700' },
  changeTableBtn: { marginHorizontal: 12, marginTop: 4, marginBottom: 6, backgroundColor: '#002748', borderRadius: 10, alignItems: 'center' },
  changeTableText: { color: '#FFF', fontWeight: '700' },
  content: { paddingTop: 4 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginTop: 8, flexWrap: 'wrap' },
  breadLink: { color: '#0062AA', fontWeight: '500' },
  breadSep: { color: '#999' },
  breadActive: { color: '#002748', fontWeight: '700' },
  sectionTitle: { fontWeight: '700', color: '#666', marginBottom: 12 },
  searchScopeText: { color: '#6B7280', fontSize: 12, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  colorCard: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 10, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, marginBottom: 12 },
  colorCardDeco: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.18)', top: -15, right: -15 },
  iconPlaceholder: { backgroundColor: 'rgba(255,255,255,0.4)' },
  colorCardText: { fontWeight: '600', textAlign: 'center', color: '#000', marginTop: 4 },
  itemCard: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 14, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, alignItems: 'center', paddingBottom: 10 },
  itemTopArea: { alignItems: 'center', width: '100%' },
  itemImageBox: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE' },
  fillImage: { width: '100%', height: '100%' },
  itemLabel: { fontWeight: '600', color: '#000', marginTop: 8, paddingHorizontal: 6, textAlign: 'center' },
  itemPrice: { color: '#666', fontWeight: '500', marginTop: 2 },
  cardRemarksWrap: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 6, justifyContent: 'center' },
  cardRemarkChip: { backgroundColor: '#F1F5F9', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, maxWidth: '100%' },
  cardRemarkText: { color: '#475569', fontSize: 10, fontWeight: '600' },
  addBtn: { backgroundColor: '#F2DDCB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 4, marginTop: 8 },
  qtyAddBtn: { backgroundColor: '#F2DDCB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 4, alignSelf: 'center', minWidth: 86, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#333', fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBtn: { backgroundColor: '#EEE', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  qtyBtnText: { fontWeight: '700', color: '#222' },
  qtyNumber: { fontWeight: '700', color: '#222', minWidth: 28, textAlign: 'center' },
  goToCartPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', paddingTop: 10, paddingBottom: 24, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8 },
  goToCartSpace: { height: 8, width: '100%' },
  goToCartRow: { alignItems: 'center', justifyContent: 'center' },
  goToCartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#002748', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 50 },
  goToCartText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  goToCartBadge: { marginLeft: 10, minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#8D9ED4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  goToCartBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  bottomSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24, overflow: 'hidden' },
  sheetHandleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
  sheetHandle: { alignSelf: 'center', width: 54, height: 5, borderRadius: 999, backgroundColor: '#D9D9D9' },
  sheetImageWrap: { position: 'relative', marginHorizontal: 18, borderRadius: 18, overflow: 'hidden', backgroundColor: '#D9D9D9' },
  sheetImage: { width: '100%', height: 220, backgroundColor: '#D9D9D9' },
  sheetBodyWrap: { flex: 1, paddingHorizontal: 18, paddingTop: 18 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#000', letterSpacing: 0.8, textTransform: 'uppercase' },
  tagRowWrap: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#002748', borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 8, maxWidth: '100%' },
  tagChipTextBtn: { flexShrink: 1, marginRight: 6 },
  tagChipText: { color: '#FFF', fontSize: 13, fontWeight: '700', marginRight: 6, maxWidth: 170 },
  tagChipRemoveBtn: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  remarkSectionWrap: { marginTop: 16 },
  remarkInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  remarkInputShell: { position: 'relative', flex: 1 },
  remarkInput: { width: '100%', height: 48, borderWidth: 1.5, borderColor: 'rgba(0,98,170,0.35)', borderRadius: 12, paddingLeft: 12, paddingRight: 44, color: '#000', fontSize: 15, backgroundColor: '#FFF', textAlignVertical: 'center' },
  remarkDropdownIconBtn: { position: 'absolute', right: 8, top: 0, bottom: 0, width: 36, alignItems: 'center', justifyContent: 'center' },
  centerDetailsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  centerDetailsCard: { width: '90%', maxWidth: 560, height: 540, backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', padding: 20, elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16 },
  centerDetailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  centerDetailsHeaderText: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  centerDetailsBody: { flex: 1 },
  centerDetailsScroll: { flex: 1 },
  centerDetailsContent: { paddingBottom: 18 },
  centerModalLoaderWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  presetsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presetsBackBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  presetsCloseBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  presetsHeaderText: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#0F172A' },
  presetsDivider: { height: 1, backgroundColor: '#E2E8F0', marginTop: 10, marginBottom: 8 },
  presetsListContent: { paddingVertical: 2 },
  presetsRow: { paddingHorizontal: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  presetsRowText: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  addTagBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(141,158,212,0.12)', borderWidth: 1, borderColor: 'rgba(141,158,212,0.35)' },
  addTagBtnText: { color: '#002748', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  saveBtn: { marginTop: 12, height: 56, borderRadius: 14, backgroundColor: '#8D9ED4', alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
});
