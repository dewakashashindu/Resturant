import { router } from 'expo-router';
import React from 'react';
import {
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 64) / 3; // Adjusted for card padding

// --- SUB-COMPONENTS ---

interface CategoryCardProps {
  label: string;
  color: string;
}

const CategoryCard = ({ label, color }: CategoryCardProps) => (
  <TouchableOpacity style={[styles.catCard, { backgroundColor: color }]}>
    <Image 
      source={{ uri: 'https://placehold.co/57x57.png' }} 
      style={styles.catImage} 
    />
    <Text style={styles.catText}>{label}</Text>
  </TouchableOpacity>
);

const ItemCard = ({ label }: { label: string }) => (
  <View style={styles.itemContainer}>
    <View style={styles.itemImageWrapper}>
      <Text style={styles.itemLabel}>{label}</Text>
    </View>
    <TouchableOpacity style={styles.addButton}>
      <Text style={styles.addText}>ADD +</Text>
    </TouchableOpacity>
  </View>
);

// --- MAIN SCREEN ---

export default function ItemSelectionScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#002748" barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Image
            source={require('../../assets/icons/blackback.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.title}>Item Selection</Text>
        <View style={styles.tableBadge}>
          <Text style={styles.tableText}>Table</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* MAIN CARD CONTAINER */}
        <View style={styles.mainCard}>
          
          {/* ROW 1 */}
          <View style={styles.row}>
            <CategoryCard label="Cool Refresh" color="#B9A0D5" />
            <CategoryCard label="Mocktails" color="#8D9ED4" />
            <ItemCard label="Chai (Tea)" />
          </View>

          {/* ROW 2 */}
          <View style={styles.row}>
            <ItemCard label="Nescafe" />
            <ItemCard label="Lemon Tea" />
            <View style={{ width: CARD_WIDTH }} />
          </View>

        </View>
      </ScrollView>

      {/* FOOTER NAV */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.footerText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  header: {
    backgroundColor: '#002748',
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  backButton: {
    padding: 8,
  },

  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff', // Making the back arrow white to match your header
  },

  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },

  tableBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },

  tableText: {
    color: '#fff',
    fontSize: 12,
  },

  mainCard: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    minHeight: 400,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  // Category Styles
  catCard: {
    width: CARD_WIDTH,
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },

  catImage: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },

  catText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000',
  },

  // Item Styles
  itemContainer: {
    width: CARD_WIDTH,
    alignItems: 'center',
  },

  itemImageWrapper: {
    width: '100%',
    height: 100,
    borderWidth: 1,
    borderColor: '#075EA7',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },

  itemLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  addButton: {
    marginTop: 8,
    backgroundColor: '#F2DDCB',
    width: '100%',
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  addText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },

  footer: {
    height: 70,
    backgroundColor: 'rgba(0, 39, 72, 0.8)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    margin: 16,
    borderRadius: 12,
  },

  footerText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  navItem: {
    padding: 10,
  }
});