'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AuthProvider, { useAuth } from './AuthProvider'; // nếu bạn đặt ở components/AuthProvider.tsx thì đổi đường dẫn import tại app/layout.tsx (bước 3)

type NavLink = { href: string; label: string; exact?: boolean };

const links: NavLink[] = [
  { href: '/', label: 'Trang chủ', exact: true },
  { href: '/student', label: 'Sinh viên' },
  { href: '/360-eval', label: 'Đánh giá đa nguồn' },
  { href: '/admin', label: 'Quản trị' },
];

function UserMenu() {
  const { user, profile, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="px-3 py-1.5 text-sm text-slate-500">Đang tải…</div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white hover:opacity-90"
        style={{ background: 'var(--brand)' }}
      >
        Đăng nhập
      </Link>
    );
  }

  const display = profile?.name || user.email || 'Tài khoản';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-slate-50"
      >
        <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white text-xs">
          {display.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-medium">{display}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {profile?.role === 'staff' && profile.dept_name ? (
            <div className="px-3 py-2 text-xs text-slate-500">Bộ môn: {profile.dept_name}</div>
          ) : null}
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const isActive = (l: NavLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`));

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        {/* Logo + brand */}
        <Link href="/" className="flex items-center gap-3">
          <Image src="/assets/brand/icon-192.png" alt="Logo" width={28} height={28} className="rounded-md" priority />
          <span className="font-semibold">CBME Atlas</span>
        </Link>

        {/* Links + user */}
        <div className="flex items-center gap-1">
          {links.map((l) => {
            const active = isActive(l);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 ${active ? 'bg-slate-100 font-medium' : ''}`}
              >
                {l.label}
              </Link>
            );
          })}

          {/* Tên người dùng / Đăng nhập / Đăng xuất */}
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
