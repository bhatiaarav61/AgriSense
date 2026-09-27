'use client';

// Push-to-talk microphone button backed by the Web Speech API. Degrades to a
// disabled button with a tooltip when the browser has no SpeechRecognition.
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { createRecognition, speechCapabilities, type RecognitionHandle } from '@/lib/speech';
import { clsx } from 'clsx';

export function VoiceControls({
  lang,
  onResult,
  className,
}: {
  lang: string;
  onResult: (text: string, isFinal: boolean) => void;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const handleRef = useRef<RecognitionHandle | null>(null);

  useEffect(() => {
    setSupported(speechCapabilities().recognition);
    return () => handleRef.current?.stop();
  }, []);

  function toggle() {
    if (listening) {
      handleRef.current?.stop();
      setListening(false);
      return;
    }
    const handle = createRecognition(lang, {
      onResult,
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    if (!handle) return;
    handleRef.current = handle;
    handle.start();
    setListening(true);
  }

  if (!supported) {
    return (
      <button type="button" disabled className={clsx('btn-ghost h-10 w-10 p-0', className)} title="Voice input needs Chrome or Edge">
        <MicOff className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? 'Stop listening' : 'Start voice input'}
      className={clsx(
        'relative h-10 w-10 rounded-xl p-0 transition-colors',
        listening ? 'bg-danger text-white' : 'btn-ghost',
        className,
      )}
    >
      {listening ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <Mic className="mx-auto h-4 w-4" />}
      {listening && <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-danger/40" />}
    </button>
  );
}
