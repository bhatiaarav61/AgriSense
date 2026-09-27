'use client';

// "Live View" scanner: streams the camera, samples a frame on an interval and
// runs the on-device detection pipeline, overlaying a live result badge. Cloud
// vision is disabled here (too many frames) — it uses the active model when
// present, otherwise the offline demo heuristic. Fully client-side.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, ScanLine } from 'lucide-react';
import { detect } from '@/lib/inference';
import type { LoadedModel } from '@/lib/models';
import type { DetectionResult } from '@/lib/types';
import { useSettings } from '@/lib/store';
import { clsx } from 'clsx';

const SEV_RING: Record<string, string> = {
  low: 'ring-brand/70',
  medium: 'ring-warn/70',
  high: 'ring-danger/80',
};

export function LiveDetect({
  regionId,
  cropId,
  model,
  onCapture,
}: {
  regionId: string;
  cropId?: string;
  model?: LoadedModel | null;
  onCapture?: (r: DetectionResult) => void;
}) {
  const liveIntervalMs = useSettings((s) => s.liveIntervalMs);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser. Try Chrome or Edge over HTTPS.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setActive(true);
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Could not start the camera.');
    }
  }, []);

  // Sampling loop.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const tick = async () => {
      const video = videoRef.current;
      if (!cancelled && video && video.readyState >= 2 && !busy.current) {
        busy.current = true;
        try {
          const r = await detect(video, { regionId, cropId, model, allowCloud: false });
          if (!cancelled) setResult(r);
        } catch {
          /* keep last result */
        } finally {
          busy.current = false;
        }
      }
    };
    const timer = setInterval(tick, Math.max(700, liveIntervalMs));
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, regionId, cropId, model, liveIntervalMs]);

  // Stop the camera on unmount.
  useEffect(() => stop, [stop]);

  const pct = result ? Math.round(result.confidence * 100) : 0;

  return (
    <div className="space-y-3">
      <div className={clsx('relative overflow-hidden rounded-2xl bg-black ring-2 ring-inset transition-colors', result ? SEV_RING[result.severity] : 'ring-border')}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
        {!active && (
          <div className="absolute inset-0 grid place-items-center text-center text-white/80">
            <div className="flex flex-col items-center gap-2 p-6">
              <ScanLine className="h-10 w-10" />
              <p className="text-sm">Point your camera at a leaf to scan in real time.</p>
            </div>
          </div>
        )}
        {active && result && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <div className="flex items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{result.name}</p>
                <p className="text-xs text-white/70 capitalize">{result.severity} severity · {result.source === 'model' ? 'on-device model' : 'demo heuristic'}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-white/15 px-2 py-1 text-sm font-semibold backdrop-blur">{pct}%</span>
            </div>
          </div>
        )}
        {active && busy.current && <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-white/80" />}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!active ? (
          <button className="btn-brand" onClick={start}>
            <Camera className="h-4 w-4" /> Start live scan
          </button>
        ) : (
          <>
            <button className="btn-ghost" onClick={stop}>
              <CameraOff className="h-4 w-4" /> Stop
            </button>
            {result && onCapture && (
              <button className="btn-brand" onClick={() => onCapture(result)}>
                Use this result
              </button>
            )}
          </>
        )}
      </div>
      {!model && active && <p className="text-xs text-muted">Tip: load a model on the Models page for accurate on-device live detection. Without one this uses a demo heuristic.</p>}
    </div>
  );
}
