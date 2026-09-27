import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthStore } from '../hooks/useAuth';

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated, token, setUser, setToken, logout: storeLogout, login: storeLogin } = useAuthStore();

  const refreshUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // In a real app, this would call the API to get fresh user data
      // const response = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } });
      // const userData = await response.json();
      // setUser(userData);
      setLoading(false);
    } catch (err) {
      console.error('Failed to refresh user:', err);
      setLoading(false);
    }
  }, [token, setUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // In a real app, this would call the auth API
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password }),
      // });
      // const { user, token } = await response.json();
      // storeLogin(user, token);

      // Mock login for development
      const mockUser = {
        id: '1',
        name: 'Demo Farmer',
        email,
        role: 'farmer' as const,
        regionId: 'india',
        cropId: 'rice',
      };
      const mockToken = 'mock-jwt-token-' + Date.now();
      storeLogin(mockUser, mockToken);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      // In a real app, this would call the auth API
      // const response = await fetch('/api/auth/register', { ... });
      // const { user, token } = await response.json();
      // storeLogin(user, token);

      // Mock registration for development
      const mockUser = {
        id: '1',
        name,
        email,
        role: 'farmer' as const,
        regionId: 'india',
        cropId: 'rice',
      };
      const mockToken = 'mock-jwt-token-' + Date.now();
      storeLogin(mockUser, mockToken);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    storeLogout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}