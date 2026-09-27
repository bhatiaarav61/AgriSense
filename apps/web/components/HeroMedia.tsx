'use client';

// Hero visual for the dashboard — three self-healing layers, richest wins:
//   1. /public/hero-farm.mp4 (AI-generated video) — auto-plays muted, loops.
//   2. /public/hero-farm.jpg  (AI-generated photo) — static cover.
//   3. Animated aurora panel with the brand mark (always present underneath).
// Assets fade in only after they actually load, so a missing/failed file can
// never leave a broken frame on screen. Drop a generated file into /public and
// it appears on the next visit — no code changes.
import { useEffect, useRef, useState } from 'react';
import { ScanLine, CloudSun } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { clsx } from 'clsx';

export function HeroMedia() {
  const [videoReady, setVideoReady] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Some browsers won't autoplay until .play() is invoked programmatically.
  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-2xl border border-border lg:min-h-[320px]">
      {/* Layer 3 — animated aurora fallback (always rendered, base of the stack) */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-accent/10">
        <div className="absolute -left-16 -top-16 h-56 w-56 animate-float rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute -bottom-20 -right-10 h-64 w-64 animate-float-delayed rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 animate-float rounded-full bg-brand/15 blur-2xl" />
        <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.07]" fill="none">
          <defs>
            <pattern id="hero-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0v28" stroke="currentColor" strokeWidth="1" className="text-fg" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
        <div className="relative grid h-full place-items-center">
          <Logo
            className={clsx(
              'h-24 w-24 drop-shadow-xl transition-all duration-700',
              (videoReady || photoReady) && 'scale-90 opacity-0',
            )}
          />
        </div>
      </div>

      {/* Layer 2 — generated photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-farm.jpg"
        alt=""
        className={clsx(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-700',
          photoReady && !videoReady ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={() => setPhotoReady(true)}
      />

      {/* Layer 1 — generated video */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src="/hero-farm.mp4"
        muted
        loop
        playsInline
        autoPlay
        className={clsx(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-700',
          videoReady ? 'opacity-100' : 'opacity-0',
        )}
        onPlaying={() => setVideoReady(true)}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

      {/* Floating status chips */}
      <div className="absolute right-3 top-3 flex animate-float items-center gap-1.5 rounded-xl border border-white/30 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-white shadow-card backdrop-blur-md">
        <ScanLine className="h-3.5 w-3.5" /> Live scan ready
      </div>
      <div className="absolute bottom-3 left-3 flex animate-float-delayed items-center gap-1.5 rounded-xl border border-white/30 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-white shadow-card backdrop-blur-md">
        <CloudSun className="h-3.5 w-3.5" /> 7-day agri forecast
      </div>
    </div>
  );
}
