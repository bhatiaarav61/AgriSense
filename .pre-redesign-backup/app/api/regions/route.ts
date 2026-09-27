import { getRegion, getRegions } from '@/lib/regions';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const region = getRegion(id);
    if (!region) return Response.json({ error: `Region not found: ${id}` }, { status: 404 });
    return Response.json(region);
  }
  // Summary list (id, name, counts) to keep the payload small.
  return Response.json(
    getRegions().map((r) => ({
      id: r.id,
      name: r.name,
      crops: r.crops.length,
      diseases: r.diseases.length,
      languages: r.languages?.length ?? 1,
    })),
  );
}
