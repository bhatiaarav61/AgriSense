/**
 * Color palette for AgriSense Farmer App
 * Supports light and dark modes
 */

export const Colors = {
  light: {
    // Primary brand colors
    primary: '#10B981',        // Emerald 500
    primaryLight: '#34D399',   // Emerald 400
    primaryDark: '#059669',    // Emerald 600
    primaryBackground: '#ECFDF5', // Emerald 50

    // Secondary colors
    secondary: '#06B6D4',      // Cyan 500
    secondaryBackground: '#ECFEFF', // Cyan 50

    // Semantic colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Neutral colors
    background: '#FFFFFF',
    surface: '#F9FAFB',
    surfaceVariant: '#F3F4F6',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',

    // Text colors
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',
    textLink: '#10B981',

    // Status colors
    online: '#10B981',
    offline: '#EF4444',
    pending: '#F59E0B',

    // Component specific
    tint: '#10B981',
    tabIconDefault: '#9CA3AF',
    tabBarBackground: '#FFFFFF',
    cardBackground: '#FFFFFF',
    inputBackground: '#FFFFFF',
    inputBorder: '#D1D5DB',
    inputFocusBorder: '#10B981',
    placeholder: '#9CA3AF',
    disabled: '#F3F4F6',
    disabledText: '#9CA3AF',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
    modalOverlay: 'rgba(0, 0, 0, 0.4)',

    // Shadows
    shadowColor: '#000000',
  },

  dark: {
    // Primary brand colors
    primary: '#34D399',        // Emerald 400
    primaryLight: '#6EE7B7',   // Emerald 300
    primaryDark: '#10B981',    // Emerald 500
    primaryBackground: '#064E3B', // Emerald 900

    // Secondary colors
    secondary: '#22D3EE',      // Cyan 400
    secondaryBackground: '#164E63', // Cyan 900

    // Semantic colors
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',

    // Neutral colors
    background: '#111827',
    surface: '#1F2937',
    surfaceVariant: '#374151',
    border: '#374151',
    borderLight: '#1F2937',

    // Text colors
    textPrimary: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary: '#9CA3AF',
    textInverse: '#111827',
    textLink: '#34D399',

    // Status colors
    online: '#34D399',
    offline: '#F87171',
    pending: '#FBBF24',

    // Component specific
    tint: '#34D399',
    tabIconDefault: '#6B7280',
    tabBarBackground: '#1F2937',
    cardBackground: '#1F2937',
    inputBackground: '#374151',
    inputBorder: '#4B5563',
    inputFocusBorder: '#34D399',
    placeholder: '#6B7280',
    disabled: '#374151',
    disabledText: '#6B7280',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
    modalOverlay: 'rgba(0, 0, 0, 0.6)',

    // Shadows
    shadowColor: '#000000',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorKey = keyof typeof Colors.light;