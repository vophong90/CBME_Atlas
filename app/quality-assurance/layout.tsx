'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Users2,
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';

const NAV = [
  { key: 'surveys',   label: 'Surveys',   href: '/quality-assurance/surveys',   icon: ClipboardList },
  { key: 'targeting', label: 'Targeting', href: '/quality-assurance/targeting', icon: Users2 },
  { key: 'progress',  label: 'Progress',  href: '/quality-assurance/progress',  icon: Activity },
  { key: 'results',   label: 'Results',   href: '/quality-assurance/results',   icon: BarChart3 },
];

export default function QALayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button
          aria-label="Mở menu"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 active:scale-95"
        >
          <Menu className="h-5 w-5" />
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
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow">
              QA
            </div>
            {!collapsed && <div className="text-sm font-semibold">Quality Assurance</div>}
            <button
              aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              onClick={() => setCollapsed((v) => !v)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 hover:bg-slate-50 active:scale-95"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 pb-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || (pathname && pathname.startsWith(item.href + '/'));
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={[
                    'group relative flex items-center rounded-xl px-2 py-2 transition',
                    active ? 'bg-slate-900 text-white shadow' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                >
                  <Icon className="mr-2 h-5 w-5 shrink-0" />
                  <span className={collapsed ? 'sr-only' : 'text-sm font-medium'}>{item.label}</span>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
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
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow">
                    QA
                  </div>
                  <div className="text-sm font-semibold">Quality Assurance</div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <nav className="space-y-1 px-2 pb-3">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (pathname && pathname.startsWith(item.href + '/'));
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        'flex items-center rounded-xl px-2 py-2 transition',
                        active ? 'bg-slate-900 text-white shadow' : 'text-slate-700 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      <Icon className="mr-2 h-5 w-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
