import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

export default function DefineTableScreen() {
  const router = useRouter();

  const [tableName, setTableName] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        backgroundColor="#FFFFFF"
        barStyle="dark-content"
      />

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

        <Text style={styles.headerTitle}>
          Define a Table
        </Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <Image
          source={require('../../assets/images/blacktable.png')}
          style={styles.tableImage}
          resizeMode="contain"
        />

        {/* INPUT */}
        <TextInput
          placeholder="Table Name"
          placeholderTextColor="rgba(0,0,0,0.5)"
          value={tableName}
          onChangeText={setTableName}
          style={styles.input}
        />

        {/* BUTTON */}
        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.8}
          onPress={() => {
            router.push('/Screens/paxcount');
          }}
        >
          <Text style={styles.nextText}>Next</Text>

          <Image
            source={require('../../assets/icons/back.png')}
            style={styles.nextIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

     
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 40,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  backIcon: {
    marginLeft: 16,
    marginTop: 20,
    width: 30,
    height: 30,
  },

  headerTitle: {
    marginLeft: 16,
    marginTop: 20,
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
  },

  card: {
    marginHorizontal: 16,
    marginTop: 180,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 40,
    paddingHorizontal: 24,
    elevation: 4,

    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  tableImage: {
    width: 110,
    height: 110,
    alignSelf: 'center',
    marginBottom: 40,
  },

  input: {
    width: '100%',
    height: 54,
    borderWidth: 1,
    borderColor: '#0062AA',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#000',
  },

  nextButton: {
    height: 54,
    backgroundColor: 'rgba(0,98,170,0.56)',
    borderRadius: 8,
    marginTop: 24,
    

    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  nextText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginRight: 10,
  },

  nextIcon: {
    width: 22,
    height: 22,
    tintColor: '#FFF',
    transform: [{ rotate: '180deg' }],
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 76,
    backgroundColor: 'rgba(66,119,164,0.5)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,

    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

 
});