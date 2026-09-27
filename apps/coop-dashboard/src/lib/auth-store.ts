'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  regionId: string;
  setRegionId: (regionId: string) => void;
  crops: string[];
  addCrop: (cropId: string) => void;
  removeCrop: (cropId: string) => void;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: {
        id: '1',
        name: 'Cooperative Admin',
        email: 'admin@greenvalley.coop',
        role: 'coop_admin',
        regionId: 'india',
        cropId: 'rice',
      },
      regionId: 'india',
      crops: ['rice'],

      setRegionId: (regionId) => set({ regionId }),
      addCrop: (cropId) => set((state) => ({ crops: state.crops.includes(cropId) ? state.crops : [...state.crops, cropId] })),
      removeCrop: (cropId) => set((state) => ({ crops: state.crops.filter(c => c !== cropId) })),
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'agrisense-coop-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);