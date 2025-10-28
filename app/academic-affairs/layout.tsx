'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/* inline icons (no deps) */
const MenuIcon = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth="1.75" strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
const ChevronLeft = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M15 6l-6 6 6 6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M9 6l6 6-6 6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const LayersIcon = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M12 2l9 5-9 5-9-5 9-5z" strokeWidth="1.75" />
    <path d="M3 12l9 5 9-5" strokeWidth="1.75" />
    <path d="M3 17l9 5 9-5" strokeWidth="1.75" />
  </svg>
);
const UsersIcon = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <circle cx="9" cy="8" r="3" strokeWidth="1.75" />
    <path d="M2 20a7 7 0 0114 0" strokeWidth="1.75" strokeLinecap="round" />
    <circle cx="17" cy="10" r="2" strokeWidth="1.75" />
    <path d="M22 20a5 5 0 00-7-4" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);
/* NEW: icon cho Quản lý học phần */
const BookIcon = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeWidth="1.75" />
    <path d="M4 4v15.5A2.5 2.5 0 0 1 6.5 22H20V6a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 6.5z" strokeWidth="1.75" />
  </svg>
);

const NAV = [
  { href: '/academic-affairs/framework', label: 'Khung CTĐT & Ma trận', Icon: LayersIcon },
  { href: '/academic-affairs/courses',   label: 'Quản lý học phần',     Icon: BookIcon   }, // <— thêm tab mới
  { href: '/academic-affairs/students',  label: 'Tài khoản sinh viên',  Icon: UsersIcon  },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem('aaSidebarCollapsed');
      if (s) setCollapsed(s === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('aaSidebarCollapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 active:scale-95">
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Quản lý đào tạo</div>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar */}
        <aside
          className={[
            'hidden md:flex md:sticky md:top-0 md:h-[100dvh] md:flex-col md:border-r md:border-slate-200 md:bg-white',
            collapsed ? 'md:w-16' : 'md:w-72',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">AA</div>
            {!collapsed && <div className="text-sm font-semibold">Academic Affairs</div>}
            <button onClick={() => setCollapsed((v) => !v)} className="rounded-lg border border-slate-200 p-2 hover:bg-brand-50">
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
                  <Icon className={['mr-2 h-5 w-5', active ? 'text-white' : 'text-slate-500'].join(' ')} />
                  <div className={collapsed ? 'sr-only' : 'min-w-0'}>
                    <div className="truncate text-sm font-medium">{label}</div>
                  </div>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-brand-700 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-3 text-center text-xs text-slate-500">CBME Atlas · Academic Affairs</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white md:hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">AA</div>
                  <div className="text-sm font-semibold">Academic Affairs</div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="rounded-lg border border-slate-200 p-2 hover:bg-brand-50">
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
                      <Icon className={['mr-2 h-5 w-5', active ? 'text-white' : 'text-slate-500'].join(' ')} />
                      <span className="text-sm font-medium">{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default function AcademicAffairsLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
