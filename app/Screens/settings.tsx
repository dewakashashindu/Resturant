import { useRouter } from 'expo-router';
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
  View,
} from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [selectedFloors, setSelectedFloors] = useState<string[]>(['Ground Floor']);
  const [moreExpanded,   setMoreExpanded]   = useState(false);

  const isTablet = width  >= 600;
  const isSmall  = height < 700;

  // ── RESPONSIVE ───────────────────────────────
  const headerH       = isTablet ? 160 : isSmall ? 110 : 140;
  const titleFs       = isTablet ? 28  : isSmall ? 20  : 24;
  const backIconSize  = isTablet ? 22  : isSmall ? 14  : 16;
  const backBtnSize   = isTablet ? 40  : isSmall ? 30  : 34;
  const hPad          = isTablet ? 24  : 16;
  const avatarSize    = isTablet ? 120 : isSmall ? 80  : 100;
  const nameFs        = isTablet ? 22  : isSmall ? 16  : 18;
  const sectionFs     = isTablet ? 18  : isSmall ? 14  : 16;
  const floorFs       = isTablet ? 20  : isSmall ? 16  : 18;
  const floorRowH     = isTablet ? 52  : isSmall ? 40  : 46;
  const checkboxSize  = isTablet ? 30  : isSmall ? 22  : 26;
  const changePwFs    = isTablet ? 18  : isSmall ? 14  : 16;
  const changePwH     = isTablet ? 50  : isSmall ? 38  : 44;

  // ── FLOOR DATA ───────────────────────────────
  const defaultFloors = ['Ground Floor', '1st Floor'];
  const extraFloors   = [
    '2nd Floor',
    '3rd Floor',
    'Beach Wing 1',
    'Beach Wing 2',
    'Private Front',
    'Private Sealed',
  ];

  const toggleFloor = (floor: string) => {
    setSelectedFloors(prev =>
      prev.includes(floor)
        ? prev.filter(f => f !== floor)
        : [...prev, floor]
    );
  };

  const FloorRow = ({ floor }: { floor: string }) => (
    <TouchableOpacity
      style={[styles.floorRow, { height: floorRowH, marginBottom: isTablet ? 12 : 8 }]}
      onPress={() => toggleFloor(floor)}
      activeOpacity={0.8}
    >
      {/* Checkbox */}
      <View style={[
        styles.checkbox,
        {
          width: checkboxSize,
          height: checkboxSize,
          borderRadius: checkboxSize * 0.22,
        },
        selectedFloors.includes(floor) && styles.checkboxSelected,
      ]}>
        {selectedFloors.includes(floor) && (
          <Text style={[styles.checkmark, { fontSize: isTablet ? 16 : 13 }]}>✓</Text>
        )}
      </View>

      {/* Label */}
      <Text style={[styles.floorText, { fontSize: floorFs }]}>
        {floor}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { height: headerH, paddingHorizontal: hPad }]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            { width: backBtnSize, height: backBtnSize, borderRadius: backBtnSize / 2 },
          ]}
          onPress={() => router.back()}
        >
          <Image
            source={require('../../assets/icons/back.png')}
            style={{ width: backIconSize, height: backIconSize, tintColor: '#FFF' }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { fontSize: titleFs }]}>Settings</Text>

        <View style={{ width: backBtnSize }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: hPad, paddingBottom: 120 },
        ]}
      >
        {/* ── PROFILE CARD ── */}
        <View style={[styles.profileCard, { padding: isTablet ? 28 : 20 }]}>
          <View style={[
            styles.avatar,
            { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
          ]} />

          <Text style={[styles.nameLabel, { fontSize: isTablet ? 13 : 11 }]}>Name</Text>
          <Text style={[styles.nameText,  { fontSize: nameFs }]}>Supun Perera</Text>

          <View style={styles.nameDivider} />

          <TouchableOpacity
            style={[styles.changePwBtn, { height: changePwH }]}
            onPress={() => router.push('/auth/changepassword' as any)}
            activeOpacity={0.85}
          >
            <Text style={[styles.changePwText, { fontSize: changePwFs }]}>
              Change Password
            </Text>
       
          </TouchableOpacity>
        </View>

        {/* ── FLOOR SELECTION ── */}
        <Text style={[styles.sectionTitle, { fontSize: sectionFs, marginTop: isTablet ? 28 : 20 }]}>
          Floor Selection
        </Text>

        {/* Default floors — always visible */}
        {defaultFloors.map((floor) => (
          <FloorRow key={floor} floor={floor} />
        ))}

        {/* Extra floors — shown when expanded */}
        {moreExpanded && extraFloors.map((floor) => (
          <FloorRow key={floor} floor={floor} />
        ))}

        {/* More / Less toggle */}
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setMoreExpanded(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={[styles.moreText, { fontSize: isTablet ? 17 : 15 }]}>
            {moreExpanded ? 'Less' : 'More'}
          </Text>
          <Text style={[styles.moreArrow, { fontSize: isTablet ? 13 : 11 }]}>
            {moreExpanded ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },

  // ── HEADER ──────────────────────────────────────
  header: {
    backgroundColor: '#002748',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    flex: 1,
  },

  // ── CONTENT ─────────────────────────────────────
  content: {
    paddingTop: 20,
  },

  // ── PROFILE CARD ────────────────────────────────
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatar: {
    backgroundColor: '#D9D9D9',
    marginBottom: 10,
  },
  nameLabel: {
    color: '#888',
    fontWeight: '500',
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  nameText: {
    color: '#000',
    fontWeight: '500',
    alignSelf: 'flex-start',
  },
  nameDivider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginVertical: 14,
  },
  changePwBtn: {
    width: '92%',
    backgroundColor: 'rgba(66,119,164,0.5)',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  changePwText: {
    color: '#FFF',
    fontWeight: '500',
  },
  changePwIcon: {
    fontSize: 18,
  },

  // ── SECTION ─────────────────────────────────────
  sectionTitle: {
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },

  // ── FLOOR ROW ───────────────────────────────────
  floorRow: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    marginBottom: 8,
  },
  checkbox: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkboxSelected: {
    backgroundColor: '#002748',
    borderColor: '#002748',
  },
  checkmark: {
    color: '#FFF',
    fontWeight: '700',
  },
  floorText: {
    color: '#000',
    fontWeight: '500',
  },

  // ── MORE BUTTON ─────────────────────────────────
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
    opacity: 0.5,
    paddingVertical: 8,
  },
  moreText: {
    color: '#000',
    fontWeight: '500',
  },
  moreArrow: {
    color: '#000',
  },
});