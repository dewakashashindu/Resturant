import { useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ImageSourcePropType,
  Keyboard,
  Modal,
  SafeAreaView,
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
import { ProtectedMenuExitModal } from '../../components/ProtectedMenuExitModal';
import { useCartStore } from '../../services/cartStore';
import { useItemStore } from '../../services/itemStore';
import { useMenuSessionStore } from '../../services/menuSessionStore';
import { storage } from '../../services/storage';

const LOGO        = require('../../assets/images/CAPTURE 1.png');
const PLACEHOLDER = require('../../assets/images/image-removebg-preview.png');

const PROMO_INTERVAL_MS  = 3_000;
const TABLET_BREAKPOINT  = 600;
const SMALL_H_BREAKPOINT = 680;

export type CartMap = Record<string, number>;
export type Metrics = ReturnType<typeof getMetrics>;

export interface SubCatItem {
  id:       string;
  name:     string;
  price:    string;
  image:    ImageSourcePropType;
  imageUrl?: string; // URL string වලින් image දෙන්න (items only)
}

export interface SubCategory {
  id:          string;
  name:        string;
  image:       ImageSourcePropType;
  heroImage:   ImageSourcePropType;
  description: string;
  items:       SubCatItem[];
}

export interface FoodItem {
  id:            string;
  name:          string;
  image:         ImageSourcePropType;
  heroImage:     ImageSourcePropType;
  description:   string;
  subCategories: SubCategory[];
  menuItems:     SubCatItem[];
  category:      string;
}

export interface PromoBanner {
  id:         string;
  accentText: string;
  title:      string;
  subtitle:   string;
  note:       string;
  image:      ImageSourcePropType;
}

type AnyMenuItem = SubCatItem & { category?: string; subCategory?: string };

type Screen =
  | { name: 'home' }
  | { name: 'detail';   item: FoodItem }
  | { name: 'subItems'; subCat: SubCategory; parentName: string; parentCategory: FoodItem['category'] };

// ─── Dynamic count helpers ───────────────────────────────────────────────────

const getFoodItemCount = (food: FoodItem): number => {
  const subCatItemIds = new Set(
    food.subCategories.flatMap(sc => sc.items.map(i => i.id))
  );
  const menuItemIds = new Set(food.menuItems.map(i => i.id));
  const allIds = new Set([...subCatItemIds, ...menuItemIds]);
  return allIds.size;
};

const getSubCatCount = (subCat: SubCategory): number => subCat.items.length;

// ─────────────────────────────────────────────────────────────────────────────

const getMetrics = (width: number, height: number) => {
  const isTablet = width  >= TABLET_BREAKPOINT;
  const isSmall  = height <  SMALL_H_BREAKPOINT;

  const t = <T,>(tablet: T, small: T, normal: T): T =>
    isTablet ? tablet : isSmall ? small : normal;

  const pH          = isTablet ? 24 : 16;
  const menuCardGap = isTablet ? 20 : isSmall ? 10 : 12;
  const foodCardGap = isTablet ? 20 : 16;
  const subCardGap  = isTablet ? 20 : 12;

  const foodCardColWidth = (width - pH * 2 - foodCardGap) / 2;
  const subCardColWidth  = (width - pH * 2 - subCardGap)  / 2;
  const menuCardColWidth = (width - pH * 2 - menuCardGap) / 2;

  return {
    width,
    height,
    isTablet,
    isSmall,

    headerHeight:         t(96,  60,  72),
    headerBtnSize:        t(48,  32,  36),
    logoW:                t(220, 120, 150),
    logoH:                t(88,  42,  50),
    avatarSize:           t(56,  36,  42),
    headerPaddingH:       t(32,  14,  20),

    promoCardWidth:       width - pH * 2,
    promoCardHeight:      t(260, 155, 195),
    promoBorderRadius:    t(26,  14,  20),
    promoPadding:         t(26,  12,  18),
    promoTitleSize:       t(24,  13,  17),
    promoAccentSize:      t(42,  20,  28),
    promoSubtitleSize:    t(15,  10,  12),
    promoNoteSize:        t(13,  9,   11),
    promoImageWidth:      t(220, 105, 155),

    tabFontSize:          t(16,  11,  13),
    tabPaddingH:          t(24,  14,  18),
    tabPaddingV:          t(12,  6,   8),
    tabGap:               t(14,  7,   10),
    tabBorderRadius:      t(24,  16,  20),

    foodCardGap,
    foodCardColWidth,
    foodCardHeight:       t(190, 128, 152),
    foodCardInnerHeight:  t(150, 93,  117),
    foodBorderRadius:     t(22,  14,  18),
    foodCardPadding:      t(22,  11,  15),
    foodNameSize:         t(24,  13,  17),
    foodCountSize:        t(17,  11,  13),
    foodImageSize:        t(130, 74,  98),

    subCardGap,
    subCardColWidth,
    subCardHeight:        t(170, 103, 135),
    subBorderRadius:      t(16,  8,   10),
    subPadding:           t(20,  10,  14),
    subNameSize:          t(24,  13,  17),
    subCountSize:         t(17,  11,  13),
    subImageSize:         t(120, 63,  88),

    menuCardGap,
    menuCardColWidth,
    menuImageSize:        t(140, 72,  100),
    menuNameSize:         t(18,  12,  14),
    menuPriceSize:        t(15,  10,  12),
    menuAddTextSize:      t(11,  7,   8),
    menuAddPaddingH:      t(22,  12,  16),
    menuAddPaddingV:      t(7,   3,   4),
    menuCardPaddingH:     t(18,  9,   12),
    menuCardBorderRadius: t(14,  8,   10),
    expandIconSize:       t(18,  11,  14),

    heroHeight:           height * t(0.32, 0.34, 0.32),
    subHeroHeight:        height * 0.28,
    backBtnSize:          t(52,  34,  40),
    catTitleSize:         t(30,  18,  22),
    catCountSize:         t(18,  11,  13),
    descriptionSize:      t(15,  10,  12),
    bodyPaddingH:         pH,
    sectionGap:           t(28,  14,  20),
    subItemTitleSize:     t(28,  16,  20),
    subItemCountSize:     t(16,  10,  12),
    subItemDescSize:      t(14,  10,  11),

    fabSize:              t(66,  46,  54),
    searchPillHeight:     t(66,  46,  54),
    searchFontSize:       t(18,  12,  14),
    bottomBarBottom:      t(36,  14,  24),
    bottomBarPaddingH:    t(24,  12,  16),
    iconScale:            isTablet ? 1.3 : isSmall ? 0.82 : 1,
  } as const;
};

const PROMO_BANNERS: PromoBanner[] = [
  {
    id:         '1',
    accentText: '20% OFF',
    title:      'Enjoy',
    subtitle:   'on your favorite pizzas every Wednesday!',
    note:       '(T&C Apply)',
    image:      PLACEHOLDER,
  },
  {
    id:         '2',
    accentText: '15% OFF',
    title:      'Get',
    subtitle:   'on all Ramen Bowls today!',
    note:       '(T&C Apply)',
    image:      PLACEHOLDER,
  },
  {
    id:         '3',
    accentText: 'DOUBLE',
    title:      'THE BITE,',
    subtitle:   'Buy any Signature Large Burger, get one FREE!',
    note:       '',
    image:      PLACEHOLDER,
  },
];

const LOOPED_BANNERS: PromoBanner[] = [
  ...PROMO_BANNERS,
  ...PROMO_BANNERS,
  ...PROMO_BANNERS,
];

// ─── Real dining menu data ───────────────────────────────────────────────────
// The Dining item-selection screen uses these same fields from /api/menu/items.
// This keeps the Menu Card UI and the POS menu in sync without a second API call.
type RawMenuRecord = Record<string, any>;

type MenuTab = {
  key: string;
  label: string;
};

const LEVEL_KEYS = ['Level1', 'Level2', 'Level3', 'Level4', 'Level5', 'Level6', 'Level7'] as const;

const getText = (value: unknown) => String(value ?? '').trim();

const getLevelValue = (item: RawMenuRecord, level: number) =>
  getText(item[LEVEL_KEYS[level - 1]] ?? item[`level${level}`]);

const getLevelLabel = (item: RawMenuRecord, level: number) =>
  getText(
    item[`L${level}DES`]
      ?? item[`L${level}Des`]
      ?? item[`l${level}Des`]
      ?? item[`l${level}des`],
  );

const getCategoryCode = (item: RawMenuRecord) =>
  getText(item.Category ?? item.CategoryCode ?? item.category).toUpperCase() || 'OTHER';

const getCategoryLabel = (item: RawMenuRecord, code: string) => {
  const label = getText(item.CategoryName ?? item.CategoryLabel ?? item.categoryName);
  if (label) return label.toUpperCase();
  const fallback: Record<string, string> = {
    F: 'FOOD',
    FOOD: 'FOOD',
    B: 'BEVERAGE',
    BEVERAGE: 'BEVERAGE',
    O: 'OTHER',
    OTHER: 'OTHER',
  };
  return fallback[code] ?? code;
};

const getMenuItemCode = (item: RawMenuRecord) =>
  getText(item.MenuItemCode ?? item.ItemCode ?? item.ItemId ?? item.Level7 ?? item.Level ?? item.code ?? item.id);

const getMenuItemName = (item: RawMenuRecord) =>
  getText(
    item.MenuItmDes
      ?? item.MenuItemDes
      ?? item.ItemName
      ?? item.itemName
      ?? item.LDes
      ?? getMenuItemCode(item),
  );

const getMenuItemPrice = (item: RawMenuRecord) =>
  Number(item.SalesPrice ?? item.salesPrice ?? item.Price ?? item.price ?? 0) || 0;

const formatPrice = (price: number) => `Rs. ${price.toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;

const isVisibleDiningItem = (item: RawMenuRecord) => {
  const flags = [item.DisplayInFront, item.MenuAssiEnable, item.MenuItemEnable]
    .map(getText)
    .filter(Boolean);
  return flags.length === 0 || flags.every((value) => value === '1' || value.toLowerCase() === 'true');
};

const getMenuItemImage = (item: RawMenuRecord): ImageSourcePropType => {
  const itemCode = getMenuItemCode(item);
  if (itemCode) {
    try {
      const cached = storage.getString(`item_pic:${itemCode}`)?.trim();
      if (cached) {
        return {
          uri: cached.startsWith('data:') ? cached : `data:image/jpeg;base64,${cached}`,
        } as ImageSourcePropType;
      }
    } catch {
      // A placeholder is shown below if the local image cache cannot be read.
    }
  }

  const imageUrl = getText(
    item.ItemImageUrl
      ?? item.ImageUrl
      ?? item.imageUrl
      ?? item.PhotoUrl
      ?? item.photoUrl
      ?? item.Image
      ?? item.image,
  );
  return imageUrl ? ({ uri: imageUrl } as ImageSourcePropType) : PLACEHOLDER;
};

const toMenuItem = (item: RawMenuRecord): SubCatItem | null => {
  const id = getMenuItemCode(item);
  if (!id) return null;
  return {
    id,
    name: getMenuItemName(item) || id,
    price: formatPrice(getMenuItemPrice(item)),
    image: getMenuItemImage(item),
  };
};

/**
 * Shapes the POS menu hierarchy for the visual Menu Card.
 * Level 1 becomes the home-card (Chinese/Indian/etc.) and Level 2 becomes
 * the detail-screen subcategory.  Any deeper levels remain inside their
 * Level-2 group, so every enabled POS item is still available to add.
 */
const buildFoodItemsFromDiningData = (rawItems: RawMenuRecord[]): { tabs: MenuTab[]; foodItems: FoodItem[] } => {
  const tabsByCode = new Map<string, MenuTab>();
  const groups = new Map<string, { tabCode: string; name: string; records: RawMenuRecord[] }>();

  rawItems.forEach((item) => {
    if (!isVisibleDiningItem(item)) return;
    const itemCode = getMenuItemCode(item);
    if (!itemCode) return;

    const tabCode = getCategoryCode(item);
    const tabLabel = getCategoryLabel(item, tabCode);
    if (!tabsByCode.has(tabCode)) tabsByCode.set(tabCode, { key: tabCode, label: tabLabel });

    const levelOneCode = getLevelValue(item, 1);
    const levelOneName = getLevelLabel(item, 1) || levelOneCode || tabLabel;
    const groupKey = `${tabCode}::${levelOneCode || levelOneName}`;
    const group = groups.get(groupKey) ?? { tabCode, name: levelOneName, records: [] };
    group.records.push(item);
    groups.set(groupKey, group);
  });

  const foodItems: FoodItem[] = [...groups.entries()].map(([groupKey, group]) => {
    const subGroups = new Map<string, { name: string; records: RawMenuRecord[] }>();
    const directRecords: RawMenuRecord[] = [];

    group.records.forEach((record) => {
      const levelTwoCode = getLevelValue(record, 2);
      const levelTwoName = getLevelLabel(record, 2) || levelTwoCode;
      if (!levelTwoCode && !levelTwoName) {
        directRecords.push(record);
        return;
      }
      const subKey = levelTwoCode || levelTwoName;
      const subGroup = subGroups.get(subKey) ?? { name: levelTwoName || subKey, records: [] };
      subGroup.records.push(record);
      subGroups.set(subKey, subGroup);
    });

    const uniqueItems = (records: RawMenuRecord[]) => {
      const items = new Map<string, SubCatItem>();
      records.forEach((record) => {
        const menuItem = toMenuItem(record);
        if (menuItem && !items.has(menuItem.id)) items.set(menuItem.id, menuItem);
      });
      return [...items.values()];
    };

    const menuItems = uniqueItems(directRecords);
    const subCategories: SubCategory[] = [...subGroups.entries()]
      .map(([subKey, subGroup]) => {
        const subItems = uniqueItems(subGroup.records);
        const representativeImage = subItems[0]?.image ?? getMenuItemImage(subGroup.records[0]);
        return {
          id: `${groupKey}::${subKey}`,
          name: subGroup.name,
          image: representativeImage,
          heroImage: representativeImage,
          description: `Browse ${subGroup.name} items from the current Dining menu.`,
          items: subItems,
        };
      })
      .filter((subCategory) => subCategory.items.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const representativeImage = menuItems[0]?.image ?? subCategories[0]?.image ?? getMenuItemImage(group.records[0]);
    return {
      id: groupKey,
      name: group.name,
      category: group.tabCode,
      image: representativeImage,
      heroImage: representativeImage,
      description: `Browse ${group.name} items from the current Dining menu.`,
      subCategories,
      menuItems,
    };
  }).filter((foodItem) => foodItem.menuItems.length > 0 || foodItem.subCategories.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const tabOrder = ['F', 'FOOD', 'B', 'BEVERAGE', 'S', 'O', 'OTHER'];
  const tabIndex = (key: string) => {
    const index = tabOrder.indexOf(key);
    return index === -1 ? tabOrder.length : index;
  };

  return {
    tabs: [...tabsByCode.values()].sort(
      (a, b) => tabIndex(a.key) - tabIndex(b.key) || a.label.localeCompare(b.label),
    ),
    foodItems,
  };
};

// ─── Searchable flat list ────────────────────────────────────────────────────
interface SearchableItem extends SubCatItem {
  category: string;
  subCategory: string;
}

const buildSearchableItems = (foodItems: FoodItem[]): SearchableItem[] => {
  const results = new Map<string, SearchableItem>();
  foodItems.forEach((food) => {
    food.menuItems.forEach((item) => {
      if (!results.has(item.id)) {
        results.set(item.id, { ...item, category: food.name, subCategory: 'Menu' });
      }
    });
    food.subCategories.forEach((subCategory) => {
      subCategory.items.forEach((item) => {
        if (!results.has(item.id)) {
          results.set(item.id, { ...item, category: food.name, subCategory: subCategory.name });
        }
      });
    });
  });
  return [...results.values()];
};

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = ({ scale = 1, color = 'rgba(255,255,255,0.7)' }: { scale?: number; color?: string }) => (
  <View style={{ width: 20 * scale, height: 20 * scale, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 13 * scale, height: 13 * scale, borderRadius: 7 * scale, borderWidth: 2, borderColor: color, position: 'absolute', top: 0, left: 0 }} />
    <View style={{ width: 7 * scale, height: 2, backgroundColor: color, borderRadius: 1, position: 'absolute', bottom: 0, right: 0, transform: [{ rotate: '45deg' }] }} />
  </View>
);

const CartIcon = ({ scale = 1, badgeCount = 0 }: { scale?: number; badgeCount?: number }) => (
  <View style={{ width: 26 * scale, height: 26 * scale, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 16 * scale, height: 11 * scale, borderWidth: 2, borderColor: 'white', borderRadius: 3, marginTop: 2 }} />
    <View style={{ width: 10 * scale, height: 5 * scale, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderWidth: 2, borderColor: 'white', borderBottomWidth: 0, position: 'absolute', top: 0 }} />
    <View style={{ flexDirection: 'row', gap: 6 * scale, marginTop: 2 }}>
      <View style={{ width: 4 * scale, height: 4 * scale, borderRadius: 2, backgroundColor: 'white' }} />
      <View style={{ width: 4 * scale, height: 4 * scale, borderRadius: 2, backgroundColor: 'white' }} />
    </View>
    {badgeCount > 0 && (
      <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
        <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{badgeCount}</Text>
      </View>
    )}
  </View>
);

const HomeIcon = ({ scale = 1 }: { scale?: number }) => (
  <View style={{ width: 26 * scale, height: 26 * scale, alignItems: 'center', justifyContent: 'flex-end' }}>
    <View style={{ width: 4 * scale, height: 5 * scale, backgroundColor: 'white', position: 'absolute', top: 1, left: 5 * scale, zIndex: 1 }} />
    <View style={{ width: 0, height: 0, borderLeftWidth: 14 * scale, borderRightWidth: 14 * scale, borderBottomWidth: 11 * scale, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'white' }} />
    <View style={{ width: 20 * scale, height: 12 * scale, backgroundColor: 'white', alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: 6 * scale, height: 7 * scale, backgroundColor: '#2A2A2A', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
    </View>
  </View>
);

const MenuIcon = ({ scale = 1 }: { scale?: number }) => (
  <View style={{ gap: 4 * scale, justifyContent: 'center', alignItems: 'flex-start' }}>
    <View style={{ width: 20 * scale, height: 2, backgroundColor: 'white', borderRadius: 1 }} />
    <View style={{ width: 14 * scale, height: 2, backgroundColor: 'white', borderRadius: 1 }} />
    <View style={{ width: 20 * scale, height: 2, backgroundColor: 'white', borderRadius: 1 }} />
  </View>
);

const BackIcon = ({ scale = 1 }: { scale?: number }) => (
  <View style={{ width: 20 * scale, height: 20 * scale, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 10 * scale, height: 10 * scale, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: 'white', transform: [{ rotate: '45deg' }] }} />
  </View>
);

const ExpandIcon = ({ size = 14 }: { size?: number }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.72, height: size * 0.72, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: 'white', transform: [{ rotate: '45deg' }] }} />
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// ADD / QTY BUTTON
// ─────────────────────────────────────────────────────────────────────────────

interface AddQtyButtonProps {
  itemId: string; qty: number;
  onIncrement: (id: string) => void; onDecrement: (id: string) => void;
  fontSize?: number; paddingH?: number; paddingV?: number;
}

const AddQtyButton = ({
  itemId, qty, onIncrement, onDecrement,
  fontSize = 8, paddingH = 16, paddingV = 4,
}: AddQtyButtonProps) => {
  const handleIncrement = useCallback(() => onIncrement(itemId), [itemId, onIncrement]);
  const handleDecrement = useCallback(() => onDecrement(itemId), [itemId, onDecrement]);

  if (qty === 0) {
    return (
      <TouchableOpacity
        style={[addBtnStyles.addBtn, { paddingHorizontal: paddingH, paddingVertical: paddingV }]}
        onPress={handleIncrement}
        activeOpacity={0.8}
      >
        <Text style={[addBtnStyles.addText, { fontSize }]}>ADD</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={addBtnStyles.qtyRow}>
      <TouchableOpacity style={addBtnStyles.qtyBtn} onPress={handleDecrement} activeOpacity={0.7}>
        <Text style={addBtnStyles.qtyOp}>−</Text>
      </TouchableOpacity>
      <Text style={addBtnStyles.qtyNum}>{qty}</Text>
      <TouchableOpacity style={addBtnStyles.qtyBtn} onPress={handleIncrement} activeOpacity={0.7}>
        <Text style={addBtnStyles.qtyOp}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const addBtnStyles = StyleSheet.create({
  addBtn:  { backgroundColor: 'rgba(171,119,60,0.85)', borderRadius: 12 },
  addText: { color: 'white', fontWeight: '700', letterSpacing: 1 },
  qtyRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(171,119,60,0.85)', borderRadius: 12, overflow: 'hidden' },
  qtyBtn:  { paddingHorizontal: 10, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },
  qtyOp:   { color: 'white', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  qtyNum:  { color: 'white', fontSize: 13, fontWeight: '700', minWidth: 20, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ITEM DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface ItemDetailModalProps {
  item:        AnyMenuItem | null;
  visible:     boolean;
  onClose:     () => void;
  cart:        CartMap;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  m:           Metrics;
}

const parsePrice = (priceStr: string): number => {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const ITEM_DESCRIPTIONS: Record<string, string> = {};

const DEFAULT_ITEM_DESCRIPTION =
  'A carefully prepared dish crafted with the finest ingredients. ' +
  'Served fresh and made to order — every bite is a perfect balance ' +
  'of flavour and quality. Our chefs source locally where possible to ' +
  'ensure you enjoy the very best with every serving.';

const ItemDetailModal = ({
  item, visible, onClose, cart, onIncrement, onDecrement, m,
}: ItemDetailModalProps) => {
  const insets    = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 280, useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 1, tension: 60, friction: 12, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0, duration: 220, useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0, duration: 220, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!item) return null;

  const qty        = cart[item.id] ?? 0;
  const unitPrice  = parsePrice(item.price);
  const totalPrice = unitPrice * qty;
  const description = ITEM_DESCRIPTIONS[item.id] ?? DEFAULT_ITEM_DESCRIPTION;
  const imageHeight = m.height * (m.isTablet ? 0.42 : m.isSmall ? 0.36 : 0.40);

  const translateY = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [m.height, 0],
  });

  const s = StyleSheet.create({
    screen:         { flex: 1, backgroundColor: '#1B1B1B' },
    imageContainer: { width: '100%', height: imageHeight, backgroundColor: '#252525', overflow: 'hidden' },
    itemImage:      { width: '100%', height: '100%' },
    imageOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
    imageFade:      { position: 'absolute', left: 0, right: 0, bottom: 0, height: imageHeight * 0.30, backgroundColor: 'transparent' },
    closeBtn:       { position: 'absolute', top: insets.top + (m.isSmall ? 10 : 14), left: m.bodyPaddingH, width: m.isTablet ? 44 : 38, height: m.isTablet ? 44 : 38, borderRadius: m.isTablet ? 22 : 19, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
    closeTxt:       { color: 'rgba(255,255,255,0.90)', fontSize: m.isTablet ? 16 : 14, fontWeight: '700', lineHeight: m.isTablet ? 18 : 16 },
    body:           { flex: 1, paddingHorizontal: m.bodyPaddingH, paddingTop: m.isTablet ? 28 : 20, paddingBottom: insets.bottom + 32 },
    nameRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    name:           { color: 'white', fontSize: m.isTablet ? 30 : m.isSmall ? 22 : 26, fontWeight: '700', flex: 1, flexWrap: 'wrap', marginRight: 14, lineHeight: m.isTablet ? 38 : m.isSmall ? 28 : 33 },
    priceTag:       { backgroundColor: 'rgba(171,119,60,0.15)', borderWidth: 1, borderColor: 'rgba(171,119,60,0.40)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
    price:          { color: '#AB773C', fontSize: m.isTablet ? 20 : m.isSmall ? 15 : 18, fontWeight: '700' },
    divider:        { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: m.isTablet ? 18 : 14 },
    descLabel:      { color: 'rgba(255,255,255,0.40)', fontSize: m.isTablet ? 11 : 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
    description:    { color: 'rgba(255,255,255,0.62)', fontSize: m.isTablet ? 15 : m.isSmall ? 12 : 14, lineHeight: m.isTablet ? 24 : m.isSmall ? 19 : 22, fontWeight: '400' },
    addRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: m.isTablet ? 32 : 24, paddingTop: m.isTablet ? 20 : 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
    totalWrap:      { gap: 4 },
    totalLabel:     { color: 'rgba(255,255,255,0.40)', fontSize: m.isTablet ? 12 : 10, fontWeight: '500' },
    totalAmt:       { color: '#AB773C', fontSize: m.isTablet ? 24 : m.isSmall ? 18 : 20, fontWeight: '700' },
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[s.screen, { opacity: fadeAnim, transform: [{ translateY }] }]}>
        <View style={s.imageContainer}>
          <Image source={item.imageUrl ? { uri: item.imageUrl } : item.image} style={s.itemImage} resizeMode="cover" />
          <View style={s.imageOverlay} />
          <View style={s.imageFade} />
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
        <ScrollView style={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={s.nameRow}>
            <Text style={s.name}>{item.name}</Text>
            <View style={s.priceTag}>
              <Text style={s.price}>{item.price}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <Text style={s.descLabel}>Description</Text>
          <Text style={s.description}>{description}</Text>
          <View style={s.addRow}>
            <View style={s.totalWrap}>
              <Text style={s.totalLabel}>
                {qty > 0 ? `${qty} × Rs. ${unitPrice.toLocaleString()}` : 'Choose quantity below'}
              </Text>
              {qty > 0 && <Text style={s.totalAmt}>Rs. {totalPrice.toLocaleString()}</Text>}
            </View>
            <AddQtyButton
              itemId={item.id} qty={qty}
              onIncrement={onIncrement} onDecrement={onDecrement}
              fontSize={m.menuAddTextSize + 4}
              paddingH={m.menuAddPaddingH + 8}
              paddingV={m.menuAddPaddingV + 5}
            />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

interface SearchOverlayProps {
  visible: boolean; onClose: () => void; onHomePress: () => void;
  cart: CartMap; onIncrement: (id: string) => void; onDecrement: (id: string) => void; m: Metrics;
  searchItems: SearchableItem[];
}

const SearchOverlay = ({ visible, onClose, onHomePress, cart, onIncrement, onDecrement, m, searchItems }: SearchOverlayProps) => {
  const insets            = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const inputRef          = useRef<TextInput>(null);
  const fadeAnim          = useRef(new Animated.Value(0)).current;
  const slideAnim         = useRef(new Animated.Value(30)).current;

  const [selectedItem,     setSelectedItem]     = useState<AnyMenuItem | null>(null);
  const [itemModalVisible, setItemModalVisible] = useState(false);

  const openItemModal  = useCallback((it: AnyMenuItem) => { setSelectedItem(it); setItemModalVisible(true); }, []);
  const closeItemModal = useCallback(() => setItemModalVisible(false), []);

  const results = useMemo<SearchableItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.subCategory.toLowerCase().includes(q)
    );
  }, [query, searchItems]);

  useEffect(() => {
    if (visible) {
      setQuery('');
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setTimeout(() => inputRef.current?.focus(), 50));
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 30, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const handleClose     = useCallback(() => { Keyboard.dismiss(); onClose(); }, [onClose]);
  const handleClear     = useCallback(() => { setQuery(''); inputRef.current?.focus(); }, []);
  const handleHomePress = useCallback(() => { Keyboard.dismiss(); onClose(); onHomePress(); }, [onClose, onHomePress]);

  const renderResult = useCallback(({ item }: { item: SearchableItem }) => (
    <TouchableOpacity style={searchStyles.resultCard} activeOpacity={0.82} onPress={() => openItemModal(item)}>
      <Image source={item.imageUrl ? { uri: item.imageUrl } : item.image} style={searchStyles.resultImage} resizeMode="cover" />
      <View style={searchStyles.resultInfo}>
        <Text style={searchStyles.resultName}>{item.name}</Text>
        <Text style={searchStyles.resultMeta}>{item.category} · {item.subCategory}</Text>
        <Text style={searchStyles.resultPrice}>{item.price}</Text>
      </View>
      <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
        <AddQtyButton
          itemId={item.id} qty={cart[item.id] ?? 0}
          onIncrement={onIncrement} onDecrement={onDecrement}
          fontSize={8} paddingH={12} paddingV={5}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  ), [cart, onIncrement, onDecrement, openItemModal]);

  const keyExtractor = useCallback((item: SearchableItem, index: number) => `${item.id}-${index}`, []);
  const bottomPad    = m.fabSize + m.bottomBarBottom + insets.bottom + 24;
  const searchBarTop = insets.top + 12;

  return (
    <>
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
        <Animated.View style={[searchStyles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Animated.View style={[searchStyles.content, { paddingTop: searchBarTop, paddingBottom: bottomPad, transform: [{ translateY: slideAnim }] }]}>
            <View style={searchStyles.searchBarRow}>
              <View style={searchStyles.searchBar}>
                <SearchIcon scale={1} color="rgba(255,255,255,0.6)" />
                <TextInput
                  ref={inputRef}
                  style={searchStyles.searchInput}
                  placeholder="Search your favorite..."
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  selectionColor="#AB773C"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <View style={searchStyles.clearBtn}>
                      <Text style={searchStyles.clearText}>✕</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={handleClose} style={searchStyles.cancelBtn} activeOpacity={0.7}>
                <Text style={searchStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            {query.trim().length === 0 ? (
              <View style={searchStyles.emptyWrap}>
                <Text style={searchStyles.emptyIcon}>🍽️</Text>
                <Text style={searchStyles.emptyTitle}>Find Your Favorite</Text>
                <Text style={searchStyles.emptySubtitle}>Search by dish name, cuisine, or category</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={searchStyles.emptyWrap}>
                <Text style={searchStyles.emptyIcon}>😔</Text>
                <Text style={searchStyles.emptyTitle}>No Results Found</Text>
                <Text style={searchStyles.emptySubtitle}>Try searching with a different keyword</Text>
              </View>
            ) : (
              <>
                <Text style={searchStyles.resultsCount}>
                  {results.length} result{results.length !== 1 ? 's' : ''} for &quot;
                  <Text style={searchStyles.resultsQuery}>{query.trim()}</Text>&quot;
                </Text>
                <FlatList
                  data={results}
                  keyExtractor={keyExtractor}
                  renderItem={renderResult}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={searchStyles.listContent}
                  ItemSeparatorComponent={() => <View style={searchStyles.separator} />}
                />
              </>
            )}
          </Animated.View>
          <View style={[searchStyles.bottomFab, { bottom: m.bottomBarBottom + insets.bottom, left: m.bottomBarPaddingH }]}>
            <TouchableOpacity
              style={[searchStyles.homeFab, { width: m.fabSize, height: m.fabSize, borderRadius: m.fabSize / 2 }]}
              onPress={handleHomePress}
              activeOpacity={0.85}
            >
              <Image source={PLACEHOLDER} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={6} />
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(171,119,60,0.82)', borderRadius: m.fabSize / 2 }]}>
                <HomeIcon scale={m.iconScale} />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
      <ItemDetailModal item={selectedItem} visible={itemModalVisible} onClose={closeItemModal} cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} m={m} />
    </>
  );
};

const searchStyles = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: '#1B1B1B' },
  content:       { flex: 1, paddingHorizontal: 16 },
  searchBarRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  searchBar:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A2A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: 'rgba(171,119,60,0.3)' },
  searchInput:   { flex: 1, color: 'white', fontSize: 15, padding: 0 },
  clearBtn:      { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  clearText:     { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  cancelBtn:     { paddingVertical: 8, paddingHorizontal: 4 },
  cancelText:    { color: '#AB773C', fontSize: 14, fontWeight: '600' },
  emptyWrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80, gap: 10 },
  emptyIcon:     { fontSize: 48, marginBottom: 8 },
  emptyTitle:    { color: 'white', fontSize: 20, fontWeight: '700' },
  emptySubtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  resultsCount:  { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 14, fontWeight: '500' },
  resultsQuery:  { color: '#AB773C', fontWeight: '700' },
  listContent:   { paddingBottom: 20 },
  separator:     { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 6 },
  resultCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 14, padding: 12, gap: 12 },
  resultImage:   { width: 56, height: 56, borderRadius: 28, backgroundColor: '#333' },
  resultInfo:    { flex: 1, gap: 3 },
  resultName:    { color: 'white', fontSize: 14, fontWeight: '600' },
  resultMeta:    { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  resultPrice:   { color: '#AB773C', fontSize: 12, fontWeight: '600' },
  bottomFab:     { position: 'absolute' },
  homeFab:       { overflow: 'hidden', shadowColor: '#AB773C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8 },
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING BOTTOM BAR
// ─────────────────────────────────────────────────────────────────────────────

interface FloatingBottomBarProps {
  m: Metrics; cartTotal: number;
  onHome: () => void; onCart: () => void; onSearchOpen: () => void;
}

const FloatingBottomBar = ({ m, cartTotal, onHome, onCart, onSearchOpen }: FloatingBottomBarProps) => {
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => StyleSheet.create({
    bottomBar:         { position: 'absolute', bottom: m.bottomBarBottom + insets.bottom, left: m.bottomBarPaddingH, right: m.bottomBarPaddingH, flexDirection: 'row', alignItems: 'center', gap: 10 },
    fab:               { width: m.fabSize, height: m.fabSize, borderRadius: m.fabSize / 2, backgroundColor: '#AB773C', justifyContent: 'center', alignItems: 'center', shadowColor: '#AB773C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8, overflow: 'hidden' },
    fabIconWrap:       { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#AB773C' },
    searchPill:        { flex: 1, height: m.searchPillHeight, backgroundColor: '#2A2A2A', borderRadius: m.searchPillHeight / 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5, overflow: 'hidden' },
    searchBg:          { position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%' },
    searchBgImage:     { width: '100%', height: '100%', opacity: 0.35 },
    searchPlaceholder: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: m.searchFontSize },
    cartFab:           { width: m.fabSize, height: m.fabSize, borderRadius: m.fabSize / 2, backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 7, overflow: 'hidden' },
    cartFabImage:      { position: 'absolute', width: '100%', height: '100%', opacity: 0.4 },
    cartIconWrap:      { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  }), [m, insets.bottom]);

  return (
    <View style={styles.bottomBar}>
      <TouchableOpacity style={styles.fab} onPress={onHome} activeOpacity={0.85}>
        <Image source={PLACEHOLDER} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={6} />
        <View style={[styles.fabIconWrap, { backgroundColor: 'rgba(171,119,60,0.82)' }]}>
          <HomeIcon scale={m.iconScale} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.searchPill} activeOpacity={0.9} onPress={onSearchOpen}>
        <View style={styles.searchBg}>
          <Image source={PLACEHOLDER} style={styles.searchBgImage} resizeMode="cover" />
        </View>
        <SearchIcon scale={m.iconScale} />
        <Text style={styles.searchPlaceholder}>Search Your Favorite ...</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cartFab} activeOpacity={0.85} onPress={onCart}>
        <Image source={PLACEHOLDER} style={styles.cartFabImage} resizeMode="cover" blurRadius={4} />
        <View style={styles.cartIconWrap}>
          <CartIcon scale={m.iconScale} badgeCount={cartTotal} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMO CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────

const PromoCarousel = ({ m }: { m: Metrics }) => {
  const flatListRef  = useRef<FlatList<PromoBanner>>(null);
  const currentIndex = useRef(PROMO_BANNERS.length);
  const isScrolling  = useRef(false);
  const isResetting  = useRef(false);
  const isMounted    = useRef(true);
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    isMounted.current = true;
    flatListRef.current?.scrollToIndex({ index: PROMO_BANNERS.length, animated: false });

    const timer = setInterval(() => {
      if (!isMounted.current || isScrolling.current || isResetting.current) return;
      const next = currentIndex.current + 1;
      if (next >= LOOPED_BANNERS.length) {
        isResetting.current  = true;
        const resetTo        = PROMO_BANNERS.length;
        currentIndex.current = resetTo;
        flatListRef.current?.scrollToIndex({ index: resetTo, animated: false });
        setActiveDot(0);
        isResetting.current = false;
        return;
      }
      currentIndex.current = next;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveDot(next % PROMO_BANNERS.length);
      if (next >= LOOPED_BANNERS.length - 1) {
        isResetting.current = true;
        setTimeout(() => {
          if (!isMounted.current) return;
          const resetTo        = PROMO_BANNERS.length;
          currentIndex.current = resetTo;
          flatListRef.current?.scrollToIndex({ index: resetTo, animated: false });
          isResetting.current  = false;
        }, 350);
      }
    }, PROMO_INTERVAL_MS);

    return () => { isMounted.current = false; clearInterval(timer); };
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    card:      { width: m.promoCardWidth, height: m.promoCardHeight, borderRadius: m.promoBorderRadius, backgroundColor: '#252525', marginRight: 16, flexDirection: 'row', overflow: 'hidden' },
    textBlock: { flex: 1, padding: m.promoPadding, justifyContent: 'center' },
    title:     { color: 'white', fontSize: m.promoTitleSize, fontWeight: '500', marginBottom: 2 },
    accent:    { color: '#AB773C', fontSize: m.promoAccentSize, fontWeight: '700', lineHeight: m.promoAccentSize * 1.2 },
    subtitle:  { color: 'rgba(255,255,255,0.85)', fontSize: m.promoSubtitleSize, fontWeight: '400', marginTop: 6, lineHeight: m.promoSubtitleSize * 1.4 },
    note:      { color: 'rgba(255,255,255,0.6)', fontSize: m.promoNoteSize, marginTop: 10, alignSelf: 'flex-end' },
    image:     { width: m.promoImageWidth, height: '100%' },
    dotsRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 6 },
    dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
    dotActive: { width: 18, height: 6, borderRadius: 3, backgroundColor: '#AB773C' },
  }), [m]);

  const itemLayout = useCallback(
    (_: unknown, index: number) => ({ length: m.promoCardWidth + 16, offset: (m.promoCardWidth + 16) * index, index }),
    [m.promoCardWidth],
  );

  const onScrollBeginDrag   = useCallback(() => { isScrolling.current = true; }, []);
  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const raw     = e.nativeEvent.contentOffset.x / (m.promoCardWidth + 16);
      const idx     = Math.round(raw);
      const clamped = Math.max(0, Math.min(idx, LOOPED_BANNERS.length - 1));
      currentIndex.current = clamped;
      setActiveDot(clamped % PROMO_BANNERS.length);
      isScrolling.current  = false;
    },
    [m.promoCardWidth],
  );

  const renderItem = useCallback(({ item }: { item: PromoBanner }) => (
    <View style={styles.card}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.accent}>{item.accentText}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
      </View>
      <Image source={item.image} style={styles.image} resizeMode="cover" />
    </View>
  ), [styles]);

  const keyExtractor = useCallback((item: PromoBanner, index: number) => `${item.id}-${index}`, []);

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={LOOPED_BANNERS}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: m.bodyPaddingH, paddingBottom: 12 }}
        snapToInterval={m.promoCardWidth + 16}
        decelerationRate="fast"
        initialScrollIndex={PROMO_BANNERS.length}
        getItemLayout={itemLayout}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={renderItem}
      />
      <View style={styles.dotsRow}>
        {PROMO_BANNERS.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeDot && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FOOD CARD
// ─────────────────────────────────────────────────────────────────────────────

const FoodCard = ({ item, onPress, m }: { item: FoodItem; onPress: (item: FoodItem) => void; m: Metrics }) => {
  const actualCount = useMemo(() => getFoodItemCount(item), [item]);

  const styles = useMemo(() => StyleSheet.create({
    cardContainer: { width: m.foodCardColWidth, height: m.foodCardHeight, marginVertical: 10, position: 'relative', overflow: 'visible' },
    cardInner:     { backgroundColor: '#2A2A2A', borderRadius: m.foodBorderRadius, padding: m.foodCardPadding, marginRight: m.foodImageSize * 0.25, height: m.foodCardInnerHeight },
    name:          { color: 'white', fontSize: m.foodNameSize, fontWeight: '700', letterSpacing: 0.3 },
    countRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    countNum:      { color: '#AB773C', fontSize: m.foodCountSize, fontWeight: '600' },
    countLabel:    { color: '#AB773C', fontSize: m.foodCountSize, fontWeight: '400' },
    image:         { width: m.foodImageSize, height: m.foodImageSize, borderRadius: m.foodImageSize / 2, position: 'absolute', bottom: 12, right: 0 },
  }), [m]);

  const handlePress = useCallback(() => onPress(item), [item, onPress]);

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.cardInner}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.countRow}>
          <Text style={styles.countNum}>{actualCount} </Text>
          <Text style={styles.countLabel}>Items</Text>
        </View>
      </View>
      <Image source={item.image} style={styles.image} resizeMode="cover" />
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY CARD
// ─────────────────────────────────────────────────────────────────────────────

const SubCategoryCard = ({ item, m, onPress }: { item: SubCategory; m: Metrics; onPress?: (item: SubCategory) => void }) => {
  const actualCount = getSubCatCount(item);

  const styles = useMemo(() => StyleSheet.create({
    card:       { width: m.subCardColWidth, height: m.subCardHeight, backgroundColor: '#333333', borderRadius: m.subBorderRadius, overflow: 'hidden', position: 'relative' },
    inner:      { padding: m.subPadding, flex: 1 },
    name:       { color: 'white', fontSize: m.subNameSize, fontWeight: '600' },
    countRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    countNum:   { color: 'rgba(171,119,60,0.9)', fontSize: m.subCountSize, fontWeight: '600' },
    countLabel: { color: 'rgba(171,119,60,0.9)', fontSize: m.subCountSize, fontWeight: '600' },
    tapHint:    { position: 'absolute', bottom: 8, left: m.subPadding },
    tapText:    { color: 'rgba(171,119,60,0.7)', fontSize: 10, fontWeight: '500' },
    image:      { width: m.subImageSize, height: m.subImageSize, borderRadius: m.subImageSize / 2, position: 'absolute', bottom: 8, right: 4, backgroundColor: '#D9D9D9' },
  }), [m]);

  const handlePress = useCallback(() => onPress?.(item), [item, onPress]);

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.82}>
      <View style={styles.inner}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.countRow}>
          <Text style={styles.countNum}>{String(actualCount).padStart(2, '0')} </Text>
          <Text style={styles.countLabel}>Items</Text>
        </View>
      </View>
      <View style={styles.tapHint}><Text style={styles.tapText}>View →</Text></View>
      <Image source={item.image} style={styles.image} resizeMode="cover" />
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MENU ITEM CARD
// ─────────────────────────────────────────────────────────────────────────────

const MenuItemCard = ({
  item, m, qty, onIncrement, onDecrement, onPress,
}: {
  item:        AnyMenuItem;
  m:           Metrics;
  qty:         number;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onPress?:    (item: AnyMenuItem) => void;
}) => {
  const imageSize    = m.menuImageSize;
  const imageOverlap = imageSize * 0.45;

  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      width:        m.menuCardColWidth,
      paddingTop:   imageOverlap,
      marginBottom: m.isTablet ? 28 : 20,
    },
    imageWrap: {
      position:   'absolute',
      top:        0,
      left:       0,
      right:      0,
      alignItems: 'center',
      zIndex:     2,
    },
    image: {
      width:           imageSize,
      height:          imageSize,
      borderRadius:    imageSize / 2,
      backgroundColor: '#D9D9D9',
    },
    card: {
      width:             '100%',
      borderRadius:      m.menuCardBorderRadius,
      borderWidth:       1,
      borderColor:       'rgba(201,201,201,0.5)',
      backgroundColor:   '#1E1E1E',
      paddingTop:        imageSize - imageOverlap + 8,
      paddingHorizontal: m.menuCardPaddingH,
      paddingBottom:     10,
    },
    name: {
      color:        'white',
      fontSize:     m.menuNameSize,
      fontWeight:   '500',
      marginBottom: 3,
    },
    price: {
      color:      'rgba(171,119,60,0.9)',
      fontSize:   m.menuPriceSize,
      fontWeight: '600',
    },
    addRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginTop:      10,
    },
  }), [m, imageSize, imageOverlap]);

  const imageSource = item.imageUrl ? { uri: item.imageUrl } : item.image;

  return (
    <TouchableOpacity
      style={styles.wrapper}
      activeOpacity={0.88}
      onPress={() => onPress?.(item)}
    >
      <View style={styles.imageWrap}>
        <Image source={imageSource} style={styles.image} resizeMode="cover" />
      </View>
      <View style={styles.card}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{item.price}</Text>
        <View style={styles.addRow}>
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
            <AddQtyButton
              itemId={item.id}
              qty={qty}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              fontSize={m.menuAddTextSize}
              paddingH={m.menuAddPaddingH}
              paddingV={m.menuAddPaddingV}
            />
          </TouchableOpacity>
          <ExpandIcon size={m.expandIconSize} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BACK HEADER
// ─────────────────────────────────────────────────────────────────────────────

const BackHeader = ({ m, onBack }: { m: Metrics; onBack: () => void }) => {
  const insets    = useSafeAreaInsets();
  const topOffset = insets.top + (m.isTablet ? 8 : m.isSmall ? 4 : 6);
  return (
    <TouchableOpacity
      style={{ position: 'absolute', top: topOffset, left: m.bodyPaddingH, width: m.backBtnSize, height: m.backBtnSize, borderRadius: m.backBtnSize / 2, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
      onPress={onBack}
      activeOpacity={0.8}
    >
      <BackIcon scale={m.iconScale} />
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ITEMS SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const SubItemsScreen = ({
  subCat, parentName, onBack, onHome, onCart,
  cart, cartTotal, onIncrement, onDecrement, searchItems,
}: {
  subCat:      SubCategory;
  parentName:  string;
  onBack:      () => void;
  onHome:      () => void;
  onCart:      () => void;
  cart:        CartMap;
  cartTotal:   number;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  searchItems: SearchableItem[];
}) => {
  const { width, height } = useWindowDimensions();
  const m      = useMemo(() => getMetrics(width, height), [width, height]);
  const insets = useSafeAreaInsets();

  const [searchVisible,    setSearchVisible]    = useState(false);
  const [selectedItem,     setSelectedItem]     = useState<AnyMenuItem | null>(null);
  const [itemModalVisible, setItemModalVisible] = useState(false);

  const openItemModal  = useCallback((it: AnyMenuItem) => { setSelectedItem(it); setItemModalVisible(true); }, []);
  const closeItemModal = useCallback(() => setItemModalVisible(false), []);

  const bottomPad   = m.fabSize + m.bottomBarBottom + insets.bottom + 24;
  const actualCount = subCat.items.length;

  const styles = useMemo(() => StyleSheet.create({
    container:     { flex: 1, backgroundColor: '#1B1B1B' },
    scrollView:    { flex: 1 },
    scrollContent: { paddingBottom: bottomPad },
    heroWrapper:   { width: '100%', height: m.subHeroHeight, overflow: 'hidden', borderBottomLeftRadius: m.width * 0.5, borderBottomRightRadius: m.width * 0.5, backgroundColor: '#000' },
    heroImage:     { width: '100%', height: '100%' },
    heroOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
    body:          { paddingHorizontal: m.bodyPaddingH, paddingTop: m.sectionGap },
    breadcrumb:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    breadParent:   { color: 'rgba(255,255,255,0.4)', fontSize: m.subItemCountSize, fontWeight: '500' },
    breadSep:      { color: 'rgba(255,255,255,0.3)', fontSize: m.subItemCountSize, marginHorizontal: 4 },
    breadCurrent:  { color: '#AB773C', fontSize: m.subItemCountSize, fontWeight: '600' },
    titleRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    title:         { color: 'white', fontSize: m.subItemTitleSize, fontWeight: '700', flex: 1, flexWrap: 'wrap' },
    count:         { color: '#AB773C', fontSize: m.subItemCountSize, fontWeight: '600', marginTop: 4 },
    description:   { color: 'rgba(255,255,255,0.5)', fontSize: m.subItemDescSize, lineHeight: m.subItemDescSize * 1.65, marginBottom: m.sectionGap },
    divider:       { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: m.sectionGap },
    gridLabel:     { color: 'rgba(255,255,255,0.6)', fontSize: m.subItemCountSize, fontWeight: '600', letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' },
    menuGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: m.menuCardGap, justifyContent: 'space-between', paddingTop: m.sectionGap },
  }), [m, bottomPad]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B1B1B" translucent />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroWrapper}>
          <Image source={subCat.heroImage} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <BackHeader m={m} onBack={onBack} />
        </View>
        <View style={styles.body}>
          <View style={styles.breadcrumb}>
            <Text style={styles.breadParent}>{parentName.toUpperCase()}</Text>
            <Text style={styles.breadSep}>›</Text>
            <Text style={styles.breadCurrent}>{subCat.name.toUpperCase()}</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{subCat.name.toUpperCase()}</Text>
            <Text style={styles.count}>{actualCount} Items</Text>
          </View>
          <Text style={styles.description}>{subCat.description}</Text>
          <View style={styles.divider} />
          <Text style={styles.gridLabel}>All Items</Text>
          <View style={styles.menuGrid}>
            {subCat.items.map(it => (
              <MenuItemCard
                key={it.id}
                item={it}
                m={m}
                qty={cart[it.id] ?? 0}
                onIncrement={onIncrement}
                onDecrement={onDecrement}
                onPress={openItemModal}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <FloatingBottomBar m={m} cartTotal={cartTotal} onHome={onHome} onCart={onCart} onSearchOpen={() => setSearchVisible(true)} />
      <SearchOverlay visible={searchVisible} onClose={() => setSearchVisible(false)} onHomePress={onHome} cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} m={m} searchItems={searchItems} />
      <ItemDetailModal item={selectedItem} visible={itemModalVisible} onClose={closeItemModal} cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} m={m} />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const DetailScreen = ({
  item, onBack, onHome, onCart, onSubCatPress,
  cart, cartTotal, onIncrement, onDecrement, searchItems,
}: {
  item:          FoodItem;
  onBack:        () => void;
  onHome:        () => void;
  onCart:        () => void;
  onSubCatPress: (subCat: SubCategory, parentName: string) => void;
  cart:          CartMap;
  cartTotal:     number;
  onIncrement:   (id: string) => void;
  onDecrement:   (id: string) => void;
  searchItems:   SearchableItem[];
}) => {
  const { width, height } = useWindowDimensions();
  const m      = useMemo(() => getMetrics(width, height), [width, height]);
  const insets = useSafeAreaInsets();

  const [searchVisible,    setSearchVisible]    = useState(false);
  const [selectedItem,     setSelectedItem]     = useState<AnyMenuItem | null>(null);
  const [itemModalVisible, setItemModalVisible] = useState(false);

  const openItemModal  = useCallback((it: AnyMenuItem) => { setSelectedItem(it); setItemModalVisible(true); }, []);
  const closeItemModal = useCallback(() => setItemModalVisible(false), []);

  const bottomPad   = m.fabSize + m.bottomBarBottom + insets.bottom + 24;
  const actualCount = useMemo(() => getFoodItemCount(item), [item]);

  const styles = useMemo(() => StyleSheet.create({
    container:     { flex: 1, backgroundColor: '#1B1B1B' },
    scrollView:    { flex: 1 },
    scrollContent: { paddingBottom: bottomPad },
    heroWrapper:   { width: '100%', height: m.heroHeight, overflow: 'hidden', borderBottomLeftRadius: m.width * 0.5, borderBottomRightRadius: m.width * 0.5, backgroundColor: '#000' },
    heroImage:     { width: '100%', height: '100%' },
    heroOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.12)' },
    bodyContent:   { paddingHorizontal: m.bodyPaddingH, paddingTop: m.sectionGap },
    titleRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    catTitle:      { color: 'white', fontSize: m.catTitleSize, fontWeight: '700', flex: 1, flexWrap: 'wrap' },
    catCount:      { color: '#AB773C', fontSize: m.catCountSize, fontWeight: '600', marginTop: 4 },
    description:   { color: 'rgba(255,255,255,0.5)', fontSize: m.descriptionSize, lineHeight: m.descriptionSize * 1.6, marginBottom: m.sectionGap },
    subCatRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: m.subCardGap, marginBottom: m.sectionGap },
    divider:       { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: m.sectionGap + 4 },
    menuGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: m.menuCardGap, justifyContent: 'space-between', paddingTop: m.sectionGap },
  }), [m, bottomPad]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B1B1B" translucent />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroWrapper}>
          <Image source={item.heroImage} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <BackHeader m={m} onBack={onBack} />
        </View>
        <View style={styles.bodyContent}>
          <View style={styles.titleRow}>
            <Text style={styles.catTitle}>{item.name.toUpperCase()}</Text>
            <Text style={styles.catCount}>{actualCount} Items</Text>
          </View>
          <Text style={styles.description}>{item.description}</Text>
          <View style={styles.subCatRow}>
            {item.subCategories.map(sub => (
              <SubCategoryCard key={sub.id} item={sub} m={m} onPress={sc => onSubCatPress(sc, item.name)} />
            ))}
          </View>
          <View style={styles.divider} />
          <View style={styles.menuGrid}>
            {item.menuItems.map(mi => (
              <MenuItemCard
                key={mi.id}
                item={mi}
                m={m}
                qty={cart[mi.id] ?? 0}
                onIncrement={onIncrement}
                onDecrement={onDecrement}
                onPress={openItemModal}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      {/* ✅ Fixed: use onCart prop instead of goToCart */}
      <FloatingBottomBar m={m} cartTotal={cartTotal} onHome={onHome} onCart={onCart} onSearchOpen={() => setSearchVisible(true)} />
      <SearchOverlay visible={searchVisible} onClose={() => setSearchVisible(false)} onHomePress={onHome} cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} m={m} searchItems={searchItems} />
      <ItemDetailModal item={selectedItem} visible={itemModalVisible} onClose={closeItemModal} cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} m={m} />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyTabState = ({ label }: { label: string }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 }}>
    <Text style={{ fontSize: 48 }}>🍽️</Text>
    <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Coming Soon</Text>
    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' }}>
      {label} items will be available soon.
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const FoodMenuScreen = () => {
  const { width, height } = useWindowDimensions();
  const m      = useMemo(() => getMetrics(width, height), [width, height]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Uses the same synchronised cache as Dining → Item Selection.
  const diningItems    = useItemStore((state) => state.items);
  const isMenuHydrated = useItemStore((state) => state.isHydrated);
  const hydrateItems   = useItemStore((state) => state.hydrateItems);

  const [activeTabKey, setActiveTabKey] = useState('');
  const [screen, setScreen]             = useState<Screen>({ name: 'home' });
  const [searchVisible, setSearchVisible] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  // This is the actual POS/Dining cart, not the old demo CartContext.
  const realCartItems = useCartStore((state) => state.cartItems);
  const addToRealCart = useCartStore((state) => state.addToCart);
  const updateRealCartQuantity = useCartStore((state) => state.updateQuantity);
  const setRealCartItems = useCartStore((state) => state.setCartItems);
  const diningSession = useMenuSessionStore((state) => state.diningSession);
  const savedCartItems = useMenuSessionStore((state) => state.savedCartItems);

  useEffect(() => {
    void hydrateItems();
  }, [hydrateItems]);

  // Restore a cart kept through the protected exit flow before showing the menu.
  useEffect(() => {
    if (realCartItems.length === 0 && savedCartItems.length > 0) {
      setRealCartItems(savedCartItems);
    }
  }, [realCartItems.length, savedCartItems, setRealCartItems]);

  const { tabs, foodItems } = useMemo(
    () => buildFoodItemsFromDiningData(diningItems),
    [diningItems],
  );

  const searchableItems = useMemo(() => buildSearchableItems(foodItems), [foodItems]);
  const menuItemByCode = useMemo(
    () => new Map(searchableItems.map((item) => [item.id, item])),
    [searchableItems],
  );

  const cart = useMemo<CartMap>(() => Object.fromEntries(
    realCartItems.map((item) => [item.menuItemCode, item.quantity]),
  ), [realCartItems]);
  const cartTotal = useMemo(
    () => realCartItems.reduce((sum, item) => sum + item.quantity, 0),
    [realCartItems],
  );

  const increment = useCallback((itemCode: string) => {
    const item = menuItemByCode.get(itemCode);
    if (!item) return;
    addToRealCart({
      menuItemCode: item.id,
      menuItmDes: item.name,
      salesPrice: parsePrice(item.price),
      itemRemarks: '',
    });
  }, [addToRealCart, menuItemByCode]);

  const decrement = useCallback((itemCode: string) => {
    updateRealCartQuantity(itemCode, -1);
  }, [updateRealCartQuantity]);

  useEffect(() => {
    setActiveTabKey((current) =>
      tabs.some((tab) => tab.key === current) ? current : (tabs[0]?.key ?? ''),
    );
  }, [tabs]);

  const activeTab = tabs.find((tab) => tab.key === activeTabKey);
  const filteredItems = useMemo(
    () => foodItems.filter((item) => item.category === activeTabKey),
    [foodItems, activeTabKey],
  );

  const goToCart = useCallback(() => {
    if (!diningSession) {
      router.replace('/Screens/menutbl_selection');
      return;
    }
    // Customers first review their order in the Menu Cart. Staff password
    // confirmation there is required before the real Dining Cart opens.
    router.push('/menu/menu_cart');
  }, [diningSession, router]);

  const goHome = useCallback(() => setExitModalVisible(true), []);

  const goToDetail   = useCallback((item: FoodItem) => setScreen({ name: 'detail', item }), []);
  const goToSubItems = useCallback(
    (subCat: SubCategory, parentName: string, parentCategory: FoodItem['category']) =>
      setScreen({ name: 'subItems', subCat, parentName, parentCategory }),
    [],
  );

  const goBack = useCallback(() => {
    setScreen((previous) => {
      if (previous.name === 'subItems') {
        const parent = foodItems.find((food) => food.name === previous.parentName);
        return parent ? { name: 'detail', item: parent } : { name: 'home' };
      }
      return { name: 'home' };
    });
  }, [foodItems]);

  const bottomPad = m.fabSize + m.bottomBarBottom + insets.bottom + 24;

  const styles = useMemo(() => StyleSheet.create({
    container:     { flex: 1, backgroundColor: '#1B1B1B' },
    header:        { height: m.headerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: m.headerPaddingH, paddingTop: 80, paddingBottom: 50 },
    headerBtn:     { width: m.headerBtnSize, height: m.headerBtnSize, justifyContent: 'center', alignItems: 'center' },
    logo:          { width: m.logoW, height: m.logoH },
    avatar:        { width: m.avatarSize, height: m.avatarSize, borderRadius: m.avatarSize / 2, backgroundColor: '#888', borderWidth: 2, borderColor: '#AB773C' },
    scroll:        { paddingBottom: bottomPad },
    tabBar:        { paddingHorizontal: m.bodyPaddingH, paddingTop: 8, paddingBottom: 16, gap: m.tabGap, flexDirection: 'row' },
    tab:           { paddingHorizontal: m.tabPaddingH, paddingVertical: m.tabPaddingV, borderRadius: m.tabBorderRadius, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'transparent' },
    tabActive:     { backgroundColor: '#AB773C', borderColor: '#AB773C' },
    tabText:       { color: 'rgba(255,255,255,0.7)', fontSize: m.tabFontSize, fontWeight: '600' },
    tabTextActive: { color: 'white' },
    grid:          { paddingHorizontal: m.bodyPaddingH, paddingBottom: 20 },
    gridRow:       { justifyContent: 'space-between' },
    loading:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText:   { color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  }), [m, bottomPad]);

  if (!isMenuHydrated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1B1B1B" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#AB773C" />
          <Text style={styles.loadingText}>Loading Dining menu…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen.name === 'subItems') {
    return (
      <>
        <SubItemsScreen
          subCat={screen.subCat}
          parentName={screen.parentName}
          onBack={goBack}
          onHome={goHome}
          onCart={goToCart}
          cart={cart}
          cartTotal={cartTotal}
          onIncrement={increment}
          onDecrement={decrement}
          searchItems={searchableItems}
        />
        <ProtectedMenuExitModal visible={exitModalVisible} onClose={() => setExitModalVisible(false)} />
      </>
    );
  }

  if (screen.name === 'detail') {
    return (
      <>
        <DetailScreen
          item={screen.item}
          onBack={goBack}
          onHome={goHome}
          onCart={goToCart}
          onSubCatPress={(subCategory, parentName) => goToSubItems(subCategory, parentName, screen.item.category)}
          cart={cart}
          cartTotal={cartTotal}
          onIncrement={increment}
          onDecrement={decrement}
          searchItems={searchableItems}
        />
        <ProtectedMenuExitModal visible={exitModalVisible} onClose={() => setExitModalVisible(false)} />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B1B1B" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
          <MenuIcon scale={m.iconScale} />
        </TouchableOpacity>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity activeOpacity={0.8}>
          <View style={styles.avatar} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PromoCarousel m={m} />
        {tabs.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTabKey === tab.key && styles.tabActive]}
                onPress={() => setActiveTabKey(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTabKey === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {filteredItems.length === 0 ? (
          <EmptyTabState label={activeTab?.label ?? 'Dining menu'} />
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => <FoodCard item={item} onPress={goToDetail} m={m} />}
          />
        )}
      </ScrollView>
      <FloatingBottomBar m={m} cartTotal={cartTotal} onHome={goHome} onCart={goToCart} onSearchOpen={() => setSearchVisible(true)} />
      <SearchOverlay
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onHomePress={goHome}
        cart={cart}
        onIncrement={increment}
        onDecrement={decrement}
        m={m}
        searchItems={searchableItems}
      />
      <ProtectedMenuExitModal visible={exitModalVisible} onClose={() => setExitModalVisible(false)} />
    </SafeAreaView>
  );
};

export default FoodMenuScreen;