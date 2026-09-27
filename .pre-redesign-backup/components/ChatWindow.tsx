'use client';

// Voice-enabled agronomy chat. Types or speaks a question; answers come from
// the AI provider (free keyless by default) with an offline knowledge-base
// fallback, and can be read aloud.
import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Volume2, VolumeX, Sparkles, WifiOff } from 'lucide-react';
import { Markdown } from './Markdown';
import { VoiceControls } from './VoiceControls';
import { useSettings } from '@/lib/store';
import { getRegion } from '@/lib/regions';
import { speak, cancelSpeech } from '@/lib/speech';
import { clsx } from 'clsx';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'demo' | 'cloud';
  warning?: string;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function ChatWindow({ initialQuery }: { initialQuery?: string }) {
  const { regionId, language, apiKey, provider, ttsEnabled, setTts } = useSettings();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const region = getRegion(regionId);
  const langName = region?.languages?.find((l) => l.code === language)?.name;

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || sending) return;
      cancelSpeech();
      const userMsg: Msg = { id: uid(), role: 'user', content: q };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput('');
      setSending(true);
      const outgoing = language !== 'en' && langName ? `${q}\n\n(Please answer in ${langName}.)` : q;
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey, 'x-provider': provider } : {}) },
          body: JSON.stringify({
            regionId,
            messages: [...history.slice(0, -1), { role: 'user', content: outgoing }].map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const json = await res.json();
        const reply: Msg = { id: uid(), role: 'assistant', content: json.reply || json.error || 'No response.', source: json.source, warning: json.warning };
        setMessages((m) => [...m, reply]);
        if (ttsEnabled && reply.content) speak(reply.content, language);
      } catch {
        setMessages((m) => [...m, { id: uid(), role: 'assistant', content: 'Network error — please try again.', source: 'demo' }]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, regionId, language, langName, apiKey, provider, ttsEnabled],
  );

  // Seed greeting + optional deep-link query (once).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setMessages([{ id: uid(), role: 'assistant', content: `Hi! I'm your AgriSense assistant for **${region?.name ?? 'your region'}**. Ask me about crop diseases, treatments, prevention, weather or yield — by typing or the mic. 🌱`, source: 'demo' }]);
    if (initialQuery) setTimeout(() => send(initialQuery), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  return (
    <div className="card flex h-[70vh] flex-col overflow-hidden">
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={clsx('max-w-[85%] rounded-2xl px-4 py-2', m.role === 'user' ? 'bg-brand text-brand-fg' : 'bg-surface-2')}>
              {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
              {m.role === 'assistant' && m.source === 'demo' && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><WifiOff className="h-3 w-3" /> Offline knowledge base</p>
              )}
              {m.role === 'assistant' && m.source === 'cloud' && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Sparkles className="h-3 w-3" /> AI answer</p>
              )}
              {m.warning && <p className="mt-1 text-[11px] text-warn">{m.warning}</p>}
            </div>
          </div>
        ))}
        {sending && <p className="text-sm text-muted">AgriSense is thinking…</p>}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <button type="button" onClick={() => setTts(!ttsEnabled)} className="btn-ghost h-10 w-10 p-0" aria-label="Toggle voice output" title={ttsEnabled ? 'Voice output on' : 'Voice output off'}>
          {ttsEnabled ? <Volume2 className="mx-auto h-4 w-4" /> : <VolumeX className="mx-auto h-4 w-4" />}
        </button>
        <VoiceControls lang={language} onResult={(t, isFinal) => (isFinal ? send(t) : setInput(t))} />
        <input className="input" placeholder="Ask about a disease, crop, weather…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" className="btn-brand h-10 w-10 p-0" disabled={sending || !input.trim()} aria-label="Send">
          <Send className="mx-auto h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
