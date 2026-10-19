import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

/** Original Login circles, shared only by staff authentication screens. */
export default function AuthBackground() {
  const { width } = useWindowDimensions();
  const tablet = width >= 600;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
      <View style={[styles.top, { width: tablet ? 220 : 160, height: tablet ? 220 : 160, top: tablet ? 120 : 80 }]} />
      <View style={[styles.bottom, { width: tablet ? 240 : 190, height: tablet ? 240 : 190 }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  top: { position: 'absolute', left: -70, borderRadius: 999, backgroundColor: 'rgba(168,139,98,0.35)' },
  bottom: { position: 'absolute', right: -70, bottom: -60, borderRadius: 999, backgroundColor: 'rgba(168,139,98,0.35)' },
});
