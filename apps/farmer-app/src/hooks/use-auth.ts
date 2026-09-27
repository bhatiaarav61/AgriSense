/**
 * Authentication and user state hook
 * Manages user session, region, and crop selection
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { mmkvStorage } from '@/utils/storage';

// Types
interface User {
  id: string;
  name: string;
  email: string;
  role: 'farmer' | 'coop_admin' | 'admin';
  regionId?: string;
  cropId?: string;
}

interface AuthState {
  user: User | null;
  regionId: string | null;
  cropId: string | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setRegionId: (regionId: string) => void;
  setCropId: (cropId: string) => void;
  setToken: (token: string) => void;
  logout: () => void;
  login: (user: User, token: string) => void;
}

// Secure storage adapter for Zustand
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      regionId: 'india', // Default region
      cropId: 'rice',    // Default crop
      token: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setRegionId: (regionId) => set({ regionId }),
      setCropId: (cropId) => set({ cropId }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      login: (user, token) => set({ user, token, isAuthenticated: true }),
    }),
    {
      name: 'agrisense-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        regionId: state.regionId,
        cropId: state.cropId,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Hook for easy access in components
export function useAuth() {
  const {
    user,
    regionId,
    cropId,
    token,
    isAuthenticated,
    setUser,
    setRegionId,
    setCropId,
    setToken,
    logout,
    login,
  } = useAuthStore();

  return {
    user,
    regionId,
    cropId,
    token,
    isAuthenticated,
    setUser,
    setRegionId,
    setCropId,
    setToken,
    logout,
    login,
  };
}

// Helper to get auth headers for API calls
export function getAuthHeaders(): Record<string, string> {
  const { token } = useAuthStore.getState();
  return token ? { Authorization: `Bearer ${token}` } : {};
}