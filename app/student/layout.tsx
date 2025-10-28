'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Flag,
  Target,
  MessageSquare,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { StudentProvider, useStudentCtx } from './context';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

// Bỏ tab “Tổng quan” như yêu cầu
const NAV_ITEMS: NavItem[] = [
  { href: '/student/plo',      label: 'PLO',      icon: Flag },
  { href: '/student/pi',       label: 'PI',       icon: Target },
  { href: '/student/feedback', label: 'Góp ý',    icon: MessageSquare },
  { href: '/student/surveys',  label: 'Khảo sát', icon: ClipboardList },
];

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname() || '';

  return (
    <aside
      className={[
        // Đồng bộ cảm giác với layout Giảng viên: nền trắng mờ + blur + viền
        'hidden md:flex h-[calc(100vh-0px)] shrink-0 flex-col border-r border-slate-200 bg-white/70 backdrop-blur',
        collapsed ? 'w-16' : 'w-64',
        'sticky top-0 z-30',
      ].join(' ')}
    >
      <div className="flex h-16 items-center px-4">
        {!collapsed ? (
          <div className="text-lg font-semibold">Sinh viên</div>
        ) : (
          <div className="text-base font-semibold">SV</div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-2">
        {NAV_ITEMS.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/');
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium',
                active
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
              title={collapsed ? it.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{it.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 text-[10px] text-slate-400">
        {!collapsed && <div>© CBME Atlas</div>}
      </div>
    </aside>
  );
}

function Topbar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { studentId, fullName, mssv, loading } = useStudentCtx();

  return (
    // Đồng bộ với Giảng viên: thanh topbar trắng mờ + blur + viền dưới
    <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white active:scale-95"
          title={collapsed ? 'Mở menu' : 'Thu gọn menu'}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <div>
          <div className="text-xl font-semibold leading-none">Sinh viên</div>
          <div className="text-sm text-slate-600">Theo dõi tiến độ, góp ý và khảo sát</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        ) : studentId ? (
          <div className="text-sm text-slate-700">
            <span className="font-medium">{fullName || 'Sinh viên'}</span>
            {mssv ? <span className="text-slate-500"> · MSSV {mssv}</span> : null}
          </div>
        ) : (
          <div className="text-sm font-medium text-red-600">Không xác định được sinh viên</div>
        )}
      </div>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <StudentProvider>
      {/* Không đặt nền riêng (giữ gradient nền từ layout gốc Giảng viên) */}
      <div className="md:flex min-h-screen">
        {/* Sidebar (desktop) */}
        <Sidebar collapsed={collapsed} />

        {/* Main area */}
        <div className="flex min-h-screen w-full flex-col">
          {/* Topbar */}
          <Topbar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

          {/* Content: dùng cùng max-width & padding như layout Giảng viên */}
          <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-4 md:py-6">
            {children}
          </div>
        </div>
      </div>
    </StudentProvider>
  );
}
