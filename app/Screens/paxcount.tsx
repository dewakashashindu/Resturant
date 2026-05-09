import { router } from 'expo-router';
import React from 'react';
import {
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function PaxCountScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#ffffff" barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
         <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.push('/Screens/definetable')}
                >
                  <Image
                    source={require('../../assets/icons/blackback.png')}
                    style={styles.backIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
        <Text style={styles.title}>Pax Count</Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        {/* IMAGE */}
        <Image
          source={require('../../assets/images/blacktable.png')}
          style={styles.image}
          resizeMode="contain"
        />

        {/* LOCAL PAX */}
        <View style={styles.inputBox}>
          <TextInput
            placeholder="Local Pax"
            placeholderTextColor="rgba(0,0,0,0.5)"
            style={styles.input}
            keyboardType="numeric"
          />
        </View>

        {/* FOREIGN PAX */}
        <View style={styles.inputBox}>
          <TextInput
            placeholder="Foreign Pax"
            placeholderTextColor="rgba(0,0,0,0.5)"
            style={styles.input}
            keyboardType="numeric"
          />
        </View>

        {/* BUTTON */}
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={() => router.push('/Screens/selectitems')}>
          <Text style={styles.buttonText}>Confirm</Text>
          <Text style={styles.icon}>✓</Text>
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
    backgroundColor: '#ffffff',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '600',
  },

  card: {
    marginTop: 160,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  image: {
    width: 110,
    height: 110,
    marginBottom: 20,
  },

  inputBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#075EA7',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
  },

  input: {
    height: 54,
    fontSize: 14,
  },

  button: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 98, 170, 0.56)',
    width: '100%',
    height: 54,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },

  icon: {
    color: '#fff',
    fontSize: 18,
  },
    backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#ffffff',
   
   
  },

  backIcon: {
    marginLeft: 16,
    marginTop: 20,
    width: 30,
    height: 30,
  },
});