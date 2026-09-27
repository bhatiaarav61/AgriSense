'use client';

// Responsive top navigation: brand + region/theme controls, with a horizontally
// scrollable route bar that works on phones and desktop alike.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ScanLine,
  Bot,
  CloudSun,
  Sprout,
  Brain,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Leaf,
} from 'lucide-react';
import { useSettings } from '@/lib/store';
import { getRegions } from '@/lib/regions';
import { clsx } from 'clsx';

const LINKS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/detect', label: 'Detect', icon: ScanLine },
  { href: '/assistant', label: 'Assistant', icon: Bot },
  { href: '/weather', label: 'Weather', icon: CloudSun },
  { href: '/yield', label: 'Yield', icon: Sprout },
  { href: '/models', label: 'Models', icon: Brain },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Nav() {
  const pathname = usePathname();
  const theme = useSettings((s) => s.theme);
  const toggleTheme = useSettings((s) => s.toggleTheme);
  const regionId = useSettings((s) => s.regionId);
  const setRegion = useSettings((s) => s.setRegion);
  const regions = getRegions();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-fg">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">AgriSense</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Region"
            className="input h-9 w-auto py-1"
            value={regionId}
            onChange={(e) => setRegion(e.target.value)}
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-ghost h-9 w-9 p-0"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className="mx-auto max-w-6xl overflow-x-auto px-2 pb-2">
        <ul className="flex gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    'flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
