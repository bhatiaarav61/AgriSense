// Server-side helpers that ground the LLM in the bundled region knowledge base
// and safely parse its output. Shared by the /api/chat, /api/detect,
// /api/advisory and /api/yield route handlers.
import type { Region } from './types';

/** System prompt establishing the assistant's role, scope and safety posture. */
export function agronomistSystem(region: Region): string {
  return [
    `You are AgriSense, a practical, friendly agronomy assistant for farmers in ${region.name}.`,
    'Give concise, actionable advice on crop diseases, symptoms, treatment (organic first, then chemical with rates), prevention, weather and yield.',
    'Prefer locally available, affordable inputs. Use simple language a smallholder farmer can follow.',
    'Always add a short safety note reminding the user to confirm chemical dosages and restricted products with a local agricultural extension officer.',
    'If asked something outside agriculture, briefly redirect to farming topics. Never invent chemical dosages you are unsure about.',
  ].join(' ');
}

/** Compact, token-efficient dump of the region's crops + diseases for grounding. */
export function regionKnowledge(region: Region, cropId?: string): string {
  const crops = cropId ? region.crops.filter((c) => c.id === cropId) : region.crops;
  const cropLine = crops.map((c) => `${c.name}${c.scientificName ? ` (${c.scientificName})` : ''}`).join(', ');
  const diseases = region.diseases
    .filter((d) => !cropId || d.cropIds.includes(cropId))
    .map((d) => {
      const sx = (d.symptoms ?? []).slice(0, 4).join('; ');
      return `- id:${d.id} | ${d.name}${d.scientificName ? ` (${d.scientificName})` : ''} | crops:${d.cropIds.join('/')} | symptoms: ${sx}`;
    })
    .join('\n');
  return `Region: ${region.name}\nCrops: ${cropLine || 'n/a'}\nKnown diseases:\n${diseases || 'n/a'}`;
}

/**
 * Extract a JSON object/array from an LLM response that may wrap it in prose or
 * ```json fences. Returns null if nothing parseable is found.
 */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  // Walk to the matching closing bracket to tolerate trailing prose.
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
