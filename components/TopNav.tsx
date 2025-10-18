'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import AuthButton from './AuthButton'

const links = [
  { href: '/', label: 'Trang chủ' },
  { href: '/dashboard', label: 'Dashboard SV' },
  { href: '/class', label: 'Báo cáo Lớp' },
  { href: '/rubrics', label: 'Rubric' },
  { href: '/observations', label: 'Chấm & Minh chứng' },
  { href: '/portfolio', label: 'e-Portfolio' },
]

export default function TopNav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/assets/brand/icon-192.png" alt="Logo" width={28} height={28} className="rounded-md"/>
          <span className="font-semibold">Năng Lực Y</span>
        </div>
        <div className="flex items-center gap-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 ${pathname===l.href ? 'bg-slate-100' : ''}`}>
              {l.label}
            </Link>
          ))}
          {/* Nếu chưa đăng nhập, AuthButton sẽ hiển thị nút Đăng nhập; đã đăng nhập sẽ hiện avatar+menu */}
          <AuthButton />
        </div>
      </div>
    </nav>
  )
}
