import { router } from 'expo-router';
import React from 'react';
import {
    Dimensions,
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

// 1. Define an Interface for your Props
interface CategoryCardProps {
  label: string;
  color: string;
  imageUri?: string; // The '?' makes this optional, fixing ts(2741)
}

const CategoryCard = ({ label, color, imageUri }: CategoryCardProps) => (
  <TouchableOpacity style={[styles.card, { backgroundColor: color }]}>
    <View style={styles.imageContainer}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.cardImage} />
      ) : (
        <Image 
          source={{ uri: 'https://via.placeholder.com/57' }} 
          style={styles.cardImage} 
        />
      )}
    </View>
    <Text style={styles.cardText} numberOfLines={2}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function ItemSelection() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity
                         style={styles.backButton}
                         onPress={() => router.push('/Screens/definetable')}>
                         <Image
                           source={require('../../assets/icons/blackback.png')}
                           style={styles.backIcon}
                           resizeMode="contain"
                         />
                       </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Item Selection</Text>
        
        <TouchableOpacity style={styles.tableBadge}>
          <Text style={styles.tableText}>Table</Text>
          <View style={styles.dropdownArrow} />
        </TouchableOpacity>
      </View>

      {/* Grid Content */}
      <View style={styles.gridContainer}>
        <View style={styles.row}>
          <CategoryCard label="Chinese" color="#B9A0D5" />
          <CategoryCard label="Indian" color="#8D9ED4" />
          <CategoryCard label="Pantry" color="#D5CD91" />
        </View>
        
        <View style={styles.row}>
          <CategoryCard label="Juice Bar" color="#D5B0B0"  />
          <CategoryCard label="Submarine" color="#BC8EB6" />
          <CategoryCard label="Soft Drink" color="#CDBCA8" />
        </View>
        
        <View style={styles.row}>
          <CategoryCard label="Bottled Water" color="#DFC888" />
          <CategoryCard label="Other" color="#A9ABCF" />
          {/* Spacer to keep alignment consistent */}
          <View style={[styles.card, { backgroundColor: 'transparent' }]} />
        </View>
      </View>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
    marginTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'System', // Standard for Roboto-like feel on iOS/Android
  },
  tableBadge: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 98, 170, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'center',
  },
  tableText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '400',
  },
  dropdownArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#000',
    marginLeft: 6,
  },
  gridContainer: {
    padding: 16,
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: (width - 48) / 3, // Precise 3-column spacing
    height: 112,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    elevation: 2, // Minor shadow for Android
    shadowColor: '#000', // Minor shadow for iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  imageContainer: {
    width: 50,
    height: 50,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  cardText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    color: '#000',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    height: 70,
    backgroundColor: 'rgba(66, 119, 164, 0.4)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 15,
  },
  navItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
    backIcon: {
    marginLeft: 16,
    marginTop: 20,
    width: 30,
    height: 30,
  },
});