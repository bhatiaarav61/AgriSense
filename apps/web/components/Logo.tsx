// AgriSense brand mark: a leaf inside camera-scan brackets on an emerald tile.
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="AgriSense">
      <defs>
        <linearGradient id="ag-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#ag-logo-g)" />
      <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
        <path d="M14.5 19.5v-2.5a2.5 2.5 0 0 1 2.5-2.5h2.5" />
        <path d="M33.5 19.5v-2.5a2.5 2.5 0 0 0-2.5-2.5h-2.5" />
        <path d="M14.5 28.5v2.5a2.5 2.5 0 0 0 2.5 2.5h2.5" />
        <path d="M33.5 28.5v2.5a2.5 2.5 0 0 1-2.5 2.5h-2.5" />
      </g>
      <path d="M17.5 30.5 Q15.5 18.5 30.5 17.5 Q32.5 30 17.5 30.5 Z" fill="#fff" opacity="0.95" />
      <path d="M18.8 29.2 Q23.5 24.5 29.2 18.8" fill="none" stroke="url(#ag-logo-g)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
