import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useCartContext } from './CartContext';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const CORRECT_PASSWORD = '1234';

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIVE TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isTablet = SCREEN_WIDTH  >= 600;
const isSmall  = SCREEN_HEIGHT < 700;

// Typography
const titleFs    = isTablet ? 26 : isSmall ? 15 : 20;
const titleLineH = isTablet ? 34 : isSmall ? 22 : 28;
const inputFs    = isTablet ? 18 : isSmall ? 13 : 15;
const optionFs   = isTablet ? 16 : isSmall ? 12 : 14;
const errorFs    = isTablet ? 14 : isSmall ? 11 : 12;
const btnTextFs  = isTablet ? 18 : isSmall ? 13 : 15;

// Layout
const hPad         = isTablet ? 40  : 24;
const inputH       = isTablet ? 56  : isSmall ? 42  : 47;
const inputRadius  = isTablet ? 16  : 12;
const btnH         = isTablet ? 44  : isSmall ? 30  : 33;
const btnRadius    = isTablet ? 14  : 12;
const checkboxSize = isTablet ? 20  : isSmall ? 14  : 16;
const checkboxR    = isTablet ? 4   : 3;
const iconSize     = isTablet ? 24  : 20;

// Vertical rhythm
const titleMT  = isTablet ? 80 : isSmall ? 48 : 64;
const inputMT  = isTablet ? 32 : isSmall ? 20 : 24;
const errorMT  = isTablet ? 8  : 6;
const dividerMT = isTablet ? 36 : isSmall ? 20 : 28;
const optionsMT = isTablet ? 32 : isSmall ? 18 : 24;
const optionGap = isTablet ? 20 : isSmall ? 12 : 14;
const btnsMT   = isTablet ? 48 : isSmall ? 28 : 36;

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const PasswordPromptScreen = () => {
  const router       = useRouter();
  const { clearAll } = useCartContext();

  const [password,       setPassword]       = useState('');
  const [selectedOption, setSelectedOption] = useState<'keep' | 'clear'>('keep');
  const [error,          setError]          = useState('');

  const handleConfirm = () => {
    const trimmed = password.trim();
    if (!trimmed) { setError('Please enter your password.'); return; }
    if (trimmed !== CORRECT_PASSWORD) {
      setError('Incorrect password. Please try again.');
      setPassword('');
      return;
    }
    if (selectedOption === 'clear') clearAll();
    router.replace('/(tabs)');
  };

  const handleCancel = () => router.back();

  const handleOptionSelect = (option: 'keep' | 'clear') => {
    setSelectedOption(option);
    if (error) setError('');
  };

  const isConfirmDisabled = password.trim().length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>

        {/* Title */}
        <Text style={styles.title}>
          Please provide your password{'\n'}to proceed
        </Text>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            secureTextEntry
            value={password}
            onChangeText={text => { setPassword(text); if (error) setError(''); }}
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <View style={styles.lockIcon}>
            <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
              <Rect x="5" y="11" width="14" height="10" rx="2"
                stroke="white" strokeWidth="2" strokeOpacity="0.5" />
              <Path
                d="M8 11V8C8 5.79086 9.79086 4 12 4C14.2091 4 16 5.79086 16 8V11"
                stroke="white" strokeWidth="2" strokeOpacity="0.5" strokeLinecap="round"
              />
              <Rect x="11" y="15" width="2" height="2" rx="1"
                fill="white" fillOpacity="0.5" />
            </Svg>
          </View>
        </View>

        {/* Error / placeholder */}
        {error
          ? <Text style={styles.errorText}>{error}</Text>
          : <View style={styles.errorPlaceholder} />
        }

        {/* Divider */}
        <View style={styles.divider} />

        {/* Options */}
        <View style={styles.optionsBlock}>
          {(['keep', 'clear'] as const).map(opt => (
            <TouchableOpacity
              key={opt}
              style={styles.optionRow}
              onPress={() => handleOptionSelect(opt)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, selectedOption === opt && styles.checkboxSelected]} />
              <Text style={styles.optionText}>
                {opt === 'keep'
                  ? 'Go back without clearing the saved data.'
                  : 'Go back with clearing the saved data.'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, isConfirmDisabled && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={isConfirmDisabled}
          >
            <Text style={styles.confirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES  — flex-based, no absolute positioning
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#1B1B1B',
  },
  inner: {
    flex:              1,
    paddingHorizontal: hPad,
    paddingTop:        titleMT,
    paddingBottom:     isTablet ? 48 : 32,
  },

  // Title
  title: {
    color:      'white',
    fontSize:   titleFs,
    fontFamily: 'Inter',
    fontWeight: '400',
    lineHeight: titleLineH,
  },

  // Input
  inputContainer: {
    marginTop:         inputMT,
    height:            inputH,
    backgroundColor:   '#3A3A3D',
    borderRadius:      inputRadius,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.3,
    shadowRadius:      8,
    elevation:         4,
  },
  textInput: {
    flex:       1,
    color:      'white',
    fontSize:   inputFs,
    fontFamily: 'Inter',
    height:     '100%',
  },
  lockIcon: {
    marginLeft:     8,
    justifyContent: 'center',
    alignItems:     'center',
  },

  // Error
  errorText: {
    marginTop:  errorMT,
    color:      '#E05252',
    fontSize:   errorFs,
    fontFamily: 'Inter',
    fontWeight: '400',
  },
  errorPlaceholder: {
    marginTop: errorMT,
    height:    errorFs * 1.4,
  },

  // Divider
  divider: {
    marginTop:       dividerMT,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Options
  optionsBlock: {
    marginTop: optionsMT,
    gap:       optionGap,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  checkbox: {
    width:           checkboxSize,
    height:          checkboxSize,
    borderRadius:    checkboxR,
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
    marginRight:     12,
    flexShrink:      0,
  },
  checkboxSelected: {
    backgroundColor: '#AB773C',
    borderColor:     '#AB773C',
  },
  optionText: {
    color:      'rgba(255,255,255,0.85)',
    fontSize:   optionFs,
    fontFamily: 'Inter',
    fontWeight: '400',
    flexShrink: 1,
  },

  // Buttons
  buttonRow: {
    marginTop:      btnsMT,
    flexDirection:  'row',
    justifyContent: 'space-between',
    gap:            12,
  },
  cancelButton: {
    flex:            1,
    height:          btnH,
    backgroundColor: '#2E2E2E',
    borderRadius:    btnRadius,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
  },
  cancelText: {
    color:      '#C97878',
    fontSize:   btnTextFs,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  confirmButton: {
    flex:            1,
    height:          btnH,
    backgroundColor: 'rgba(171,119,60,0.85)',
    borderRadius:    btnRadius,
    justifyContent:  'center',
    alignItems:      'center',
  },
  confirmButtonDisabled: {
    opacity: 0.35,
  },
  confirmText: {
    color:      'white',
    fontSize:   btnTextFs,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
});

export default PasswordPromptScreen;