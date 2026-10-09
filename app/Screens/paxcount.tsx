import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import { CartItem, useCartStore } from '../../services/cartStore';
import { useMenuSessionStore } from '../../services/menuSessionStore';
import { useOrderStore } from '../../services/orderStore';

export default function PaxCountScreen() {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const setCartItems = useCartStore((state) => state.setCartItems);
  const setOrderType = useCartStore((state) => state.setOrderType);
  const setDiningSession = useMenuSessionStore((state) => state.setDiningSession);
  const clearDiningSession = useMenuSessionStore((state) => state.clearDiningSession);
  const saveCartItems = useMenuSessionStore((state) => state.saveCartItems);
  const { width, height } = useWindowDimensions();
  
  // Receives both regular Dining navigation and the Menu Card table flow.
  const {
    tableName,
    floor,
    menuFlow,
    groupId,
    groupLabel,
    tableId,
    existingInvoiceNo,
    existingLocalPax,
    existingForeignPax,
  } = useLocalSearchParams<{
    tableName: string;
    floor?: string;
    menuFlow?: string;
    groupId?: string;
    groupLabel?: string;
    tableId?: string;
    existingInvoiceNo?: string;
    existingLocalPax?: string;
    existingForeignPax?: string;
  }>();

  const [localPax, setLocalPax] = useState(() => String(existingLocalPax ?? ''));
  const [foreignPax, setForeignPax] = useState(() => String(existingForeignPax ?? ''));
  const [continuing, setContinuing] = useState(false);

  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  // ── RESPONSIVE VALUES ──
  const hPad          = isTablet ? 24 : 16;
  const headerMT      = Platform.OS === 'android' ? (isTablet ? 20 : 16) : 10;
  const headerTitleFs = isTablet ? 32 : 24;
  const backIconSize  = isTablet ? 56 : 44;

  const cardW         = isTablet ? width * 0.90 : width - hPad * 2;
  const innerPad      = isTablet ? 32 : 24;

  const tableImgSize  = isTablet ? 140 : isSmall ? 90  : 110;
  const imgMB         = isTablet ? 40  : isSmall ? 20  : 30;
  const inputH        = isTablet ? 60  : isSmall ? 48  : 54;
  const inputFs       = isTablet ? 20  : isSmall ? 15  : 17;
  const btnH          = isTablet ? 60  : isSmall ? 48  : 54;
  const btnFs         = isTablet ? 22  : isSmall ? 17  : 20;
  const inputMB       = isTablet ? 16  : isSmall ? 10  : 12;
  
  // Validates that at least one of the inputs contains text
  const canContinue = localPax.trim() !== '' || foreignPax.trim() !== '';
  const activeExistingInvoiceNo = String(existingInvoiceNo ?? '').trim();

  const handleConfirm = async (): Promise<void> => {
    if (!canContinue || continuing) return;

    const localPaxValue = localPax.trim() || '0';
    const foreignPaxValue = foreignPax.trim() || '0';

    // An occupied-table choice means new customer items must append to the
    // current bill, never create a second invoice for the same table.
    if (menuFlow === '1' && activeExistingInvoiceNo) {
      setContinuing(true);
      try {
        const response = await apiClient.getActiveBillItems(
          String(tableName ?? ''),
          activeExistingInvoiceNo,
        );
        const bill = response.ok ? response.data?.data : null;
        const invoiceNo = String(bill?.invoiceNo ?? activeExistingInvoiceNo).trim();
        const existingItems: CartItem[] = Array.isArray(bill?.items)
          ? bill.items
              .map((item: any) => ({
                menuItemCode: String(item?.menuItemCode ?? item?.ItemCode ?? item?.itemCode ?? '').trim(),
                menuItmDes: String(item?.menuItmDes ?? item?.MenuItmDes ?? item?.ItemDescription ?? ''),
                salesPrice: Number(item?.salesPrice ?? item?.SalesPrice ?? 0) || 0,
                quantity: Math.max(0, Number(item?.quantity ?? item?.QTY ?? 0) || 0),
                itemRemarks: String(item?.itemRemarks ?? item?.ItemRemarks ?? ''),
              }))
              .filter((item: CartItem) => item.menuItemCode && item.quantity > 0)
          : [];

        if (!invoiceNo || existingItems.length === 0) {
          Alert.alert('Bill unavailable', 'The selected table bill is no longer available. Please select the table again.');
          return;
        }

        const resolvedLocalPax = String(bill?.lPax ?? bill?.LPax ?? localPaxValue);
        const resolvedForeignPax = String(bill?.fPax ?? bill?.FPax ?? foreignPaxValue);
        const resolvedTableNo = String(bill?.tableNo ?? tableName ?? '').trim();

        clearDiningSession();
        setCartItems(existingItems);
        setOrderType('DINING');
        useOrderStore.getState().setLastConfirmedOrder({
          orderType: String(bill?.orderType ?? 'DI') || 'DI',
          tableNo: resolvedTableNo,
          userId: String(bill?.userId ?? 'SYSTEM'),
          tableGrpId: String(bill?.tableGrpId ?? groupId ?? ''),
          lPax: Number(resolvedLocalPax) || 0,
          fPax: Number(resolvedForeignPax) || 0,
          invoiceNo,
          createdAt: new Date().toISOString(),
          items: existingItems,
        });
        setDiningSession({
          groupId: String(groupId ?? bill?.tableGrpId ?? ''),
          groupLabel: String(groupLabel ?? floor ?? ''),
          tableName: resolvedTableNo,
          tableNo: resolvedTableNo,
          floor: String(floor ?? ''),
          localPax: resolvedLocalPax,
          foreignPax: resolvedForeignPax,
          orderType: 'DINING',
          existingInvoiceNo: invoiceNo,
          existingBillItems: existingItems,
        });
        saveCartItems(existingItems);
        router.push('/menu/menu_welcome');
      } catch {
        Alert.alert('Bill unavailable', 'Unable to load the selected table bill. Please try again.');
      } finally {
        setContinuing(false);
      }
      return;
    }

    clearCart();
    clearDiningSession();
    useOrderStore.getState().clearLastConfirmedOrder();
    setOrderType('DINING');

    // Menu Card flow: persist the invisible table/pax context, then continue
    // through Welcome → Menu Card. The Cart receives these values later when
    // the user opens the real Dining cart.
    if (menuFlow === '1') {
      setDiningSession({
        groupId: String(groupId ?? ''),
        groupLabel: String(groupLabel ?? floor ?? ''),
        tableName: String(tableName ?? ''),
        tableNo: String(tableName ?? ''),
        floor: String(floor ?? ''),
        localPax: localPaxValue,
        foreignPax: foreignPaxValue,
        orderType: 'DINING',
      });
      router.push('/menu/menu_welcome');
      return;
    }

    router.push({
      pathname: '/Screens/selectitems',
      params: {
        tableName: tableName || '',
        localPax: localPaxValue,
        foreignPax: foreignPaxValue,
        floor: floor || '',
        tableId: tableId || '',
        orderType: 'DINING',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

      {/* ── BACK BUTTON (absolute) ── */}
      <TouchableOpacity
        style={styles.backButtonAbsolute}
        onPress={() => router.back()}
      >
        <Image
          source={require('../../assets/icons/blackback.png')}
          style={{ width: backIconSize, height: backIconSize }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* ── WRAPPER ── */}
      <View style={styles.contentWrapper}>

        {/* ── HEADER ── */}
        <View style={[styles.header, { marginTop: headerMT, paddingHorizontal: hPad }]}>
          <Text style={[styles.headerTitle, { fontSize: headerTitleFs }]}>
            Pax Count
          </Text>
        </View>

        {/* ── MAIN CARD ── */}
        <View style={[styles.mainCard, { width: cardW, padding: innerPad }]}>

          {/* Table Image */}
          <Image
            source={require('../../assets/images/blacktable.png')}
            style={[
              styles.tableImage,
              { width: tableImgSize, height: tableImgSize, marginBottom: imgMB },
            ]}
            resizeMode="contain"
          />

          {/* Local Pax Input */}
          <TextInput
            placeholder="Local Pax"
            placeholderTextColor="rgba(0,0,0,0.4)"
            value={localPax}
            onChangeText={setLocalPax}
            keyboardType="numeric"
            style={[
              styles.input,
              { height: inputH, fontSize: inputFs, marginBottom: inputMB },
            ]}
          />

          {/* Foreign Pax Input */}
          <TextInput
            placeholder="Foreign Pax"
            placeholderTextColor="rgba(0,0,0,0.4)"
            value={foreignPax}
            onChangeText={setForeignPax}
            keyboardType="numeric"
            style={[
              styles.input,
              { height: inputH, fontSize: inputFs, marginBottom: inputMB },
            ]}
          />

          {/* Confirm Button */}
          <TouchableOpacity
            style={[
              styles.nextButton, 
              { height: btnH, marginTop: isSmall ? 8 : 12 },
              (!canContinue || continuing) && styles.disabledButton,
            ]}
            activeOpacity={0.8}
            onPress={() => void handleConfirm()}
            disabled={!canContinue || continuing}
          >
            {continuing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.nextText, { fontSize: btnFs }]}>Confirm</Text>
            )}
           
          </TouchableOpacity>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButtonAbsolute: {
    position: 'absolute',
    left: 24,
    top: 100,
    zIndex: 10,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: '600',
    color: '#000',
  },
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    alignItems: 'center',
  },
  tableImage: {
    alignSelf: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#0062AA',
    borderRadius: 10,
    paddingHorizontal: 16,
    color: '#000',
    backgroundColor: '#FAFAFA',
  },
  nextButton: {
    width: '100%',
    backgroundColor: '#0062AA',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  disabledButton: {
    backgroundColor: '#A0C4DF', // Greys out slightly if inputs are empty
  },
  nextText: {
    color: '#FFF',
    fontWeight: '700',
  },
  checkIcon: {
    color: '#FFF',
    fontWeight: '700',
  },
});