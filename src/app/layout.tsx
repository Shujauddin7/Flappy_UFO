import ClientProviders from '@/providers';
import '@worldcoin/mini-apps-ui-kit-react/styles.css';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Flappy UFO - Win WLD Tournaments',
  description: 'Navigate through space obstacles and win Worldcoin tournaments in this skill-based mini game',
  manifest: '/manifest.json', // Optional: Add if you have a web manifest
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Allow NextAuth SessionProvider to handle session management properly
  // Session will be restored from JWT tokens automatically
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ClientProviders session={null}>{children}</ClientProviders>
      </body>
    </html>
  );
}
