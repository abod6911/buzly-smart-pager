import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { QueueProvider } from '@/context/QueueContext';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Chimer | بيجر واستدعاء المطاعم الذكي',
  description: 'نظام بيجر ونداء واستدعاء الزبائن الذكي في المطاعم والكافيهات مباشرة عبر متصفح الجوال',
  applicationName: 'Chimer Pager',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chimer Pager',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#09090B',
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
    <html lang="ar" dir="rtl" className={`${ibmPlexArabic.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-obsidian text-white min-h-screen antialiased selection:bg-emerald-500 selection:text-black font-sans">
        <QueueProvider>{children}</QueueProvider>
      </body>
    </html>
  );
}
