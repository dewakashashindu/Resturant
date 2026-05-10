import { useLocalSearchParams, useRouter } from 'expo-router';

import React, { useState } from 'react';

import {
  Image,

  ImageSourcePropType,

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

  View
} from 'react-native';

import { categories, Category, SubCategory } from '../../data/categories';



type Level = 'category' | 'subcategory' | 'items';



// ── COLORED CARD (Screen 1 & 2) ────────────────

interface ColorCardProps {

  label: string;

  color: string;

  icon?: ImageSourcePropType;

  onPress?: () => void;

}



const ColorCard = ({ label, color, icon, onPress }: ColorCardProps) => {

  const { width, height } = useWindowDimensions();

  const isTablet = width >= 600;

  const isSmall  = height < 700;



  const cardW   = (width - 32 - 24) / 2;

  const cardH   = cardW * (isTablet ? 0.9 : 0.6);

  const imgSize = isTablet ? 56 : isSmall ? 38 : 46;

  const labelFs = isTablet ? 15 : isSmall ? 11 : 13;

  return (

    <TouchableOpacity

      activeOpacity={0.82}

      onPress={onPress}

      style={[styles.colorCard, { backgroundColor: color, width: cardW, height: cardH }]}

    >

      <View style={styles.colorCardDeco} />



      <View style={{ width: imgSize, height: imgSize, marginBottom: 8 }}>

        {icon

          ? <Image source={icon} style={{ width: '100%', height: '100%' }} resizeMode="contain" />

          : <View style={[styles.iconPlaceholder, { width: imgSize, height: imgSize, borderRadius: imgSize / 2 }]} />

        }

      </View>



      <Text style={[styles.colorCardText, { fontSize: labelFs }]} numberOfLines={2}>

        {label}

      </Text>

    </TouchableOpacity>

  );

};



//  WHITE ITEM CARD (Screen 3) 

interface ItemCardProps {

  label: string;

  itemId?: string;

  price?: number;

  icon?: ImageSourcePropType;

  onAdd?: () => void;
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onPressDetails?: () => void;

}



const ItemCard = ({ label, itemId, price, icon, onAdd, quantity, onIncrement, onDecrement, onPressDetails }: ItemCardProps) => {

  const { width, height } = useWindowDimensions();

  const isTablet = width >= 600;

  const isSmall  = height < 700;



  const cardW   = (width - 32 - 24) / 2;

  const imgSize = cardW - 4; // almost full card width

  const labelFs = isTablet ? 15 : isSmall ? 12 : 14;

  const priceFs = isTablet ? 13 : isSmall ? 10 : 11;

  const addFs   = isTablet ? 12 : isSmall ? 10 : 11;



  return (

    <View style={[styles.itemCard, { width: cardW }]}>

      <TouchableOpacity activeOpacity={0.9} onPress={onPressDetails} style={styles.itemTopArea}>
        {/* Square Image */}
        <View style={[styles.itemImageBox, { width: imgSize, height: imgSize }]}> 
          {icon
            ? <Image source={icon} style={styles.fillImage} resizeMode="cover" />
            : <Image
                source={{ uri: 'https://placehold.co/112x112' }}
                style={styles.fillImage}
                resizeMode="cover"
              />
          }
        </View>

        {/* Name */}
        <Text style={[styles.itemLabel, { fontSize: labelFs }]} numberOfLines={2}>
          {label}
        </Text>

        {!!itemId && (
          <Text style={[styles.itemIdText, { fontSize: priceFs }]} numberOfLines={1}>
            ID: {itemId}
          </Text>
        )}
      </TouchableOpacity>



      {/* Price */}


      {price !== undefined && (
        <Text style={[styles.itemPrice, { fontSize: priceFs }]}> 
          Rs. {price}
        </Text>
      )}

      {/* ADD + or quantity controls */}
      {quantity && quantity > 0 ? (
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={onDecrement} activeOpacity={0.8}>
            <Text style={styles.qtyBtnText}>-</Text>
          </TouchableOpacity>

          <Text style={[styles.qtyNumber, { fontSize: addFs }]}>{quantity}</Text>

          <TouchableOpacity style={styles.qtyBtn} onPress={onIncrement} activeOpacity={0.8}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
          <Text style={[styles.addBtnText, { fontSize: addFs }]}>ADD +</Text>
        </TouchableOpacity>
      )}

    </View>

  );

};



//  MAIN SCREEN 

export default function ItemSelection() {

  const router   = useRouter();

  const { tableId } = useLocalSearchParams<{ tableId: string }>();

  const { width, height } = useWindowDimensions();



  const [dropdownVisible,  setDropdownVisible]  = useState(false);

  const [level,            setLevel]            = useState<Level>('category');

  const [selectedCategory, setSelectedCategory] = useState<Category   | null>(null);

  const [selectedSub,      setSelectedSub]      = useState<SubCategory | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedItem, setSelectedItem] = useState<{ key: string; label: string; price?: number; icon?: ImageSourcePropType } | null>(null);
  const [itemDetailsVisible, setItemDetailsVisible] = useState(false);
  const [orderRemark, setOrderRemark] = useState('');
  const [searchQuery, setSearchQuery] = useState('');



  const isTablet = width  >= 600;

  const isSmall  = height < 700;



  // ── RESPONSIVE ───────────────────────────────

  const headerH      = isTablet ? 250 : isSmall ? 65  : 200;

  const titleSize    = isTablet ? 32  : isSmall ? 16  : 24;

  const hPad         = isTablet ? 20  : 16;

  const backIconSize = isTablet ? 44  : isSmall ? 14  : 44;

  const backBtnSize  = isTablet ? 40  : isSmall ? 30  : 34;

  const badgeFs      = isTablet ? 16  : isSmall ? 11  : 12;

  const badgePadH    = isTablet ? 16  : isSmall ? 10  : 12;

  const badgePadV    = isTablet ? 12  : isSmall ? 5   : 6;

  const sectionFont  = isTablet ? 20  : isSmall ? 10  : 12;

  const sectionMT    = isTablet ? 20  : isSmall ? 12  : 16;

  const gridGap      = isTablet ? 16  : isSmall ? 10  : 12;

  const breadFs      = isTablet ? 14  : isSmall ? 11  : 12;



  // TITLES 

  const headerTitle = level === 'category'

    ? 'Item Selection'

    : level === 'subcategory'

    ? selectedCategory?.label ?? ''

    : selectedSub?.label ?? '';



  const sectionLabel = level === 'category'

    ? `CATEGORIES — ${categories.length}`

    : level === 'subcategory'

    ? `${selectedCategory?.label.toUpperCase()} — ${selectedCategory?.subCategories.length} ITEMS`

    : `${selectedSub?.label.toUpperCase()} — ${selectedSub?.items.length} ITEMS`;



  // BACK

  const handleBack = () => {

    if (level === 'items') {

      setSelectedSub(null);

      setLevel('subcategory');

    } else if (level === 'subcategory') {

      setSelectedCategory(null);

      setLevel('category');

    } else {

      router.back();

    }

  };

  // CURRENT COUNT

  const currentCount = level === 'category'

    ? categories.length

    : level === 'subcategory'

    ? selectedCategory?.subCategories.length ?? 0

    : selectedSub?.items.length ?? 0;

  const selectedItemCount = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (value?: string) => !normalizedSearch || (value ?? '').toLowerCase().includes(normalizedSearch);

  const filteredCategories = categories.filter((cat) => matchesSearch(cat.label));

  const filteredSubCategories = selectedCategory?.subCategories.filter((sub) => matchesSearch(sub.label)) ?? [];

  const filteredItems = selectedSub?.items
    .map((item, index) => ({
      item,
      key: `${selectedSub.label}-${index}`,
      itemId: `ITEM-${String(index + 1).padStart(2, '0')}`,
    }))
    .filter(({ item, itemId }) => matchesSearch(item.label) || matchesSearch(itemId)) ?? [];



  const tableInfo = [

    { label: 'Table',  value: tableId ?? '—'  },

    { label: 'Status', value: 'Active'         },

    { label: 'Floor',  value: 'Ground Floor'   },

  ];

  const openItemDetails = (item: { key: string; label: string; price?: number; icon?: ImageSourcePropType }) => {
    setSelectedItem(item);
    setOrderRemark('');
    setItemDetailsVisible(true);
  };

  const closeItemDetails = () => {
    setItemDetailsVisible(false);
    setSelectedItem(null);
  };



  return (

    <SafeAreaView style={styles.container}>

      <StatusBar backgroundColor="#002748" barStyle="light-content" />



      {/* ── HEADER ── */}

      <View style={[styles.header, { height: headerH, paddingHorizontal: hPad }]}> 

        <View style={styles.headerTopRow}>

        <TouchableOpacity

          style={[styles.backButton, { width: backBtnSize, height: backBtnSize, borderRadius: backBtnSize / 2 }]}

          onPress={handleBack}

        >

          <Image

            source={require('../../assets/icons/back.png')}

            style={{ width: backIconSize, height: backIconSize, tintColor: '#FFF' }}

            resizeMode="contain"

          />


        </TouchableOpacity>

        <Text style={[styles.headerTitle, { fontSize: titleSize }]} numberOfLines={1}>

          {headerTitle}

        </Text>



        <TouchableOpacity

          style={[styles.tableBadge, { paddingHorizontal: badgePadH, paddingVertical: badgePadV }]}

          onPress={() => setDropdownVisible(true)}

          activeOpacity={0.8}

        >

          <Text style={[styles.tableBadgeText, { fontSize: badgeFs }]}>

            {tableId ?? 'Table'}

          </Text>

          <View style={styles.dropdownArrow} />

        </TouchableOpacity>

        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={level === 'items' ? 'Search item name or ID' : 'Search'}
            placeholderTextColor="rgba(255,255,255,0.75)"
            style={[styles.searchInput, { fontSize: isTablet ? 16 : 14 }]}
          />
        </View>

      </View>



      {/* ── DROPDOWN MODAL ── */}

      <Modal

        visible={dropdownVisible}

        transparent

        animationType="fade"

        onRequestClose={() => setDropdownVisible(false)}

      >

        <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>

          <View style={styles.modalOverlay}>

            <TouchableWithoutFeedback>

              <View style={[styles.dropdown, { right: hPad, top: headerH + 8, minWidth: isTablet ? 240 : 200 }]}>

                <View style={styles.dropdownHeader}>

                  <Text style={[styles.dropdownTitle, { fontSize: isTablet ? 16 : 14 }]}>

                    Table Info

                  </Text>

                  <TouchableOpacity onPress={() => setDropdownVisible(false)}>

                    <Text style={[styles.dropdownClose, { fontSize: isTablet ? 16 : 14 }]}>✕</Text>

                  </TouchableOpacity>

                </View>

                <View style={styles.divider} />

                {tableInfo.map((item, i) => (

                  <View key={i} style={styles.dropdownRow}>

                    <Text style={[styles.dropdownLabel, { fontSize: isTablet ? 14 : 13 }]}>{item.label}</Text>

                    <Text style={[styles.dropdownValue, { fontSize: isTablet ? 14 : 13 }]}>{item.value}</Text>

                  </View>

                ))}

                <View style={styles.divider} />

                <TouchableOpacity

                  style={[styles.changeTableBtn, { paddingVertical: isTablet ? 12 : 10 }]}

                  onPress={() => { setDropdownVisible(false); router.push('/Screens/tableselection'); }}

                >

                  <Text style={[styles.changeTableText, { fontSize: isTablet ? 14 : 13 }]}>

                    Change Table

                  </Text>

                </TouchableOpacity>

              </View>

            </TouchableWithoutFeedback>

          </View>

        </TouchableWithoutFeedback>

      </Modal>



      {/* ── CONTENT ── */}

      <ScrollView

        showsVerticalScrollIndicator={false}

        contentContainerStyle={[

          styles.content,

          { paddingHorizontal: hPad, paddingBottom: isTablet ? 180 : 140 },

        ]}

      >

        {/* Breadcrumb */}

        {level !== 'category' && (

          <View style={styles.breadcrumbRow}>

            <TouchableOpacity onPress={() => { setLevel('category'); setSelectedCategory(null); setSelectedSub(null); }}>

              <Text style={[styles.breadLink, { fontSize: breadFs }]}>All Categories</Text>

            </TouchableOpacity>



            {selectedCategory && (

              <>

                <Text style={[styles.breadSep, { fontSize: breadFs }]}> › </Text>

                <TouchableOpacity

                  onPress={() => {

                    if (level === 'items') { setLevel('subcategory'); setSelectedSub(null); }

                  }}

                >

                  <Text style={[

                    level === 'subcategory' ? styles.breadActive : styles.breadLink,

                    { fontSize: breadFs },

                  ]}>

                    {selectedCategory.label}

                  </Text>

                </TouchableOpacity>

              </>

            )}



            {level === 'items' && selectedSub && (

              <>

                <Text style={[styles.breadSep, { fontSize: breadFs }]}> › </Text>

                <Text style={[styles.breadActive, { fontSize: breadFs }]}>

                  {selectedSub.label}

                </Text>

              </>

            )}

          </View>

        )}



        {/* Section Label */}

        <Text style={[styles.sectionTitle, { fontSize: sectionFont, marginTop: sectionMT }]}>

          {sectionLabel}

        </Text>



        {/* ── SCREEN 1: Categories ── */}

        {level === 'category' && (

          <View style={[styles.grid, { gap: gridGap }]}>

            {filteredCategories.slice(0, 6).map((cat, i) => (

              <ColorCard

                key={i}

                label={cat.label}

                color={cat.color}

                icon={cat.icon}

                onPress={() => { setSelectedCategory(cat); setLevel('subcategory'); }}

              />

            ))}

          </View>

        )}



        {/* ── SCREEN 2: Subcategories ── */}

        {level === 'subcategory' && selectedCategory && (

          <View style={[styles.grid, { gap: gridGap }]}>

            {filteredSubCategories.map((sub, i) => (

              <ColorCard

                key={i}

                label={sub.label}

                color={sub.color}

                icon={sub.icon}

                onPress={() => { setSelectedSub(sub); setLevel('items'); }}

              />

            ))}

            {selectedCategory.subCategories.length % 3 !== 0 && (

              <View style={{ width: (width - 32 - 24) / 3 }} />

            )}

          </View>

        )}



        {/* ── SCREEN 3: Items with ADD button ── */}

        {level === 'items' && selectedSub && (

          <View style={[styles.grid, { gap: gridGap }]}>

            {filteredItems.map(({ item, key, itemId }, i) => {
              const qty = quantities[key] ?? 0;
              return (
                <ItemCard
                  key={i}
                  label={item.label}
                  itemId={itemId}
                  price={item.price}
                  icon={item.icon}
                  quantity={qty}
                  onPressDetails={() => openItemDetails({ key, label: item.label, price: item.price, icon: item.icon })}
                  onAdd={() => {
                    setQuantities(q => ({ ...q, [key]: 1 }));
                    console.log('Add to order:', item.label, '| Rs.', item.price, '| Table:', tableId);
                  }}
                  onIncrement={() => setQuantities(q => ({ ...q, [key]: (q[key] ?? 0) + 1 }))}
                  onDecrement={() => setQuantities(q => {
                    const next = { ...q };
                    const v = (next[key] ?? 0) - 1;
                    if (v <= 0) delete next[key]; else next[key] = v;
                    return next;
                  })}
                />
              );
            })}

            {filteredItems.length % 3 !== 0 && (

              <View style={{ width: (width - 32 - 24) / 3 }} />

            )}

          </View>

        )}

      </ScrollView>

      <TouchableOpacity
        style={[styles.goToCartBtn, { left: hPad, right: hPad }]}
        activeOpacity={0.9}
        onPress={() => router.push('/Screens/cart')}
      >
        <Text style={styles.goToCartText}>Go to Cart</Text>
        <View style={styles.goToCartBadge}>
          <Text style={styles.goToCartBadgeText}>{selectedItemCount}</Text>
        </View>
      </TouchableOpacity>

      {/* ── ITEM DETAIL BOTTOM SHEET ── */}
      <Modal
        visible={itemDetailsVisible}
        transparent
        animationType="slide"
        onRequestClose={closeItemDetails}
      >
        <TouchableWithoutFeedback onPress={closeItemDetails}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.bottomSheet}>
                <View style={styles.sheetHandle} />

                <View style={styles.sheetImageWrap}>
                  <Image
                    source={selectedItem?.icon ?? { uri: 'https://placehold.co/402x176' }}
                    style={styles.sheetImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity style={styles.sheetAddBadge} activeOpacity={0.8} onPress={() => {
                    if (!selectedItem) return;
                    const next = (quantities[selectedItem.key] ?? 0) + 1;
                    setQuantities(q => ({ ...q, [selectedItem.key]: next }));
                  }}>
                    <Text style={styles.sheetAddBadgeText}>
                      {selectedItem && (quantities[selectedItem.key] ?? 0) > 0 ? 'ADD +' : 'ADD'}
                    </Text>
                    <Text style={styles.sheetAddPlus}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sheetTitle}>{selectedItem?.label ?? ''}</Text>
                <Text style={styles.sheetItemId}>ID: {selectedItem?.key ?? ''}</Text>
                <Text style={styles.sheetPrice}>Lkr {selectedItem?.price?.toFixed(2) ?? '0.00'}</Text>

                <View style={styles.remarkInputWrap}>
                  <TextInput
                    value={orderRemark}
                    onChangeText={setOrderRemark}
                    placeholder="Order Remark"
                    placeholderTextColor="rgba(0,0,0,0.5)"
                    style={styles.remarkInput}
                    multiline={false}
                  />
                </View>

                <TouchableOpacity
                  style={styles.definedRemarkBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!selectedItem) return;
                    setOrderRemark('');
                    setQuantities(q => ({ ...q, [selectedItem.key]: Math.max(1, (q[selectedItem.key] ?? 0)) }));
                    closeItemDetails();
                  }}
                >
                  <Text style={styles.definedRemarkBtnText}>Add Defined Remarks</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  container:       { flex: 1, backgroundColor: '#F4F6F8' },



  //  HEADER 

  header:          { backgroundColor: '#002748', justifyContent: 'center' },

  headerTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  backButton:      {  },

  headerTitle:     { fontWeight: '700', color: '#FFF', flex: 1, textAlign: 'center', marginHorizontal: 8 },



  // TABLE BADGE 

  tableBadge:      { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, alignItems: 'center', gap: 6 },

  tableBadgeText:  { color: '#FFF', fontWeight: '600' },

  dropdownArrow:   { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFF' },

  searchWrap:      { marginTop: 12 },

  searchInput:     { width: '100%', height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', color: '#FFF', paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },



  // ── MODAL & DROPDOWN 

  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },

  dropdown:        { position: 'absolute', backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 8, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },

  dropdownHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },

  dropdownTitle:   { fontWeight: '700', color: '#002748' },

  dropdownClose:   { color: '#888', fontWeight: '600' },

  divider:         { height: 1, backgroundColor: '#EEE', marginVertical: 4 },

  dropdownRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },

  dropdownLabel:   { color: '#666', fontWeight: '500' },

  dropdownValue:   { color: '#000', fontWeight: '700' },

  changeTableBtn:  { marginHorizontal: 12, marginTop: 4, marginBottom: 6, backgroundColor: '#002748', borderRadius: 10, alignItems: 'center' },

  changeTableText: { color: '#FFF', fontWeight: '700' },



  // SCONTENT 

  content:         { paddingTop: 4 },



  //  BREADCRUMB 

  breadcrumbRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginTop: 8, flexWrap: 'wrap' },

  breadLink:       { color: '#0062AA', fontWeight: '500' },

  breadSep:        { color: '#999' },

  breadActive:     { color: '#002748', fontWeight: '700' },

  sectionTitle:    { fontWeight: '700', color: '#666', marginBottom: 12 },



  

  grid:            { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },



  // ── COLORED CARD (S1 & S2) ──────────────────

  colorCard:       { borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 10, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, marginBottom: 12 },

  colorCardDeco:   { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.18)', top: -15, right: -15 },

  iconPlaceholder: { backgroundColor: 'rgba(255,255,255,0.4)' },

  colorCardText:   { fontWeight: '600', textAlign: 'center', color: '#000', marginTop: 4 },



  // ── WHITE ITEM CARD (S3) ────────────────────

  itemCard:        { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 14, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, alignItems: 'center', paddingBottom: 10 },
  itemTopArea:     { alignItems: 'center', width: '100%' },

  itemImageBox:    { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE' },

  fillImage:       { width: '100%', height: '100%' },

  itemLabel:       { fontWeight: '600', color: '#000', marginTop: 8, paddingHorizontal: 6, textAlign: 'center' },

  itemIdText:      { color: '#0062AA', fontWeight: '700', marginTop: 2, paddingHorizontal: 6, textAlign: 'center' },

  itemPrice:       { color: '#666', fontWeight: '500', marginTop: 2 },



  // ── ADD BUTTON ──────────────────────────────

  addBtn:          { backgroundColor: '#F2DDCB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 4, marginTop: 8 },

  addBtnText:      { color: '#333', fontWeight: '700' },
  qtyRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBtn:          { backgroundColor: '#EEE', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  qtyBtnText:      { fontWeight: '700', color: '#222' },
  qtyNumber:       { fontWeight: '700', color: '#222', minWidth: 28, textAlign: 'center' },

  goToCartBtn:     { position: 'absolute', bottom: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#002748', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6 },
  goToCartText:    { color: '#FFF', fontSize: 16, fontWeight: '700' },
  goToCartBadge:   { marginLeft: 10, minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#8D9ED4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  goToCartBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // ── ITEM DETAIL SHEET ───────────────────────
  sheetOverlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  bottomSheet:     { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24, overflow: 'hidden' },
  sheetHandle:     { alignSelf: 'center', width: 54, height: 5, borderRadius: 999, backgroundColor: '#D9D9D9', marginTop: 10, marginBottom: 14 },
  sheetImageWrap:  { position: 'relative', marginHorizontal: 18, borderRadius: 12, overflow: 'hidden' },
  sheetImage:      { width: '100%', height: 176, backgroundColor: '#D9D9D9' },
  sheetAddBadge:   { position: 'absolute', right: 0, bottom: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2DDCB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  sheetAddBadgeText: { fontSize: 12, fontWeight: '500', color: '#000', marginRight: 4 },
  sheetAddPlus:    { fontSize: 14, fontWeight: '500', color: '#000' },
  sheetTitle:      { marginTop: 18, marginHorizontal: 18, fontSize: 24, fontWeight: '600', color: '#000' },

  sheetItemId:     { marginTop: 4, marginHorizontal: 18, fontSize: 14, fontWeight: '700', color: '#0062AA' },

  sheetPrice:      { marginTop: 8, marginHorizontal: 18, fontSize: 16, fontWeight: '400', color: '#000' },
  remarkInputWrap: { marginTop: 14, marginHorizontal: 18, borderWidth: 2, borderColor: '#0062AA', borderRadius: 8, height: 54, justifyContent: 'center' },
  remarkInput:     { paddingHorizontal: 16, fontSize: 16, color: '#000' },
  definedRemarkBtn: { marginTop: 18, marginHorizontal: 18, height: 54, borderRadius: 8, backgroundColor: '#8D9ED4', alignItems: 'center', justifyContent: 'center' },
  definedRemarkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '500' },

});