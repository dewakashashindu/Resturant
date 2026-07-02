import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';


 
export const getUniqueDeviceId = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'android') {
     
      const androidId = await Application.getAndroidId();
      if (!androidId) throw new Error("Could not fetch Android ID");
      return androidId;
    } else {
      const KEYCHAIN_KEY = 'pos_secure_device_id';
      let savedUuid = await SecureStore.getItemAsync(KEYCHAIN_KEY);
      
      if (!savedUuid) {
        savedUuid = await Application.getIosIdForVendorAsync();
        
        if (!savedUuid) {
          savedUuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }
        
        await SecureStore.setItemAsync(KEYCHAIN_KEY, savedUuid);
      }
      
      return savedUuid;
    }
  } catch (error) {
    console.error("Error getting device ID:", error);
    return null;
  }
};