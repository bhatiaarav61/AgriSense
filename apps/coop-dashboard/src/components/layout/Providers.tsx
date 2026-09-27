'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth';

interface ProvidersContextType {
  regionId: string;
  setRegionId: (id: string) => void;
  crops: string[];
  addCrop: (id: string) => void;
  removeCrop: (id: string) => void;
}

const ProvidersContext = createContext<ProvidersContextType | undefined>(undefined);

export function Providers({ children }: { children: ReactNode }) {
  const { regionId, setRegionId } = useAuthStore();
  const [crops, setCrops] = useState<string[]>(['rice']);

  const addCrop = useCallback((id: string) => {
    setCrops(prev => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const removeCrop = useCallback((id: string) => {
    setCrops(prev => prev.filter(c => c !== id));
  }, []);

  return (
    <ProvidersContext.Provider
      value={{
        regionId,
        setRegionId,
        crops,
        addCrop,
        removeCrop,
      }}
    >
      {children}
    </ProvidersContext.Provider>
  );
}

export function useProviders() {
  const context = useContext(ProvidersContext);
  if (!context) {
    throw new Error('useProviders must be used within Providers');
  }
  return context;
}