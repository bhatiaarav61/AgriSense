import { getRegions } from '@/lib/regions';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    status: 'ok',
    name: 'AgriSense Web',
    version: '1.0.0',
    time: new Date().toISOString(),
    regions: getRegions().map((r) => r.id),
  });
}
