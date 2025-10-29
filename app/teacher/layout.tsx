'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { ClipboardList } from 'lucide-react';

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
    <rect x="6" y="4" width="12" height="16" rx="2" />
    <path d="M9 4h6v3H9z" />
    <path d="M8 11h5" />
    <path d="M8 15h8" />
    <path d="M14 10l2 2 3-3" />
  </svg>
);
const GraduationCap = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M12 13v7" />
    <path d="M7 15c1.5 1 3.5 1.5 5 1.5S15.5 16 17 15v4c-1.5 1-3.5 1.5-5 1.5S8.5 20 7 19v-4z" />
  </svg>
);
const MessageSquare = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
  </svg>
);
const InboxIcon = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 13h4l2 3h6l2-3h4" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NAV = [
  { href: '/teacher/evaluate', label: 'Đánh giá', desc: 'Chấm theo Rubric', Icon: ClipboardCheck },
  { href: '/teacher/student',  label: 'Thông tin SV', desc: 'Tra cứu & CLO chưa đạt', Icon: GraduationCap },
  { href: '/teacher/feedback', label: 'Phản hồi (GV → SV)', desc: 'Gợi ý cải thiện', Icon: MessageSquare },
  { href: '/teacher/inbox',    label: 'Hộp thư góp ý', desc: 'Ẩn danh từ SV', Icon: InboxIcon },
  { href: '/teacher/surveys', label: 'Khảo sát', desc: 'Khảo sát dành cho GV', Icon: ClipboardList },

];

function getInitials(name?: string) {
  if (!name) return 'GV';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Thông tin GV
  const [teacherName, setTeacherName] = useState<string>('');
  const [deptName, setDeptName] = useState<string>('');
  const initials = useMemo(() => getInitials(teacherName), [teacherName]);

  useEffect(() => {
    try {
      const s = localStorage.getItem('teacherSidebarCollapsed');
      if (s) setCollapsed(s === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('teacherSidebarCollapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  // Lấy tên GV + bộ môn từ bảng staff (join departments)
  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data: userRes } = await sb.auth.getUser();
        const uid = userRes?.user?.id;
        if (!uid) return;

        const { data, error } = await sb
          .from('staff')
          .select('full_name, departments ( name )')
          .eq('user_id', uid)
          .maybeSingle();

        if (!error && data) {
          setTeacherName((data as any)?.full_name || 'Giảng viên');
          setDeptName((data as any)?.departments?.name || '');
          return;
        }

        // Fallback nếu chưa có record staff
        setTeacherName(userRes?.user?.user_metadata?.full_name || userRes?.user?.email || 'Giảng viên');
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white text-slate-900">
      {/* Topbar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 active:scale-95">
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">{teacherName || 'Giảng viên'}{deptName ? ` · ${deptName}` : ''}</div>
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
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{teacherName || 'Giảng viên'}</div>
                <div className="truncate text-xs text-slate-500">{deptName || 'Khu vực giảng viên'}</div>
              </div>
            )}
            <button onClick={() => setCollapsed((v) => !v)} className="rounded-lg border border-slate-200 p-2 hover:bg-brand-50">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-2 pb-3">
            {NAV.map(({ href, label, desc, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'group relative flex items-center rounded-xl px-2 py-2 transition',
                    active ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-brand-50',
                  ].join(' ')}
                >
                  <Icon className={['mr-2 h-5 w-5', active ? 'text-white' : 'text-slate-500'].join(' ')} />
                  <div className={collapsed ? 'sr-only' : 'min-w-0'}>
                    <div className="truncate text-sm font-medium">{label}</div>
                    <div className={['truncate text-xs', active ? 'text-white/80' : 'text-slate-500'].join(' ')}>{desc}</div>
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

          <div className="border-t p-3 text-center text-xs text-slate-500">CBME Atlas · Teacher</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white md:hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">{initials}</div>
                  <div className="text-sm font-semibold">{teacherName || 'Giảng viên'}</div>
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
          <div className="mb-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">
                    Giảng viên <span className="text-brand-700">• {teacherName || '—'}</span>
                  </h1>
                  <p className="text-sm text-slate-600">
                    Chấm đánh giá, tra cứu sinh viên, phản hồi đến SV. {deptName ? `(${deptName})` : ''}
                  </p>
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

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
