'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/* inline icons */
const UsersIcon = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><circle cx="9" cy="8" r="3"/><path d="M2 20a7 7 0 0114 0"/><circle cx="17" cy="10" r="2"/><path d="M22 20a5 5 0 00-7-4"/></svg>);
const OrgIcon = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="8.5" y="14" width="7" height="7" rx="1"/><path d="M6.5 10v4M17.5 10v4M12 14V10" /></svg>);
const ShieldIcon = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4z"/></svg>);

const NAV = [
  { href: '/admin/users', label: 'Quản lý nhân sự', Icon: UsersIcon },
  { href: '/admin/org', label: 'Tổ chức nhân sự', Icon: OrgIcon },
  { href: '/admin/security', label: 'Bảo mật hệ thống', Icon: ShieldIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem('adminSidebarCollapsed');
    if (s) setCollapsed(s === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('adminSidebarCollapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white text-slate-900">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className={['sticky top-0 hidden h-[100dvh] border-r border-slate-200 bg-white md:flex md:flex-col', collapsed ? 'w-16' : 'w-72'].join(' ')}>
          <div className="flex items-center justify-between p-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white">AD</div>
            {!collapsed && <div className="text-sm font-semibold">Admin Center</div>}
            <button onClick={() => setCollapsed(v => !v)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"><path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 pb-3">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href} className={['group relative flex items-center rounded-xl px-2 py-2 transition', active ? 'bg-slate-900 text-white shadow' : 'text-slate-700 hover:bg-slate-100'].join(' ')}>
                  <Icon className="mr-2 h-5 w-5" />
                  <span className={collapsed ? 'sr-only' : 'text-sm font-medium'}>{label}</span>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-3 text-center text-xs text-slate-500">CBME Atlas · Admin</div>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
