'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';

/** ==== Minimal inline icons (no external deps) ==== */
type IconProps = React.SVGProps<SVGSVGElement>;
const MenuIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth={1.75} strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
const ChevronLeftIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
  </svg>
);
const ChevronRightIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
  </svg>
);
const ClipboardIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <rect x="7" y="4" width="10" height="16" rx="2" strokeWidth={1.75} />
    <path d="M9 4h6M12 2v4" strokeWidth={1.75} strokeLinecap="round" />
  </svg>
);
const UsersIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <circle cx="9" cy="8" r="3" strokeWidth={1.75} />
    <path d="M2 20a7 7 0 0114 0" strokeWidth={1.75} strokeLinecap="round" />
    <circle cx="17" cy="10" r="2" strokeWidth={1.75} />
    <path d="M22 20a5 5 0 00-7-4" strokeWidth={1.75} strokeLinecap="round" />
  </svg>
);
const ActivityIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M22 12h-4l-2 6-4-12-2 6H2" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BarChartIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M3 20h18" strokeWidth={1.75} strokeLinecap="round" />
    <rect x="6" y="10" width="3" height="8" rx="1" strokeWidth={1.75} />
    <rect x="11" y="6" width="3" height="12" rx="1" strokeWidth={1.75} />
    <rect x="16" y="12" width="3" height="6" rx="1" strokeWidth={1.75} />
  </svg>
);

/** ==== Nav config ==== */
const NAV = [
  { key: 'surveys',   label: 'Surveys',   href: '/quality-assurance/surveys',   Icon: ClipboardIcon },
  { key: 'targeting', label: 'Targeting', href: '/quality-assurance/targeting', Icon: UsersIcon },
  { key: 'progress',  label: 'Progress',  href: '/quality-assurance/progress',  Icon: ActivityIcon },
  { key: 'results',   label: 'Results',   href: '/quality-assurance/results',   Icon: BarChartIcon },
];

export default function QALayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('qaSidebarCollapsed');
      if (saved) setCollapsed(saved === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('qaSidebarCollapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button
          aria-label="Mở menu"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 active:scale-95"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Quality Assurance</div>
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
              QA
            </div>
            {!collapsed && <div className="text-sm font-semibold">Quality Assurance</div>}
            <button
              aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              onClick={() => setCollapsed((v) => !v)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 hover:bg-brand-50 active:scale-95"
            >
              {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-2 pb-3">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.Icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={[
                    'group relative flex items-center rounded-xl px-2 py-2 transition',
                    active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50',
                  ].join(' ')}
                >
                  <Icon className={['mr-2 h-5 w-5 shrink-0', active ? 'text-white' : 'text-slate-500'].join(' ')} />
                  <span className={collapsed ? 'sr-only' : 'min-w-0'}>
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                  </span>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-brand-700 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
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
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">
                    QA
                  </div>
                  <div className="text-sm font-semibold">Quality Assurance</div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-brand-50 active:scale-95"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
              </div>
              <nav className="space-y-1 px-2 pb-3">
                {NAV.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.Icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        'flex items-center rounded-xl px-2 py-2 transition',
                        active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50',
                      ].join(' ')}
                    >
                      <Icon className={['mr-2 h-5 w-5', active ? 'text-white' : 'text-slate-500'].join(' ')} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
