'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type NavLink = { href: string; label: string; exact?: boolean };

// KHÔNG để /login trong mảng này, vì sẽ hiện theo trạng thái tài khoản ở góc phải
const links: NavLink[] = [
  { href: '/', label: 'Trang chủ', exact: true },
  { href: '/student', label: 'Sinh viên' },
  { href: '/360-eval', label: 'Đánh giá đa nguồn' },
  { href: '/admin', label: 'Quản trị' },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabase();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (l: NavLink) =>
    l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);

  // Đọc trạng thái đăng nhập + tên hiển thị
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const u = auth?.user ?? null;
      if (!mounted) return;

      if (!u) {
        setUserId(null);
        setDisplayName(null);
        setLoading(false);
        return;
      }

      setUserId(u.id);
      // Ưu tiên staff.full_name -> students.full_name -> email
      try {
        const [{ data: staff }, { data: students }] = await Promise.all([
          supabase.from('staff').select('full_name').eq('user_id', u.id).maybeSingle(),
          supabase.from('students').select('full_name').eq('user_id', u.id).maybeSingle(),
        ]);
        const name =
          (staff?.full_name && String(staff.full_name).trim()) ||
          (students?.full_name && String(students.full_name).trim()) ||
          u.email ||
          'Tài khoản';
        setDisplayName(name);
      } catch {
        setDisplayName(u.email || 'Tài khoản');
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    setUserId(null);
    setDisplayName(null);
    router.replace('/login');
  }

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
          <span className="font-semibold">CBME Atlas</span>
        </Link>

        {/* Links + Tài khoản */}
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

          {/* Nút tài khoản */}
          <div className="relative ml-2" ref={menuRef}>
            {!userId ? (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white hover:opacity-90"
                style={{ background: 'var(--brand, #0E7BD0)' }}
              >
                {loading ? '...' : 'Đăng nhập'}
              </Link>
            ) : (
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200"
                title={displayName || ''}
              >
                <div className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white text-[11px]">
                  {(displayName || 'U')
                    .split(' ')
                    .map((s) => s[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <span className="max-w-[160px] truncate">{displayName}</span>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path d="M5.5 7.5l4.5 4.5 4.5-4.5H5.5z" />
                </svg>
              </button>
            )}

            {/* Dropdown */}
            {userId && menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden">
                <div className="px-3 py-2 text-xs text-slate-500 border-b">Tài khoản</div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
