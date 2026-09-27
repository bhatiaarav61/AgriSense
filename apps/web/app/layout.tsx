import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/Nav';
import { ThemeScript } from '@/components/ThemeScript';
import { ThemeSync } from '@/components/ThemeSync';
import { ServiceWorker } from '@/components/ServiceWorker';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const sora = Sora({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display', display: 'swap' });

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
    { media: '(prefers-color-scheme: light)', color: '#059669' },
    { media: '(prefers-color-scheme: dark)', color: '#070b09' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen">
        <ThemeSync />
        <ServiceWorker />
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-24 pt-6 text-center text-xs leading-relaxed text-muted md:pb-10">
          <p>
            AgriSense · Free &amp; open. Works offline with a demo detector; add a free AI key for full accuracy.
          </p>
          <p>Not a substitute for professional agronomic advice — always confirm treatments locally.</p>
        </footer>
      </body>
    </html>
  );
}
