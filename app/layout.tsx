import './globals.css';
import type { Metadata } from 'next';
import TopNav from '../components/TopNav';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'CBME Atlas', template: '%s — CBME Atlas' },
  description: 'CBME | PLO–CLO–PI–EPA | Minh chứng & báo cáo realtime',
  manifest: '/assets/brand/site.webmanifest',
  icons: {
    icon: [
      { url: '/assets/brand/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/assets/brand/icon-512.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.ico' },
    ],
    apple: '/assets/brand/apple-touch-icon.png',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0E7BD0' },
    { media: '(prefers-color-scheme: dark)', color: '#0A325B' },
  ],
  openGraph: {
    title: 'CBME Atlas',
    description: 'Nền tảng quản trị ma trận PLO–CLO–PI–EPA & đánh giá năng lực (CBME).',
    url: 'https://cbme-atlas.vercel.app',
    siteName: 'CBME Atlas',
    images: [{ url: '/assets/brand/og-cover.png', width: 1200, height: 630, alt: 'CBME Atlas' }],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CBME Atlas',
    description: 'CBME | PLO–CLO–PI–EPA | Minh chứng & báo cáo realtime',
    images: ['/assets/brand/og-cover.png'],
  },
  metadataBase: new URL('https://cbme-atlas.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      {/* CSS var --brand giúp dùng màu thương hiệu đồng nhất cả khi chưa cấu hình tailwind theme */}
      <body className="font-sans antialiased text-slate-900" style={{ ['--brand' as any]: '#0E7BD0' }}>
        <div className="relative min-h-screen bg-[radial-gradient(1200px_600px_at_-20%_-10%,rgba(14,123,208,0.06),transparent_60%),radial-gradient(1200px_600px_at_120%_-10%,rgba(43,174,114,0.06),transparent_60%),linear-gradient(180deg,#ffffff_0%,#f7fafc_100%)]">
          <TopNav />
          <main className="mx-auto max-w-7xl px-4 md:px-6">{children}</main>

          {/* Footer tinh gọn */}
          <footer className="mt-24 border-t bg-white/70 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 text-sm text-slate-600 flex items-center justify-between">
              <div>© {new Date().getFullYear()} Khoa Y học Cổ truyền – ĐHYD TP.HCM</div>
              <div className="text-slate-500">CBME Atlas</div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
