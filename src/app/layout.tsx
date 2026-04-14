import type { Metadata, Viewport } from 'next';
import { DM_Sans, Raleway } from 'next/font/google';
import './globals.css';
import { getSiteBaseUrl } from '@/lib/seo/site';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-dm-sans',
  adjustFontFallback: true,
});

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-raleway',
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  themeColor: '#f4f3ef',
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteBaseUrl()),
  title: {
    default: 'Browse Salads by Cuisine',
    template: '%s | Ease',
  },
  description:
    'Browse salads by cuisine, flavor, or season. Build your weekly meal plan and copy a combined grocery list in one click.',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232d8650'/%3E%3Cpath fill='%23fff' d='M9 15c1.5-3 4-5 7-5s5.5 2 7 5l-7 11-7-11z'/%3E%3C/svg%3E",
    apple: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='36' fill='%232d8650'/%3E%3Cpath fill='%23fff' d='M50 85c9-34 45-34 54 0 9 34-27 62-27 62s-36-28-27-62z'/%3E%3C/svg%3E",
  },
  appleWebApp: {
    statusBarStyle: 'default',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${raleway.variable}`}>
      <body>{children}</body>
    </html>
  );
}
