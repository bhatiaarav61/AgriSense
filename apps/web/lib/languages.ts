// Shared language registry — server-safe (no 'use client'), so API routes can
// look up language names to instruct models, while the client UI imports the
// same list through lib/i18n.

export interface LanguageDef {
  code: string;
  name: string;
  nativeName: string;
}

/** All languages offered for UI text, AI answers and voice. */
export const ALL_LANGUAGES: LanguageDef[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي' },
  { code: 'tw', name: 'Twi', nativeName: 'Twi' },
  { code: 'ee', name: 'Ewe', nativeName: 'Eʋegbe' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'om', name: 'Oromo', nativeName: 'Afaan Oromoo' },
  { code: 'ceb', name: 'Cebuano', nativeName: 'Cebuano' },
];

const RTL = new Set(['ur', 'sd', 'fa', 'ar', 'he']);

/** True when the language code is right-to-left (affects document direction). */
export function isRtl(lang: string): boolean {
  return RTL.has(lang);
}

/** Display name of a language code (native name preferred). */
export function languageName(code: string): string {
  const l = ALL_LANGUAGES.find((x) => x.code === code);
  return l?.nativeName ?? l?.name ?? code;
}
