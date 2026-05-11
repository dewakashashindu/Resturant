import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

interface BillItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function BillingScreen() {
  const router = useRouter();
  const { tableId } = useLocalSearchParams<{ tableId: string }>();
  const { width, height } = useWindowDimensions();

  // ── SAMPLE DATA ──────────────────────────────
  const [billItems, setBillItems] = useState<BillItem[]>([
    { id: '1', name: 'Orange Juice',   price: 1250, quantity: 1 },
    { id: '2', name: 'Chicken Burger', price: 1300, quantity: 3 },
    { id: '3', name: 'Chicken Burger', price: 1300, quantity: 2 },
  ]);

  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  // ── RESPONSIVE ───────────────────────────────
  const hPad        = isTablet ? 40  : 16;
  const headerH     = isTablet ? 110 : isSmall ? 80 : 100;
  const backIconSize= isTablet ? 22  : isSmall ? 14 : 34;
  const backBtnSize = isTablet ? 40  : isSmall ? 30 : 44;
  const titleFs     = isTablet ? 28  : isSmall ? 20 : 24;
  const logoW       = isTablet ? 200 : isSmall ? 120: 159;
  const logoH       = isTablet ? 76  : isSmall ? 44 : 60;
  const tableFs     = isTablet ? 18  : isSmall ? 13 : 16;
  const dateFs      = isTablet ? 16  : isSmall ? 11 : 14;
  const itemFs      = isTablet ? 18  : isSmall ? 13 : 16;
  const totalFs     = isTablet ? 18  : isSmall ? 14 : 16;
  const btnH        = isTablet ? 60  : isSmall ? 42 : 48;
  const btnFs       = isTablet ? 20  : isSmall ? 14 : 16;
  const qtySize     = isTablet ? 20  : isSmall ? 14 : 16;
  const qtyBtnSize  = isTablet ? 28  : isSmall ? 20 : 24;

  // ── UPDATE QUANTITY ──────────────────────────
  const updateQuantity = (itemId: string, delta: number) => {
    setBillItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      )
    );
  };

  const grossTotal = billItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ── DATE & TIME ──────────────────────────────
  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { height: headerH, paddingHorizontal: hPad }]}>
        <TouchableOpacity
          style={[styles.backButton, { width: backBtnSize, height: backBtnSize, borderRadius: backBtnSize / 2 }]}
          onPress={() => router.back()}
        >
          <Image
            source={require('../../assets/icons/blackback.png')}
            style={{ width: backIconSize + 8, height: backIconSize + 8 }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { fontSize: titleFs }]}>Billing</Text>

        {/* Balance spacer */}
        <View style={{ width: backBtnSize }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: hPad, paddingBottom: 120 }]}
      >
        {/* ── LOGO ── */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/CAPTURE 1.png')}
            style={{ width: logoW, height: logoH }}
            resizeMode="contain"
          />
        </View>

        {/* ── TABLE & DATE ── */}
        <Text style={[styles.tableNumber, { fontSize: tableFs }]}>
          Table Number - {tableId ?? 'GF 05'}
        </Text>
        <Text style={[styles.dateText, { fontSize: dateFs }]}>
          {timeStr}{'  '}{dateStr}
        </Text>

        {/* ── DIVIDER ── */}
        <View style={styles.topDivider} />

        {/* ── BILL ITEMS ── */}
        {billItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            {/* Name */}
            <Text style={[styles.itemName, { fontSize: itemFs }]} numberOfLines={1}>
              {item.name}
            </Text>

            {/* Price */}
            <Text style={[styles.itemPrice, { fontSize: itemFs }]}>
              Lkr {item.price.toFixed(2)}
            </Text>

            {/* Quantity controls */}
            <View style={styles.qtyPill}>
              <TouchableOpacity
                onPress={() => updateQuantity(item.id, -1)}
                style={[styles.qtyBtn, { width: qtyBtnSize, height: qtyBtnSize }]}
              >
                <Ionicons name="remove" size={isTablet ? 16 : 12} color="#000" />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { fontSize: qtySize }]}>
                {item.quantity}
              </Text>
              <TouchableOpacity
                onPress={() => updateQuantity(item.id, 1)}
                style={[styles.qtyBtn, { width: qtyBtnSize, height: qtyBtnSize }]}
              >
                <Ionicons name="add" size={isTablet ? 16 : 12} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* ── BOTTOM DIVIDER ── */}
        <View style={styles.bottomDivider} />

        {/* ── GROSS TOTAL ── */}
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { fontSize: totalFs }]}>
            Gross Total (Lkr)
          </Text>
          <Text style={[styles.totalValue, { fontSize: totalFs }]}>
            {grossTotal.toFixed(2)}
          </Text>
        </View>
      </ScrollView>

      {/* ── PRINT BUTTON ── */}
      <View style={[styles.footer, { paddingHorizontal: hPad, paddingBottom: isSmall ? 12 : 20 }]}>
        <TouchableOpacity
          style={[styles.printBtn, { height: btnH }]}
          activeOpacity={0.85}
          onPress={() => console.log('Print bill')}
        >
          <Text style={[styles.printText, { fontSize: btnFs }]}>Print</Text>
         
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },

  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    marginTop:30,
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
    flex: 1,
  },

  // ── CONTENT ─────────────────────────────────────
  content: {
    paddingTop: 16,
  },

  // ── LOGO ────────────────────────────────────────
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },

  // ── TABLE & DATE ────────────────────────────────
  tableNumber: {
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  dateText: {
    fontWeight: '300',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },

  // ── TOP DIVIDER ─────────────────────────────────
  topDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 16,
  },

  // ── ITEM ROW ────────────────────────────────────
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  itemName: {
    fontWeight: '400',
    color: '#000',
    flex: 1,
  },
  itemPrice: {
    fontWeight: '400',
    color: '#000',
    marginHorizontal: 8,
  },

  // ── QTY PILL ────────────────────────────────────
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyText: {
    fontWeight: '500',
    color: '#000',
    minWidth: 16,
    textAlign: 'center',
  },
  qtyBtn: {
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── BOTTOM DIVIDER ──────────────────────────────
  bottomDivider: {
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginVertical: 16,
    borderRadius: 2,
  },

  // ── TOTAL ROW ───────────────────────────────────
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: '500',
    color: '#000',
  },
  totalValue: {
    fontWeight: '500',
    color: '#000',
  },

  // ── FOOTER ──────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    paddingTop: 12,
  },

  // PRINT BUTTON 
  printBtn: {
    backgroundColor: '#8D9ED4',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  printText: {
    color: '#FFF',
    fontWeight: '700',
  },
  printIcon: {
    fontSize: 20,
  },
});