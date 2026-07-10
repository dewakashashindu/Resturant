import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient, getCachedOrderDescriptions } from '../../services/api';
import { useCartStore } from '../../services/cartStore';
import useItemStore from '../../services/itemStore';
import { useOrderStore } from '../../services/orderStore';
import { storage } from '../../services/storage';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

type SelectedItem = {
  key: string;
  label: string;
  price?: number;
  icon?: ImageSourcePropType;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_TABS: MainTab[] = [
  { code: 'F', label: 'Foods' },
  { code: 'B', label: 'Beverages' },
  { code: 'S', label: 'Siga' },
  { code: 'O', label: 'Others' },
];

const FALLBACK_REMARK_TAG_PRESETS = [
  'No Spicy', 'Less Spicy', 'Takeaway', 'No Onion', 'Extra Sauce', 'No Garlic',
];

const LEVEL_KEYS = [
  'Level1', 'Level2', 'Level3', 'Level4', 'Level5', 'Level6', 'Level7',
] as const;

const MENU_SNAPSHOT_KEY    = 'menu_items_cache_v1';
const CACHED_CATEGORIES_KEY = 'cached_categories';
const CACHED_ITEMS_KEY     = 'cached_items';
const COLUMNS              = 2;

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const normalizeMenuItemCode = (value: unknown) => String(value ?? '').trim();
const getText = (value: unknown) => String(value ?? '').trim();

const getSubCategoryCode = (item: Record<string, any>) =>
  getText(item.Level1 ?? item.level1 ?? item.CategoryLevel1 ?? item.level ?? item.code ?? item.id ?? '');

const getSubCategoryLabel = (item: Record<string, any>) =>
  getText(
    item.L1DES ?? item.L1Des ?? item.LDes ?? item.name ?? item.categoryName
    ?? item.category_name ?? item.SubCategoryName ?? item.subCategoryName ?? item.label,
  );

const isVisibleCachedItem = (item: Record<string, any>) => {
  const displayInFront = getText(item.DisplayInFront);
  const menuAssiEnable = getText(item.MenuAssiEnable);
  const menuItemEnable = getText(item.MenuItemEnable);
  const flags = [displayInFront, menuAssiEnable, menuItemEnable].filter(Boolean);
  if (flags.length === 0) return true;
  return flags.every((value) => value === '1' || value.toLowerCase() === 'true');
};

const getLevelValue = (item: Record<string, any>, level: number) =>
  getText(item[LEVEL_KEYS[level - 1]]);

const getLevelDescription = (item: Record<string, any>, level: number) => {
  const upperKey = `L${level}DES`;
  const mixedKey = `L${level}Des`;
  const lowerKey = mixedKey.toLowerCase();
  return getText(item[upperKey] ?? item[mixedKey] ?? item[lowerKey] ?? item.LDES ?? item.LDes);
};

const getMenuItemCode = (item: Record<string, any>) =>
  getText(item.MenuItemCode ?? item.ItemCode ?? item.ItemId ?? item.Level7 ?? item.Level ?? item.code);

const getMenuItemLabel = (item: Record<string, any>) =>
  getText(
    item.MenuItmDes ?? item.MenuItemDes ?? item.ItemName ?? item.itemName
    ?? item.label ?? item.LDes ?? getMenuItemCode(item),
  );

const getMenuItemPrice = (item: Record<string, any>) =>
  Number(item.SalesPrice ?? item.salesPrice ?? 0) || 0;

const toImageSource = (value: unknown): ImageSourcePropType | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const uri = value.trim();
    return uri ? { uri } : undefined;
  }
  return value as ImageSourcePropType;
};

const getMenuItemImageSource = (item: Record<string, any>) =>
  toImageSource(
    item.ItemImageUrl ?? item.ImageUrl ?? item.imageUrl
    ?? item.PhotoUrl ?? item.photoUrl ?? item.Image ?? item.image ?? item.icon,
  );

const splitRemarkTags = (value?: string) =>
  String(value ?? '').split(',').map((part) => part.trim()).filter(Boolean);

const normalizeRemarkTags = (values: string[]) =>
  values.map((part) => String(part ?? '').trim()).filter(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// CACHE READERS
// ─────────────────────────────────────────────────────────────────────────────

const readCachedMenuItems = () => {
  try {
    const rawSnapshot = storage.getString(MENU_SNAPSHOT_KEY);
    if (rawSnapshot) {
      const snapshot = JSON.parse(rawSnapshot);
      if (Array.isArray(snapshot?.items)) return snapshot.items;
    }
    const rawItems = storage.getString(CACHED_ITEMS_KEY);
    if (rawItems) {
      const parsedItems = JSON.parse(rawItems);
      if (Array.isArray(parsedItems)) return parsedItems;
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

// ─────────────────────────────────────────────────────────────────────────────
// DATA BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

const buildTabsFromItems = (items: Record<string, any>[]): MainTab[] => {
  const tabs = new Map<string, MainTab>();
  for (const item of items) {
    if (!isVisibleCachedItem(item)) continue;
    const code = getText(item.Category ?? item.CategoryCode ?? item.category);
    if (!code) continue;
    const label =
      getText(item.CategoryName ?? item.CategoryLabel ?? item.categoryName)
      || FALLBACK_TABS.find((tab) => tab.code === code)?.label
      || code;
    if (!tabs.has(code)) tabs.set(code, { code, label });
  }
  return Array.from(tabs.values());
};

const buildCategoriesFromItems = (
  items: Record<string, any>[],
  tabCode: string,
): DynamicCategory[] => {
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
  return Array.from(categories.values()).sort(
    (a, b) => a.listingOrder - b.listingOrder || a.label.localeCompare(b.label),
  );
};

const buildMenuRowsFromItems = (
  items: Record<string, any>[],
  codes: string[],
  level: number,
  tabCode?: string,
): MenuRow[] => {
  const rows = new Map<string, MenuRow>();
  const path = codes.filter(Boolean);
  for (const item of items) {
    if (!isVisibleCachedItem(item)) continue;
    if (tabCode) {
      const itemTabCode = getText(item.Category ?? item.CategoryCode ?? item.category);
      if (itemTabCode !== tabCode) continue;
    }
    let matchesPath = true;
    for (let i = 0; i < path.length; i += 1) {
      const code = i === 0 ? getSubCategoryCode(item) : getLevelValue(item, i + 1);
      if (String(code ?? '').trim() !== String(path[i] ?? '').trim()) {
        matchesPath = false;
        break;
      }
    }
    if (!matchesPath) continue;
    const nextLevel      = level + 1;
    const nextLevelValue = getLevelValue(item, nextLevel);
    const nextLevelDesc  = getLevelDescription(item, nextLevel);
    if (nextLevelValue) {
      if (!rows.has(nextLevelValue)) {
        rows.set(nextLevelValue, {
          Level: nextLevelValue,
          LDes: nextLevelDesc || nextLevelValue,
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

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — ColorCard
// ─────────────────────────────────────────────────────────────────────────────

interface ColorCardProps {
  label: string;
  color: string;
  icon?: ImageSourcePropType;
  onPress?: () => void;
  cardWidth: number;
}

const ColorCard = ({ label, color, icon, onPress, cardWidth }: ColorCardProps) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cs = getDynamicStyles(width, height, insets.bottom);

  const isTablet = width >= 600;
  const isSmall  = height < 700;
  const cardH    = cardWidth * (isTablet ? 0.55 : isSmall ? 0.65 : 0.60);
  const imgSize  = isTablet ? 66 : isSmall ? 38 : 46;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        cs.colorCard,
        { backgroundColor: color || '#E3F2FD', width: cardWidth, height: cardH },
      ]}
    >
      <View style={cs.colorCardDeco} />
      <View
        style={{
          width: imgSize,
          height: imgSize,
          marginBottom: 8,
          borderRadius: Math.round(imgSize / 8),
          overflow: 'hidden',
        }}
      >
        <Image
          source={icon ? icon : require('../../assets/icons/blackback.png')}
          style={{ width: '100%', height: '100%', transform: [{ rotate: '180deg' }] }}
          resizeMode="cover"
        />
      </View>
      <Text style={cs.colorCardText} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — ItemCard
// ─────────────────────────────────────────────────────────────────────────────

interface ItemCardProps {
  label: string;
  price?: number;
  icon?: ImageSourcePropType;
  onAdd?: () => void;
  quantity?: number;
  existingQty?: number;   // items already on the bill (read-only, shown as grey badge)
  remarks?: string;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onPressDetails?: () => void;
  path?: string[];
  cardWidth: number;
}

const ItemCard = ({
  label,
  price,
  icon,
  onAdd,
  quantity,
  existingQty = 0,
  remarks,
  onIncrement,
  onDecrement,
  onPressDetails,
  path,
  cardWidth,
}: ItemCardProps) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cs = getDynamicStyles(width, height, insets.bottom);

  const displayQuantity = quantity ?? 0;   // new qty (delta)
  const remarkTags      = normalizeRemarkTags(splitRemarkTags(remarks));
  const imgSize         = cardWidth - 4;

  return (
    <View style={[cs.itemCard, { width: cardWidth }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPressDetails} style={cs.itemTopArea}>
        <View style={[cs.itemImageBox, { width: imgSize, height: imgSize }]}>
          {icon ? (
            <Image source={icon} style={cs.fillImage} resizeMode="cover" />
          ) : (
            <Image
              source={{ uri: 'https://placehold.co/112x112' }}
              style={cs.fillImage}
              resizeMode="cover"
            />
          )}
        </View>
        <Text style={cs.itemLabel} numberOfLines={2}>
          {label}
        </Text>
      </TouchableOpacity>

      {price !== undefined && (
        <Text style={cs.itemPrice}>Rs. {price}</Text>
      )}

      {path?.length ? (
        <Text style={cs.pathText} numberOfLines={2}>
          {path.join(' > ')}
        </Text>
      ) : null}

      {remarkTags.length > 0 && (
        <View style={cs.cardRemarksWrap}>
          {remarkTags.map((tag, index) => (
            <View key={`${tag}-${index}`} style={cs.cardRemarkChip}>
              <Text style={cs.cardRemarkText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Existing-on-bill badge (grey, read-only) */}
      {existingQty > 0 && (
        <View style={cs.existingQtyBadge}>
          <Text style={cs.existingQtyText}>On bill: {existingQty}</Text>
        </View>
      )}

      <View style={cs.qtyRow}>
        {displayQuantity > 0 ? (
          <>
            <TouchableOpacity style={cs.qtyBtn} onPress={() => onDecrement?.()} activeOpacity={0.8}>
              <Text style={cs.qtyBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={cs.qtyNumber}>{displayQuantity}</Text>
            <TouchableOpacity style={cs.qtyBtn} onPress={() => onIncrement?.()} activeOpacity={0.8}>
              <Text style={cs.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={cs.qtyAddBtn} onPress={() => onAdd?.()} activeOpacity={0.8}>
            <Text style={cs.addBtnText}>{existingQty > 0 ? 'ADD MORE +' : 'ADD +'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ItemSelection() {
  const router = useRouter();
  const { tableName, localPax, foreignPax, status, floor, fromBilling, tableNo, invoiceNo } =
    useLocalSearchParams<{
      tableName: string;
      localPax: string;
      foreignPax: string;
      status?: string;
      floor?: string;
      fromBilling?: string;
      tableNo?: string;      
      invoiceNo?: string;
    }>();

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = getDynamicStyles(width, height, insets.bottom);

  const cardWidth = (width - s.hPad * 2 - s.gridGap) / COLUMNS;

  // ── Store ────────────────────────────────────────────────────────────────
  const storeItems    = useItemStore((state) => state.items);
  const storeHydrated = useItemStore((state) => state.isHydrated);
  const hydrateItems  = useItemStore((state) => state.hydrateItems);

  const cartItems      = useCartStore((state) => state.cartItems);
  const addToCart      = useCartStore((state) => state.addToCart);
  const upsertCartItem = useCartStore((state) => state.upsertCartItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const orderType      = useCartStore((state) => state.orderType);
  const clearCart      = useCartStore((state) => state.clearCart);

  // When arriving from billing ("Add More"), lastConfirmedOrder holds the
  // items already on the bill.  We use this to:
  //  • show existing qty on each card (grey, read-only)
  //  • compute the DELTA qty the user is adding on top
  const lastConfirmedOrder = useOrderStore((state) => state.lastConfirmedOrder);
  const isFromBilling = fromBilling === '1';

  // Build a quick lookup: menuItemCode → existing qty on the current bill
  const existingQtyByCode = useMemo<Record<string, number>>(() => {
    if (!isFromBilling || !lastConfirmedOrder?.items?.length) return {};
    const map: Record<string, number> = {};
    for (const it of lastConfirmedOrder.items) {
      map[it.menuItemCode] = (map[it.menuItemCode] ?? 0) + Number(it.quantity ?? 0);
    }
    return map;
  }, [isFromBilling, lastConfirmedOrder]);

  // ── Cache state ──────────────────────────────────────────────────────────
  const [cachedItems, setCachedItems]           = useState<Record<string, any>[]>([]);
  const [cachedCategories, setCachedCategories] = useState<Record<string, any>[]>([]);
  const [isCacheHydrated, setIsCacheHydrated]   = useState(false);

  // ── Navigation / tab state ───────────────────────────────────────────────
  const [tabsList, setTabsList]               = useState<MainTab[]>([]);
  const [selectedTabCode, setSelectedTabCode] = useState('');
  const [categoriesList, setCategoriesList]   = useState<DynamicCategory[]>([]);
  const [menuRows, setMenuRows]               = useState<MenuRow[]>([]);

  // ── View / menu state ────────────────────────────────────────────────────
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [viewMode, setViewMode]               = useState<ViewMode>('categories');
  const [activeCategory, setActiveCategory]   = useState<DynamicCategory | null>(null);
  const [menuLevel, setMenuLevel]             = useState(1);
  const [menuCodes, setMenuCodes]             = useState<string[]>([]);
  const [menuLabels, setMenuLabels]           = useState<string[]>([]);
  const [searchQuery, setSearchQuery]         = useState('');

  // ── Item details modal state ─────────────────────────────────────────────
  const [selectedItem, setSelectedItem]                 = useState<SelectedItem | null>(null);
  const [itemDetailsVisible, setItemDetailsVisible]     = useState(false);
  const [selectedRemarks, setSelectedRemarks]           = useState<string[]>([]);
  const [currentTypedText, setCurrentTypedText]         = useState('');
  const [isViewingPresets, setIsViewingPresets]         = useState(false);
  const [remarkOptions, setRemarkOptions]               = useState<string[]>(() => getCachedOrderDescriptions());
  const [loadingRemarkOptions, setLoadingRemarkOptions] = useState(false);
  const [editingTagIndex, setEditingTagIndex]           = useState<number | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const normalizedSearch  = searchQuery.trim().toLowerCase();
  // When fromBilling, show only the count of NEWLY added items (delta)
  const selectedItemCount = cartItems.reduce((sum, item) => {
    if (isFromBilling) {
      const existingQty = existingQtyByCode[item.menuItemCode] ?? 0;
      return sum + Math.max(0, item.quantity - existingQty);
    }
    return sum + item.quantity;
  }, 0);

  const headerTitle =
    viewMode === 'categories'
      ? 'Item Selection'
      : menuLabels[menuLabels.length - 1] ?? activeCategory?.label ?? 'Menu';

  const sectionLabel =
    viewMode === 'categories'
      ? `CATEGORIES — ${categoriesList.length}`
      : `${
          menuLabels[menuLabels.length - 1]?.toUpperCase()
          ?? activeCategory?.label.toUpperCase()
          ?? 'MENU'
        } — ${menuRows.length} ITEMS`;

  const tableInfo = [
    { label: 'Table', value: tableName ?? '—' },
    { label: 'Floor', value: floor ?? '—' },
  ];

  // ── Effects ──────────────────────────────────────────────────────────────

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
    if (storeItems.length > 0) { setCachedItems(storeItems); return; }
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
        const mappedCategories = cachedCategories
          .map((cat) => ({
            id: String(cat.id ?? cat.Level ?? '').trim(),
            label: getSubCategoryLabel(cat) || String(cat.id ?? cat.Level ?? '').trim(),
            type: String(cat.type ?? cat.Type ?? 'C'),
            price: Number(cat.price ?? cat.SalesPrice ?? 0),
            listingOrder: Number(cat.listingOrder ?? cat.L1LitingOrder ?? 0),
            color: String(cat.color ?? '#E3F2FD'),
            icon: getMenuItemImageSource(cat),
          }))
          .filter((cat) => Boolean(cat.id));
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
    if (!cachedItems.length) { setCategoriesList([]); return; }
    setCategoriesList(buildCategoriesFromItems(cachedItems, selectedTabCode));
  }, [cachedItems, selectedTabCode]);

  useEffect(() => {
    if (!cachedItems.length || viewMode !== 'menu' || menuCodes.length === 0) {
      if (!cachedItems.length) setMenuRows([]);
      return;
    }
    setMenuRows(buildMenuRowsFromItems(cachedItems, menuCodes, menuLevel, selectedTabCode));
  }, [cachedItems, menuCodes, menuLevel, viewMode, selectedTabCode]);

  useEffect(() => {
    setRemarkOptions(getCachedOrderDescriptions());
  }, []);

  // ── Search expand state ──────────────────────────────────────────────────
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  const openSearchBar = () => {
    setIsSearchOpen(true);
    Animated.timing(searchBarAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  };

  const closeSearchBar = () => {
    setSearchQuery('');
    searchInputRef.current?.blur();
    Animated.timing(searchBarAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: false,
    }).start(() => {
      setIsSearchOpen(false);
    });
  };

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
    if (!selectedTabCode) { setCategoriesList([]); return; }
    setCategoriesList(buildCategoriesFromItems(cachedItems, selectedTabCode));
  }, [cachedItems, selectedTabCode]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const fetchMenuRows = async (level: number, codes: string[]) => {
    setMenuRows(buildMenuRowsFromItems(cachedItems, codes, level, selectedTabCode));
  };

  const openCategory = async (category: DynamicCategory) => {
    setActiveCategory(category);
    setMenuLevel(1);
    setMenuCodes([category.id]);
    setMenuLabels([category.label]);
    setViewMode('menu');
    await fetchMenuRows(1, [category.id]);
  };

  const openMenuRow = async (row: MenuRow) => {
    if (row.Type !== 'C') return;
    const nextCodes  = [...menuCodes, row.Level];
    const nextLabels = [...menuLabels, row.LDes];
    const nextLevel  = menuLevel + 1;
    setMenuCodes(nextCodes);
    setMenuLabels(nextLabels);
    setMenuLevel(nextLevel);
    await fetchMenuRows(nextLevel, nextCodes);
  };

  const goBackOneMenuLevel = async () => {
    if (menuLevel <= 1) {
      setSearchQuery('');
      setViewMode('categories');
      setActiveCategory(null);
      setMenuRows([]);
      setMenuCodes([]);
      setMenuLabels([]);
      setMenuLevel(1);
      return;
    }
    const nextCodes  = menuCodes.slice(0, -1);
    const nextLabels = menuLabels.slice(0, -1);
    const nextLevel  = menuLevel - 1;
    setMenuCodes(nextCodes);
    setMenuLabels(nextLabels);
    setMenuLevel(nextLevel);
    await fetchMenuRows(nextLevel, nextCodes);
  };

  const handleBack = () => {
    setSearchQuery('');
    if (viewMode === 'categories') router.back();
    else if (menuLevel > 1) goBackOneMenuLevel();
    else {
      setViewMode('categories');
      setActiveCategory(null);
      setMenuRows([]);
      setMenuCodes([]);
      setMenuLabels([]);
      setMenuLevel(1);
    }
  };

  const handleTabPress = (tabCode: string) => {
    setSelectedTabCode(tabCode);
    setViewMode('categories');
    setActiveCategory(null);
    setMenuRows([]);
    setMenuCodes([]);
    setMenuLabels([]);
    setMenuLevel(1);
    setSearchQuery('');
  };

  const getCartQuantity = (menuItemCode: string) => {
    const normalizedCode = normalizeMenuItemCode(menuItemCode);
    const totalQty = cartItems.find((item) => item.menuItemCode === normalizedCode)?.quantity ?? 0;
    if (isFromBilling) {
      // Show only the NEW qty added on top of what's already on the bill
      const existingQty = existingQtyByCode[normalizedCode] ?? 0;
      return Math.max(0, totalQty - existingQty);
    }
    return totalQty;
  };

  // How many items are already on the bill for this code (shown as a grey badge)
  const getExistingQty = (menuItemCode: string) => {
    if (!isFromBilling) return 0;
    return existingQtyByCode[normalizeMenuItemCode(menuItemCode)] ?? 0;
  };

  const getCartRemarks = (menuItemCode: string) => {
    const normalizedCode = normalizeMenuItemCode(menuItemCode);
    return cartItems.find((item) => item.menuItemCode === normalizedCode)?.itemRemarks ?? '';
  };

  const getStoredCartItem = (menuItemCode: string) => {
    const normalizedCode = normalizeMenuItemCode(menuItemCode);
    return cartItems.find((item) => item.menuItemCode === normalizedCode) ?? null;
  };

  const syncSelectedRemarksToCart = (remarks: string[], item = selectedItem) => {
    if (!item) return;
    const normalizedKey    = normalizeMenuItemCode(item.key);
    const existingCartItem = getStoredCartItem(normalizedKey);
    const safeQuantity     = Math.max(1, existingCartItem?.quantity ?? 1);
    upsertCartItem({
      menuItemCode: normalizedKey,
      menuItmDes:   item.label,
      salesPrice:   Number(item.price) || 0,
      itemRemarks:  normalizeRemarkTags(remarks).join(', '),
      quantity:     safeQuantity,
    });
  };

  const openItemDetails = (item: {
    key: string;
    label: string;
    price?: number;
    icon?: ImageSourcePropType;
  }) => {
    const normalizedKey    = normalizeMenuItemCode(item.key);
    const existingCartItem = getStoredCartItem(normalizedKey);
    if (!existingCartItem) {
      upsertCartItem({
        menuItemCode: normalizedKey,
        menuItmDes:   item.label,
        salesPrice:   Number(item.price) || 0,
        itemRemarks:  '',
        quantity:     1,
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
      if (descriptions.length > 0) setRemarkOptions(descriptions);
      else setRemarkOptions(FALLBACK_REMARK_TAG_PRESETS);
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
    setSelectedRemarks((current) => current.filter((_, i) => i !== index));
  };

  const addRemarkTag = (tag: string) => {
    const trimmedTag = String(tag ?? '').trim();
    if (!trimmedTag) return;
    setSelectedRemarks((current) => {
      if (editingTagIndex !== null) {
        const nextRemarks = [...current];
        const insertAt    = Math.max(0, Math.min(editingTagIndex, nextRemarks.length));
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
    if (selectedItem) syncSelectedRemarksToCart(normalizedNextRemarks, selectedItem);
    setSelectedRemarks(normalizedNextRemarks);
    setCurrentTypedText('');
    setIsViewingPresets(false);
    setEditingTagIndex(null);
    closeItemDetails();
  };

  // ── Search memo ──────────────────────────────────────────────────────────

  const globalSearchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    const seen = new Set<string>();
    return cachedItems
      .filter((item) => {
        if (!isVisibleCachedItem(item)) return false;
        const itemCode = getMenuItemCode(item);
        if (!itemCode) return false;
        if (selectedTabCode) {
          const itemTabCode = getText(item.Category ?? item.CategoryCode ?? item.category);
          if (itemTabCode !== selectedTabCode) return false;
        }
        const searchableFields = [
          item.MenuItemCode, item.ItemCode, item.MenuItmDes,
          item.L1Des, item.L2Des, item.L3Des, item.L4Des,
          item.L5Des, item.L6Des, item.L7Des,
          item.Level1, item.Level2, item.Level3, item.Level4,
          item.Level5, item.Level6, item.Level7,
        ];
        return searchableFields.some((field) =>
          String(field ?? '').toLowerCase().includes(normalizedSearch),
        );
      })
      .map((item) => ({
        code:  getMenuItemCode(item),
        label: getMenuItemLabel(item),
        price: getMenuItemPrice(item),
        icon:  getMenuItemImageSource(item),
        path:  [item.L1Des, item.L2Des, item.L3Des, item.L4Des, item.L5Des, item.L6Des]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean),
      }))
      .filter((item) => {
        if (seen.has(item.code)) return false;
        seen.add(item.code);
        return true;
      });
  }, [normalizedSearch, cachedItems, selectedTabCode]);

  const matchesSearch = (value?: string) =>
    !normalizedSearch || (value ?? '').toLowerCase().includes(normalizedSearch);

  const filteredCategories = categoriesList.filter(
    (cat) => matchesSearch(cat.label) || matchesSearch(cat.id),
  );
  const filteredMenuRows = menuRows.filter(
    (row) => matchesSearch(row.LDes) || matchesSearch(row.Level) || matchesSearch(row.Type),
  );
  const categoriesRows = filteredMenuRows.filter((r) => r.Type === 'C');
  const itemsRows      = filteredMenuRows.filter((r) => r.Type === 'I');

  // ── Early return ─────────────────────────────────────────────────────────

  if (!isCacheHydrated) {
    return (
      <View
        style={[
          s.container,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color="#002748" />
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />

      {/* Navy notch fill */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: '#002748',
          zIndex: 0,
        }}
      />

      {/* ── Header ── */}
      <View
        style={[
          s.header,
          {
            height: s.headerH + insets.top,
            paddingTop: insets.top,
            paddingHorizontal: s.hPad,
          },
        ]}
      >
        <View style={s.headerTopRow}>
          <TouchableOpacity style={s.backButton} onPress={handleBack}>
            <Image
              source={require('../../assets/icons/back.png')}
              style={s.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={s.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>

          <TouchableOpacity
            style={s.tableBadge}
            onPress={() => setDropdownVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={s.tableBadgeText}>{tableName ?? 'Table'}</Text>
            <View style={s.dropdownArrow} />
          </TouchableOpacity>
        </View>



        {/* ── Tabs (left, scrollable) + Search icon (right, fixed) ── */}
        <View style={s.searchTabsRow}>

          {/* Tabs — shrink out to the left when search opens */}
          <Animated.View
            style={{
              width: searchBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [width - s.hPad * 3 - 38, 0],
              }),
              opacity: searchBarAnim.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [1, 0, 0],
              }),
              overflow: 'hidden',
            }}
            pointerEvents={isSearchOpen ? 'none' : 'auto'}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabsInHeaderContent}
            >
              {tabsList.map((tab) => {
                const isActive = selectedTabCode === tab.code;
                return (
                  <TouchableOpacity
                    key={tab.code}
                    activeOpacity={0.8}
                    onPress={() => handleTabPress(tab.code)}
                    style={[s.headerTab, isActive && s.headerTabActive]}
                  >
                    <Text style={[s.headerTabLabel, isActive && s.headerTabLabelActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Search input — expand in from the right */}
          <Animated.View
            style={{
              width: searchBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, width - s.hPad * 2 - 46],
              }),
              opacity: searchBarAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0, 1],
              }),
              overflow: 'hidden',
            }}
            pointerEvents={isSearchOpen ? 'auto' : 'none'}
          >
            <View style={s.searchExpandInner}>
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by item name or code..."
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={s.searchExpandInput}
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={closeSearchBar}
                activeOpacity={0.7}
                style={s.searchCloseBtn}
              >
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Search icon — always fixed right, never scrolls */}
          <TouchableOpacity
            style={s.searchIconBtn}
            activeOpacity={0.8}
            onPress={openSearchBar}
          >
            <Ionicons name="search" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* ── Section label inside header (blue area) ── */}
        <View style={s.sectionLabelInHeader}>
          <Text style={s.sectionTitleInHeader}>
            {normalizedSearch
              ? `SEARCH RESULTS — ${globalSearchResults.length} ITEMS`
              : sectionLabel}
          </Text>
        </View>
      </View>

      {/* ── Table info dropdown modal ── */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[s.dropdown, { right: s.hPad, top: s.headerH + 8 }]}>
                <View style={s.dropdownHeader}>
                  <Text style={s.dropdownTitle}>Table Info</Text>
                  <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                    <Text style={s.dropdownClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.divider} />
                {tableInfo.map((item, i) => (
                  <View key={i} style={s.dropdownRow}>
                    <Text style={s.dropdownLabel}>{item.label}</Text>
                    <Text style={s.dropdownValue}>{item.value}</Text>
                  </View>
                ))}
                <View style={s.divider} />
                <TouchableOpacity
                  style={s.changeTableBtn}
                  onPress={() => {
                    setDropdownVisible(false);
                    if (orderType === 'TA') router.push('/Screens/operation');
                    else router.push('/Screens/tableselection');
                  }}
                >
                  <Text style={s.changeTableText}>
                    {orderType === 'TA' ? 'Change Order' : 'Change Table'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Main scrollable content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          {
            paddingHorizontal: s.hPad,
            paddingBottom: s.contentBottomPad + insets.bottom,
          },
        ]}
      >
        {/* Breadcrumb */}
        {viewMode === 'menu' && (
          <View style={s.breadcrumbRow}>
            <TouchableOpacity
              onPress={() => {
                setViewMode('categories');
                setActiveCategory(null);
                setMenuRows([]);
                setMenuCodes([]);
                setMenuLabels([]);
                setMenuLevel(1);
              }}
            >
              <Text style={s.breadLink}>All Categories</Text>
            </TouchableOpacity>
            {menuLabels.map((label, index) => (
              <React.Fragment key={`${label}-${index}`}>
                <Text style={s.breadSep}> › </Text>
                <TouchableOpacity
                  onPress={async () => {
                    const nextCodes  = menuCodes.slice(0, index + 1);
                    const nextLabels = menuLabels.slice(0, index + 1);
                    setMenuCodes(nextCodes);
                    setMenuLabels(nextLabels);
                    const nextLevel = index + 1;
                    setMenuLevel(nextLevel);
                    await fetchMenuRows(nextLevel, nextCodes);
                  }}
                >
                  <Text
                    style={
                      index === menuLabels.length - 1 ? s.breadActive : s.breadLink
                    }
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Search results ── */}
        {normalizedSearch ? (
          <>
            <Text style={s.searchScopeText}>
              {globalSearchResults.length} result
              {globalSearchResults.length !== 1 ? 's' : ''} across all categories
            </Text>
            <View style={[s.grid, { gap: s.gridGap }]}>
              {globalSearchResults.length === 0 ? (
                <View style={s.emptySearchWrap}>
                  <Text style={s.emptySearchText}>
                    No items found for "{searchQuery}"
                  </Text>
                </View>
              ) : (
                globalSearchResults.map((item, i) => (
                  <ItemCard
                    key={`search-${item.code}-${i}`}
                    label={item.label}
                    price={item.price}
                    icon={item.icon}
                    path={item.path}
                    cardWidth={cardWidth}
                    quantity={getCartQuantity(item.code)}
                    existingQty={getExistingQty(item.code)}
                    remarks={getCartRemarks(item.code)}
                    onPressDetails={() =>
                      openItemDetails({
                        key:   item.code,
                        label: item.label,
                        price: item.price,
                        icon:  item.icon,
                      })
                    }
                    onAdd={() =>
                      addToCart({
                        menuItemCode: item.code,
                        menuItmDes:   item.label,
                        salesPrice:   item.price,
                        itemRemarks:  '',
                      })
                    }
                    onIncrement={() => updateQuantity(item.code, 1)}
                    onDecrement={() => updateQuantity(item.code, -1)}
                  />
                ))
              )}
            </View>
          </>
        ) : (
          <>
            {/* ── Categories grid ── */}
            {viewMode === 'categories' && (
              <View style={[s.grid, { gap: s.gridGap }]}>
                {filteredCategories.map((cat, i) => (
                  <ColorCard
                    key={cat.id || i}
                    label={cat.label}
                    color={cat.color}
                    icon={cat.icon}
                    cardWidth={cardWidth}
                    onPress={() => openCategory(cat)}
                  />
                ))}
                {filteredCategories.length % COLUMNS !== 0 && (
                  <View style={{ width: cardWidth }} />
                )}
              </View>
            )}

            {/* ── Menu grid ── */}
            {viewMode === 'menu' && (
              <View style={[s.grid, { gap: s.gridGap }]}>
                {categoriesRows.map((row, i) => (
                  <ColorCard
                    key={`${row.Level}-cat-${i}`}
                    label={row.LDes}
                    color="#E3F2FD"
                    icon={row.icon}
                    cardWidth={cardWidth}
                    onPress={() => openMenuRow(row)}
                  />
                ))}
                {itemsRows.map((row, i) => (
                  <ItemCard
                    key={`${row.Level}-item-${i}`}
                    label={row.LDes}
                    price={Number(row.SalesPrice) || 0}
                    icon={row.icon}
                    cardWidth={cardWidth}
                    quantity={getCartQuantity(row.Level)}
                    existingQty={getExistingQty(row.Level)}
                    remarks={getCartRemarks(row.Level)}
                    onPressDetails={() =>
                      openItemDetails({
                        key:   row.Level,
                        label: row.LDes,
                        price: Number(row.SalesPrice) || 0,
                        icon:  row.icon,
                      })
                    }
                    onAdd={() =>
                      addToCart({
                        menuItemCode: row.Level,
                        menuItmDes:   row.LDes,
                        salesPrice:   Number(row.SalesPrice) || 0,
                        itemRemarks:  '',
                      })
                    }
                    onIncrement={() => updateQuantity(row.Level, 1)}
                    onDecrement={() => updateQuantity(row.Level, -1)}
                  />
                ))}
                {(categoriesRows.length + itemsRows.length) % COLUMNS !== 0 && (
                  <View style={{ width: cardWidth }} />
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Go to Cart panel ── */}
      <View
        style={[
          s.goToCartPanel,
          { paddingBottom: s.cartPanelBottomPad + insets.bottom },
        ]}
      >
        <View style={s.goToCartSpace} />
        <View style={s.goToCartRow}>
          <TouchableOpacity
            style={s.goToCartBtn}
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: '/Screens/cart',
                params: {
                  tableName:   tableName   || '',
                  tableNo:     String(tableNo || tableName || ''), 
                  invoiceNo:   String(invoiceNo || ''),           
                  localPax:    localPax    || '0',
                  foreignPax:  foreignPax  || '0',
                  floor:       floor       || '',
                  status:      status      || '',
                  fromBilling: fromBilling || '',
                },
              })
            }
          >
            <Text style={s.goToCartText}>Go to Cart</Text>
            <View style={s.goToCartBadge}>
              <Text style={s.goToCartBadgeText}>{selectedItemCount}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Item Details Modal ── */}
      <Modal
        visible={itemDetailsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeItemDetails}
      >
        <TouchableWithoutFeedback onPress={closeItemDetails}>
          <View style={s.centerDetailsOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.centerDetailsCard}>
                {!isViewingPresets ? (
                  <>
                    <View style={s.centerDetailsHeader}>
                      <Text style={s.centerDetailsHeaderText}>Item Details</Text>
                      <TouchableOpacity onPress={closeItemDetails} activeOpacity={0.8}>
                        <Ionicons name="close" size={22} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={s.centerDetailsBody}>
                      <ScrollView
                        showsVerticalScrollIndicator
                        contentContainerStyle={s.centerDetailsContent}
                        style={s.centerDetailsScroll}
                      >
                        <View style={s.sheetImageWrap}>
                          <Image
                            source={
                              selectedItem?.icon ?? {
                                uri: 'https://placehold.co/402x176',
                              }
                            }
                            style={s.sheetImage}
                            resizeMode="cover"
                          />
                        </View>

                        <View style={s.sheetBodyWrap}>
                          <Text style={s.sheetTitle} numberOfLines={2}>
                            {selectedItem?.label?.toUpperCase() ?? ''}
                          </Text>

                          {selectedRemarks.length > 0 && (
                            <View style={s.tagRowWrap}>
                              {selectedRemarks.map((tag, index) => (
                                <View key={`${tag}-${index}`} style={s.tagChip}>
                                  <TouchableOpacity
                                    onPress={() => editRemarkTag(tag, index)}
                                    activeOpacity={0.8}
                                    style={s.tagChipTextBtn}
                                  >
                                    <Text style={s.tagChipText} numberOfLines={1}>
                                      {tag}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => removeRemarkTag(tag)}
                                    activeOpacity={0.85}
                                    style={s.tagChipRemoveBtn}
                                  >
                                    <Ionicons name="close" size={13} color="#FFF" />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}

                        </View>
                      </ScrollView>

                      {/* Input row - always visible, never scrolls away */}
                      <View style={s.remarkSectionWrap}>
                        <View style={s.remarkInputRow}>
                          <View style={s.remarkInputShell}>
                            <TextInput
                              value={currentTypedText}
                              onChangeText={setCurrentTypedText}
                              placeholder="Type a custom remark"
                              placeholderTextColor="rgba(0,0,0,0.42)"
                              style={s.remarkInput}
                              multiline={false}
                              returnKeyType="done"
                              onSubmitEditing={handleAddTypedTag}
                            />
                            <TouchableOpacity
                              style={s.remarkDropdownIconBtn}
                              activeOpacity={0.8}
                              onPress={() => setIsViewingPresets(true)}
                            >
                              <Ionicons
                                name="chevron-down"
                                size={18}
                                color="#0062AA"
                              />
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={s.addTagBtn}
                            activeOpacity={0.9}
                            onPress={handleAddTypedTag}
                          >
                            <Text style={s.addTagBtnText}>+ ADD TAG</Text>
                          </TouchableOpacity>
                        </View>
                      </View>


                      <TouchableOpacity
                        style={s.saveBtn}
                        activeOpacity={0.9}
                        onPress={handleSaveSelectedItem}
                      >
                        <Text style={s.saveBtnText}>SAVE REMARKS</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={s.presetsHeader}>
                      <TouchableOpacity
                        onPress={() => setIsViewingPresets(false)}
                        activeOpacity={0.8}
                        style={s.presetsBackBtn}
                      >
                        <Ionicons name="arrow-back" size={20} color="#0F172A" />
                      </TouchableOpacity>
                      <Text style={s.presetsHeaderText}>Select Preset Remark</Text>
                      <TouchableOpacity
                        onPress={closeItemDetails}
                        activeOpacity={0.8}
                        style={s.presetsCloseBtn}
                      >
                        <Ionicons name="close" size={20} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={s.presetsDivider} />

                    {loadingRemarkOptions ? (
                      <View style={s.centerModalLoaderWrap}>
                        <ActivityIndicator size="small" color="#002748" />
                      </View>
                    ) : (
                      <ScrollView
                        showsVerticalScrollIndicator
                        contentContainerStyle={s.presetsListContent}
                      >
                        {remarkOptions.map((preset, index) => (
                          <TouchableOpacity
                            key={`${preset}-${index}`}
                            style={s.presetsRow}
                            activeOpacity={0.85}
                            onPress={() => handlePresetRemarkSelect(preset)}
                          >
                            <Text style={s.presetsRowText}>{preset}</Text>
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
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC STYLES FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function getDynamicStyles(width: number, height: number, bottomInset: number) {
  const isTablet   = width >= 600;
  const isSmall    = height < 700;
  const BASE_WIDTH = isTablet ? 768 : 375;
  const scale      = (size: number): number => (width / BASE_WIDTH) * size;

  const hPad               = isTablet ? 24  : isSmall ? 12  : 16;
  const headerH            = isTablet ? 170 : isSmall ? 130 : 150;
  const contentBottomPad   = isTablet ? 180 : isSmall ? 120 : 140;
  const cartPanelBottomPad = isTablet ? 28  : isSmall ? 20  : 24;
  const gridGap            = isTablet ? 16  : isSmall ? 10  : 12;

  const titleFs            = isTablet ? 32  : isSmall ? 16  : 24;
  const badgeFs            = isTablet ? 16  : isSmall ? 11  : 12;
  const sectionFont        = isTablet ? 20  : isSmall ? 10  : 12;
  const breadFs            = isTablet ? 16  : isSmall ? 11  : 12;
  const searchFs           = isTablet ? 16  : isSmall ? 13  : 14;
  const dropdownTitleFs    = isTablet ? 16  : isSmall ? 13  : 14;
  const dropdownRowFs      = isTablet ? 14  : isSmall ? 12  : 13;
  const colorCardLabelFs   = isTablet ? 20  : isSmall ? 11  : 13;
  const itemLabelFs        = isTablet ? 20  : isSmall ? 12  : 14;
  const itemPriceFs        = isTablet ? 20  : isSmall ? 10  : 11;
  const addBtnFs           = isTablet ? 20  : isSmall ? 10  : 11;
  const qtyNumberFs        = isTablet ? 20  : isSmall ? 10  : 11;
  const goToCartTextFs     = isTablet ? 18  : isSmall ? 14  : 16;
  const goToCartBadgeFs    = isTablet ? 16  : isSmall ? 12  : 14;
  const sheetTitleFs       = isTablet ? 26  : isSmall ? 18  : 22;
  const tagChipFs          = isTablet ? 15  : isSmall ? 11  : 13;
  const remarkInputFs      = isTablet ? 17  : isSmall ? 13  : 15;
  const addTagBtnFs        = isTablet ? 14  : isSmall ? 10  : 12;
  const saveBtnFs          = isTablet ? 18  : isSmall ? 14  : 16;
  const detailsHeaderFs    = isTablet ? 18  : isSmall ? 14  : 16;
  const presetsHeaderFs    = isTablet ? 18  : isSmall ? 14  : 16;
  const presetsRowFs       = isTablet ? 16  : isSmall ? 12  : 14;
  const pathTextFs         = isTablet ? 12  : isSmall ? 9   : 10;

  const badgePadH          = isTablet ? 16  : isSmall ? 10  : 12;
  const badgePadV          = isTablet ? 12  : isSmall ? 5   : 6;
  const backBtnSize        = isTablet ? 48  : isSmall ? 36  : 40;
  const searchH            = isTablet ? 50  : isSmall ? 36  : 42;
  const searchBr           = isTablet ? 16  : isSmall ? 10  : 12;
  const searchMt           = isTablet ? 40  : isSmall ? 20  : 32;
  const searchPadH         = isTablet ? 18  : isSmall ? 12  : 14;
  const dropdownMinW       = isTablet ? 240 : isSmall ? 180 : 200;
  const dropdownBr         = isTablet ? 18  : isSmall ? 12  : 14;
  const cardBr             = isTablet ? 18  : isSmall ? 12  : 14;
  const itemCardBr         = isTablet ? 16  : isSmall ? 10  : 12;
  const itemCardMb         = isTablet ? 20  : isSmall ? 10  : 14;
  const goToCartBtnPadV    = isTablet ? 18  : isSmall ? 11  : 14;
  const goToCartBtnPadH    = isTablet ? 64  : isSmall ? 40  : 50;
  const goToCartBtnBr      = isTablet ? 18  : isSmall ? 12  : 14;
  const goToCartBadgeSize  = isTablet ? 34  : isSmall ? 24  : 28;
  const goToCartBadgeBr    = isTablet ? 17  : isSmall ? 12  : 14;
  const sheetImageH        = isTablet ? 280 : isSmall ? 160 : 220;
  const sheetImageBr       = isTablet ? 22  : isSmall ? 14  : 18;
  const sheetBodyPadH      = isTablet ? 24  : isSmall ? 14  : 18;
  const sheetBodyPadT      = isTablet ? 22  : isSmall ? 14  : 18;
  const remarkInputH       = isTablet ? 56  : isSmall ? 42  : 48;
  const remarkInputBr      = isTablet ? 16  : isSmall ? 10  : 12;
  const addTagBtnPadH      = isTablet ? 18  : isSmall ? 10  : 14;
  const addTagBtnPadV      = isTablet ? 12  : isSmall ? 8   : 10;
  const saveBtnH           = isTablet ? 66  : isSmall ? 48  : 56;
  const saveBtnBr          = isTablet ? 18  : isSmall ? 12  : 14;
  const saveBtnMt          = isTablet ? 16  : isSmall ? 8   : 12;
  const centerCardW        = isTablet ? 560 : isSmall ? 320 : 400;
  const centerCardH        = isTablet ? 620 : isSmall ? 460 : 540;
  const centerCardBr       = isTablet ? 24  : isSmall ? 16  : 20;
  const centerCardPad      = isTablet ? 24  : isSmall ? 14  : 20;
  const tagChipPadL        = isTablet ? 16  : isSmall ? 10  : 12;
  const tagChipPadR        = isTablet ? 8   : isSmall ? 4   : 6;
  const tagChipPadV        = isTablet ? 10  : isSmall ? 6   : 8;
  const scrollTabPadH      = isTablet ? 18  : isSmall ? 10  : 14;
  const scrollTabPadV      = isTablet ? 10  : isSmall ? 6   : 8;
  const scrollTabBr        = isTablet ? 22  : isSmall ? 14  : 18;
  const scrollTabMinH      = isTablet ? 46  : isSmall ? 32  : 38;
  const changeTablePadV    = isTablet ? 12  : isSmall ? 8   : 10;

  return {
    hPad,
    headerH,
    gridGap,
    contentBottomPad,
    cartPanelBottomPad,

    ...StyleSheet.create({

      container: {
        flex: 1,
        backgroundColor: '#F4F6F8',
      },

      header: {
        backgroundColor: '#002748',
        justifyContent: 'center',
      },
      headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      },
      backButton: {
        width: scale(backBtnSize),
        height: scale(backBtnSize),
        borderRadius: scale(backBtnSize / 2),
      },
      backIcon: {
        width: scale(backBtnSize),
        height: scale(backBtnSize),
        tintColor: '#FFF',
      },
      headerTitle: {
        fontSize: scale(titleFs),
        fontWeight: '700',
        color: '#FFF',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: scale(8),
      },
      tableBadge: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: scale(20),
        alignItems: 'center',
        gap: scale(6),
        paddingHorizontal: scale(badgePadH),
        paddingVertical: scale(badgePadV),
      },
      tableBadgeText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: scale(badgeFs),
      },
      dropdownArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 4,
        borderRightWidth: 4,
        borderTopWidth: 5,
        borderStyle: 'solid',
        backgroundColor: 'transparent',
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#FFF',
      },

      // ── Search icon + tabs row (inside header) ───────────────────────────
      searchTabsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: scale(isSmall ? 10 : 14),
        gap: scale(8),
      },
      searchIconBtn: {
        width: scale(isSmall ? 34 : 38),
        height: scale(isSmall ? 34 : 38),
        borderRadius: scale(19),
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginRight: hPad,
      },
      tabsInHeaderScroll: {
        flex: 1,
      },
      tabsInHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
      },
      headerTab: {
        minHeight: scale(scrollTabMinH),
        paddingHorizontal: scale(scrollTabPadH),
        paddingVertical: scale(scrollTabPadV),
        borderRadius: scale(scrollTabBr),
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.35)',
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
      },
      headerTabActive: {
        backgroundColor: '#FFF',
        borderColor: '#FFF',
      },
      headerTabLabel: {
        fontSize: scale(13),
        fontWeight: '700',
        color: 'rgba(255,255,255,0.75)',
        textAlign: 'center',
      },
      headerTabLabelActive: {
        color: '#002748',
      },
      searchExpandWrap: {
        flex: 1,
        overflow: 'hidden',
      },
      searchExpandInner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: scale(searchBr),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
        height: scale(searchH),
        paddingHorizontal: scale(searchPadH),
      },
      searchExpandInput: {
        flex: 1,
        color: '#FFF',
        fontSize: scale(searchFs),
        paddingRight: scale(8),
        height: '100%',
      },
      searchCloseBtn: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: scale(4),
      },

      // ── Section label inside header ───────────────────────────────────────
      sectionLabelInHeader: {
        marginTop: scale(isSmall ? 8 : 10),
        paddingBottom: scale(isSmall ? 6 : 8),
      },
      sectionTitleInHeader: {
        fontSize: scale(sectionFont),
        fontWeight: '700',
        color: 'rgba(255,255,255,0.75)',
        letterSpacing: 0.4,
      },

      // ── Section label (kept for reference, unused) ────────────────────────
      sectionLabelWrap: {
        paddingHorizontal: scale(hPad),
        paddingTop: scale(10),
        paddingBottom: scale(2),
        backgroundColor: '#F4F6F8',
      },
      sectionTitle: {
        fontSize: scale(sectionFont),
        fontWeight: '700',
        color: '#666',
        marginBottom: scale(4),
      },

      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
      },
      dropdown: {
        position: 'absolute',
        backgroundColor: '#FFF',
        borderRadius: scale(dropdownBr),
        paddingVertical: scale(8),
        minWidth: scale(dropdownMinW),
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        paddingVertical: scale(8),
      },
      dropdownTitle: {
        fontWeight: '700',
        color: '#002748',
        fontSize: scale(dropdownTitleFs),
      },
      dropdownClose: {
        color: '#888',
        fontWeight: '600',
        fontSize: scale(dropdownTitleFs),
      },
      divider: {
        height: 1,
        backgroundColor: '#EEE',
        marginVertical: scale(4),
      },
      dropdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: scale(16),
        paddingVertical: scale(10),
      },
      dropdownLabel: {
        color: '#666',
        fontWeight: '500',
        fontSize: scale(dropdownRowFs),
      },
      dropdownValue: {
        color: '#000',
        fontWeight: '700',
        fontSize: scale(dropdownRowFs),
      },
      changeTableBtn: {
        marginHorizontal: scale(12),
        marginTop: scale(4),
        marginBottom: scale(6),
        backgroundColor: '#002748',
        borderRadius: scale(10),
        alignItems: 'center',
        paddingVertical: scale(changeTablePadV),
      },
      changeTableText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: scale(dropdownRowFs),
      },

      content: {
        paddingTop: scale(4),
      },
      breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(10),
        marginTop: scale(8),
        flexWrap: 'wrap',
      },
      breadLink: {
        color: '#0062AA',
        fontWeight: '500',
        fontSize: scale(breadFs),
      },
      breadSep: {
        color: '#999',
        fontSize: scale(breadFs),
      },
      breadActive: {
        color: '#002748',
        fontWeight: '700',
        fontSize: scale(breadFs),
      },
      searchScopeText: {
        color: '#6B7280',
        fontSize: scale(12),
        marginBottom: scale(12),
      },
      emptySearchWrap: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: scale(32),
      },
      emptySearchText: {
        color: '#9CA3AF',
        fontSize: scale(14),
      },

      grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
      },

      colorCard: {
        borderRadius: scale(cardBr),
        alignItems: 'center',
        justifyContent: 'center',
        padding: scale(10),
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        marginBottom: scale(12),
      },
      colorCardDeco: {
        position: 'absolute',
        width: scale(60),
        height: scale(60),
        borderRadius: scale(30),
        backgroundColor: 'rgba(255,255,255,0.18)',
        top: scale(-15),
        right: scale(-15),
      },
      colorCardText: {
        fontSize: scale(colorCardLabelFs),
        fontWeight: '600',
        textAlign: 'center',
        color: '#000',
        marginTop: scale(4),
      },

      itemCard: {
        backgroundColor: '#FFF',
        borderRadius: scale(itemCardBr),
        marginBottom: scale(itemCardMb),
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        alignItems: 'center',
        paddingBottom: scale(10),
      },
      itemTopArea: {
        alignItems: 'center',
        width: '100%',
      },
      itemImageBox: {
        borderRadius: scale(12),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EEE',
      },
      fillImage: {
        width: '100%',
        height: '100%',
      },
      itemLabel: {
        fontSize: scale(itemLabelFs),
        fontWeight: '600',
        color: '#000',
        marginTop: scale(8),
        paddingHorizontal: scale(6),
        textAlign: 'center',
      },
      itemPrice: {
        fontSize: scale(itemPriceFs),
        color: '#666',
        fontWeight: '500',
        marginTop: scale(2),
      },
      pathText: {
        fontSize: scale(pathTextFs),
        color: '#64748B',
        marginTop: scale(2),
        textAlign: 'center',
        paddingHorizontal: scale(8),
      },
      cardRemarksWrap: {
        marginTop: scale(6),
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(4),
        paddingHorizontal: scale(6),
        justifyContent: 'center',
      },
      cardRemarkChip: {
        backgroundColor: '#F1F5F9',
        borderRadius: scale(5),
        paddingHorizontal: scale(6),
        paddingVertical: scale(3),
        maxWidth: '100%',
      },
      cardRemarkText: {
        color: '#475569',
        fontSize: scale(10),
        fontWeight: '600',
      },
      qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
        marginTop: scale(8),
      },
      qtyBtn: {
        backgroundColor: '#EEE',
        borderRadius: scale(6),
        paddingHorizontal: scale(10),
        paddingVertical: scale(6),
      },
      qtyBtnText: {
        fontWeight: '700',
        color: '#222',
      },
      qtyNumber: {
        fontSize: scale(qtyNumberFs),
        fontWeight: '700',
        color: '#222',
        minWidth: scale(28),
        textAlign: 'center',
      },
      qtyAddBtn: {
        backgroundColor: '#F2DDCB',
        borderRadius: scale(8),
        paddingHorizontal: scale(16),
        paddingVertical: scale(4),
        alignSelf: 'center',
        minWidth: scale(86),
        alignItems: 'center',
        justifyContent: 'center',
      },
      addBtnText: {
        fontSize: scale(addBtnFs),
        color: '#333',
        fontWeight: '700',
      },

      // "On bill: N" grey badge shown below item image when fromBilling=1
      existingQtyBadge: {
        backgroundColor: '#F1F5F9',
        borderRadius: scale(5),
        paddingHorizontal: scale(8),
        paddingVertical: scale(2),
        marginTop: scale(4),
        alignSelf: 'center',
      },
      existingQtyText: {
        fontSize: scale(10),
        color: '#64748B',
        fontWeight: '600',
      },

      goToCartPanel: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#ffffff',
        paddingTop: scale(10),
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
      },
      goToCartSpace: {
        height: scale(8),
        width: '100%',
      },
      goToCartRow: {
        alignItems: 'center',
        justifyContent: 'center',
      },
      goToCartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#002748',
        borderRadius: scale(goToCartBtnBr),
        paddingVertical: scale(goToCartBtnPadV),
        paddingHorizontal: scale(goToCartBtnPadH),
      },
      goToCartText: {
        color: '#FFF',
        fontSize: scale(goToCartTextFs),
        fontWeight: '700',
      },
      goToCartBadge: {
        marginLeft: scale(10),
        minWidth: scale(goToCartBadgeSize),
        height: scale(goToCartBadgeSize),
        borderRadius: scale(goToCartBadgeBr),
        backgroundColor: '#8D9ED4',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(8),
      },
      goToCartBadgeText: {
        color: '#FFF',
        fontSize: scale(goToCartBadgeFs),
        fontWeight: '700',
      },

      centerDetailsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(20),
      },
      centerDetailsCard: {
        width: '100%',
        maxWidth: scale(centerCardW),
        height: scale(centerCardH),
        backgroundColor: '#FFF',
        borderRadius: scale(centerCardBr),
        overflow: 'hidden',
        padding: scale(centerCardPad),
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
      },
      centerDetailsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(12),
      },
      centerDetailsHeaderText: {
        fontSize: scale(detailsHeaderFs),
        fontWeight: '800',
        color: '#0F172A',
      },
      centerDetailsBody: {
        flex: 1,
      },
      centerDetailsScroll: {
        flex: 1,
      },
      centerDetailsContent: {
        paddingBottom: scale(18),
      },
      centerModalLoaderWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: scale(12),
      },

      sheetImageWrap: {
        position: 'relative',
        marginHorizontal: scale(sheetBodyPadH),
        borderRadius: scale(sheetImageBr),
        overflow: 'hidden',
        backgroundColor: '#D9D9D9',
      },
      sheetImage: {
        width: '100%',
        height: scale(sheetImageH),
        backgroundColor: '#D9D9D9',
      },
      sheetBodyWrap: {
        flex: 1,
        paddingHorizontal: scale(sheetBodyPadH),
        paddingTop: scale(sheetBodyPadT),
      },
      sheetTitle: {
        fontSize: scale(sheetTitleFs),
        fontWeight: '800',
        color: '#000',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
      },

      tagRowWrap: {
        marginTop: scale(14),
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(8),
      },
      tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#002748',
        borderRadius: scale(999),
        paddingLeft: scale(tagChipPadL),
        paddingRight: scale(tagChipPadR),
        paddingVertical: scale(tagChipPadV),
        maxWidth: '100%',
      },
      tagChipTextBtn: {
        flexShrink: 1,
        marginRight: scale(6),
      },
      tagChipText: {
        color: '#FFF',
        fontSize: scale(tagChipFs),
        fontWeight: '700',
        marginRight: scale(6),
        maxWidth: scale(170),
      },
      tagChipRemoveBtn: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
      },

      remarkSectionWrap: {
        marginTop: scale(16),
      },
      remarkInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
      },
      remarkInputShell: {
        position: 'relative',
        flex: 1,
      },
      remarkInput: {
        width: '100%',
        height: scale(remarkInputH),
        borderWidth: 1.5,
        borderColor: 'rgba(0,98,170,0.35)',
        borderRadius: scale(remarkInputBr),
        paddingLeft: scale(12),
        paddingRight: scale(44),
        color: '#000',
        fontSize: scale(remarkInputFs),
        backgroundColor: '#FFF',
        textAlignVertical: 'center',
      },
      remarkDropdownIconBtn: {
        position: 'absolute',
        right: scale(8),
        top: 0,
        bottom: 0,
        width: scale(36),
        alignItems: 'center',
        justifyContent: 'center',
      },
      addTagBtn: {
        paddingHorizontal: scale(addTagBtnPadH),
        paddingVertical: scale(addTagBtnPadV),
        borderRadius: scale(999),
        backgroundColor: 'rgba(141,158,212,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(141,158,212,0.35)',
      },
      addTagBtnText: {
        color: '#002748',
        fontSize: scale(addTagBtnFs),
        fontWeight: '800',
        letterSpacing: 0.8,
      },

      saveBtn: {
        marginTop: scale(saveBtnMt),
        height: scale(saveBtnH),
        borderRadius: scale(saveBtnBr),
        backgroundColor: '#8D9ED4',
        alignItems: 'center',
        justifyContent: 'center',
      },
      saveBtnText: {
        color: '#FFF',
        fontSize: scale(saveBtnFs),
        fontWeight: '800',
        letterSpacing: 0.4,
      },

      presetsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      },
      presetsBackBtn: {
        width: scale(36),
        height: scale(36),
        alignItems: 'center',
        justifyContent: 'center',
      },
      presetsCloseBtn: {
        width: scale(36),
        height: scale(36),
        alignItems: 'center',
        justifyContent: 'center',
      },
      presetsHeaderText: {
        flex: 1,
        textAlign: 'center',
        fontSize: scale(presetsHeaderFs),
        fontWeight: '800',
        color: '#0F172A',
      },
      presetsDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginTop: scale(10),
        marginBottom: scale(8),
      },
      presetsListContent: {
        paddingVertical: scale(2),
      },
      presetsRow: {
        paddingHorizontal: scale(12),
        paddingVertical: scale(13),
        borderBottomWidth: 1,
        borderBottomColor: '#EEF2F7',
      },
      presetsRowText: {
        color: '#0F172A',
        fontSize: scale(presetsRowFs),
        fontWeight: '600',
      },
    }),
  };
}