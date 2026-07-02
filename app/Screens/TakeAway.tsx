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
  View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient } from '../../services/api';
import { useCartStore } from '../../services/cartStore';



const KNOB_SIZE = 150; 
const RADIUS = 130;     

// Standard clockwise ordered faces array
const FACES = ['😡', '😠', '😑', '🫤', '😐', '🙂', '😊', '😃'];

export default function TakeAwayScreen() {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);

  const setCustomerInfo = useCartStore((state) => state.setCustomerInfo);
  const setOrderType = useCartStore((state) => state.setOrderType);

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const [currentTableNumber, setCurrentTableNumber] = useState('Loading...');
  const [serialLoading, setSerialLoading] = useState(false);
  const serialFetched = useRef(false);

  const [contactNumber, setContactNumber] = useState('');
  const [name, setName] = useState('');
  const [remark, setRemark] = useState(''); 

  const rotation = useSharedValue(0);       
  const startRotation = useSharedValue(0);  

  // ── GESTURE HANDLER ──
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
    let finalDegrees = (degrees - 90 + 360) % 360;
    return Math.round(finalDegrees / 45) % 8;
  });

  // ── FACE TAP HANDLER ──
  // activeIndex maps rotation via: finalDegrees = (degrees - 90 + 360) % 360, index = round(finalDegrees / 45)
  // To make a given index active, we need rotation = (index * 45 + 90) * (π/180)
  const handleFacePress = (index: number) => {
    const targetAngle = (index * 45 + 90) * (Math.PI / 180);
    rotation.value = withTiming(targetAngle, { duration: 400 });
  };

  const isTablet = width >= 600;
  const isSmall  = height < 700;

  const hPad          = isTablet ? 32 : 16;
  const headerMT      = Platform.OS === 'android' ? (isTablet ? 24 : 16) : 10;
  const headerTitleFs = isTablet ? 28 : 24;
  const backIconSize  = isTablet ? 44 : 44; 

  const cardW         = isTablet ? width * 0.85 : width - hPad * 2;
  const innerPad      = isTablet ? 28 : 20;
  const gap           = isTablet ? 20 : 14;

  const inputH        = isTablet ? 60 : isSmall ? 48 : 54;
  const inputFs       = isTablet ? 16 : isSmall ? 13 : 14;

  const confirmBtnH   = isTablet ? 60 : 54;
  const confirmBtnFs  = isTablet ? 20 : 18;

  // Auto-fill customer name when phone number is long enough
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
    const nameVal   = name.trim() || 'TakeAway Guest';
    const remarkVal = remark.trim() || '';

    try {
      const res = await apiClient.saveCustomer({
        RegTel: phoneVal,
        CusName: nameVal,
        Rmks: remarkVal,
        CusBehaviour: activeIndex.value,
      });

      if (!res || !res.ok) {
        console.log("Database Save Warning:", res?.data?.message || "Insert failed");
      }
    } catch (error) {
      console.log("Network Connection Warning: Backend might be unreachable.");
    } finally {
      setSerialLoading(false);
      clearCart(); 

      
      useCartStore.getState().setCustomerInfo({
        contactNumber: phoneVal,
        customerName: nameVal,
        remark: remarkVal,
      });
      useCartStore.getState().setOrderType('TA'); 

      const selectedBehavior = FACES[activeIndex.value];

      
      router.push({
        pathname: '/Screens/selectitems',
        params: {
          contactNumber: phoneVal,
          customerName: nameVal,
          remark: remarkVal,
          orderType: 'TA',
        },
      });
    }
  };

  const knobAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}rad` }],
    };
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

        {/* ── HEADER ── */}
        <View style={[styles.headerContainer, { marginTop: headerMT, paddingHorizontal: hPad }]}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => router.back()}
            style={[styles.backButtonContainer, { width: backIconSize, height: backIconSize }]}
          >
            <View style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              <Image
                source={require('../../assets/icons/blackback.png')}
                style={styles.backImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { fontSize: headerTitleFs }]}>Take Away</Text>
          <View style={{ width: backIconSize }} />
        </View>

        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: hPad, paddingBottom: 34 + insets.bottom }]} 
          showsVerticalScrollIndicator={false}
        >
          
          {/* ── CARD 1: FORM INPUTS ── */}
          <View style={[styles.mainCard, { width: cardW, padding: innerPad, gap: gap }]}>

            <TextInput
              placeholder="Contact Number"
              placeholderTextColor="rgba(0, 0, 0, 0.35)"
              value={contactNumber}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              style={[styles.input, { height: inputH, fontSize: inputFs }]}
            />

            <TextInput
              placeholder="Name"
              placeholderTextColor="rgba(0, 0, 0, 0.35)"
              value={name}
              onChangeText={setName}
              style={[styles.input, { height: inputH, fontSize: inputFs }]}
            />

            <TextInput
              placeholder="Add Remark"
              placeholderTextColor="rgba(0, 0, 0, 0.35)"
              value={remark}
              onChangeText={setRemark}
              multiline={true}
              numberOfLines={2}
              style={[styles.input, styles.remarkInput, { fontSize: inputFs }]}
            />
          </View>

          {/* ── CARD 2: RADIAL KNOB BEHAVIOR CHART ── */}
          <View style={[styles.behaviorCard, { width: cardW, padding: innerPad }]}>
            <Text style={styles.behaviorTitle}>Customer Behavior</Text>
            
            <View style={styles.chartWrapper}>
              
              {FACES.map((face, index) => {
                const angle = (index * 45) * (Math.PI / 180);
                const x = RADIUS * Math.cos(angle);
                const y = RADIUS * Math.sin(angle);

                const faceAnimatedStyle = useAnimatedStyle(() => {
                  const isActive = activeIndex.value === index;
                  return {
                    transform: [
                      { translateX: x },
                      { translateY: y },
                      { scale: isActive ? 1.4 : 0.85 }
                    ],
                    opacity: isActive ? 1 : 0.35,
                  };
                });

                return (
                  <Animated.View key={index} style={[styles.faceWrapper, faceAnimatedStyle]}>
                    <TouchableOpacity
                      onPress={() => handleFacePress(index)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.faceText}>{face}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}

              <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.knobContainer, knobAnimatedStyle]}>
                  <View style={styles.knobInner}>
                    <View style={styles.knobIndicator} />
                  </View>
                </Animated.View>
              </GestureDetector>

            </View>
          </View>

          {/* ── CONFIRM BUTTON ── */}
          <TouchableOpacity
            style={[styles.confirmButton, { width: cardW, height: confirmBtnH, opacity: serialLoading ? 0.6 : 1 }]}
            activeOpacity={0.8}
            onPress={handleConfirm}
            disabled={serialLoading}
          >
            <Text style={[styles.confirmButtonText, { fontSize: confirmBtnFs }]}>Next</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingBottom: 25,
    paddingTop: Platform.OS === 'android' ? 55 : 55,
  },
  backButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 34,
    gap: 16,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#075EA7',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
  },
  remarkInput: {
    minHeight: 80,
    textAlignVertical: 'top', 
    paddingTop: 12,
  },
  behaviorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    alignItems: 'center',
    paddingVertical: 24,
  },
  behaviorTitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 25,
  },
  chartWrapper: {
    width: 300,
    height: 300,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceWrapper: {
    position: 'absolute',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceText: {
    fontSize: 36,
  },
  knobContainer: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  knobInner: {
    width: KNOB_SIZE - 16,
    height: KNOB_SIZE - 16,
    borderRadius: (KNOB_SIZE - 16) / 2,
    backgroundColor: '#075EA7', 
    position: 'relative',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  knobIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 12, 
    alignSelf: 'center',
  },
  confirmButton: {
    backgroundColor: '#0062AA',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Inter',
  },
});