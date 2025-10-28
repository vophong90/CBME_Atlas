// app/360-eval/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/* ===== Inline icons (no deps) ===== */
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
const ClipboardCheck = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <rect x="6" y="4" width="12" height="16" rx="2" strokeWidth="1.75" />
    <path d="M9 4h6v3H9z" strokeWidth="1.75" />
    <path d="M8 11h5" strokeWidth="1.75" />
    <path d="M8 15h8" strokeWidth="1.75" />
    <path d="M14 10l2 2 3-3" strokeWidth="1.75" />
  </svg>
);
const WrenchIcon = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M14.7 6.3a4.5 4.5 0 0 0-6.36 6.36l-5.34 5.34a1.5 1.5 0 0 0 2.12 2.12l5.34-5.34a4.5 4.5 0 0 0 6.36-6.36l-1.06 1.06a3 3 0 1 1-4.24-4.24L14.7 6.3z" strokeWidth="1.75"/>
  </svg>
);
const BarIcon = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M3 20h18" strokeWidth="1.75" strokeLinecap="round" />
    <rect x="6" y="10" width="3" height="8" rx="1" strokeWidth="1.75" />
    <rect x="11" y="6" width="3" height="12" rx="1" strokeWidth="1.75" />
    <rect x="16" y="12" width="3" height="6" rx="1" strokeWidth="1.75" />
  </svg>
);

/* ===== Roles helper: QA tabs chỉ hiện khi user có role phù hợp ===== */
type MeResp = { user?: { id: string; email?: string; name?: string | null } | null; roles?: string[] | null };
const CAN_SEE_QA = (roles?: string[] | null) => {
  if (!roles) return false;
  const allow = ['qa', 'admin', 'academic_affairs', 'secretary'];
  return roles.some(r => allow.includes(r));
};

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<MeResp | null>(null);

  // restore sidebar state
  useEffect(() => {
    try {
      const s = localStorage.getItem('eval360SidebarCollapsed');
      if (s) setCollapsed(s === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('eval360SidebarCollapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  // fetch current user + roles (graceful fallback)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { credentials: 'include' });
        const d = await r.json().catch(() => ({}));
        setMe(d || {});
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const showQA = CAN_SEE_QA(me?.roles);

  const NAV = [
    { href: '/360-eval/evaluate', label: 'Thực hiện đánh giá', Icon: ClipboardCheck, show: true },
    { href: '/360-eval/forms',    label: 'Quản lý biểu mẫu',   Icon: WrenchIcon,    show: showQA },
    { href: '/360-eval/results',  label: 'Kết quả theo MSSV',  Icon: BarIcon,       show: showQA },
  ].filter(i => i.show);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 active:scale-95">
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
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">360</div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Đánh giá 360°</div>
                <div className="truncate text-xs text-slate-500">
                  {me?.user?.name || me?.user?.email || 'Khách'}
                </div>
              </div>
            )}
            <button onClick={() => setCollapsed(v => !v)} className="rounded-lg border border-slate-200 p-2 hover:bg-brand-50">
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

          <div className="border-t p-3 text-center text-xs text-slate-500">CBME Atlas · 360 Eval</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white md:hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">360</div>
                  <div className="text-sm font-semibold">Đánh giá 360°</div>
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
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Eval360Layout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
