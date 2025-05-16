import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppProviders from '@/components/layout/app-providers';
import ServiceWorkerRegistration from '@/components/layout/service-worker-registration';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'HotelKey - Smart Hotel Management',
  description: 'Book rooms, control amenities, and manage your stay seamlessly.',
  manifest: '/manifest.json',
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: '#64B5F6', // Primary color
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png"></link>
        <meta name="theme-color" content="#64B5F6" />
      </head>
      <body>
        <AppProviders>
          <div className="flex flex-col min-h-screen">
            {children}
          </div>
          <Toaster />
        </AppProviders>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
