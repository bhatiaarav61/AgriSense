import { getRegion, getDefaultRegion } from '@/lib/regions';
import { resolveCreds } from '@/lib/providers';
import { generateWithFailover } from '@/lib/ai-pool';
import { agronomistSystem, regionKnowledge } from '@/lib/ai-context';
import { demoChat } from '@/lib/demo';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import type { ChatMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Conversational agronomy assistant. Uses the best available AI provider
// (free keyless Pollinations by default, or the user's own key). If the model
// call fails, it answers from the bundled knowledge base so chat never breaks.
interface ChatBody {
  messages?: Pick<ChatMessage, 'role' | 'content'>[];
  regionId?: string;
}

export async function POST(req: Request) {
  const rl = rateLimit(`chat:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return Response.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const region = getRegion(body.regionId || '') ?? getDefaultRegion();
  const history = (body.messages ?? [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10);
  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (!lastUser.trim()) return Response.json({ error: 'Empty message' }, { status: 400 });
  if (lastUser.length > 4000) return Response.json({ error: 'Message too long' }, { status: 413 });

  const creds = resolveCreds(req.headers);

  // Fold short history into a single grounded prompt (keeps token use low and
  // works uniformly across Gemini / OpenAI-compatible providers).
  const convo = history.map((m) => `${m.role === 'user' ? 'Farmer' : 'AgriSense'}: ${m.content}`).join('\n');
  const user = `${regionKnowledge(region)}\n\nConversation so far:\n${convo}\n\nReply as AgriSense to the farmer's last message. Use markdown. Be concise.`;

  try {
    const { text: reply, provider, model } = await generateWithFailover(creds, {
      system: agronomistSystem(region),
      user,
      temperature: 0.6,
      maxTokens: 900,
    });
    return Response.json({ reply, source: 'cloud', keyless: creds.keyless ?? false, provider, model });
  } catch (err) {
    return Response.json({
      reply: demoChat(lastUser, region),
      source: 'demo',
      warning: `AI unavailable (${(err as Error).message?.slice(0, 80)}) — answered from offline knowledge base.`,
    });
  }
}
