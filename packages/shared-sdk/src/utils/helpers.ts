/**
 * Utility functions for AgriSense SDK
 */

import { DiseaseResult, YieldPrediction, Advisory, WeatherData, Crop, Disease } from './api';

/**
 * Format confidence as percentage string
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Get confidence label
 */
export function getConfidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get confidence color (for UI)
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#10B981'; // green
  if (confidence >= 0.5) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

/**
 * Format yield range
 */
export function formatYieldRange(prediction: YieldPrediction, unit: string = 't/ha'): string {
  return `${prediction.yield_min.toFixed(1)} - ${prediction.yield_max.toFixed(1)} ${unit}`;
}

/**
 * Format expected yield
 */
export function formatExpectedYield(prediction: YieldPrediction, unit: string = 't/ha'): string {
  return `${prediction.yield_expected.toFixed(1)} ${unit}`;
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high': return '#EF4444';
    case 'medium': return '#F59E0B';
    case 'low': return '#10B981';
    default: return '#6B7280';
  }
}

/**
 * Get severity label
 */
export function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
    default: return severity;
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format date for display
 */
export function formatDate(dateString: string, locale: string = 'en-US'): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format date time for display
 */
export function formatDateTime(dateString: string, locale: string = 'en-US'): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert blob to base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resize image for API upload
 */
export function resizeImage(
  file: File,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to resize image'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Validate image file
 */
export function validateImageFile(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload JPEG, PNG, or WebP.' };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File too large. Maximum size is ${maxSizeMB}MB.` };
  }

  return { valid: true };
}

/**
 * Get disease display name with local name fallback
 */
export function getDiseaseDisplayName(disease: Disease, language: string = 'en'): string {
  return disease.localNames[language] || disease.name;
}

/**
 * Get crop display name with local name fallback
 */
export function getCropDisplayName(crop: Crop, language: string = 'en'): string {
  return crop.localNames[language] || crop.name;
}

/**
 * Format weather condition for display
 */
export function formatWeatherCondition(condition: string): string {
  // Capitalize first letter of each word
  return condition
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get weather icon name based on condition
 */
export function getWeatherIcon(condition: string): string {
  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('clear') || conditionLower.includes('sunny')) return 'sun';
  if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) return 'cloud';
  if (conditionLower.includes('rain') || conditionLower.includes('drizzle') || conditionLower.includes('shower')) return 'cloud-rain';
  if (conditionLower.includes('thunder') || conditionLower.includes('storm')) return 'cloud-lightning';
  if (conditionLower.includes('snow') || conditionLower.includes('sleet')) return 'cloud-snow';
  if (conditionLower.includes('fog') || conditionLower.includes('mist') || conditionLower.includes('haze')) return 'cloud-fog';
  if (conditionLower.includes('wind')) return 'wind';

  return 'cloud';
}

/**
 * Calculate growing degree days (simplified)
 */
export function calculateGDD(tempMin: number, tempMax: number, baseTemp: number = 10): number {
  const avgTemp = (tempMin + tempMax) / 2;
  return Math.max(0, avgTemp - baseTemp);
}

/**
 * Format large numbers with suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Check if running in React Native
 */
export function isReactNative(): boolean {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

/**
 * Get platform info
 */
export function getPlatform(): 'web' | 'react-native' | 'node' | 'unknown' {
  if (isReactNative()) return 'react-native';
  if (isBrowser()) return 'web';
  if (typeof process !== 'undefined' && process.versions?.node) return 'node';
  return 'unknown';
}