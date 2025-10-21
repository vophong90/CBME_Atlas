'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/* ==== Inline icons (no deps) ==== */
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
/* 360 marker */
const Rotate360Icon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M21 12a9 9 0 10-3.3 6.95" strokeWidth={1.75} />
    <path d="M21 12v6h-6" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
/* Tasks */
const ClipboardCheckIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <rect x="7" y="4" width="10" height="16" rx="2" strokeWidth={1.75} />
    <path d="M9 4h6M12 2v4" strokeWidth={1.75} strokeLinecap="round" />
    <path d="M9 13l2 2 4-4" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NAV = [
  { href: '/360-eval', label: 'Phiếu của tôi', Icon: ClipboardCheckIcon },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { try { const s = localStorage.getItem('eval360SidebarCollapsed'); if (s) setCollapsed(s === '1'); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('eval360SidebarCollapsed', collapsed ? '1' : '0'); } catch {} }, [collapsed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/60 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 active:scale-95" aria-label="Mở menu">
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Đánh giá 360°</div>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar (desktop) */}
        <aside
          className={[
            'hidden md:flex md:sticky md:top-0 md:h-[100dvh] md:flex-col md:border-r md:border-slate-200 md:bg-white',
            collapsed ? 'md:w-16' : 'md:w-72',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">
              <Rotate360Icon className="h-5 w-5" />
            </div>
            {!collapsed && <div className="text-sm font-semibold">Đánh giá đa nguồn</div>}
            <button onClick={() => setCollapsed(v => !v)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
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
                  <span className={collapsed ? 'sr-only' : 'text-sm font-medium'}>{label}</span>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-brand-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-3 text-center text-xs text-slate-500">CBME Atlas · 360°</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white md:hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">
                    <Rotate360Icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-semibold">Đánh giá đa nguồn</div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="Đóng">
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
                      className={['flex items-center rounded-xl px-2 py-2 transition', active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50'].join(' ')}
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
        <main className="flex-1 p-6 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">Đánh giá đa nguồn (360°)</h1>
                <p className="text-sm text-slate-600">Xem và điền các phiếu được giao cho bạn.</p>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Eval360Layout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
