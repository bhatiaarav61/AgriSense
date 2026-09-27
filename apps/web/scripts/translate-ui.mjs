// One-off generator: translates the core UI strings into the languages that
// lack hand-written dictionaries, using the same free keyless AI the app uses.
// Output: data/ui-i18n.generated.json — merged into lib/i18n.ts at build time.
// Re-run any time: node scripts/translate-ui.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, '..', 'data', 'ui-i18n.generated.json');

// Core UI strings (visible chrome). English is the source; anything a target
// language misses simply falls back to English in the app.
const STRINGS = {
  nav_home: 'Dashboard',
  nav_detect: 'Detect',
  nav_assistant: 'Assistant',
  nav_weather: 'Weather',
  nav_yield: 'Yield',
  nav_models: 'Models',
  nav_settings: 'Settings',
  hero_badge: 'Free & open · works offline',
  hero_title_pre: 'AI crop assistant for {region}',
  hero_sub: 'Detect diseases from a photo or live camera, chat by voice, check the weather and estimate yield — all in your browser. No sign-up, and it works with no API key.',
  hero_cta1: 'Scan a leaf',
  hero_cta2: 'Ask the assistant',
  hero_note_free: 'Using free keyless AI — add your own key in Settings for best accuracy.',
  kpi_region: 'Region',
  kpi_crops: 'Crops covered',
  kpi_diseases: 'Diseases',
  kpi_langs: 'Languages',
  features_title: 'Everything you can do',
  recent_scans: 'Recent scans',
  disclaimer: 'AgriSense is a decision-support tool, not a substitute for professional agronomic advice. Always confirm chemical treatments and dosages with a local agricultural extension officer.',
  f_detect_t: 'Detect disease',
  f_detect_d: 'Upload a leaf photo for an instant diagnosis, treatment and prevention plan.',
  f_live_t: 'Live View scan',
  f_live_d: 'Point your camera at a plant and get real-time, on-device detection.',
  f_voice_t: 'Voice assistant',
  f_voice_d: 'Ask agronomy questions by voice or text and hear answers read aloud.',
  f_weather_t: 'Weather',
  f_weather_d: 'Live conditions and a 7-day agri forecast — free, no key needed.',
  f_yield_t: 'Yield estimator',
  f_yield_d: 'Transparent yield range from crop, area, planting and live weather.',
  f_models_t: 'Your models',
  f_models_d: 'Upload a TensorFlow.js model to diagnose fully offline, on-device.',
  detect_title: 'Detect crop disease',
  assistant_title: 'Voice assistant',
  assistant_sub: 'Ask about diseases, treatment, weather or yield — type or tap the mic.',
  weather_title: 'Weather',
  weather_sub: 'Live conditions and a 7-day agri forecast. Free, no API key (Open-Meteo).',
  yield_title: 'Yield estimator',
  yield_sub: 'A transparent agronomic estimate with a confidence band — free, works offline.',
  models_title: 'Your models',
  settings_title: 'Settings',
  settings_sub: 'Everything here is saved in your browser only.',
  confidence: 'Confidence',
  symptoms: 'Symptoms',
  treatment: 'Treatment',
  prevention: 'Prevention',
  sev_low: 'Low severity',
  sev_medium: 'Medium severity',
  sev_high: 'High severity',
  get_plan: 'Get AI action plan',
  ask_assistant: 'Ask the assistant',
  preparing: 'Preparing…',
  search: 'Search',
  my_location: 'My location',
  humidity: 'Humidity',
  forecast7: '7-day forecast',
  y_crop: 'Crop',
  y_area: 'Area (hectares)',
  y_planting: 'Planting date',
  y_irrigation: 'Irrigation',
  y_add_wx: 'Add live weather',
  y_estimate: 'Estimate yield',
  y_expected: 'expected total',
  y_risks: 'Risks',
  y_recs: 'Recommendations',
  chat_placeholder: 'Ask about a disease, crop, weather…',
  chat_thinking: 'AgriSense is thinking…',
  chat_greeting: "Hi! I'm your AgriSense assistant for **{region}**. Ask me about crop diseases, treatments, prevention, weather or yield — by typing or the mic.",
  g_title: 'AI visual guide',
  g_sub: 'See what each disease typically looks like — free AI images, no key needed.',
  g_generate: 'Generate',
  g_regenerate: 'Regenerate',
  theme: 'Theme',
  language: 'Language',
  region: 'Region',
};

// Languages without hand-written dictionaries in lib/i18n.ts.
const TARGETS = [
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'tw', name: 'Twi' },
  { code: 'ee', name: 'Ewe' },
  { code: 'ha', name: 'Hausa' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'ig', name: 'Igbo' },
  { code: 'om', name: 'Oromo' },
  { code: 'ceb', name: 'Cebuano' },
];

async function translate(target, attempt = 1) {
  const prompt = [
    `Translate these UI strings of a farming-assistant app into ${target.name} (${target.code}).`,
    'Rules: keep farming terms simple and locally understandable; keep the literal placeholders {region} and ** ** untouched; keep chemical names in Latin script; keep it short (UI labels).',
    'Respond ONLY with a valid JSON object with EXACTLY the same keys, values translated.',
    JSON.stringify(STRINGS),
  ].join('\n');
  try {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        referrer: 'agrisense',
        private: true,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const raw = await res.text();
    const start = raw.search(/[[{]/);
    if (start === -1) throw new Error('no json');
    const json = JSON.parse(raw.slice(start, raw.lastIndexOf('}') + 1));
    const out = {};
    let missing = 0;
    for (const [k, v] of Object.entries(STRINGS)) {
      const t = json?.[k];
      if (typeof t === 'string' && t.trim() && t.trim() !== v) out[k] = t.trim();
      else missing++;
    }
    console.log(`[translate] ${target.code}: ${Object.keys(out).length} strings (${missing} fallback to English)`);
    return out;
  } catch (err) {
    if (attempt < 3) {
      console.warn(`[translate] ${target.code} attempt ${attempt} failed (${err.message}); retrying…`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return translate(target, attempt + 1);
    }
    console.warn(`[translate] ${target.code} FAILED — this language keeps English UI for missing keys.`);
    return {};
  }
}

const result = {};
for (const target of TARGETS) {
  result[target.code] = await translate(target);
}
writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
const total = Object.values(result).reduce((n, d) => n + Object.keys(d).length, 0);
console.log(`[translate] wrote ${outFile} — ${Object.keys(result).length} languages, ${total} strings`);
