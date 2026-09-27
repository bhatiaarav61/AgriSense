import { getRegion, getCrop } from '@/lib/regions';
import { resolveCreds, generate } from '@/lib/providers';
import { agronomistSystem } from '@/lib/ai-context';
import { estimateYield, type YieldInput } from '@/lib/yield';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Yield estimation. The numeric estimate is a deterministic agronomic heuristic
// (see lib/yield.ts); an optional AI narrative interprets it for the farmer.
export async function POST(req: Request) {
  const rl = rateLimit(`yield:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return Response.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });

  let body: YieldInput & { regionId?: string; narrative?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const region = getRegion(body.regionId || 'india');
  const crop = region && body.cropId ? getCrop(region.id, body.cropId) : undefined;
  const estimate = estimateYield({ ...body, cropName: body.cropName || crop?.name });

  // Only spend an AI call when explicitly requested (default on) and the numbers exist.
  if (body.narrative === false || !region) {
    return Response.json({ estimate, narrative: null, source: 'demo' });
  }

  const creds = resolveCreds(req.headers);
  const user = [
    `Interpret this yield estimate for a farmer in ${region.name}.`,
    `Crop: ${estimate.crop}, area: ${estimate.areaHa} ha.`,
    `Estimated ${estimate.lowTPerHa}–${estimate.highTPerHa} t/ha (expected ${estimate.expectedTPerHa} t/ha), total ~${estimate.totalExpectedT} t.`,
    `Risks: ${estimate.risks.join('; ') || 'none flagged'}.`,
    `Assumptions: ${estimate.assumptions.join('; ')}.`,
    'In 3-5 short markdown bullets, explain what most limits this yield and the highest-impact, low-cost actions to improve it. Do not repeat the numbers verbatim.',
  ].join('\n');

  try {
    const narrative = await generate(creds, { system: agronomistSystem(region), user, temperature: 0.5, maxTokens: 600 });
    return Response.json({ estimate, narrative, source: 'cloud', keyless: creds.keyless ?? false });
  } catch {
    return Response.json({ estimate, narrative: null, source: 'demo' });
  }
}
