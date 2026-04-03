import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#f4f3ef',
};

export const metadata: Metadata = {
  title: 'Simple Healthy Meal Prep',
  description: 'Plan your week in minutes. Browse curated salad recipes, build your weekly meal plan, and copy your grocery list in one click.',
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
