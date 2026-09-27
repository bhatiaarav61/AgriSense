'use client';

// Voice-enabled agronomy chat. Types or speaks a question; answers come from
// the AI provider (free keyless by default) with an offline knowledge-base
// fallback, and can be read aloud.
import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Volume2, VolumeX, Sparkles, WifiOff, Bot } from 'lucide-react';
import { Markdown } from './Markdown';
import { VoiceControls } from './VoiceControls';
import { useSettings } from '@/lib/store';
import { getRegion } from '@/lib/regions';
import { useT } from '@/lib/i18n';
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

const SUGGESTIONS = [
  'How do I treat leaf rust?',
  'When should I irrigate my crop?',
  'Best fertilizer schedule for tomatoes?',
  'How to prevent blight next season?',
];

export function ChatWindow({ initialQuery }: { initialQuery?: string }) {
  const { regionId, language, apiKey, provider, ttsEnabled, setTts } = useSettings();
  const t = useT();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const region = getRegion(regionId);

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
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey, 'x-provider': provider } : {}) },
          body: JSON.stringify({
            regionId,
            language,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
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
    [messages, sending, regionId, language, apiKey, provider, ttsEnabled],
  );

  // Seed greeting + optional deep-link query (once).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setMessages([{ id: uid(), role: 'assistant', content: (t('chat_greeting') || '').replace('{region}', region?.name ?? 'your region'), source: 'demo' }]);
    if (initialQuery) setTimeout(() => send(initialQuery), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const showSuggestions = messages.length === 1 && !sending;

  return (
    <div className="card chat-height flex flex-col overflow-hidden">
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={clsx('flex items-end gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <span className="icon-tile mb-0.5 h-7 w-7 rounded-lg shadow-none">
                <Bot className="h-4 w-4" />
              </span>
            )}
            <div
              className={clsx(
                'max-w-[85%] px-4 py-2.5 text-sm shadow-card',
                m.role === 'user'
                  ? 'rounded-2xl rounded-br-md bg-brand text-brand-fg'
                  : 'rounded-2xl rounded-bl-md border border-border bg-surface-2',
              )}
            >
              {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : <p className="whitespace-pre-wrap">{m.content}</p>}
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
        {sending && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="icon-tile h-7 w-7 animate-pulse rounded-lg shadow-none">
              <Bot className="h-4 w-4" />
            </span>
            {t('chat_thinking')}
          </div>
        )}
      </div>

      {showSuggestions && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip whitespace-nowrap transition-colors hover:border-brand/50 hover:text-brand" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

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
        <input className="input" placeholder={t('chat_placeholder')} value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" className="btn-brand h-10 w-10 p-0" disabled={sending || !input.trim()} aria-label="Send">
          <Send className="mx-auto h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
