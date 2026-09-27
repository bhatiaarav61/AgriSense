import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { ThemeScript } from '@/components/ThemeScript';
import { ThemeSync } from '@/components/ThemeSync';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = {
  title: { default: 'AgriSense — AI Crop Assistant', template: '%s · AgriSense' },
  description:
    'Free, offline-friendly AI crop disease detection, live-camera scanner, voice assistant, weather and yield tools for farmers. Works with no API key.',
  manifest: '/manifest.webmanifest',
  applicationName: 'AgriSense',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'AgriSense' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#16a34a' },
    { media: '(prefers-color-scheme: dark)', color: '#090d0b' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen">
        <ThemeSync />
        <ServiceWorker />
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-center text-xs text-muted">
          AgriSense · Free &amp; open. Works offline with a demo detector; add a free AI key for full accuracy.
          Not a substitute for professional agronomic advice.
        </footer>
      </body>
    </html>
  );
}
