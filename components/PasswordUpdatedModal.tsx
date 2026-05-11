import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Modal,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSignIn?: () => void;
}

export default function PasswordUpdatedModal({ visible, onClose, onSignIn }: Props) {
  const { width, height } = useWindowDimensions();
  const isTablet = width  >= 600;
  const isSmall  = height < 700;
  const popAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      popAnim.setValue(0);
      return;
    }

    Animated.timing(popAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [popAnim, visible]);

  // ── AUTO NAVIGATE AFTER 3 SECONDS ──────────────
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      onClose();
      onSignIn?.();
    }, 2000);

    return () => clearTimeout(timer);
  }, [visible, onClose, onSignIn]);

  // ── RESPONSIVE ──────────────────────────────
  const cardW       = isTablet ? 340 : isSmall ? 260 : 300;
  const cardPad     = isTablet ? 32  : isSmall ? 20  : 24;
  const imgSize     = isTablet ? 160 : isSmall ? 100 : 135;
  const imgCardW    = isTablet ? 220 : isSmall ? 160 : 183;
  const imgCardH    = isTablet ? 200 : isSmall ? 150 : 168;
  const titleFs     = isTablet ? 24  : isSmall ? 17  : 20;
  const subtitleFs  = isTablet ? 14  : isSmall ? 11  : 12;
  const btnH        = isTablet ? 52  : isSmall ? 40  : 46;
  const btnFs       = isTablet ? 18  : isSmall ? 14  : 16;
  const gapMT       = isTablet ? 20  : isSmall ? 12  : 16;
  const iconScale = popAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });
  const iconOpacity = popAnim;
  const buttonMT = isTablet ? 24 : 18;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>

            {/* ── CARD ── */}
            <View style={[styles.card, { width: cardW, padding: cardPad }]}>

              {/* ── DECORATIVE CIRCLE ── */}
              <View style={styles.bgCircle} />

              {/* ── IMAGE CARD ── */}
              <View style={[styles.imageCard, { width: imgCardW, height: imgCardH }]}>
                <Animated.View
                  style={[
                    styles.iconWrap,
                    {
                      opacity: iconOpacity,
                      transform: [{ scale: iconScale }],
                      width: imgSize,
                      height: imgSize,
                      borderRadius: imgSize / 2,
                    },
                  ]}
                >
                  <Ionicons name="checkmark" size={isTablet ? 82 : isSmall ? 52 : 64} color="#fff" />
                </Animated.View>
              </View>

              {/* ── TITLE ── */}
              <Text style={[styles.title, { fontSize: titleFs, marginTop: gapMT }]}>
                Password Updated
              </Text>

              {/* ── SUBTITLE ── */}
              <Text style={[styles.subtitle, { fontSize: subtitleFs, marginTop: isTablet ? 10 : 6 }]}>
                Your new password has been created.{'\n'}&{'\n'} You can sign in now.
              </Text>

            

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ── OVERLAY ─────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── CARD ────────────────────────────────────────
  card: {
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },

  // ── DECORATIVE CIRCLE ───────────────────────────
  bgCircle: {
    position: 'absolute',
    width: 182,
    height: 181,
    borderRadius: 9999,
    backgroundColor: 'rgba(97,145,185,0.54)',
    bottom: -80,
    right: -60,
  },

  // ── IMAGE CARD ──────────────────────────────────
  imageCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  iconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3178a2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },

  // ── TEXT ────────────────────────────────────────
  title: {
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
  },
  subtitle: {
    color: '#000',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── BUTTON ──────────────────────────────────────
  signInBtn: {
    width: '100%',
    backgroundColor: '#0062AA',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: '#FFF',
    fontWeight: '700',
  },
});