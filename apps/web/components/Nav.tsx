'use client';

// Top navigation (desktop links + mobile actions) and a mobile bottom tab bar.
// The tab bar keeps the five core actions thumb-reachable on phones; Models and
// Settings stay reachable from the header icons on small screens.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
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
  Globe,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useSettings } from '@/lib/store';
import { getRegions } from '@/lib/regions';
import { useT, isRtl, ALL_LANGUAGES } from '@/lib/i18n';
import { clsx } from 'clsx';

const LINK_HREFS = [
  { href: '/', key: 'nav_home' },
  { href: '/detect', key: 'nav_detect' },
  { href: '/assistant', key: 'nav_assistant' },
  { href: '/weather', key: 'nav_weather' },
  { href: '/yield', key: 'nav_yield' },
] as const;

const TAB_HREFS = [
  { href: '/', key: 'nav_home' },
  { href: '/detect', key: 'nav_detect' },
  { href: '/assistant', key: 'nav_assistant' },
  { href: '/weather', key: 'nav_weather' },
  { href: '/yield', key: 'nav_yield' },
] as const;

const ICONS = {
  nav_home: LayoutDashboard,
  nav_detect: ScanLine,
  nav_assistant: Bot,
  nav_weather: CloudSun,
  nav_yield: Sprout,
} as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();
  const theme = useSettings((s) => s.theme);
  const toggleTheme = useSettings((s) => s.toggleTheme);
  const regionId = useSettings((s) => s.regionId);
  const setRegion = useSettings((s) => s.setRegion);
  const language = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const t = useT();
  const regions = getRegions();

  // Keep the document language and direction in sync with the chosen language
  // (e.g. Urdu and Sindhi render right-to-left).
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr';
  }, [language]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/65">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-9 w-9 drop-shadow-sm" />
            <span className="hidden font-display text-lg font-bold tracking-tight sm:inline">AgriSense</span>
          </Link>

          <nav className="ml-6 hidden lg:block" aria-label="Primary">
            <ul className="flex items-center gap-1">
              {LINK_HREFS.map(({ href, key }) => {
                const Icon = ICONS[key];
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={clsx('nav-link', isActive(pathname, href) && 'nav-link-active')}
                      aria-current={isActive(pathname, href) ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      {t(key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Language: always visible in the header so users can find their
                regional language without hunting through Settings. Native
                names are shown first so the list is readable before you can
                read English. */}
            <label className="relative" title="Language">
              <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <select
                aria-label="Language"
                className="input h-9 w-auto max-w-[7.75rem] truncate py-1 pl-8 pr-2 text-xs"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {ALL_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName}
                  </option>
                ))}
              </select>
            </label>

            <select
              aria-label="Region"
              className="input hidden h-9 w-auto py-1 sm:block"
              value={regionId}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <Link
              href="/models"
              className="btn-ghost h-9 w-9 p-0 lg:hidden"
              aria-label="Your models"
              title="Your models"
            >
              <Brain className="h-4 w-4" />
            </Link>
            <Link
              href="/settings"
              className="btn-ghost h-9 w-9 p-0 lg:hidden"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
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
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="tabbar-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 backdrop-blur-md lg:hidden"
        aria-label="Primary mobile"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {TAB_HREFS.map(({ href, key }) => {
            const Icon = ICONS[key];
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                    active ? 'text-brand' : 'text-muted hover:text-fg',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className={clsx(
                      'grid h-7 w-12 place-items-center rounded-lg transition-colors',
                      active && 'bg-brand/10',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
