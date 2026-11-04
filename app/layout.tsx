import type { Metadata, Viewport } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { QueueProvider } from '@/context/QueueContext';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Buzly | بيجر المطاعم الذكي',
  description: 'نظام بيجر ونداء واستدعاء الزبائن الذكي في المطاعم والكافيهات مباشرة عبر متصفح الجوال',
  applicationName: 'Buzly Pager',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Buzly Pager',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔔</text></svg>" />
      </head>
      <body className="bg-obsidian text-white min-h-screen antialiased selection:bg-emerald-500 selection:text-black">
        <QueueProvider>{children}</QueueProvider>
      </body>
    </html>
  );
}
