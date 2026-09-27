'use client';

// Voice-enabled agronomy assistant page. Reads an optional ?q= deep link (used
// by the "Ask the assistant" button on detection results) and seeds the chat.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatWindow } from '@/components/ChatWindow';

function Assistant() {
  const q = useSearchParams().get('q') ?? undefined;
  return <ChatWindow initialQuery={q} />;
}

export default function AssistantPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Voice assistant</h1>
        <p className="text-sm text-muted">Ask about diseases, treatment, weather or yield — type or tap the mic. Answers can be read aloud.</p>
      </header>
      <Suspense fallback={<div className="card h-[70vh] animate-pulse" />}>
        <Assistant />
      </Suspense>
    </div>
  );
}
