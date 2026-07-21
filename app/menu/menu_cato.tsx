import { useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  FlatList,
  Image,
  ImageSourcePropType,
  Keyboard,
  Modal,
  Platform,
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
import { useCartContext } from '../menu/CartContext';

const LOGO        = require('../../assets/images/CAPTURE 1.png');
const PLACEHOLDER = require('../../assets/images/image-removebg-preview.png');

const STATUS_BAR_HEIGHT: number =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

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
  category:      'FOOD' | 'BEVERAGE' | 'OTHER';
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

const TABS = [
  { key: 'FOOD',     label: 'FOOD'     },
  { key: 'BEVERAGE', label: 'BEVERAGE' },
  { key: 'OTHER',    label: 'OTHER'    },
] as const;

type TabKey = typeof TABS[number]['key'];

const FOOD_ITEMS: FoodItem[] = [
  // ─── FOOD ────────────────────────────────────────────────────────────────
  {
    id: '1', name: 'Chinese', category: 'FOOD',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description:
      'Explore the rich, bold, and authentic flavors of the East! With over 80 delicious items on our menu—ranging from sizzling stir-fries and steaming bowls of noodles to crispy, flavor-packed appetizers—there is something perfect for everyone.\nDive in, explore the variety, and choose your favorite masterpiece today!\nTaste the tradition, crafted fresh just for you.',
    subCategories: [
      {
        id: 'c_sc1', name: 'Sawans',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'A delightful selection of traditional Sawan dishes, prepared with authentic spices and fresh ingredients sourced daily.',
        items: [
          { id: 'c_sc1_i1', name: 'Sawan Special',    price: 'Rs. 1200', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=300' },
          { id: 'c_sc1_i2', name: 'Crispy Sawan',     price: 'Rs. 980',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300' },
          { id: 'c_sc1_i3', name: 'Sawan Platter',    price: 'Rs. 1580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=300' },
          { id: 'c_sc1_i4', name: 'Steamed Sawan',    price: 'Rs. 1100', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=300' },
          { id: 'c_sc1_i5', name: 'Sawan with Sauce', price: 'Rs. 1350', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=300' },
        ],
      },
      {
        id: 'c_sc2', name: 'Chicken Specialities',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Our signature chicken dishes crafted by master chefs — from sizzling wok-tossed specials to slow-cooked aromatic classics.',
        items: [
          { id: 'c_sc2_i1', name: 'Devilled Chicken',      price: 'Rs. 1580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=300' },
          { id: 'c_sc2_i2', name: 'Honey Chilli Chicken',  price: 'Rs. 1680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=300' },
          { id: 'c_sc2_i3', name: 'Kung Pao Chicken',      price: 'Rs. 1490', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300' },
          { id: 'c_sc2_i4', name: 'Chicken Manchurian',    price: 'Rs. 1390', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300' },
          { id: 'c_sc2_i5', name: 'Sweet & Sour Chicken',  price: 'Rs. 1290', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1609167830220-7164aa360951?w=300' },
          { id: 'c_sc2_i6', name: 'Sesame Chicken',        price: 'Rs. 1480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=300' },
          { id: 'c_sc2_i7', name: "General Tso's Chicken", price: 'Rs. 1550', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=300' },
          { id: 'c_sc2_i8', name: 'Chilli Garlic Chicken', price: 'Rs. 1420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'c_m1', name: 'Devilled Fish',        price: 'Rs. 1580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300' },
      { id: 'c_m2', name: 'Singapore Fried Rice', price: 'Rs. 1190', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300' },
      { id: 'c_m3', name: 'Crispy Spring Roll',   price: 'Rs. 980',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300' },
      { id: 'c_m4', name: 'Wonton Soup',          price: 'Rs. 880',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
      { id: 'c_m5', name: 'Fried Rice',           price: 'Rs. 1080', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300' },
      { id: 'c_m6', name: 'Chow Mein',            price: 'Rs. 1150', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300' },
    ],
  },
  {
    id: '2', name: 'Indian', category: 'FOOD',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Savor the aromatic spices and vibrant colors of India. From creamy curries to crispy dosas, our authentic Indian dishes bring the subcontinent to your plate.',
    subCategories: [
      {
        id: 'in_sc1', name: 'Curries',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Rich, creamy and boldly spiced curries from across India.',
        items: [
          { id: 'in_sc1_i1', name: 'Butter Chicken', price: 'Rs. 1480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300' },
          { id: 'in_sc1_i2', name: 'Dal Makhani',    price: 'Rs. 1080', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' },
          { id: 'in_sc1_i3', name: 'Palak Paneer',   price: 'Rs. 1180', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300' },
          { id: 'in_sc1_i4', name: 'Rogan Josh',     price: 'Rs. 1580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=300' },
        ],
      },
      {
        id: 'in_sc2', name: 'Tandoor',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Freshly fired in our authentic clay tandoor oven.',
        items: [
          { id: 'in_sc2_i1', name: 'Tandoori Chicken', price: 'Rs. 1380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=300' },
          { id: 'in_sc2_i2', name: 'Seekh Kebab',      price: 'Rs. 1280', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565299715199-866c917206bb?w=300' },
          { id: 'in_sc2_i3', name: 'Garlic Naan',      price: 'Rs. 380',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1619985631105-6e01f2a6a5f3?w=300' },
          { id: 'in_sc2_i4', name: 'Tandoori Paneer',  price: 'Rs. 1180', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'in_m1', name: 'Butter Chicken', price: 'Rs. 1480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300' },
      { id: 'in_m2', name: 'Dal Makhani',    price: 'Rs. 1080', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' },
      { id: 'in_m3', name: 'Garlic Naan',    price: 'Rs. 380',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1619985631105-6e01f2a6a5f3?w=300' },
      { id: 'in_m4', name: 'Palak Paneer',   price: 'Rs. 1180', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300' },
    ],
  },
  {
    id: '3', name: 'Sri Lankan', category: 'FOOD',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Taste the tropical richness of Sri Lanka. With authentic dishes featuring coconut, spices, and fresh seafood.',
    subCategories: [
      {
        id: 'sl_sc1', name: 'Rice & Curry',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Traditional Sri Lankan rice and curry plates with a variety of side dishes.',
        items: [
          { id: 'sl_sc1_i1', name: 'Pol Sambol Rice',   price: 'Rs. 980',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300' },
          { id: 'sl_sc1_i2', name: 'Fish Ambul Thiyal', price: 'Rs. 1380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300' },
          { id: 'sl_sc1_i3', name: 'Chicken Curry',     price: 'Rs. 1180', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=300' },
          { id: 'sl_sc1_i4', name: 'Dhal Curry',        price: 'Rs. 780',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' },
        ],
      },
      {
        id: 'sl_sc2', name: 'Short Eats',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Delicious bite-sized Sri Lankan snacks, perfect for any time of day.',
        items: [
          { id: 'sl_sc2_i1', name: 'Kottu Roti',     price: 'Rs. 1180', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=300' },
          { id: 'sl_sc2_i2', name: 'Hoppers',        price: 'Rs. 680',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300' },
          { id: 'sl_sc2_i3', name: 'String Hoppers', price: 'Rs. 580',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=300' },
          { id: 'sl_sc2_i4', name: 'Isso Wade',      price: 'Rs. 480',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'sl_m1', name: 'Pol Sambol Rice',   price: 'Rs. 980',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300' },
      { id: 'sl_m2', name: 'Fish Ambul Thiyal', price: 'Rs. 1380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300' },
      { id: 'sl_m3', name: 'Kottu Roti',        price: 'Rs. 1180', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=300' },
      { id: 'sl_m4', name: 'Hoppers',           price: 'Rs. 680',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300' },
    ],
  },
  {
    id: '4', name: 'Pentry', category: 'FOOD',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Freshly baked goods and pantry staples crafted daily with quality ingredients.',
    subCategories: [
      {
        id: 'pt_sc1', name: 'Sweet',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Indulge in our sweet pastry selection, freshly baked every morning.',
        items: [
          { id: 'pt_sc1_i1', name: 'Butter Croissant', price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300' },
          { id: 'pt_sc1_i2', name: 'Pain au Chocolat', price: 'Rs. 560', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=300' },
          { id: 'pt_sc1_i3', name: 'Almond Danish',    price: 'Rs. 620', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
        ],
      },
      {
        id: 'pt_sc2', name: 'Savory',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Savory baked goods perfect for a quick snack or light meal.',
        items: [
          { id: 'pt_sc2_i1', name: 'Cheese Twist',   price: 'Rs. 520', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300' },
          { id: 'pt_sc2_i2', name: 'Herb Focaccia',  price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
          { id: 'pt_sc2_i3', name: 'Olive Ciabatta', price: 'Rs. 740', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'pt_m1', name: 'Butter Croissant', price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300' },
      { id: 'pt_m2', name: 'Pain au Chocolat', price: 'Rs. 560', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=300' },
      { id: 'pt_m3', name: 'Almond Danish',    price: 'Rs. 620', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
      { id: 'pt_m4', name: 'Cheese Twist',     price: 'Rs. 520', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300' },
    ],
  },
  {
    id: '5', name: 'Roty', category: 'FOOD',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Soft, flaky, and satisfying roti varieties made fresh daily.',
    subCategories: [
      {
        id: 'rt_sc1', name: 'Plain',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Simple, classic rotis made with love — perfect with any curry.',
        items: [
          { id: 'rt_sc1_i1', name: 'Plain Roti', price: 'Rs. 280', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300' },
          { id: 'rt_sc1_i2', name: 'Egg Roti',   price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300' },
        ],
      },
      {
        id: 'rt_sc2', name: 'Stuffed',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Generously stuffed rotis bursting with flavor in every bite.',
        items: [
          { id: 'rt_sc2_i1', name: 'Cheese Roti',  price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=300' },
          { id: 'rt_sc2_i2', name: 'Chicken Roti', price: 'Rs. 520', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=300' },
          { id: 'rt_sc2_i3', name: 'Veggie Roti',  price: 'Rs. 460', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'rt_m1', name: 'Plain Roti',   price: 'Rs. 280', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300' },
      { id: 'rt_m2', name: 'Egg Roti',     price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300' },
      { id: 'rt_m3', name: 'Cheese Roti',  price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=300' },
      { id: 'rt_m4', name: 'Chicken Roti', price: 'Rs. 520', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=300' },
    ],
  },
  {
    id: '6', name: 'Submarine', category: 'FOOD',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Loaded submarine sandwiches packed with fresh ingredients and signature sauces.',
    subCategories: [
      {
        id: 'sub_sc1', name: 'Classic',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Timeless classic submarine flavors you know and love.',
        items: [
          { id: 'sub_sc1_i1', name: 'Chicken Club Sub', price: 'Rs. 1180', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300' },
          { id: 'sub_sc1_i2', name: 'Tuna Melt Sub',    price: 'Rs. 1080', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=300' },
          { id: 'sub_sc1_i3', name: 'BLT Sub',          price: 'Rs. 1280', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300' },
          { id: 'sub_sc1_i4', name: 'Veggie Delight',   price: 'Rs. 980',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300' },
        ],
      },
      {
        id: 'sub_sc2', name: 'Signature',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: "Our chef's exclusive submarine creations — bold and unforgettable.",
        items: [
          { id: 'sub_sc2_i1', name: 'Spicy Italian', price: 'Rs. 1380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300' },
          { id: 'sub_sc2_i2', name: 'BBQ Beef Sub',  price: 'Rs. 1480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=300' },
          { id: 'sub_sc2_i3', name: 'Avocado Bliss', price: 'Rs. 1280', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1551782450-17144efb9c50?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'sub_m1', name: 'Chicken Club Sub', price: 'Rs. 1180', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300' },
      { id: 'sub_m2', name: 'Tuna Melt Sub',    price: 'Rs. 1080', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=300' },
      { id: 'sub_m3', name: 'Veggie Delight',   price: 'Rs. 980',  image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300' },
      { id: 'sub_m4', name: 'BLT Sub',          price: 'Rs. 1280', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300' },
    ],
  },
  {
    id: '7', name: 'Buffet', category: 'FOOD',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'All-you-can-eat experience with rotating stations. Freshly replenished throughout service.',
    subCategories: [
      {
        id: 'buf_sc1', name: 'Lunch',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Our lunch buffet spread features fresh hot dishes replenished every 30 minutes.',
        items: [
          { id: 'buf_sc1_i1', name: 'Lunch Buffet Standard', price: 'Rs. 2800', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300' },
          { id: 'buf_sc1_i2', name: 'Lunch Buffet Premium',  price: 'Rs. 3400', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=300' },
          { id: 'buf_sc1_i3', name: 'Kids Lunch Buffet',     price: 'Rs. 1800', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
          { id: 'buf_sc1_i4', name: 'Veg Lunch Buffet',      price: 'Rs. 2400', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300' },
        ],
      },
      {
        id: 'buf_sc2', name: 'Dinner',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'An elegant dinner buffet spread with premium dishes and live stations.',
        items: [
          { id: 'buf_sc2_i1', name: 'Dinner Buffet Standard', price: 'Rs. 3500', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=300' },
          { id: 'buf_sc2_i2', name: 'Dinner Buffet Premium',  price: 'Rs. 4200', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300' },
          { id: 'buf_sc2_i3', name: 'Weekend Brunch',         price: 'Rs. 3200', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
          { id: 'buf_sc2_i4', name: 'Seafood Night',          price: 'Rs. 4800', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'buf_m1', name: 'Lunch Buffet',   price: 'Rs. 2800', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300' },
      { id: 'buf_m2', name: 'Dinner Buffet',  price: 'Rs. 3500', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=300' },
      { id: 'buf_m3', name: 'Weekend Brunch', price: 'Rs. 3200', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
      { id: 'buf_m4', name: 'Veg Buffet',     price: 'Rs. 2400', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300' },
    ],
  },

  // ─── BEVERAGE ────────────────────────────────────────────────────────────
  {
    id: 'b1', name: 'Hot Drinks', category: 'BEVERAGE',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Warm up with our carefully curated selection of hot beverages — from rich espressos to soothing herbal teas.',
    subCategories: [
      {
        id: 'b1_sc1', name: 'Coffee',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Crafted from premium single-origin beans, brewed to perfection.',
        items: [
          { id: 'b1_sc1_i1', name: 'Espresso',   price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=300' },
          { id: 'b1_sc1_i2', name: 'Cappuccino', price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=300' },
          { id: 'b1_sc1_i3', name: 'Flat White',  price: 'Rs. 520', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300' },
          { id: 'b1_sc1_i4', name: 'Americano',  price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1521302200778-33500795e128?w=300' },
          { id: 'b1_sc1_i5', name: 'Latte',      price: 'Rs. 500', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=300' },
          { id: 'b1_sc1_i6', name: 'Mocha',      price: 'Rs. 550', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=300' },
        ],
      },
      {
        id: 'b1_sc2', name: 'Tea',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Handpicked teas sourced from the finest estates.',
        items: [
          { id: 'b1_sc2_i1', name: 'Ceylon Black Tea', price: 'Rs. 350', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300' },
          { id: 'b1_sc2_i2', name: 'Green Tea',        price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300' },
          { id: 'b1_sc2_i3', name: 'Chamomile Tea',    price: 'Rs. 400', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=300' },
          { id: 'b1_sc2_i4', name: 'Masala Chai',      price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'b1_m1', name: 'Espresso',         price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=300' },
      { id: 'b1_m2', name: 'Cappuccino',       price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=300' },
      { id: 'b1_m3', name: 'Ceylon Black Tea', price: 'Rs. 350', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300' },
      { id: 'b1_m4', name: 'Masala Chai',      price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=300' },
    ],
  },
  {
    id: 'b2', name: 'Cold Drinks', category: 'BEVERAGE',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Refreshing cold beverages to cool you down — from blended smoothies to sparkling favorites.',
    subCategories: [
      {
        id: 'b2_sc1', name: 'Smoothies',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Blended fresh fruit smoothies packed with vitamins.',
        items: [
          { id: 'b2_sc1_i1', name: 'Mango Blast',    price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=300' },
          { id: 'b2_sc1_i2', name: 'Berry Mix',       price: 'Rs. 620', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=300' },
          { id: 'b2_sc1_i3', name: 'Green Detox',     price: 'Rs. 650', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300' },
          { id: 'b2_sc1_i4', name: 'Banana Shake',    price: 'Rs. 540', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=300' },
          { id: 'b2_sc1_i5', name: 'Tropical Fusion', price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=300' },
        ],
      },
      {
        id: 'b2_sc2', name: 'Iced Coffee',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Cold-brewed and iced coffee specialties.',
        items: [
          { id: 'b2_sc2_i1', name: 'Iced Latte',    price: 'Rs. 560', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300' },
          { id: 'b2_sc2_i2', name: 'Cold Brew',      price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300' },
          { id: 'b2_sc2_i3', name: 'Iced Mocha',     price: 'Rs. 600', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=300' },
          { id: 'b2_sc2_i4', name: 'Caramel Frappé', price: 'Rs. 650', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'b2_m1', name: 'Mango Blast', price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=300' },
      { id: 'b2_m2', name: 'Iced Latte',  price: 'Rs. 560', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300' },
      { id: 'b2_m3', name: 'Cold Brew',   price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300' },
      { id: 'b2_m4', name: 'Berry Mix',   price: 'Rs. 620', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=300' },
    ],
  },
  {
    id: 'b3', name: 'Fresh Juices', category: 'BEVERAGE',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Freshly squeezed juices made daily from hand-picked fruits.',
    subCategories: [
      {
        id: 'b3_sc1', name: 'Citrus',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Tangy and refreshing citrus blends.',
        items: [
          { id: 'b3_sc1_i1', name: 'Orange Juice',     price: 'Rs. 450', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300' },
          { id: 'b3_sc1_i2', name: 'Lemonade',         price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?w=300' },
          { id: 'b3_sc1_i3', name: 'Grapefruit Juice', price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=300' },
          { id: 'b3_sc1_i4', name: 'Lime Soda',        price: 'Rs. 350', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300' },
        ],
      },
      {
        id: 'b3_sc2', name: 'Tropical',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Exotic tropical fruit juices bursting with flavor.',
        items: [
          { id: 'b3_sc2_i1', name: 'Pineapple Juice',  price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=300' },
          { id: 'b3_sc2_i2', name: 'Watermelon Juice', price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1585154986-f6719cac6e90?w=300' },
          { id: 'b3_sc2_i3', name: 'Coconut Water',    price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300' },
          { id: 'b3_sc2_i4', name: 'Passion Fruit',    price: 'Rs. 520', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'b3_m1', name: 'Orange Juice',    price: 'Rs. 450', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300' },
      { id: 'b3_m2', name: 'Pineapple Juice', price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=300' },
      { id: 'b3_m3', name: 'Lemonade',        price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?w=300' },
      { id: 'b3_m4', name: 'Coconut Water',   price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300' },
    ],
  },
  {
    id: 'b4', name: 'Milkshakes', category: 'BEVERAGE',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Thick, creamy milkshakes made with premium ice cream and fresh milk.',
    subCategories: [
      {
        id: 'b4_sc1', name: 'Classic',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Timeless classic milkshake flavors.',
        items: [
          { id: 'b4_sc1_i1', name: 'Chocolate Shake',  price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300' },
          { id: 'b4_sc1_i2', name: 'Vanilla Shake',    price: 'Rs. 620', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=300' },
          { id: 'b4_sc1_i3', name: 'Strawberry Shake', price: 'Rs. 650', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=300' },
          { id: 'b4_sc1_i4', name: 'Caramel Shake',    price: 'Rs. 700', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=300' },
        ],
      },
      {
        id: 'b4_sc2', name: 'Special',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Unique specialty milkshake creations.',
        items: [
          { id: 'b4_sc2_i1', name: 'Oreo Shake',    price: 'Rs. 750', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300' },
          { id: 'b4_sc2_i2', name: 'Nutella Shake', price: 'Rs. 780', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300' },
          { id: 'b4_sc2_i3', name: 'Lotus Biscoff', price: 'Rs. 800', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=300' },
          { id: 'b4_sc2_i4', name: 'Matcha Shake',  price: 'Rs. 720', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'b4_m1', name: 'Chocolate Shake', price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300' },
      { id: 'b4_m2', name: 'Oreo Shake',      price: 'Rs. 750', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300' },
      { id: 'b4_m3', name: 'Vanilla Shake',   price: 'Rs. 620', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=300' },
      { id: 'b4_m4', name: 'Matcha Shake',    price: 'Rs. 720', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300' },
    ],
  },

  // ─── OTHER ───────────────────────────────────────────────────────────────
  {
    id: 'o1', name: 'Desserts', category: 'OTHER',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Indulge your sweet tooth with our carefully crafted dessert collection.',
    subCategories: [
      {
        id: 'o1_sc1', name: 'Ice Cream',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Premium ice cream in a wide variety of flavors.',
        items: [
          { id: 'o1_sc1_i1', name: 'Vanilla Scoop',    price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1570197571499-166b36435e9f?w=300' },
          { id: 'o1_sc1_i2', name: 'Chocolate Scoop',  price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300' },
          { id: 'o1_sc1_i3', name: 'Strawberry Scoop', price: 'Rs. 380', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=300' },
          { id: 'o1_sc1_i4', name: 'Mango Scoop',      price: 'Rs. 400', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=300' },
          { id: 'o1_sc1_i5', name: 'Mint Choc Chip',   price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300' },
          { id: 'o1_sc1_i6', name: 'Cookie Dough',     price: 'Rs. 450', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1580915411954-282cb537dbe3?w=300' },
        ],
      },
      {
        id: 'o1_sc2', name: 'Cakes & Pastries',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Freshly baked cakes and pastries made in-house daily.',
        items: [
          { id: 'o1_sc2_i1', name: 'Chocolate Lava Cake', price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300' },
          { id: 'o1_sc2_i2', name: 'Cheesecake Slice',    price: 'Rs. 620', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300' },
          { id: 'o1_sc2_i3', name: 'Tiramisu',            price: 'Rs. 720', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300' },
          { id: 'o1_sc2_i4', name: 'Brownie Sundae',      price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1580915411954-282cb537dbe3?w=300' },
          { id: 'o1_sc2_i5', name: 'Waffles',             price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'o1_m1', name: 'Chocolate Lava Cake', price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300' },
      { id: 'o1_m2', name: 'Cheesecake Slice',    price: 'Rs. 620', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300' },
      { id: 'o1_m3', name: 'Brownie Sundae',      price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1580915411954-282cb537dbe3?w=300' },
      { id: 'o1_m4', name: 'Waffles',             price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=300' },
    ],
  },
  {
    id: 'o2', name: 'Snacks', category: 'OTHER',
    image: PLACEHOLDER, heroImage: PLACEHOLDER,
    description: 'Light bites and snacks perfect for any time of day.',
    subCategories: [
      {
        id: 'o2_sc1', name: 'Fried Snacks',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Crispy fried snacks made fresh to order.',
        items: [
          { id: 'o2_sc1_i1', name: 'French Fries',      price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=300' },
          { id: 'o2_sc1_i2', name: 'Onion Rings',       price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=300' },
          { id: 'o2_sc1_i3', name: 'Mozzarella Sticks', price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=300' },
          { id: 'o2_sc1_i4', name: 'Chicken Wings',     price: 'Rs. 780', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300' },
          { id: 'o2_sc1_i5', name: 'Calamari',          price: 'Rs. 680', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=300' },
        ],
      },
      {
        id: 'o2_sc2', name: 'Light Bites',
        image: PLACEHOLDER, heroImage: PLACEHOLDER,
        description: 'Healthier light bite options.',
        items: [
          { id: 'o2_sc2_i1', name: 'Garden Salad',  price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300' },
          { id: 'o2_sc2_i2', name: 'Caesar Salad',  price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=300' },
          { id: 'o2_sc2_i3', name: 'Bruschetta',    price: 'Rs. 520', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=300' },
          { id: 'o2_sc2_i4', name: 'Hummus & Pita', price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300' },
          { id: 'o2_sc2_i5', name: 'Spring Rolls',  price: 'Rs. 420', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300' },
        ],
      },
    ],
    menuItems: [
      { id: 'o2_m1', name: 'French Fries',  price: 'Rs. 480', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=300' },
      { id: 'o2_m2', name: 'Chicken Wings', price: 'Rs. 780', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300' },
      { id: 'o2_m3', name: 'Caesar Salad',  price: 'Rs. 580', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=300' },
      { id: 'o2_m4', name: 'Bruschetta',    price: 'Rs. 520', image: PLACEHOLDER, imageUrl: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=300' },
    ],
  },
];

// ─── Searchable flat list ────────────────────────────────────────────────────
interface SearchableItem extends SubCatItem {
  category:    string;
  subCategory: string;
}

const ALL_SEARCHABLE_ITEMS: SearchableItem[] = FOOD_ITEMS.flatMap(food => [
  ...food.menuItems.map(item => ({
    ...item,
    category:    food.name,
    subCategory: 'Menu',
  })),
  ...food.subCategories.flatMap(sc =>
    sc.items.map(item => ({
      ...item,
      category:    food.name,
      subCategory: sc.name,
    }))
  ),
]);

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
  const cleaned = priceStr.replace(/^[^0-9]+/, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
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
}

const SearchOverlay = ({ visible, onClose, onHomePress, cart, onIncrement, onDecrement, m }: SearchOverlayProps) => {
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
    return ALL_SEARCHABLE_ITEMS.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.subCategory.toLowerCase().includes(q)
    );
  }, [query]);

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
                  {results.length} result{results.length !== 1 ? 's' : ''} for "
                  <Text style={searchStyles.resultsQuery}>{query.trim()}</Text>"
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
  cart, cartTotal, onIncrement, onDecrement,
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
      <SearchOverlay visible={searchVisible} onClose={() => setSearchVisible(false)} onHomePress={onHome} cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} m={m} />
      <ItemDetailModal item={selectedItem} visible={itemModalVisible} onClose={closeItemModal} cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} m={m} />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const DetailScreen = ({
  item, onBack, onHome, onCart, onSubCatPress,
  cart, cartTotal, onIncrement, onDecrement,
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
      <SearchOverlay visible={searchVisible} onClose={() => setSearchVisible(false)} onHomePress={onHome} cart={cart} onIncrement={onIncrement} onDecrement={onDecrement} m={m} />
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

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [screen, setScreen]                 = useState<Screen>({ name: 'home' });
  const [searchVisible, setSearchVisible]   = useState(false);

  const { cart, increment, decrement, total: cartTotal, registerItems } = useCartContext();

  useEffect(() => {
    const allItems = FOOD_ITEMS.flatMap(f => [
      ...f.menuItems,
      ...f.subCategories.flatMap(sc => sc.items),
    ]);
    registerItems(allItems);
  }, [registerItems]);

  const activeTabKey = TABS[activeTabIndex].key;

  const filteredItems = useMemo(
    () => FOOD_ITEMS.filter(item => item.category === activeTabKey),
    [activeTabKey],
  );

  const goToCart = useCallback(() => router.push('/menu/menu_cart'), [router]);
  const goHome   = useCallback(() => router.replace('/menu/menu_clear'), [router]);

  const goToDetail   = useCallback((item: FoodItem) => setScreen({ name: 'detail', item }), []);
  const goToSubItems = useCallback(
    (subCat: SubCategory, parentName: string, parentCategory: FoodItem['category']) =>
      setScreen({ name: 'subItems', subCat, parentName, parentCategory }),
    [],
  );

  const goBack = useCallback(() => {
    setScreen(prev => {
      if (prev.name === 'subItems') {
        const parent = FOOD_ITEMS.find(f => f.name === prev.parentName);
        if (parent) return { name: 'detail', item: parent };
        return { name: 'home' };
      }
      return { name: 'home' };
    });
  }, []);

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
  }), [m, bottomPad]);

  if (screen.name === 'subItems') {
    return (
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
      />
    );
  }

  if (screen.name === 'detail') {
    return (
      <DetailScreen
        item={screen.item}
        onBack={goBack}
        onHome={goHome}
        onCart={goToCart}
        onSubCatPress={(sc, parentName) => goToSubItems(sc, parentName, screen.item.category)}
        cart={cart}
        cartTotal={cartTotal}
        onIncrement={increment}
        onDecrement={decrement}
      />
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((tab, idx) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTabIndex === idx && styles.tabActive]}
              onPress={() => setActiveTabIndex(idx)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTabIndex === idx && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {filteredItems.length === 0 ? (
          <EmptyTabState label={TABS[activeTabIndex].label} />
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <FoodCard item={item} onPress={goToDetail} m={m} />
            )}
          />
        )}
      </ScrollView>
      <FloatingBottomBar m={m} cartTotal={cartTotal} onHome={goHome} onCart={goToCart} onSearchOpen={() => setSearchVisible(true)} />
      <SearchOverlay visible={searchVisible} onClose={() => setSearchVisible(false)} onHomePress={goHome} cart={cart} onIncrement={increment} onDecrement={decrement} m={m} />
    </SafeAreaView>
  );
};

export default FoodMenuScreen;