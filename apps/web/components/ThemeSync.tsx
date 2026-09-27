'use client';

// Keeps the <html> class in sync with the persisted theme after hydration
// (the initial paint is handled by ThemeScript). Also reflects the chosen
// UI language onto <html lang> for accessibility + speech defaults.
import { useEffect } from 'react';
import { useSettings } from '@/lib/store';

export function ThemeSync() {
  const theme = useSettings((s) => s.theme);
  const language = useSettings((s) => s.language);
  useEffect(() => {
    const d = document.documentElement;
    d.classList.toggle('dark', theme === 'dark');
    d.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language || 'en';
  }, [language]);
  return null;
}
