'use client';

// Voice-enabled agronomy assistant page. Reads an optional ?q= deep link (used
// by the "Ask the assistant" button on detection results) and seeds the chat.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bot } from 'lucide-react';
import { ChatWindow } from '@/components/ChatWindow';
import { useT } from '@/lib/i18n';

function Assistant() {
  const q = useSearchParams().get('q') ?? undefined;
  return <ChatWindow initialQuery={q} />;
}

export default function AssistantPage() {
  const t = useT();
  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex items-center gap-3">
        <span className="icon-tile"><Bot className="h-5 w-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{t('assistant_title')}</h1>
          <p className="text-sm text-muted">{t('assistant_sub')}</p>
        </div>
      </header>
      <Suspense fallback={<div className="card h-[70vh] skeleton" />}>
        <Assistant />
      </Suspense>
    </div>
  );
}
