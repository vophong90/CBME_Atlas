'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
};

const links: NavLink[] = [
  { href: '/', label: 'Trang chủ', exact: true },
  { href: '/student', label: 'Sinh viên' },
  { href: '/360-eval', label: 'Đánh giá đa nguồn' }, // khớp route trong Trang chủ
  { href: '/admin', label: 'Quản trị' },             // khớp card "Quản trị" ở Trang chủ
  { href: '/login', label: 'Đăng nhập' },
];

export default function TopNav() {
  const pathname = usePathname();

  const isActive = (l: NavLink) => {
    if (l.exact) return pathname === l.href;
    return pathname === l.href || pathname.startsWith(`${l.href}/`);
  };

  return (
    <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Logo + brand */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/brand/icon-192.png"
            alt="Logo"
            width={28}
            height={28}
            className="rounded-md"
            priority
          />
          <span className="font-semibold">Năng Lực Y</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1">
          {links.map((l) => {
            const active = isActive(l);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 ${
                  active ? 'bg-slate-100 font-medium' : ''
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
