import { NavigationProp } from '@react-navigation/native';
import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

interface Props {
  navigation?: NavigationProp<any>;
}

export default function App({ navigation }: Props) {
  const handleBack = () => {
    if (navigation) {
      navigation.goBack();
    } else {
      console.log('Back button pressed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
       
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  iconContainer: {
    width: 16,
    height: 16,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  arrowLine: {
    width: 12,
    height: 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 1,
  },
  arrowHead: {
    width: 7,
    height: 2,
    backgroundColor: '#1A1A1A',
    position: 'absolute',
    borderRadius: 1,
    left: 2,
  },
  arrowHeadTop: {
    transform: [{ rotate: '-45deg' }],
    top: 4,
  },
  arrowHeadBottom: {
    transform: [{ rotate: '45deg' }],
    bottom: 4,
  },
  backText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});