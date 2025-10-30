// app/student/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StudentProvider, useStudentCtx } from './context';

/** ===== Inline icons (no deps) ===== */
type IconProps = React.SVGProps<SVGSVGElement>;
const MenuIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth={1.75} strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
const ChevronLeft = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M15 6l-6 6 6 6" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M9 6l6 6-6 6" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const FlagIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M4 4v16" strokeWidth={1.75} />
    <path d="M4 5h11l-1.5 4L20 9l-2 6H4" strokeWidth={1.75} strokeLinejoin="round" />
  </svg>
);
const TargetIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <circle cx="12" cy="12" r="8" strokeWidth={1.75} />
    <circle cx="12" cy="12" r="3" strokeWidth={1.75} />
    <path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" strokeWidth={1.75} strokeLinecap="round" />
  </svg>
);
const MessageIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" strokeWidth={1.75} />
  </svg>
);
const ClipboardIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <rect x="6" y="4" width="12" height="16" rx="2" strokeWidth={1.75} />
    <path d="M9 4h6v3H9zM8 11h8M8 15h8" strokeWidth={1.75} strokeLinecap="round" />
  </svg>
);
const GridIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.75} />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeWidth={1.75} />
  </svg>
);

const BookIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M4 6a2 2 0 0 1 2-2h12v16H6a2 2 0 0 1-2-2V6z" strokeWidth={1.75} />
    <path d="M8 4v16" strokeWidth={1.75} />
  </svg>
);

/** ===== Nav config ===== */
const NAV = [
  { href: '/student/plo',      label: 'PLO',       Icon: FlagIcon },
  { href: '/student/pi',       label: 'PI',        Icon: TargetIcon },
  { href: '/student/rubrics',  label: 'Rubric',    Icon: GridIcon },
  { href: '/student/courses',  label: 'Học phần',  Icon: BookIcon },
  { href: '/student/feedback', label: 'Góp ý',     Icon: MessageIcon },
  { href: '/student/surveys',  label: 'Khảo sát',  Icon: ClipboardIcon },
];

/** ===== Header (card) ===== */
function HeaderIdentity() {
  const { studentId, fullName, mssv, loading } = useStudentCtx();

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sinh viên</h1>
          <p className="text-sm text-slate-600">Theo dõi tiến độ, góp ý và khảo sát.</p>
        </div>

        <div className="grid gap-1 text-right">
          {loading ? (
            <div className="ml-auto h-5 w-48 animate-pulse rounded bg-slate-200" />
          ) : studentId ? (
            <>
              <div className="text-sm font-semibold text-slate-900">{fullName || 'Sinh viên'}</div>
              {mssv ? <div className="text-xs text-slate-600">MSSV: {mssv}</div> : null}
            </>
          ) : (
            <div className="text-sm font-semibold text-red-600">Không xác định được sinh viên</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** ===== Shell ===== */
function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem('stuSidebarCollapsed');
      if (s) setCollapsed(s === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('stuSidebarCollapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/60 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-slate-200 p-2 active:scale-95"
          aria-label="Mở menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Sinh viên</div>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar (desktop) */}
        <aside
          className={[
            'hidden md:sticky md:top-0 md:h-[100dvh] md:flex md:flex-col md:border-r md:border-slate-200 md:bg-white',
            collapsed ? 'md:w-16' : 'md:w-72',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">SV</div>
            {!collapsed && <div className="text-sm font-semibold">Khu vực Sinh viên</div>}
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
              aria-label="Thu gọn/mở menu"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-2 pb-3">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'group relative flex items-center rounded-xl px-2 py-2 transition',
                    active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50',
                  ].join(' ')}
                >
                  <Icon className="mr-2 h-5 w-5 shrink-0" />
                  <div className={collapsed ? 'sr-only' : 'min-w-0'}>
                    <div className="truncate text-sm font-medium">{label}</div>
                  </div>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-brand-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-3 text-center text-xs text-slate-500">CBME Atlas · Student</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white md:hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">SV</div>
                  <div className="text-sm font-semibold">Khu vực Sinh viên</div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <nav className="space-y-1 px-2 pb-3">
                {NAV.map(({ href, label, Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        'flex items-center rounded-xl px-2 py-2 transition',
                        active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50',
                      ].join(' ')}
                    >
                      <Icon className="mr-2 h-5 w-5" />
                      <span className="text-sm font-medium">{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main */}
        <main className="flex-1 space-y-6 p-6">
          <HeaderIdentity />
          {children}
        </main>
      </div>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentProvider>
      <Shell>{children}</Shell>
    </StudentProvider>
  );
}
