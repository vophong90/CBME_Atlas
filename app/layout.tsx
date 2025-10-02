import './globals.css'
import type { Metadata } from 'next'
import TopNav from '../components/TopNav'

export const metadata: Metadata = {
  title: 'Năng Lực Y',
  description: 'CBME | CLO–PI–PLO–EPA | Minh chứng & báo cáo realtime',
  icons: { icon: '/assets/brand/icon-192.png' },
  themeColor: '#0ea44b'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="manifest" href="/assets/brand/site.webmanifest" />
        <meta name="theme-color" content="#0ea44b" />
      </head>
      <body>
        <TopNav />
        <main className="min-h-screen">{children}</main>
        <footer className="mt-24 border-t">
          <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500">
            © {new Date().getFullYear()} Khoa Y học Cổ truyền – ĐHYD TP.HCM
          </div>
        </footer>
      </body>
    </html>
  )
}