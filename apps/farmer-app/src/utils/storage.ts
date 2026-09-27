/**
 * MMKV Storage for fast, synchronous key-value storage
 * Falls back to AsyncStorage if MMKV not available
 */

import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV({
  id: 'agrisense-storage',
  encryptionKey: 'agrisense-secure-key-2024',
});

export const mmkvStorage = {
  getItem: (key: string): string | null => {
    try {
      return mmkv.getString(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    mmkv.set(key, value);
  },
  removeItem: (key: string): void => {
    mmkv.delete(key);
  },
  clearAll: (): void => {
    mmkv.clearAll();
  },
  getAllKeys: (): string[] => {
    return mmkv.getAllKeys();
  },
};

// AsyncStorage fallback for web
export const asyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      console.error('AsyncStorage setItem error:', err);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.error('AsyncStorage removeItem error:', err);
    }
  },
  clearAll: async (): Promise<void> => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.clear();
    } catch (err) {
      console.error('AsyncStorage clearAll error:', err);
    }
  },
};

// Unified storage interface
export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    // Try MMKV first (synchronous, faster)
    const mmkvValue = mmkvStorage.getItem(key);
    if (mmkvValue !== null) return mmkvValue;

    // Fallback to AsyncStorage
    return asyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    mmkvStorage.setItem(key, value);
    await asyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    mmkvStorage.removeItem(key);
    await asyncStorage.removeItem(key);
  },
  clearAll: async (): Promise<void> => {
    mmkvStorage.clearAll();
    await asyncStorage.clearAll();
  },
};