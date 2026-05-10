import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

export default function DefineTableScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [tableName, setTableName] = useState('');

  const isTablet = width >= 600;
  const isSmall  = height < 700;

  // ── RESPONSIVE VALUES ──────────────────────────
  const hPad          = isTablet ? 24 : 16;
  const headerMT      = Platform.OS === 'android' ? (isTablet ? 20 : 16) : 10;
  const headerTitleFs = isTablet ? 32 : 24;
  const backIconSize  = isTablet ? 56 : 44;

  // Card fills most of screen width (same as ModeSelection)
  const cardW         = isTablet ? width * 0.90 : width - hPad * 2;
  const innerPad      = isTablet ? 32 : 24;

  // Inner element sizes
  const tableImgSize  = isTablet ? 140 : isSmall ? 90  : 110;
  const imgMB         = isTablet ? 40  : isSmall ? 20  : 30;
  const inputH        = isTablet ? 60  : isSmall ? 48  : 54;
  const inputFs       = isTablet ? 20  : isSmall ? 15  : 17;
  const btnH          = isTablet ? 60  : isSmall ? 48  : 54;
  const btnFs         = isTablet ? 22  : isSmall ? 17  : 20;
  const btnIconSize   = isTablet ? 32  : isSmall ? 18  : 24;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

      {/* ── BACK BUTTON (absolute, same as ModeSelection) ── */}
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

      {/* ── WRAPPER: centers header + card ── */}
      <View style={styles.contentWrapper}>

        {/* ── HEADER ── */}
        <View style={[styles.header, { marginTop: headerMT, paddingHorizontal: hPad }]}>
          <Text style={[styles.headerTitle, { fontSize: headerTitleFs }]}>
            Define a Table
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

          {/* Input */}
          <TextInput
            placeholder="Table Name"
            placeholderTextColor="rgba(0,0,0,0.4)"
            value={tableName}
            onChangeText={setTableName}
            style={[styles.input, { height: inputH, fontSize: inputFs }]}
          />

          {/* Next Button */}
          <TouchableOpacity
            style={[styles.nextButton, { height: btnH, marginTop: isSmall ? 16 : 24 }]}
            activeOpacity={0.8}
            onPress={() => router.push('/Screens/paxcount')}
          >
            <Text style={[styles.nextText, { fontSize: btnFs }]}>Next</Text>
            <Image
              source={require('../../assets/icons/back.png')}
              style={[styles.nextIcon, { width: btnIconSize, height: btnIconSize }]}
              resizeMode="contain"
            />
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

  // ── BACK BUTTON ─────────────────────────────────
  // Matches ModeSelection exactly
  backButtonAbsolute: {
   position: 'absolute',
  left: 24,
  top: 100,
  zIndex: 10,
    },

  // ── WRAPPER ─────────────────────────────────────
  // Same as ModeSelection — centers everything
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── HEADER ──────────────────────────────────────
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

  // ── MAIN CARD ───────────────────────────────────
  // Same shadow/radius as ModeSelection
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    alignItems: 'center',   // centers image horizontally
  },

  // ── TABLE IMAGE ─────────────────────────────────
  tableImage: {
    alignSelf: 'center',
  },

  // ── INPUT ───────────────────────────────────────
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#0062AA',
    borderRadius: 10,
    paddingHorizontal: 16,
    color: '#000',
    backgroundColor: '#FAFAFA',
  },

  // ── NEXT BUTTON ─────────────────────────────────
  nextButton: {
    width: '100%',
    backgroundColor: '#0062AA',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  nextText: {
    color: '#FFF',
    fontWeight: '700',
  },
  nextIcon: {
    tintColor: '#FFF',
    transform: [{ rotate: '180deg' }],
  },
});