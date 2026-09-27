// Offline, dependency-free fallbacks so the whole product works with NO API key
// and NO uploaded model. These are heuristics, clearly labelled "Demo" in the UI
// — not a substitute for a trained model or an agronomist.
import type { Disease, Region } from './types';

export interface ImageFeatures {
  brightness: number; // 0..1
  greenRatio: number; // 0..1 share of vegetation-green pixels
  brownRatio: number; // 0..1 share of brown/necrotic pixels
  yellowRatio: number; // 0..1 share of yellow/chlorotic pixels
  spotiness: number; // 0..1 local contrast / lesion texture
}

export interface ClassScore {
  label: string; // diseaseId or 'healthy'
  score: number; // 0..1
}

function seededJitter(features: ImageFeatures, salt: string): number {
  // Deterministic pseudo-noise so the same image → the same result.
  const base = Math.sin((features.brightness * 97 + features.spotiness * 57 + hash(salt)) * 12.9898) * 43758.5453;
  return (base - Math.floor(base)) * 0.12;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h / 100000;
}

function descriptorWeight(text: string, f: ImageFeatures): number {
  const t = text.toLowerCase();
  let w = 0;
  if (/(rust|yellow|orange|chloros|stripe)/.test(t)) w += f.yellowRatio * 1.6;
  if (/(blight|rot|wilt|dead|dry|scald|burn|necro)/.test(t)) w += f.brownRatio * 1.6;
  if (/(spot|lesion|blast|speck|pustul)/.test(t)) w += f.spotiness * 1.3 + f.brownRatio * 0.5;
  if (/(mildew|white|powder|mold|mould)/.test(t)) w += (1 - f.greenRatio) * 0.6 + f.brightness * 0.4;
  if (/(mosaic|virus|curl|streak|stunt|tungro|deform)/.test(t)) w += f.yellowRatio * 0.9 + f.spotiness * 0.4;
  return w;
}

/**
 * Score a crop's candidate diseases (plus a synthetic "healthy" class) from
 * coarse image colour/texture features. Returns a softmax-normalised, sorted list.
 */
export function demoClassify(diseases: Disease[], f: ImageFeatures): ClassScore[] {
  const raw: ClassScore[] = [];

  const healthy = 1.1 * f.greenRatio - 0.9 * f.brownRatio - 0.6 * f.yellowRatio - 0.7 * f.spotiness + 0.3;
  raw.push({ label: 'healthy', score: healthy });

  for (const d of diseases) {
    const text = `${d.name} ${d.symptoms?.join(' ') ?? ''}`;
    const w = 0.25 + descriptorWeight(text, f) + seededJitter(f, d.id);
    raw.push({ label: d.id, score: w });
  }

  // Softmax for readable confidences.
  const max = Math.max(...raw.map((r) => r.score));
  const exps = raw.map((r) => ({ label: r.label, e: Math.exp((r.score - max) * 2.2) }));
  const sum = exps.reduce((s, r) => s + r.e, 0) || 1;
  return exps
    .map((r) => ({ label: r.label, score: Math.min(0.94, r.e / sum) }))
    .sort((a, b) => b.score - a.score);
}

// ── Rule-based agronomy assistant ─────────────────────────────────────────

function findDisease(text: string, region: Region): Disease | undefined {
  const t = text.toLowerCase();
  return region.diseases.find((d) => {
    if (t.includes(d.name.toLowerCase())) return true;
    if (t.includes(d.id.replace(/_/g, ' '))) return true;
    return Object.values(d.localNames ?? {}).some((n) => n && t.includes(n.toLowerCase()));
  });
}

function findCrop(text: string, region: Region) {
  const t = text.toLowerCase();
  return region.crops.find(
    (c) => t.includes(c.name.toLowerCase()) || Object.values(c.localNames ?? {}).some((n) => n && t.includes(n.toLowerCase())),
  );
}

/** Deterministic, genuinely useful agronomy answer from bundled region data. */
export function demoChat(text: string, region: Region): string {
  const t = text.trim().toLowerCase();
  if (!t) return 'Ask me about a crop, a disease, symptoms, treatment, weather, or yield.';

  if (/^(hi|hello|hey|namaste|hola|good (morning|evening|afternoon))/.test(t)) {
    return `Hello! I'm your AgriSense assistant for ${region.name}. Ask me about crop diseases, treatments, prevention, weather, or yield. For example: "How do I treat late blight in potato?"`;
  }

  const disease = findDisease(t, region);
  if (disease) {
    const crop = region.crops.find((c) => disease.cropIds.includes(c.id));
    const treat = (disease.treatmentTemplate || '')
      .replace(/\{disease\}/g, disease.name)
      .replace(/\{crop\}/g, crop?.name ?? 'the crop')
      .replace(/\{region\}/g, region.name);
    return [
      `**${disease.name}**${disease.scientificName ? ` (_${disease.scientificName}_)` : ''}`,
      disease.symptoms?.length ? `\n**Symptoms:**\n- ${disease.symptoms.join('\n- ')}` : '',
      treat ? `\n**Treatment:** ${treat}` : '',
      disease.preventiveMeasures?.length ? `\n**Prevention:**\n- ${disease.preventiveMeasures.join('\n- ')}` : '',
      `\n_Offline demo answer. Add a free AI key in Settings for tailored guidance, and confirm chemicals with a local extension officer._`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const crop = findCrop(t, region);
  if (crop) {
    const diseases = region.diseases.filter((d) => d.cropIds.includes(crop.id));
    return `**${crop.name}** ${crop.icon ?? ''} — common issues in ${region.name}: ${
      diseases.map((d) => d.name).join(', ') || 'no data'
    }. Ask "treatment for ${diseases[0]?.name ?? 'a disease'}" for details, or scan a leaf photo on the Detect page.`;
  }

  if (/(weather|rain|forecast|temperature|humid)/.test(t)) {
    return 'Open the **Weather** page for a live 7-day agri-forecast (rain, humidity, temperature, wind) for your location — no API key needed.';
  }
  if (/(yield|harvest|production|how much)/.test(t)) {
    return 'Use the **Yield** page to estimate output from your crop, area, planting date and irrigation — it factors in live weather.';
  }
  if (/(scan|photo|image|camera|detect|picture)/.test(t)) {
    return 'Go to **Detect** to upload a leaf photo or use **Live View** (real-time camera). Load your own model on the **Models** page for offline, on-device diagnosis.';
  }

  return `I can help with crop diseases, symptoms, treatment, prevention, weather and yield for ${region.name}. Try naming a crop (e.g. "${
    region.crops[0]?.name ?? 'rice'
  }") or a disease. Add a free AI key in Settings to unlock full conversational answers.`;
}
