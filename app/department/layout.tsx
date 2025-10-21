'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DepartmentProvider, useDepartmentCtx } from './context';

/** ===== Inline icons (no deps) ===== */
type IconProps = React.SVGProps<SVGSVGElement>;
const MenuIcon = (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path strokeWidth={1.75} strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18"/></svg>);
const ChevronLeft = (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M15 6l-6 6 6 6" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"/></svg>);
const ChevronRight = (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M9 6l6 6-6 6" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"/></svg>);
const UploadIcon = (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth={1.75}/><path d="M7 10l5-5 5 5" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"/><path d="M12 15V5" strokeWidth={1.75} strokeLinecap="round"/></svg>);
const BookIcon = (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeWidth={1.75}/><path d="M4 4v15.5A2.5 2.5 0 0 1 6.5 22H20V6a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 6.5z" strokeWidth={1.75}/></svg>);
const RulerIcon = (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M21 3 3 21" strokeWidth={1.75}/><path d="M16 7l1 1M14 9l1 1M12 11l1 1M10 13l1 1M8 15l1 1M6 17l1 1" strokeWidth={1.75} strokeLinecap="round"/></svg>);
const BarIcon = (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M3 20h18" strokeWidth={1.75} strokeLinecap="round"/><rect x="6" y="10" width="3" height="8" rx="1" strokeWidth={1.75}/><rect x="11" y="6" width="3" height="12" rx="1" strokeWidth={1.75}/><rect x="16" y="12" width="3" height="6" rx="1" strokeWidth={1.75}/></svg>);
const InboxIcon = (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.75}/><path d="M3 13h4l2 3h6l2-3h4" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"/></svg>);

const NAV = [
  { href: '/department/upload',  label: 'Upload kết quả', Icon: UploadIcon },
  { href: '/department/courses', label: 'Học phần',       Icon: BookIcon },
  { href: '/department/rubrics', label: 'Rubrics',         Icon: RulerIcon },
  { href: '/department/metrics', label: 'Kết quả',         Icon: BarIcon },
  { href: '/department/inbox',   label: 'Hộp thư góp ý',   Icon: InboxIcon },
];

function HeaderFilters() {
  const { frameworks, frameworkId, setFrameworkId, courses, courseCode, setCourseCode, formatFw } = useDepartmentCtx();
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bộ môn</h1>
          <p className="text-sm text-slate-600">Quản lý kết quả đo lường, học phần, rubric & hộp thư góp ý.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-3 w-full md:w-auto">
          <div>
            <label className="block text-xs font-semibold mb-1">Khung chương trình</label>
            <select
              value={frameworkId}
              onChange={(e) => setFrameworkId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300 min-w-[260px]"
            >
              <option value="">— Chọn khung —</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>{formatFw(f) || f.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Học phần</label>
            <select
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300 min-w-[220px]"
            >
              <option value="">— Tất cả —</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>{c.code}{c.name ? ` • ${c.name}` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { try { const s = localStorage.getItem('deptSidebarCollapsed'); if (s) setCollapsed(s==='1'); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('deptSidebarCollapsed', collapsed ? '1':'0'); } catch {} }, [collapsed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/60 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 active:scale-95">
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Bộ môn</div>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar (desktop) */}
        <aside className={['hidden md:flex md:sticky md:top-0 md:h-[100dvh] md:flex-col md:border-r md:border-slate-200 md:bg-white', collapsed?'md:w-16':'md:w-72'].join(' ')}>
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">BM</div>
            {!collapsed && <div className="text-sm font-semibold">Khu vực Bộ môn</div>}
            <button onClick={()=>setCollapsed(v=>!v)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
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
                    active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50'
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
          <div className="border-t p-3 text-center text-xs text-slate-500">CBME Atlas · Department</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={()=>setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white md:hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">BM</div>
                  <div className="text-sm font-semibold">Khu vực Bộ môn</div>
                </div>
                <button onClick={()=>setMobileOpen(false)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
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
                      onClick={()=>setMobileOpen(false)}
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
          <HeaderFilters />
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DepartmentProvider>
      <Shell>{children}</Shell>
    </DepartmentProvider>
  );
}
