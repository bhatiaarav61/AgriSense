// Pure, testable agronomic yield heuristic. Deliberately conservative and
// transparent — it reports its assumptions and a confidence band rather than a
// single number. When an AI key is present the route adds a narrative on top.
import { clamp } from './ai-context';

export type Irrigation = 'rainfed' | 'irrigated' | 'drip' | 'unknown';

export interface YieldWeather {
  tempAvg?: number; // °C
  tempMax?: number; // °C
  rainSum7d?: number; // mm over the coming 7 days
  humidity?: number; // %
}

export interface YieldInput {
  cropId?: string;
  cropName?: string;
  areaHa: number;
  plantingDate?: string; // ISO date
  irrigation?: Irrigation;
  weather?: YieldWeather;
}

export interface YieldEstimate {
  crop: string;
  areaHa: number;
  unit: 't';
  expectedTPerHa: number;
  lowTPerHa: number;
  highTPerHa: number;
  totalExpectedT: number;
  totalLowT: number;
  totalHighT: number;
  confidence: number; // 0..1
  risks: string[];
  recommendations: string[];
  assumptions: string[];
}

// Rough attainable yields (t/ha) under decent management. Keyword-matched so it
// covers crop-name variants across regions; falls back to a generic value.
const BASE_YIELD: { match: RegExp; t: number }[] = [
  { match: /sugarcane|cane/, t: 70 },
  { match: /banana|plantain/, t: 40 },
  { match: /tomato/, t: 35 },
  { match: /cabbage|cauliflower/, t: 30 },
  { match: /onion/, t: 25 },
  { match: /potato/, t: 22 },
  { match: /cassava|yam|tuber/, t: 20 },
  { match: /mango/, t: 10 },
  { match: /chil|pepper|capsic/, t: 8 },
  { match: /maize|corn/, t: 5.5 },
  { match: /rice|paddy/, t: 4.5 },
  { match: /wheat/, t: 3.5 },
  { match: /soy/, t: 2.8 },
  { match: /sorghum|jowar/, t: 2.5 },
  { match: /groundnut|peanut/, t: 2.5 },
  { match: /coffee/, t: 1.5 },
  { match: /tea/, t: 2.0 },
  { match: /millet|bajra|ragi/, t: 1.5 },
  { match: /bean|pea|lentil|gram|pulse|legume|cowpea/, t: 1.8 },
  { match: /cotton/, t: 2.0 },
];

function baseYield(id = '', name = ''): { t: number; known: boolean } {
  const hay = `${id} ${name}`.toLowerCase();
  for (const b of BASE_YIELD) if (b.match.test(hay)) return { t: b.t, known: true };
  return { t: 3.0, known: false };
}

export function estimateYield(input: YieldInput): YieldEstimate {
  const areaHa = clamp(Number(input.areaHa) || 0, 0, 100000);
  const { t: base, known } = baseYield(input.cropId, input.cropName);
  const risks: string[] = [];
  const recommendations: string[] = [];
  const assumptions: string[] = [`Attainable baseline for ${input.cropName || 'this crop'}: ${base} t/ha under good management.`];

  let factor = 1;
  const irr = input.irrigation ?? 'unknown';
  if (irr === 'drip') { factor *= 1.2; assumptions.push('Drip irrigation: +20% water-use efficiency.'); }
  else if (irr === 'irrigated') { factor *= 1.15; assumptions.push('Assured irrigation: +15%.'); }
  else if (irr === 'rainfed') { factor *= 0.8; assumptions.push('Rainfed: −20% vs irrigated potential.'); recommendations.push('Consider supplemental/life-saving irrigation at flowering and grain-fill.'); }

  const w = input.weather;
  if (w) {
    if (typeof w.tempMax === 'number' && w.tempMax > 38) { factor *= 0.9; risks.push(`Heat stress likely (forecast max ${Math.round(w.tempMax)}°C).`); recommendations.push('Irrigate in the evening and mulch to reduce heat and moisture loss.'); }
    if (typeof w.tempAvg === 'number' && w.tempAvg < 10) { factor *= 0.92; risks.push(`Cold stress possible (avg ${Math.round(w.tempAvg)}°C).`); }
    if (typeof w.rainSum7d === 'number') {
      if (w.rainSum7d > 120) { factor *= 0.95; risks.push(`Heavy rain expected (${Math.round(w.rainSum7d)}mm/7d) — waterlogging & fungal risk.`); recommendations.push('Ensure field drainage; scout for fungal disease after wet spells.'); }
      else if (w.rainSum7d < 5 && irr === 'rainfed') { factor *= 0.9; risks.push('Dry spell forecast with no irrigation.'); }
    }
    if (typeof w.humidity === 'number' && w.humidity > 85) { risks.push('High humidity favours fungal/bacterial disease — scout regularly.'); }
  } else {
    assumptions.push('No live weather supplied — using neutral seasonal assumptions.');
  }

  if (input.plantingDate) assumptions.push(`Planting date considered: ${input.plantingDate}.`);
  recommendations.push('Use certified seed, balanced NPK based on a soil test, and scout weekly for early disease.');

  const expected = base * factor;
  const spread = 0.22; // ±22% band
  const low = expected * (1 - spread);
  const high = expected * (1 + spread);

  let confidence = 0.6;
  if (w) confidence += 0.1;
  if (irr !== 'unknown') confidence += 0.08;
  if (!known) confidence -= 0.12;
  confidence = clamp(confidence, 0.3, 0.85);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    crop: input.cropName || input.cropId || 'crop',
    areaHa,
    unit: 't',
    expectedTPerHa: r2(expected),
    lowTPerHa: r2(low),
    highTPerHa: r2(high),
    totalExpectedT: r2(expected * areaHa),
    totalLowT: r2(low * areaHa),
    totalHighT: r2(high * areaHa),
    confidence: r2(confidence),
    risks,
    recommendations,
    assumptions,
  };
}
