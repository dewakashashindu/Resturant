import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OperationalColors } from '../constants/operationalTheme';
import AuthBackground from './AuthBackground';

export default function AuthFormLayout({ children, padding = 26 }: { children: React.ReactNode; padding?: number }) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <AuthBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={[styles.form, { paddingHorizontal: padding }]}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: OperationalColors.canvas },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 28 },
  form: { width: '100%', maxWidth: 520, alignSelf: 'center' },
});
