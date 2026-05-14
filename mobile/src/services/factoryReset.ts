import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { resetDatabase } from '../db/schema';
import { Platform } from 'react-native';

export async function performFactoryReset() {
  console.log('🏁 Starting Factory Reset...');

  try {
    // 1. Reset SQLite Database
    await resetDatabase();

    // 2. Clear AsyncStorage (Preferences, Sync State, etc.)
    await AsyncStorage.clear();

    // 3. Clear SecureStore (Auth Tokens, PIN)
    // SecureStore doesn't have a "clear all" on all platforms, so we clear known keys
    const keysToClear = [
      'auth_token',
      'refresh_token',
      'user_pin',
      'user_data',
      'last_sync_timestamp',
      'partner_data'
    ];

    if (Platform.OS !== 'web') {
      for (const key of keysToClear) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (e) {
          // Key might not exist
        }
      }
    }

    console.log('✅ Factory Reset complete!');
    return true;
  } catch (error) {
    console.error('❌ Factory Reset failed:', error);
    return false;
  }
}
