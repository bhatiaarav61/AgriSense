// Shared domain types for AgriSense Web.

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  rtl?: boolean;
}

export interface Crop {
  id: string;
  name: string;
  scientificName?: string;
  localNames?: Record<string, string>;
  growingSeasons?: string[];
  diseaseClasses?: string[];
  icon?: string;
  color?: string;
}

export interface Disease {
  id: string;
  name: string;
  scientificName?: string;
  cropIds: string[];
  symptoms: string[];
  localNames?: Record<string, string>;
  severityLevels?: string[];
  treatmentTemplate?: string;
  preventiveMeasures?: string[];
  confidenceThreshold?: number;
}

export interface Region {
  id: string;
  name: string;
  displayName?: Record<string, string>;
  isoCode?: string;
  timezone?: string;
  languages?: LanguageInfo[];
  defaultLanguage?: string;
  currency?: string;
  coordinates?: { latMin: number; latMax: number; lonMin: number; lonMax: number };
  crops: Crop[];
  diseases: Disease[];
}

export type Severity = 'low' | 'medium' | 'high';

/** Where a detection result came from. */
export type DetectionSource = 'demo' | 'model' | 'cloud';

export interface DetectionResult {
  diseaseId: string;
  name: string;
  confidence: number; // 0..1
  source: DetectionSource;
  severity: Severity;
  symptoms: string[];
  treatment: string;
  preventiveMeasures: string[];
  localNames: Record<string, string>;
  cropId?: string;
  /** Full ranked list of candidate scores (top-k), for the UI. */
  candidates?: { label: string; score: number }[];
  note?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  source?: 'demo' | 'cloud';
}

// 'pollinations' is a free, KEYLESS provider used as the automatic default so
// AI chat + vision work out of the box with zero setup. The other three are
// optional "bring your own (free) key" providers for higher quality/limits.
export type AiProvider = 'gemini' | 'groq' | 'openrouter' | 'pollinations';

/** Providers the user can pick + paste a key for in Settings. */
export const KEYED_PROVIDERS = ['gemini', 'groq', 'openrouter'] as const;
