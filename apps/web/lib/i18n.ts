'use client';

// UI internationalization. English is the base dictionary; other languages
// override any subset and fall back to English per key. The app's language is
// chosen globally (Settings or Nav), independent of region: crop/disease names,
// chat answers, advisories and voice follow it too.
import { useSettings } from './store';

export interface Dict {
  nav_home: string;
  nav_detect: string;
  nav_assistant: string;
  nav_weather: string;
  nav_yield: string;
  nav_models: string;
  nav_settings: string;

  hero_badge: string;
  hero_title_pre: string;
  hero_sub: string;
  hero_cta1: string;
  hero_cta2: string;
  hero_note_free: string;
  hero_note_key: string;
  kpi_region: string;
  kpi_crops: string;
  kpi_diseases: string;
  kpi_langs: string;
  features_title: string;
  recent_scans: string;
  disclaimer: string;

  f_detect_t: string;
  f_detect_d: string;
  f_live_t: string;
  f_live_d: string;
  f_voice_t: string;
  f_voice_d: string;
  f_weather_t: string;
  f_weather_d: string;
  f_yield_t: string;
  f_yield_d: string;
  f_models_t: string;
  f_models_d: string;

  detect_title: string;
  assistant_title: string;
  assistant_sub: string;
  weather_title: string;
  weather_sub: string;
  yield_title: string;
  yield_sub: string;
  models_title: string;
  models_sub: string;
  settings_title: string;
  settings_sub: string;

  confidence: string;
  symptoms: string;
  treatment: string;
  prevention: string;
  sev_low: string;
  sev_medium: string;
  sev_high: string;
  get_plan: string;
  ask_assistant: string;
  preparing: string;

  search: string;
  my_location: string;
  humidity: string;
  wind_kmh: string;
  mm_now: string;
  forecast7: string;

  y_crop: string;
  y_area: string;
  y_planting: string;
  y_irrigation: string;
  y_add_wx: string;
  y_estimate: string;
  y_expected: string;
  y_risks: string;
  y_recs: string;

  chat_placeholder: string;
  chat_thinking: string;

  g_title: string;
  g_sub: string;
  g_generate: string;
  g_regenerate: string;

  theme: string;
  language: string;
  region: string;
}

const en: Dict = {
  nav_home: 'Dashboard',
  nav_detect: 'Detect',
  nav_assistant: 'Assistant',
  nav_weather: 'Weather',
  nav_yield: 'Yield',
  nav_models: 'Models',
  nav_settings: 'Settings',

  hero_badge: 'Free & open · works offline',
  hero_title_pre: 'AI crop assistant for',
  hero_sub: 'Detect diseases from a photo or live camera, chat by voice, check the weather and estimate yield — all in your browser. No sign-up, and it works with no API key.',
  hero_cta1: 'Scan a leaf',
  hero_cta2: 'Ask the assistant',
  hero_note_free: 'Using free keyless AI — add your own key in Settings for best accuracy.',
  hero_note_key: 'Using your AI key.',
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
  models_sub: 'Run diagnosis fully on-device — offline, private, and free. Models are stored in your browser and never uploaded.',
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
  wind_kmh: 'km/h',
  mm_now: 'mm now',
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

  g_title: 'AI visual guide',
  g_sub: 'See what each disease typically looks like — free AI images, no key needed.',
  g_generate: 'Generate',
  g_regenerate: 'Regenerate',

  theme: 'Theme',
  language: 'Language',
  region: 'Region',
};

const DICTS: Record<string, Partial<Dict>> = {
  en,
  hi: {
    nav_home: 'डैशबोर्ड', nav_detect: 'पहचान', nav_assistant: 'सहायक', nav_weather: 'मौसम', nav_yield: 'उपज', nav_models: 'मॉडल', nav_settings: 'सेटिंग्स',
    hero_badge: 'मुफ़्त और खुला · ऑफ़लाइन भी चलता है',
    hero_title_pre: 'के लिए एआई फसल सहायक',
    hero_sub: 'फोटो या लाइव कैमरे से रोग पहचानें, आवाज़ से बात करें, मौसम देखें और उपज का अनुमान लगाएँ — सब आपके ब्राउज़र में। न साइन-अप, न API की।',
    hero_cta1: 'पत्ती स्कैन करें', hero_cta2: 'सहायक से पूछें',
    hero_note_free: 'मुफ़्त कीलेस एआई चल रहा है — बेहतर सटीकता के लिए सेटिंग्स में अपनी की जोड़ें।',
    hero_note_key: 'आपकी एआई की उपयोग हो रही है।',
    kpi_region: 'क्षेत्र', kpi_crops: 'फसलें', kpi_diseases: 'रोग', kpi_langs: 'भाषाएँ',
    features_title: 'आप क्या-क्या कर सकते हैं', recent_scans: 'हाल की स्कैन',
    disclaimer: 'AgriSense एक सहायक उपकरण है, पेशेवर कृषि सलाह का विकल्प नहीं। रासायनिक उपचार की पुष्टि स्थानीय कृषि अधिकारी से करें।',
    f_detect_t: 'रोग पहचानें', f_detect_d: 'पत्ती की फोटो अपलोड करें और तुरंत निदान, उपचार व बचाव पाएँ।',
    f_live_t: 'लाइव स्कैन', f_live_d: 'कैमरा पौधे की ओर करें और रीयल-टाइम पहचान पाएँ।',
    f_voice_t: 'आवाज़ सहायक', f_voice_d: 'आवाज़ या टाइप करके सवाल पूछें और जवाब सुनें।',
    f_weather_t: 'मौसम', f_weather_d: 'लाइव मौसम और 7-दिन का कृषि पूर्वानुमान — मुफ़्त।',
    f_yield_t: 'उपज अनुमान', f_yield_d: 'फसल, क्षेत्र, बुवाई और मौसम से पारदर्शी उपज अनुमान।',
    f_models_t: 'आपके मॉडल', f_models_d: 'TensorFlow.js मॉडल अपलोड करें और पूरी तरह ऑफ़लाइन जाँच करें।',
    detect_title: 'फसल रोग पहचानें',
    assistant_title: 'आवाज़ सहायक', assistant_sub: 'रोग, उपचार, मौसम या उपज के बारे में पूछें — टाइप करें या माइक दबाएँ।',
    weather_title: 'मौसम', weather_sub: 'लाइव मौसम और 7-दिन का कृषि पूर्वानुमान। मुफ़्त, कोई API की नहीं।',
    yield_title: 'उपज अनुमान', yield_sub: 'विश्वास सीमा के साथ पारदर्शी कृषि अनुमान — मुफ़्त, ऑफ़लाइन भी।',
    models_title: 'आपके मॉडल',
    settings_title: 'सेटिंग्स', settings_sub: 'यह सब केवल आपके ब्राउज़र में सुरक्षित रहता है।',
    confidence: 'विश्वास', symptoms: 'लक्षण', treatment: 'उपचार', prevention: 'बचाव',
    sev_low: 'कम गंभीरता', sev_medium: 'मध्यम गंभीरता', sev_high: 'अधिक गंभीरता',
    get_plan: 'एआई कार्य योजना पाएँ', ask_assistant: 'सहायक से पूछें', preparing: 'तैयार कर रहे हैं…',
    search: 'खोजें', my_location: 'मेरी लोकेशन', humidity: 'नमी', wind_kmh: 'किमी/घं', mm_now: 'मिमी अब', forecast7: '7-दिन का पूर्वानुमान',
    y_crop: 'फसल', y_area: 'क्षेत्र (हेक्टेयर)', y_planting: 'बुवाई तिथि', y_irrigation: 'सिंचाई', y_add_wx: 'लाइव मौसम जोड़ें', y_estimate: 'उपज का अनुमान', y_expected: 'अपेक्षित कुल', y_risks: 'जोखिम', y_recs: 'सिफ़ारिशें',
    chat_placeholder: 'रोग, फसल, मौसम के बारे में पूछें…', chat_thinking: 'AgriSense सोच रहा है…',
    g_title: 'एआई विज़ुअल गाइड', g_sub: 'देखें कि रोग कैसा दिखता है — मुफ़्त एआई चित्र, कोई की नहीं।', g_generate: 'बनाएँ', g_regenerate: 'फिर बनाएँ',
    theme: 'थीम', language: 'भाषा', region: 'क्षेत्र',
  },
  bn: {
    nav_home: 'ড্যাশবোর্ড', nav_detect: 'সনাক্ত', nav_assistant: 'সহকারী', nav_weather: 'আবহাওয়া', nav_yield: 'ফলন', nav_models: 'মডেল', nav_settings: 'সেটিংস',
    hero_badge: 'বিনামূল্যে ও উন্মুক্ত · অফলাইনেও চলে',
    hero_title_pre: 'এর জন্য এআই ফসল সহকারী',
    hero_sub: 'ছবি বা লাইভ ক্যামেরায় রোগ শনাক্ত করুন, কণ্ঠে কথা বলুন, আবহাওয়া দেখুন ও ফলন অনুমান করুন — সব আপনার ব্রাউজারেই। কোনো সাইন-আপ বা API কী লাগে না।',
    hero_cta1: 'পাতা স্ক্যান করুন', hero_cta2: 'সহকারীকে জিজ্ঞাসা করুন',
    hero_note_free: 'বিনামূল্যে কী-ছাড়া এআই চলছে — আরও নির্ভুলতার জন্য সেটিংসে নিজের কী যোগ করুন।',
    hero_note_key: 'আপনার এআই কী ব্যবহৃত হচ্ছে।',
    kpi_region: 'অঞ্চল', kpi_crops: 'ফসল', kpi_diseases: 'রোগ', kpi_langs: 'ভাষা',
    features_title: 'আপনি যা করতে পারেন', recent_scans: 'সাম্প্রতিক স্ক্যান',
    confidence: 'আস্থা', symptoms: 'লক্ষণ', treatment: 'চিকিৎসা', prevention: 'প্রতিরোধ',
    sev_low: 'কম তীব্রতা', sev_medium: 'মধ্যম তীব্রতা', sev_high: 'উচ্চ তীব্রতা',
    get_plan: 'এআই অ্যাকশন প্ল্যান নিন', ask_assistant: 'সহকারীকে জিজ্ঞাসা করুন', preparing: 'প্রস্তুত হচ্ছে…',
    search: 'খুঁজুন', my_location: 'আমার অবস্থান', humidity: 'আর্দ্রতা', forecast7: '৭ দিনের পূর্বাভাস',
    detect_title: 'ফসলের রোগ শনাক্ত করুন',
    assistant_title: 'ভয়েস সহকারী', weather_title: 'আবহাওয়া', yield_title: 'ফলন অনুমান', models_title: 'আপনার মডেল', settings_title: 'সেটিংস',
    chat_placeholder: 'রোগ, ফসল বা আবহাওয়া সম্পর্কে জিজ্ঞাসা করুন…', chat_thinking: 'AgriSense ভাবছে…',
    g_title: 'এআই ভিজ্যুয়াল গাইড', g_generate: 'তৈরি করুন', g_regenerate: 'আবার তৈরি করুন',
    theme: 'থিম', language: 'ভাষা', region: 'অঞ্চল',
    y_crop: 'ফসল', y_estimate: 'ফলন অনুমান করুন', y_risks: 'ঝুঁকি', y_recs: 'সুপারিশ',
  },
  ur: {
    nav_home: 'ڈیش بورڈ', nav_detect: 'تشخیص', nav_assistant: 'معاون', nav_weather: 'موسم', nav_yield: 'پیداوار', nav_models: 'ماڈلز', nav_settings: 'ترتیبات',
    hero_badge: 'مفت اور آزاد · آف لائن بھی چلتا ہے',
    hero_title_pre: 'کے لیے اے آئی فصل معاون',
    hero_sub: 'تصویر یا لائیو کیمرے سے بیماری پہچانیں، آواز سے بات کریں، موسم دیکھیں اور پیداوار کا اندازہ لگائیں — سب آپ کے براؤزر میں۔ نہ سائن اپ، نہ API کی۔',
    hero_cta1: 'پتہ اسکین کریں', hero_cta2: 'معاون سے پوچھیں',
    hero_note_free: 'مفت کی لیس اے آئی چل رہا ہے — بہتر درستگی کے لیے ترتیبات میں اپنی کلید شامل کریں۔',
    hero_note_key: 'آپ کی اے آئی کلید استعمال ہو رہی ہے۔',
    kpi_region: 'علاقہ', kpi_crops: 'فصلیں', kpi_diseases: 'بیماریاں', kpi_langs: 'زبانیں',
    features_title: 'آپ کیا کر سکتے ہیں', recent_scans: 'حالیہ اسکین',
    confidence: 'اعتماد', symptoms: 'علامات', treatment: 'علاج', prevention: 'بچاؤ',
    sev_low: 'کم شدت', sev_medium: 'درمیانی شدت', sev_high: 'زیادہ شدت',
    get_plan: 'اے آئی کارروائی منصوبہ', ask_assistant: 'معاون سے پوچھیں', preparing: 'تیار کر رہے ہیں…',
    search: 'تلاش', my_location: 'میری لوکیشن', humidity: 'نمی', forecast7: '7 روزہ پیشن گوئی',
    detect_title: 'فصل کی بیماری کی تشخیص',
    assistant_title: 'صوتی معاون', weather_title: 'موسم', yield_title: 'پیداوار کا اندازہ', models_title: 'آپ کے ماڈلز', settings_title: 'ترتیبات',
    chat_placeholder: 'بیماری، فصل یا موسم کے بارے میں پوچھیں…', chat_thinking: 'AgriSense سوچ رہا ہے…',
    g_title: 'اے آئی بصری رہنما', g_generate: 'بنائیں', g_regenerate: 'دوبارہ بنائیں',
    theme: 'تھیم', language: 'زبان', region: 'علاقہ',
    y_crop: 'فصل', y_estimate: 'پیداوار کا اندازہ', y_risks: 'خطرات', y_recs: 'سفارشات',
  },
  sw: {
    nav_home: 'Dashibodi', nav_detect: 'Gundua', nav_assistant: 'Msaidizi', nav_weather: 'Hali ya hewa', nav_yield: 'Mavuno', nav_models: 'Mifano', nav_settings: 'Mipangilio',
    hero_badge: 'Bure na wazi · hufanya kazi nje ya mtandao',
    hero_title_pre: 'Msaidizi wa kilimo wa AI kwa',
    hero_sub: 'Gundua magonjwa kwa picha au kamera ya moja kwa moja, Wasiliana kwa sauti, angalia hali ya hewa na kadiria mavuno — yote kwenye kivinjari chako. Hakuna kujisajili wala funguo ya API.',
    hero_cta1: 'Chora jani', hero_cta2: 'Uliza msaidizi',
    hero_note_free: 'Inatumia AI ya bure bila funguo — ongeza funguo yako kwenye Mipangilio kwa usahihi zaidi.',
    hero_note_key: 'Inatumia funguo yako ya AI.',
    kpi_region: 'Mkoa', kpi_crops: 'Mazao', kpi_diseases: 'Magonjwa', kpi_langs: 'Lugha',
    features_title: 'Kila unachoweza kufanya', recent_scans: 'Uchunguzi wa hivi karibuni',
    confidence: 'Uhakika', symptoms: 'Dalili', treatment: 'Matibabu', prevention: 'Kinga',
    sev_low: 'Ukali wa chini', sev_medium: 'Ukali wa wastani', sev_high: 'Ukali wa juu',
    get_plan: 'Pata mpango wa AI', ask_assistant: 'Uliza msaidizi', preparing: 'Inaandaliwa…',
    search: 'Tafuta', my_location: 'Mahali nilipo', humidity: 'Unyevu', forecast7: 'Siku 7 ijayo',
    detect_title: 'Gundua magonjwa ya mazao',
    assistant_title: 'Msaidizi wa sauti', weather_title: 'Hali ya hewa', yield_title: 'Kikadiriaji cha mavuno', models_title: 'Mifano yako', settings_title: 'Mipangilio',
    chat_placeholder: 'Uliza kuhusu ugonjwa, zao, hali ya hewa…', chat_thinking: 'AgriSense inafikiri…',
    g_title: 'Mwongozo wa picha wa AI', g_generate: 'Tengeneza', g_regenerate: 'Tengeneza upya',
    theme: 'Mandhari', language: 'Lugha', region: 'Mkoa',
    y_crop: 'Zao', y_estimate: 'Kadiria mavuno', y_risks: 'Hatari', y_recs: 'Mapendekezo',
  },
  pt: {
    nav_home: 'Painel', nav_detect: 'Detectar', nav_assistant: 'Assistente', nav_weather: 'Clima', nav_yield: 'Colheita', nav_models: 'Modelos', nav_settings: 'Ajustes',
    hero_badge: 'Grátis e aberto · funciona offline',
    hero_title_pre: 'Assistente de cultivo com IA para',
    hero_sub: 'Detecte doenças por foto ou câmera ao vivo, converse por voz, veja o clima e estime a colheita — tudo no seu navegador. Sem cadastro e sem chave de API.',
    hero_cta1: 'Escanear uma folha', hero_cta2: 'Perguntar ao assistente',
    hero_note_free: 'Usando IA gratuita sem chave — adicione sua chave nos Ajustes para mais precisão.',
    hero_note_key: 'Usando sua chave de IA.',
    kpi_region: 'Região', kpi_crops: 'Culturas', kpi_diseases: 'Doenças', kpi_langs: 'Idiomas',
    features_title: 'Tudo o que você pode fazer', recent_scans: 'Varreduras recentes',
    confidence: 'Confiança', symptoms: 'Sintomas', treatment: 'Tratamento', prevention: 'Prevenção',
    sev_low: 'Severidade baixa', sev_medium: 'Severidade média', sev_high: 'Severidade alta',
    get_plan: 'Obter plano de IA', ask_assistant: 'Perguntar ao assistente', preparing: 'Preparando…',
    search: 'Buscar', my_location: 'Minha localização', humidity: 'Umidade', forecast7: 'Previsão de 7 dias',
    detect_title: 'Detectar doenças na plantação',
    assistant_title: 'Assistente de voz', weather_title: 'Clima', yield_title: 'Estimativa de colheita', models_title: 'Seus modelos', settings_title: 'Ajustes',
    chat_placeholder: 'Pergunte sobre doenças, culturas, clima…', chat_thinking: 'AgriSense está pensando…',
    g_title: 'Guia visual com IA', g_generate: 'Gerar', g_regenerate: 'Regerar',
    theme: 'Tema', language: 'Idioma', region: 'Região',
    y_crop: 'Cultura', y_estimate: 'Estimar colheita', y_risks: 'Riscos', y_recs: 'Recomendações',
  },
  es: {
    nav_home: 'Panel', nav_detect: 'Detectar', nav_assistant: 'Asistente', nav_weather: 'Clima', nav_yield: 'Cosecha', nav_models: 'Modelos', nav_settings: 'Ajustes',
    hero_badge: 'Gratis y abierto · funciona sin conexión',
    hero_title_pre: 'Asistente de cultivo con IA para',
    hero_sub: 'Detecta enfermedades con una foto o la cámara, consulta por voz, mira el clima y estima la cosecha — todo en tu navegador. Sin registro ni clave de API.',
    hero_cta1: 'Escanear una hoja', hero_cta2: 'Preguntar al asistente',
    hero_note_free: 'Usando IA gratuita sin clave — añade tu clave en Ajustes para más precisión.',
    hero_note_key: 'Usando tu clave de IA.',
    kpi_region: 'Región', kpi_crops: 'Cultivos', kpi_diseases: 'Enfermedades', kpi_langs: 'Idiomas',
    features_title: 'Todo lo que puedes hacer', recent_scans: 'Escaneos recientes',
    confidence: 'Confianza', symptoms: 'Síntomas', treatment: 'Tratamiento', prevention: 'Prevención',
    sev_low: 'Severidad baja', sev_medium: 'Severidad media', sev_high: 'Severidad alta',
    get_plan: 'Obtener plan de IA', ask_assistant: 'Preguntar al asistente', preparing: 'Preparando…',
    search: 'Buscar', my_location: 'Mi ubicación', humidity: 'Humedad', forecast7: 'Pronóstico de 7 días',
    detect_title: 'Detectar enfermedades del cultivo',
    assistant_title: 'Asistente de voz', weather_title: 'Clima', yield_title: 'Estimador de cosecha', models_title: 'Tus modelos', settings_title: 'Ajustes',
    chat_placeholder: 'Pregunta sobre enfermedades, cultivos, clima…', chat_thinking: 'AgriSense está pensando…',
    g_title: 'Guía visual con IA', g_generate: 'Generar', g_regenerate: 'Regenerar',
    theme: 'Tema', language: 'Idioma', region: 'Región',
    y_crop: 'Cultivo', y_estimate: 'Estimar cosecha', y_risks: 'Riesgos', y_recs: 'Recomendaciones',
  },
  fr: {
    nav_home: 'Tableau de bord', nav_detect: 'Détecter', nav_assistant: 'Assistant', nav_weather: 'Météo', nav_yield: 'Rendement', nav_models: 'Modèles', nav_settings: 'Réglages',
    hero_badge: 'Gratuit et ouvert · fonctionne hors ligne',
    hero_title_pre: 'Assistant cultural IA pour',
    hero_sub: 'Détectez les maladies par photo ou caméra, discutez en voix, consultez la météo et estimez le rendement — tout dans votre navigateur. Sans inscription ni clé API.',
    hero_cta1: 'Scanner une feuille', hero_cta2: 'Demander à l’assistant',
    hero_note_free: 'IA gratuite sans clé — ajoutez votre clé dans les Réglages pour plus de précision.',
    hero_note_key: 'Utilisation de votre clé IA.',
    kpi_region: 'Région', kpi_crops: 'Cultures', kpi_diseases: 'Maladies', kpi_langs: 'Langues',
    features_title: 'Tout ce que vous pouvez faire', recent_scans: 'Analyses récentes',
    confidence: 'Confiance', symptoms: 'Symptômes', treatment: 'Traitement', prevention: 'Prévention',
    sev_low: 'Gravité faible', sev_medium: 'Gravité moyenne', sev_high: 'Gravité élevée',
    get_plan: 'Obtenir un plan IA', ask_assistant: 'Demander à l’assistant', preparing: 'Préparation…',
    search: 'Rechercher', my_location: 'Ma position', humidity: 'Humidité', forecast7: 'Prévisions 7 jours',
    detect_title: 'Détecter les maladies des cultures',
    assistant_title: 'Assistant vocal', weather_title: 'Météo', yield_title: 'Estimateur de rendement', models_title: 'Vos modèles', settings_title: 'Réglages',
    chat_placeholder: 'Posez une question sur une maladie, une culture…', chat_thinking: 'AgriSense réfléchit…',
    g_title: 'Guide visuel IA', g_generate: 'Générer', g_regenerate: 'Régénérer',
    theme: 'Thème', language: 'Langue', region: 'Région',
    y_crop: 'Culture', y_estimate: 'Estimer le rendement', y_risks: 'Risques', y_recs: 'Recommandations',
  },
  de: {
    nav_home: 'Übersicht', nav_detect: 'Erkennen', nav_assistant: 'Assistent', nav_weather: 'Wetter', nav_yield: 'Ertrag', nav_models: 'Modelle', nav_settings: 'Einstellungen',
    hero_badge: 'Kostenlos & offen · funktioniert offline',
    hero_title_pre: 'KI-Pflanzenassistent für',
    hero_sub: 'Erkenne Krankheiten per Foto oder Kamera, sprich per Sprache, prüfe das Wetter und schätze den Ertrag — alles im Browser. Ohne Anmeldung und ohne API-Schlüssel.',
    hero_cta1: 'Blatt scannen', hero_cta2: 'Assistenten fragen',
    hero_note_free: 'Kostenlose KI ohne Schlüssel — füge in den Einstellungen deinen Schlüssel für mehr Genauigkeit hinzu.',
    hero_note_key: 'Dein KI-Schlüssel wird verwendet.',
    kpi_region: 'Region', kpi_crops: 'Kulturen', kpi_diseases: 'Krankheiten', kpi_langs: 'Sprachen',
    features_title: 'Alles, was du tun kannst', recent_scans: 'Letzte Scans',
    confidence: 'Sicherheit', symptoms: 'Symptome', treatment: 'Behandlung', prevention: 'Vorbeugung',
    sev_low: 'Geringe Schwere', sev_medium: 'Mittlere Schwere', sev_high: 'Hohe Schwere',
    get_plan: 'KI-Aktionsplan holen', ask_assistant: 'Assistenten fragen', preparing: 'Wird vorbereitet…',
    search: 'Suchen', my_location: 'Mein Standort', humidity: 'Luftfeuchte', forecast7: '7-Tage-Vorhersage',
    detect_title: 'Pflanzenkrankheiten erkennen',
    assistant_title: 'Sprachassistent', weather_title: 'Wetter', yield_title: 'Ertragsschätzer', models_title: 'Deine Modelle', settings_title: 'Einstellungen',
    chat_placeholder: 'Frag zu Krankheiten, Kulturen, Wetter…', chat_thinking: 'AgriSense denkt nach…',
    g_title: 'KI-Bildführer', g_generate: 'Erzeugen', g_regenerate: 'Neu erzeugen',
    theme: 'Design', language: 'Sprache', region: 'Region',
    y_crop: 'Kultur', y_estimate: 'Ertrag schätzen', y_risks: 'Risiken', y_recs: 'Empfehlungen',
  },
  fil: {
    nav_home: 'Dashboard', nav_detect: 'Tuklasin', nav_assistant: 'Katulong', nav_weather: 'Panahon', nav_yield: 'Ani', nav_models: 'Mga Modelo', nav_settings: 'Mga Setting',
    hero_badge: 'Libre at bukas · gumagana offline',
    hero_title_pre: 'AI na katulong sa pananim para sa',
    hero_sub: 'Tuklasin ang sakit sa pamamagitan ng larawan o camera, magtanong gamit ang boses, tingnan ang panahon at tantiyahin ang ani — lahat sa browser mo. Walang sign-up at API key.',
    hero_cta1: 'I-scan ang dahon', hero_cta2: 'Tanungin ang katulong',
    hero_note_free: 'Gumagamit ng libreng AI na walang key — magdagdag ng sariling key sa Settings para mas tumpak.',
    hero_note_key: 'Ginagamit ang AI key mo.',
    kpi_region: 'Rehiyon', kpi_crops: 'Mga pananim', kpi_diseases: 'Mga sakit', kpi_langs: 'Mga wika',
    features_title: 'Lahat ng magagawa mo', recent_scans: 'Mga kamakailang scan',
    confidence: 'Katiyakan', symptoms: 'Mga sintomas', treatment: 'Gamutan', prevention: 'Pag-iwas',
    sev_low: 'Mababang grabidad', sev_medium: 'Katamtamang grabidad', sev_high: 'Mataas na grabidad',
    get_plan: 'Kunin ang AI action plan', ask_assistant: 'Tanungin ang katulong', preparing: 'Naghahanda…',
    search: 'Maghanap', my_location: 'Aking lokasyon', humidity: 'Halumigmig', forecast7: '7-araw na forecast',
    detect_title: 'Tuklasin ang sakit ng pananim',
    assistant_title: 'Voice assistant', weather_title: 'Panahon', yield_title: 'Tagatantiya ng ani', models_title: 'Mga modelo mo', settings_title: 'Mga Setting',
    chat_placeholder: 'Magtanong tungkol sa sakit, pananim, panahon…', chat_thinking: 'Nag-iisip si AgriSense…',
    g_title: 'AI na gabay na biswal', g_generate: 'Gumawa', g_regenerate: 'Gumawa muli',
    theme: 'Tema', language: 'Wika', region: 'Rehiyon',
    y_crop: 'Pananim', y_estimate: 'Tantiyahin ang ani', y_risks: 'Mga panganib', y_recs: 'Mga rekomendasyon',
  },
  am: {
    nav_home: 'ዳሽቦርድ', nav_detect: 'መለየት', nav_assistant: 'ረዳት', nav_weather: 'አየር ሁኔታ', nav_yield: 'ምርት', nav_models: 'ሞዴሎች', nav_settings: 'ቅንብሮች',
    hero_badge: 'ነጻ እና ክፍት · ከመስመር ውጭም ይሠራል',
    hero_title_pre: 'ለ አአ የሰብል እርዳታ',
    hero_sub: 'በፎቶ ወይም በካሜራ በሽታዎችን ይለዩ፣ በድምፅ ይጠይቁ፣ አየር ሁኔታን ይመልከቱ እና ምርትን ይገምግሙ — ሁሉም በአሳሽዎ ውስጥ። ምንም ምዝገባ ወይም API ቁልፍ አያስፈልግም።',
    hero_cta1: 'ቅጠል ይቃኙ', hero_cta2: 'ረዳቱን ይጠይቁ',
    hero_note_free: 'ነጻ የሆነ ቁልፍ የሌለው አአ እየሠራ ነው — ትክክለኛነትን ለመጨመር በቅንብሮች ውስጥ የራስዎን ቁልፍ ያክሉ።',
    hero_note_key: 'የእርስዎ አአ ቁልፍ እየተጠቀመ ነው።',
    kpi_region: 'ክልል', kpi_crops: 'ሰብሎች', kpi_diseases: 'በሽታዎች', kpi_langs: 'ቋንቋዎች',
    features_title: 'ማድረግ የሚችሉት ሁሉ', recent_scans: 'የቅርብ ግምገማዎች',
    confidence: 'እምነት', symptoms: 'ምልክቶች', treatment: 'ሕክምና', prevention: 'መከላከያ',
    sev_low: 'ዝቅተኛ ክብደት', sev_medium: 'መካከለኛ ክብደት', sev_high: 'ከፍተኛ ክብደት',
    get_plan: 'የአአ እርምጃ ዕቅድ', ask_assistant: 'ረዳቱን ይጠይቁ', preparing: 'በመዘጋጀት ላይ…',
    search: 'ፈልግ', my_location: 'የእኔ አካባቢ', humidity: 'እርጥበት', forecast7: 'የ7 ቀን ትንበያ',
    detect_title: 'የሰብል በሽታ መለየት',
    assistant_title: 'የድምፅ ረዳት', weather_title: 'አየር ሁኔታ', yield_title: 'የምርት ግምተኛ', models_title: 'የእርስዎ ሞዴሎች', settings_title: 'ቅንብሮች',
    chat_placeholder: 'ስለ በሽታ፣ ሰብል ወይም አየር ሁኔታ ይጠይቁ…', chat_thinking: 'AgriSense እያሰበ ነው…',
    g_title: 'የአአ ምስላዊ መመሪያ', g_generate: 'ፍጠር', g_regenerate: 'እንደገና ፍጠር',
    theme: 'ገጽታ', language: 'ቋንቋ', region: 'ክልል',
    y_crop: 'ሰብል', y_estimate: 'ምርትን ገምግም', y_risks: 'ስጋቶች', y_recs: 'ምክሮች',
  },
};

/** All languages offered for the UI + voice (union of region languages). */
export const ALL_LANGUAGES: { code: string; name: string; nativeName: string }[] = [
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

/** React hook: translate a key in the user's chosen language (English fallback). */
export function useT() {
  const language = useSettings((s) => s.language);
  return (key: keyof Dict): string => DICTS[language]?.[key] ?? en[key];
}

/** Non-hook translation (for plain module contexts). */
export function tFor(language: string) {
  return (key: keyof Dict): string => DICTS[language]?.[key] ?? en[key];
}

/** Display name of a language code (native name preferred). */
export function languageName(code: string): string {
  const l = ALL_LANGUAGES.find((x) => x.code === code);
  return l?.nativeName ?? l?.name ?? code;
}
