import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const COLORS = {
  bg: '#1C1C1C',
  card: '#2A2A2A',
  accent: '#B07A3E',
  accentLight: '#D9A766',
  steam: 'rgba(217, 167, 102, 0.22)',
};

const LOADER_W = 100;
const LOADER_H = 80;
const CUP_H = 20;
const CUP_MIN_W = 25;
const DURATION = 6_000;

type SmokeProps = { delay: number };

const Smoke = ({ delay }: SmokeProps) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: DURATION,
          easing: Easing.linear,
          // Interpolation below uses easing. Expo's native Animated driver
          // does not support that combination, so keep this visual timeline
          // JS-driven rather than throwing a runtime error.
          useNativeDriver: false,
        }),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  const ease = Easing.inOut(Easing.ease);
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -60],
    easing: ease,
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1.2],
    easing: ease,
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: [0, 0.9, 0.5, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.smokeWrap, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      <View style={[styles.smokeLayer, { width: 22, height: 32, opacity: 0.35 }]} />
      <View style={[styles.smokeLayer, { width: 16, height: 24, opacity: 0.55 }]} />
      <View style={[styles.smokeLayer, { width: 9, height: 15, opacity: 0.8 }]} />
    </Animated.View>
  );
};

export default function CoffeeLoader() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const ease = Easing.inOut(Easing.ease);
  const width = progress.interpolate({
    inputRange: [0, 0.4, 0.8, 0.9, 1],
    outputRange: [CUP_MIN_W, LOADER_W, CUP_MIN_W, LOADER_W, CUP_MIN_W],
    easing: ease,
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.4, 0.8, 0.9, 1],
    outputRange: [0, 0, 64, 0, 0],
    easing: ease,
  });

  return (
    <View style={styles.loader}>
      <Text style={styles.load} numberOfLines={1}>..........................</Text>
      <Animated.View style={[styles.mover, { width, transform: [{ translateX }] }]}>
        <View style={styles.cup}>
          <View style={styles.cupBottom} />
          <View style={styles.cupRim} />
          <View style={styles.cupHandle} />
        </View>
        <View style={styles.saucer} />
        <View style={styles.smokeAnchor} pointerEvents="none">
          <Smoke delay={0} />
          <Smoke delay={1_000} />
          <Smoke delay={2_000} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    width: LOADER_W,
    height: LOADER_H,
    justifyContent: 'center',
    overflow: 'visible',
  },
  mover: {
    position: 'absolute',
    left: 0,
    top: (LOADER_H - CUP_H) / 2,
    height: CUP_H,
    overflow: 'visible',
    zIndex: 1,
  },
  cup: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'visible',
  },
  cupRim: {
    position: 'absolute',
    top: -3,
    left: -1,
    right: -1,
    height: 3,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 2,
  },
  cupBottom: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 4,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.accent,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  cupHandle: {
    position: 'absolute',
    width: 6,
    height: 12,
    right: -7,
    top: 2,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 2,
  },
  saucer: {
    position: 'absolute',
    bottom: -3,
    left: -3,
    right: -3,
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    opacity: 0.6,
  },
  smokeAnchor: {
    position: 'absolute',
    top: -4,
    left: '50%',
    width: 0,
    height: 0,
    overflow: 'visible',
  },
  smokeWrap: {
    position: 'absolute',
    bottom: 0,
    left: -11,
    width: 22,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smokeLayer: {
    position: 'absolute',
    borderRadius: 20,
    backgroundColor: COLORS.steam,
  },
  load: {
    position: 'absolute',
    left: -50,
    width: 200,
    top: '45%',
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.accent,
    opacity: 0.7,
  },
});
