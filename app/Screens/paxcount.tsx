import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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
import { useCartStore } from '../../services/cartStore';

export default function PaxCountScreen() {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const { width, height } = useWindowDimensions();
  
  // ── 1. RECEIVE THE TABLE NAME AND FLOOR FROM THE PREVIOUS SCREEN ──
  const { tableName, floor } = useLocalSearchParams<{ tableName: string; floor?: string }>();

  const [localPax, setLocalPax]   = useState('');
  const [foreignPax, setForeignPax] = useState('');

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
  const canContinue   = localPax.trim() !== '' || foreignPax.trim() !== '';

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
              !canContinue && styles.disabledButton // Visual indicator if disabled
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (!canContinue) return;

              clearCart();

              // ── 2. FORWARD ALL VARIABLES TOGETHER, INCLUDING FLOOR ──
              router.push({
                pathname: '/Screens/selectitems',
                params: {
                  tableName: tableName || '', // Carried over from the previous screen
                  localPax: localPax.trim() || '0',
                  foreignPax: foreignPax.trim() || '0',
                  floor: floor || '',
                },
              });
            }}
          >
            <Text style={[styles.nextText, { fontSize: btnFs }]}>Confirm</Text>
           
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