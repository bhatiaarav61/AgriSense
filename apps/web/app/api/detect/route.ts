import { getRegion } from '@/lib/regions';
import { resolveCreds, providerSupportsVision } from '@/lib/providers';
import { generateWithFailover } from '@/lib/ai-pool';
import { agronomistSystem, regionKnowledge, parseJsonLoose } from '@/lib/ai-context';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vision disease detection. The browser sends a base64 JPEG; we ask a
// vision-capable model to classify it against THIS region's real disease list
// and return ranked candidates. On any failure we return `fallback: true` with
// HTTP 200 so the client silently uses its offline demo heuristic instead.
interface DetectBody {
  image?: string;
  regionId?: string;
  cropId?: string;
}

export async function POST(req: Request) {
  const rl = rateLimit(`detect:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return Response.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });

  let body: DetectBody;
  try {
    body = (await req.json()) as DetectBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const image = body.image?.replace(/^data:image\/\w+;base64,/, '');
  if (!image) return Response.json({ error: 'Missing image' }, { status: 400 });
  if (image.length > 8_000_000) return Response.json({ error: 'Image too large (max ~6MB)' }, { status: 413 });

  const region = getRegion(body.regionId || 'india');
  if (!region) return Response.json({ error: 'Unknown region' }, { status: 400 });

  const creds = resolveCreds(req.headers);
  if (!providerSupportsVision(creds.provider)) {
    // e.g. a Groq text-only key — let the client fall back to demo/local model.
    return Response.json({ fallback: true, reason: 'provider-no-vision' });
  }

  const knowledge = regionKnowledge(region, body.cropId);
  const validIds = new Set(region.diseases.filter((d) => !body.cropId || d.cropIds.includes(body.cropId!)).map((d) => d.id));

  const prompt = [
    'Analyse this crop/leaf photo for disease.',
    knowledge,
    '',
    'Return ONLY compact JSON, no prose, in this exact shape:',
    '{"candidates":[{"label":"<one of the disease ids above, or \\"healthy\\">","score":<0..1>}],"note":"<one short observation>"}',
    'Rules: use only the disease ids listed above (or "healthy"). List up to 5 candidates, most likely first, scores summing to about 1. If the plant looks healthy, put "healthy" first.',
  ].join('\n');

  try {
    const { text: raw } = await generateWithFailover(creds, {
      system: agronomistSystem(region),
      user: prompt,
      images: [image],
      temperature: 0.2,
      maxTokens: 600,
      needsVision: true,
    });
    const parsed = parseJsonLoose<{ candidates?: { label: string; score: number }[]; note?: string }>(raw);
    const candidates = (parsed?.candidates ?? [])
      .filter((c) => c && typeof c.label === 'string')
      .map((c) => ({ label: c.label, score: clampScore(c.score) }))
      .filter((c) => c.label === 'healthy' || validIds.has(c.label))
      .slice(0, 5);

    if (!candidates.length) return Response.json({ fallback: true, reason: 'no-candidates' });
    return Response.json({ candidates, note: parsed?.note, source: 'cloud', keyless: creds.keyless ?? false });
  } catch (err) {
    // Network/rate-limit/parse failure → let the client use the offline demo.
    return Response.json({ fallback: true, reason: (err as Error).message?.slice(0, 120) });
  }
}

function clampScore(s: unknown): number {
  const n = typeof s === 'number' ? s : parseFloat(String(s));
  if (!isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}
