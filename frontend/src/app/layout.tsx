import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AppProviders } from '@/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

/**
 * Monospace is load-bearing here, not decoration: MRZ lines, document numbers,
 * check digits and hashes must align character-for-character to be readable.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'VeriGuard AI — Integrity Console',
    template: '%s · VeriGuard AI',
  },
  description:
    'Officer decision-support console for identity and travel-document integrity screening. Presents evidence and risk indications for human review.',
  applicationName: 'VeriGuard AI',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#050810',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-background font-sans text-foreground"
        suppressHydrationWarning
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
