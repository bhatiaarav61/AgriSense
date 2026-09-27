import { getRegion, getDisease, getCrop, renderTreatment } from '@/lib/regions';
import { resolveCreds, generate } from '@/lib/providers';
import { agronomistSystem } from '@/lib/ai-context';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Treatment advisory for a specific disease. Always returns the bundled
// symptoms/treatment/prevention; when AI is reachable it also adds a tailored
// step-by-step plan (`elaboration`).
interface AdvisoryBody {
  regionId?: string;
  diseaseId?: string;
  cropId?: string;
  question?: string;
}

export async function POST(req: Request) {
  const rl = rateLimit(`advisory:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return Response.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });

  let body: AdvisoryBody;
  try {
    body = (await req.json()) as AdvisoryBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const region = getRegion(body.regionId || 'india');
  if (!region) return Response.json({ error: 'Unknown region' }, { status: 400 });
  const disease = getDisease(region.id, body.diseaseId || '');
  if (!disease) return Response.json({ error: 'Unknown disease' }, { status: 404 });

  const crop = body.cropId ? getCrop(region.id, body.cropId) : region.crops.find((c) => disease.cropIds.includes(c.id));
  const base = {
    name: disease.name,
    scientificName: disease.scientificName,
    symptoms: disease.symptoms ?? [],
    treatment: renderTreatment(disease, { cropName: crop?.name, regionName: region.name }),
    preventiveMeasures: disease.preventiveMeasures ?? [],
    localNames: disease.localNames ?? {},
  };

  const creds = resolveCreds(req.headers);
  const user = [
    `Create a practical field action plan for a farmer dealing with "${disease.name}"${crop ? ` in ${crop.name}` : ''} in ${region.name}.`,
    `Known symptoms: ${base.symptoms.join('; ') || 'n/a'}.`,
    `Recommended treatment: ${base.treatment}`,
    `Prevention: ${base.preventiveMeasures.join('; ') || 'n/a'}.`,
    body.question ? `The farmer also asks: "${body.question}".` : '',
    'Respond in markdown with sections: Immediate steps, Organic options, Chemical options (with rates), Prevention, When to seek an expert. Keep it concise.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const elaboration = await generate(creds, {
      system: agronomistSystem(region),
      user,
      temperature: 0.5,
      maxTokens: 900,
    });
    return Response.json({ base, elaboration, source: 'cloud', keyless: creds.keyless ?? false });
  } catch {
    return Response.json({ base, elaboration: null, source: 'demo' });
  }
}
