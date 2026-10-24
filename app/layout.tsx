import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GorgeLink - MEDIA Downloader',
  description: 'All in one media downloader for TikTok, Instagram, YouTube, Facebook, and more.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GorgeLink',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#FAFAFA] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F8FAFC] min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
