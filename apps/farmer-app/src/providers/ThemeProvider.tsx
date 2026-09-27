import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme as useRNColorScheme, Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type ColorScheme = 'light' | 'dark';

interface ThemeContextType {
  colorScheme: ColorScheme;
  toggleTheme: () => void;
  setTheme: (theme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadTheme();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const subscription = Appearance.addColorSchemeChangeListener(({ colorScheme }) => {
      // Only auto-switch if user hasn't manually set a preference
      const saved = SecureStore.getItemAsync('user_theme_preference').then(pref => {
        if (!pref) {
          setColorScheme(colorScheme);
        }
      });
    });
    return () => subscription.remove();
  }, [mounted]);

  const loadTheme = async () => {
    try {
      const saved = await SecureStore.getItemAsync('user_theme_preference');
      if (saved) {
        setColorScheme(saved as ColorScheme);
      } else {
        setColorScheme(systemColorScheme || 'light');
      }
    } catch {
      setColorScheme(systemColorScheme || 'light');
    }
  };

  const setTheme = useCallback(async (theme: ColorScheme) => {
    setColorScheme(theme);
    try {
      await SecureStore.setItemAsync('user_theme_preference', theme);
    } catch (err) {
      console.error('Failed to save theme preference:', err);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(colorScheme === 'light' ? 'dark' : 'light');
  }, [colorScheme, setTheme]);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ colorScheme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// For components that need the color scheme but not the full context
export function useColorScheme(): ColorScheme {
  const { colorScheme } = useTheme();
  return colorScheme;
}