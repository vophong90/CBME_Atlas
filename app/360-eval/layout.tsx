'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

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

export default function Eval360Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const { profile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { try { const s = localStorage.getItem('eval360SidebarCollapsed'); if (s) setCollapsed(s==='1'); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('eval360SidebarCollapsed', collapsed ? '1':'0'); } catch {} }, [collapsed]);

  // Quy ước hiển thị tab QA/Admin
  const isAdmin = (profile as any)?.is_admin === true || (profile?.role === 'admin');
  const isQA    = profile?.role === 'qa';
  const showQA  = isAdmin || isQA;

  const TABS = [
    { href: '/360-eval/evaluate', label: 'Thực hiện đánh giá' },
    ...(showQA ? [
      { href: '/360-eval/forms',   label: 'Quản lý biểu mẫu' },
      { href: '/360-eval/results', label: 'Kết quả theo MSSV' },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/60 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 active:scale-95">
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Đánh giá 360°</div>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar (desktop) */}
        <aside className={['hidden md:sticky md:top-0 md:h-[100dvh] md:flex md:flex-col md:border-r md:border-slate-200 md:bg-white', collapsed ? 'md:w-16' : 'md:w-72'].join(' ')}>
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">360</div>
            {!collapsed && <div className="text-sm font-semibold">Đánh giá 360°</div>}
            <button onClick={()=>setCollapsed(v=>!v)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-2 pb-3">
            {TABS.map(t => {
              const active = pathname === t.href || pathname.startsWith(t.href + '/');
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={[
                    'group relative flex items-center rounded-xl px-2 py-2 transition',
                    active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50',
                  ].join(' ')}
                >
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current opacity-60" />
                  <div className={collapsed ? 'sr-only' : 'min-w-0'}>
                    <div className="truncate text-sm font-medium">{t.label}</div>
                  </div>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-brand-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {t.label}
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
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={()=>setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white md:hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">360</div>
                  <div className="text-sm font-semibold">Đánh giá 360°</div>
                </div>
                <button onClick={()=>setMobileOpen(false)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <nav className="space-y-1 px-2 pb-3">
                {TABS.map(t => {
                  const active = pathname === t.href || pathname.startsWith(t.href + '/');
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={()=>setMobileOpen(false)}
                      className={['flex items-center rounded-xl px-2 py-2 transition', active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50'].join(' ')}
                    >
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current opacity-60" />
                      <span className="text-sm font-medium">{t.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main */}
        <main className="flex-1 space-y-6 p-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">Đánh giá 360°</h1>
                <p className="text-sm text-slate-600">Peer • Self • Faculty • Supervisor • Patient</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TABS.map(t => {
                  const active = pathname === t.href || pathname.startsWith(t.href + '/');
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={`px-3 py-1.5 rounded-lg text-sm ${active ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}
                    >
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
