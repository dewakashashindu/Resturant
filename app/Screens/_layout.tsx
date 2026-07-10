import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import BottomBar from '../../components/BottomBar';

export default function ScreensLayout() {
  return (
    <View style={styles.container}>
      
      <View style={styles.content}>
        <Slot />
      </View>

      
      <BottomBar />
    </View>
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
});
