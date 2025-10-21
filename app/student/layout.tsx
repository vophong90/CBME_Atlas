'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StudentProvider, useStudentCtx } from './context';

/* inline icons (no deps) */
const MenuIcon = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path strokeWidth="1.75" strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" /></svg>);
const ChevronLeft = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M15 6l-6 6 6 6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const ChevronRight = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M9 6l6 6-6 6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>);

const NAV = [
  { href: '/student/pi', label: 'Tiến độ PI', desc: 'Mức độ đạt PI' },
  { href: '/student/plo', label: 'Tiến độ PLO', desc: 'Tổng thể chương trình' },
  { href: '/student/feedback', label: 'Phản hồi', desc: 'Góp ý học phần/giảng viên' },
  { href: '/student/surveys', label: 'Khảo sát', desc: 'Phiếu khảo sát' },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const { studentId, setStudentId } = useStudentCtx();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { try { const s = localStorage.getItem('studentSidebarCollapsed'); if (s) setCollapsed(s==='1'); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('studentSidebarCollapsed', collapsed ? '1':'0'); } catch {} }, [collapsed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 active:scale-95">
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">Sinh viên</div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-600">SV:</span>
          <input value={studentId} onChange={e=>setStudentId(e.target.value)}
                 placeholder="student_id"
                 className="rounded-lg border border-slate-300 px-2 py-1 text-xs" />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar (desktop) */}
        <aside className={['hidden md:flex md:sticky md:top-0 md:h-[100dvh] md:flex-col md:border-r md:border-slate-200 md:bg-white', collapsed?'md:w-16':'md:w-72'].join(' ')}>
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow">SV</div>
            {!collapsed && <div className="text-sm font-semibold">Trang sinh viên</div>}
            <button onClick={()=>setCollapsed(v=>!v)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 pb-3">
            {NAV.map(item=>{
              const active = pathname===item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}
                      className={['group relative flex items-center rounded-xl px-2 py-2 transition', active?'bg-slate-900 text-white shadow':'text-slate-700 hover:bg-slate-100'].join(' ')}>
                  <div className="mr-2 h-5 w-5 rounded bg-slate-200" /> {/* placeholder icon */}
                  <div className={collapsed ? 'sr-only':'min-w-0'}>
                    <div className="truncate text-sm font-medium">{item.label}</div>
                    <div className="truncate text-xs text-slate-500">{item.desc}</div>
                  </div>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {item.label}
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
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={()=>setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white md:hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow">SV</div>
                  <div className="text-sm font-semibold">Trang sinh viên</div>
                </div>
                <button onClick={()=>setMobileOpen(false)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <nav className="space-y-1 px-2 pb-3">
                {NAV.map(item=>{
                  const active = pathname===item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link key={item.href} href={item.href} onClick={()=>setMobileOpen(false)}
                          className={['flex items-center rounded-xl px-2 py-2 transition', active?'bg-slate-900 text-white shadow':'text-slate-700 hover:bg-slate-100'].join(' ')}>
                      <div className="mr-2 h-5 w-5 rounded bg-slate-200" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main */}
        <main className="flex-1 p-6">
          <div className="mb-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">Sinh viên</h1>
                  <p className="text-sm text-slate-600">Theo dõi tiến độ, góp ý và làm khảo sát.</p>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-sm text-slate-600">SV:</span>
                  <input value={studentId} onChange={e=>setStudentId(e.target.value)}
                         placeholder="student_id (tùy chọn)"
                         className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring" />
                </div>
              </div>
            </div>
          </div>
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
