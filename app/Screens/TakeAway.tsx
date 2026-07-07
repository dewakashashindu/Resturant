import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient } from '../../services/api';
import { useCartStore } from '../../services/cartStore';

// ─── Module-level constants (never change at runtime) ─────────────────────────
const KNOB_SIZE = 150;
const RADIUS    = 130;
const FACES     = ['😡', '😠', '😑', '🫤', '😐', '🙂', '😊', '😃'] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function TakeAwayScreen() {
  const router     = useRouter();
  const clearCart  = useCartStore((state) => state.clearCart);
  const setCustomerInfo = useCartStore((state) => state.setCustomerInfo);
  const setOrderType    = useCartStore((state) => state.setOrderType);

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = getDynamicStyles(width, height, insets.bottom);

  // ── State ──────────────────────────────────────────────────────────────────
  const [currentTableNumber, setCurrentTableNumber] = useState('Loading...');
  const [serialLoading, setSerialLoading]           = useState(false);
  const [contactNumber, setContactNumber]           = useState('');
  const [name, setName]                             = useState('');
  const [remark, setRemark]                         = useState('');

  const serialFetched = useRef(false);

  // ── Gesture & animation shared values ─────────────────────────────────────
  const rotation      = useSharedValue(0);
  const startRotation = useSharedValue(0);

  // ── Gesture handler ────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      const x = event.x - KNOB_SIZE / 2;
      const y = event.y - KNOB_SIZE / 2;
      startRotation.value = Math.atan2(y, x) - rotation.value;
    })
    .onUpdate((event) => {
      const x = event.x - KNOB_SIZE / 2;
      const y = event.y - KNOB_SIZE / 2;
      rotation.value = Math.atan2(y, x) - startRotation.value;
    });

  const activeIndex = useDerivedValue(() => {
    let degrees = (rotation.value * (180 / Math.PI)) % 360;
    if (degrees < 0) degrees += 360;
    const finalDegrees = (degrees - 90 + 360) % 360;
    return Math.round(finalDegrees / 45) % 8;
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFacePress = (index: number) => {
    const targetAngle = (index * 45 + 90) * (Math.PI / 180);
    rotation.value = withTiming(targetAngle, { duration: 400 });
  };

  const handlePhoneChange = async (phone: string) => {
    setContactNumber(phone);
    if (phone.length >= 9) {
      const res = await apiClient.getCustomerByPhone(phone);
      if (res.ok && res.data?.exists) {
        setName(res.data.customerName);
      }
    }
  };

  const handleConfirm = async () => {
    if (serialLoading) return;
    setSerialLoading(true);

    const phoneVal  = contactNumber.trim() || 'N/A';
    const nameVal   = name.trim()          || 'TakeAway Guest';
    const remarkVal = remark.trim()        || '';

    try {
      const res = await apiClient.saveCustomer({
        RegTel:       phoneVal,
        CusName:      nameVal,
        Rmks:         remarkVal,
        CusBehaviour: activeIndex.value,
      });
      if (!res || !res.ok) {
        console.log('Database Save Warning:', res?.data?.message || 'Insert failed');
      }
    } catch {
      console.log('Network Connection Warning: Backend might be unreachable.');
    } finally {
      setSerialLoading(false);
      clearCart();

      useCartStore.getState().setCustomerInfo({
        contactNumber: phoneVal,
        customerName:  nameVal,
        remark:        remarkVal,
      });
      useCartStore.getState().setOrderType('TA');

      router.push({
        pathname: '/Screens/selectitems',
        params: {
          contactNumber: phoneVal,
          customerName:  nameVal,
          remark:        remarkVal,
          orderType:     'TA',
        },
      });
    }
  };

  // ── Animated styles ────────────────────────────────────────────────────────
  const knobAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}rad` }],
  }));

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.container}>
        <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

        {/* HEADER */}
        <View style={s.headerContainer}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => router.back()}
            style={s.backButtonContainer}
          >
            <View style={s.backButtonInner}>
              <Image
                source={require('../../assets/icons/blackback.png')}
                style={s.backImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>

          <Text style={s.headerTitle}>Take Away</Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* CARD 1: FORM INPUTS */}
          <View style={s.mainCard}>
            <TextInput
              placeholder="Contact Number"
              placeholderTextColor="rgba(0, 0, 0, 0.35)"
              value={contactNumber}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              style={s.input}
            />
            <TextInput
              placeholder="Name"
              placeholderTextColor="rgba(0, 0, 0, 0.35)"
              value={name}
              onChangeText={setName}
              style={s.input}
            />
            <TextInput
              placeholder="Add Remark"
              placeholderTextColor="rgba(0, 0, 0, 0.35)"
              value={remark}
              onChangeText={setRemark}
              multiline
              numberOfLines={2}
              style={s.remarkInput}
            />
          </View>

          {/* CARD 2: RADIAL KNOB BEHAVIOR CHART */}
          <View style={s.behaviorCard}>
            <Text style={s.behaviorTitle}>Customer Behavior</Text>

            <View style={s.chartWrapper}>
              {FACES.map((face, index) => {
                const angle = (index * 45) * (Math.PI / 180);
                const x     = RADIUS * Math.cos(angle);
                const y     = RADIUS * Math.sin(angle);

                const faceAnimatedStyle = useAnimatedStyle(() => {
                  const isActive = activeIndex.value === index;
                  return {
                    transform: [
                      { translateX: x },
                      { translateY: y },
                      { scale: isActive ? 1.4 : 0.85 },
                    ],
                    opacity: isActive ? 1 : 0.35,
                  };
                });

                return (
                  <Animated.View key={index} style={[s.faceWrapper, faceAnimatedStyle]}>
                    <TouchableOpacity
                      onPress={() => handleFacePress(index)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={s.faceText}>{face}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}

              <GestureDetector gesture={panGesture}>
                <Animated.View style={[s.knobContainer, knobAnimatedStyle]}>
                  <View style={s.knobInner}>
                    <View style={s.knobIndicator} />
                  </View>
                </Animated.View>
              </GestureDetector>
            </View>
          </View>

          {/* CONFIRM BUTTON */}
          <TouchableOpacity
            style={[s.confirmButton, { opacity: serialLoading ? 0.6 : 1 }]}
            activeOpacity={0.8}
            onPress={handleConfirm}
            disabled={serialLoading}
          >
            <Text style={s.confirmButtonText}>Next</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Dynamic Styles Factory ───────────────────────────────────────────────────
function getDynamicStyles(width: number, height: number, bottomInset: number) {
  const isTablet = width >= 600;
  const isSmall  = height < 700;

  const BASE_WIDTH = isTablet ? 768 : 375;
  const scale = (size: number): number => (width / BASE_WIDTH) * size;

  // ── 3-Tier Conditional Benchmarks ─────────────────────────────────────────

  // Header
  const hPad           = isTablet ? 32   : isSmall ? 12   : 16;
  const headerMT       = Platform.OS === 'android'
                           ? (isTablet ? 24 : isSmall ? 14 : 16)
                           : (isTablet ? 12 : isSmall ?  8 : 10);
  const headerPadV     = isTablet ? 20   : isSmall ? 12   : 15;
  const headerPadB     = isTablet ? 30   : isSmall ? 16   : 25;
  const headerPadT     = isTablet ? 40   : isSmall ? 40   : 55;
  const headerTitleFs  = isTablet ? 32   : isSmall ? 20   : 24;
  const backIconSize   = isTablet ? 56   : isSmall ? 36   : 44;

  // Scroll content
  const scrollPadT     = isTablet ? 14   : isSmall ?  6   :  8;
  const scrollPadB     = isTablet ? 48   : isSmall ? 24   : 34;
  const scrollGap      = isTablet ? 24   : isSmall ? 12   : 16;

  // Main card
  const cardW          = isTablet ? width * 0.85 : width - scale(hPad) * 2;
  const innerPad       = isTablet ? 28   : isSmall ? 16   : 20;
  const cardGap        = isTablet ? 20   : isSmall ? 10   : 14;
  const cardRadius     = isTablet ? 18   : isSmall ? 10   : 12;
  const cardShadH      = isTablet ?  4   : isSmall ?  1   :  2;
  const cardShadR      = isTablet ?  9   : isSmall ?  4   :  6;

  // Input fields
  const inputH         = isTablet ? 60   : isSmall ? 48   : 54;
  const inputFs        = isTablet ? 18   : isSmall ? 13   : 14;
  const inputPadH      = isTablet ? 20   : isSmall ? 12   : 16;
  const inputRadius    = isTablet ? 12   : isSmall ?  6   :  8;
  const inputBW        = 1; // border width — intentionally not scaled

  // Remark input
  const remarkMinH     = isTablet ? 110  : isSmall ? 66   : 80;
  const remarkPadT     = isTablet ? 16   : isSmall ?  9   : 12;

  // Behavior card
  const behaviorPadV   = isTablet ? 36   : isSmall ? 18   : 24;
  const behaviorTitleFs= isTablet ? 22   : isSmall ? 13   : 16;
  const behaviorTitleMB= isTablet ? 36   : isSmall ? 18   : 25;
  const behaviorCardR  = isTablet ? 18   : isSmall ? 10   : 12;
  const behaviorShadH  = isTablet ?  4   : isSmall ?  1   :  2;
  const behaviorShadR  = isTablet ?  9   : isSmall ?  4   :  6;

  // Chart & knob
  const chartSize      = isTablet ? 380  : isSmall ? 260   : 300;
  const faceWrapSz     = isTablet ? 100  : isSmall ?  66   :  80;
  const faceFs         = isTablet ?  48  : isSmall ?  28   :  36;
  const knobSz         = isTablet ? 180  : isSmall ? 126   : 150; // mirrors KNOB_SIZE visually
  const knobInnerSz    = knobSz - scale(16);
  const knobInnerR     = knobInnerSz / 2;
  const knobShadH      = isTablet ?  4   : isSmall ?  1   :  2;
  const knobShadR      = isTablet ? 12   : isSmall ?  6   :  8;
  const knobIndW       = isTablet ? 14   : isSmall ?  8   : 10;
  const knobIndH       = isTablet ? 14   : isSmall ?  8   : 10;
  const knobIndR       = isTablet ?  7   : isSmall ?  4   :  5;
  const knobIndTop     = isTablet ? 18   : isSmall ?  9   : 12;

  // Confirm button
  const confirmBtnH    = isTablet ? 60   : isSmall ? 46   : 54;
  const confirmBtnFs   = isTablet ? 20   : isSmall ? 15   : 18;
  const confirmBtnR    = isTablet ? 14   : isSmall ?  8   : 10;
  const confirmBtnMT   = isTablet ?  8   : isSmall ?  2   :  4;
  const confirmBtnGap  = isTablet ? 14   : isSmall ?  7   : 10;
  const confirmShadH   = isTablet ?  4   : isSmall ?  1   :  2;
  const confirmShadR   = isTablet ?  8   : isSmall ?  3   :  4;

  // ── StyleSheet ─────────────────────────────────────────────────────────────
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },

    // ── Header ──────────────────────────────────────────────────────────────
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFFFFF',
      marginTop: scale(headerMT),
      paddingHorizontal: scale(hPad),
      paddingVertical: scale(headerPadV),
      paddingBottom: scale(headerPadB),
      paddingTop: scale(headerPadT),
    },
    backButtonContainer: {
      width: scale(backIconSize),
      height: scale(backIconSize),
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButtonInner: {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    },
    backImage: {
      width: '100%',
      height: '100%',
    },
    headerTitle: {
      fontFamily: 'Roboto',
      fontWeight: '500',
      color: '#000000',
      textAlign: 'center',
      fontSize: scale(headerTitleFs),
    },
    headerSpacer: {
      width: scale(backIconSize),
    },

    // ── Scroll ───────────────────────────────────────────────────────────────
    scrollContent: {
      alignItems: 'center',
      paddingTop: scale(scrollPadT),
      paddingBottom: scale(scrollPadB) + bottomInset,
      paddingHorizontal: scale(hPad),
      gap: scale(scrollGap),
    },

    // ── Main Card ────────────────────────────────────────────────────────────
    mainCard: {
      width: cardW,
      padding: scale(innerPad),
      gap: scale(cardGap),
      backgroundColor: '#FFFFFF',
      borderRadius: scale(cardRadius),
      elevation: 3,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: scale(cardShadH) },
      shadowOpacity: 0.08,
      shadowRadius: scale(cardShadR),
    },

    // ── Inputs ───────────────────────────────────────────────────────────────
    input: {
      width: '100%',
      height: scale(inputH),
      borderWidth: inputBW,
      borderColor: '#075EA7',
      borderRadius: scale(inputRadius),
      paddingHorizontal: scale(inputPadH),
      fontSize: scale(inputFs),
      color: '#000000',
      backgroundColor: '#FFFFFF',
      fontFamily: 'Inter',
    },
    remarkInput: {
      width: '100%',
      minHeight: scale(remarkMinH),
      borderWidth: inputBW,
      borderColor: '#075EA7',
      borderRadius: scale(inputRadius),
      paddingHorizontal: scale(inputPadH),
      fontSize: scale(inputFs),
      color: '#000000',
      backgroundColor: '#FFFFFF',
      fontFamily: 'Inter',
      textAlignVertical: 'top',
      paddingTop: scale(remarkPadT),
    },

    // ── Behavior Card ────────────────────────────────────────────────────────
    behaviorCard: {
      width: cardW,
      padding: scale(innerPad),
      paddingVertical: scale(behaviorPadV),
      backgroundColor: '#FFFFFF',
      borderRadius: scale(behaviorCardR),
      elevation: 3,
      shadowColor: '#000000',
      shadowOffset: { width: scale(2), height: scale(behaviorShadH) },
      shadowOpacity: 0.10,
      shadowRadius: scale(behaviorShadR),
      alignItems: 'center',
    },
    behaviorTitle: {
      fontFamily: 'Inter',
      fontSize: scale(behaviorTitleFs),
      fontWeight: '500',
      color: '#000000',
      marginBottom: scale(behaviorTitleMB),
    },

    // ── Chart ────────────────────────────────────────────────────────────────
    chartWrapper: {
      width: scale(chartSize),
      height: scale(chartSize),
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    faceWrapper: {
      position: 'absolute',
      width: scale(faceWrapSz),
      height: scale(faceWrapSz),
      justifyContent: 'center',
      alignItems: 'center',
    },
    faceText: {
      fontSize: scale(faceFs),
    },

    // ── Knob ─────────────────────────────────────────────────────────────────
    knobContainer: {
      width: scale(knobSz),
      height: scale(knobSz),
      borderRadius: scale(knobSz / 2),
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: scale(2), height: scale(knobShadH) },
      shadowOpacity: 0.12,
      shadowRadius: scale(knobShadR),
      elevation: 4,
    },
    knobInner: {
      width: scale(knobSz - 16),
      height: scale(knobSz - 16),
      borderRadius: scale((knobSz - 16) / 2),
      backgroundColor: '#075EA7',
      position: 'relative',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    knobIndicator: {
      width: scale(knobIndW),
      height: scale(knobIndH),
      borderRadius: scale(knobIndR),
      backgroundColor: '#FFFFFF',
      position: 'absolute',
      top: scale(knobIndTop),
      alignSelf: 'center',
    },

    // ── Confirm Button ───────────────────────────────────────────────────────
    confirmButton: {
      width: cardW,
      height: scale(confirmBtnH),
      backgroundColor: '#0062AA',
      borderRadius: scale(confirmBtnR),
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: scale(confirmBtnGap),
      marginTop: scale(confirmBtnMT),
      elevation: 2,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: scale(confirmShadH) },
      shadowOpacity: 0.1,
      shadowRadius: scale(confirmShadR),
    },
    confirmButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontFamily: 'Inter',
      fontSize: scale(confirmBtnFs),
    },
  });
}