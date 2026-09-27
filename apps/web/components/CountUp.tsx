'use client';

// Animated number count-up (ease-out cubic). Always ends on the true value:
// it jumps straight there when the user prefers reduced motion, when the tab
// is hidden (rAF never fires in background tabs), or via a safety timeout if
// frames get throttled.
import { useEffect, useState } from 'react';

export function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const finish = () => setDisplay(value);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState !== 'visible') {
      finish();
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 800;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const safety = setTimeout(finish, duration + 250);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
    };
  }, [value]);

  return <span className={className}>{display}</span>;
}
