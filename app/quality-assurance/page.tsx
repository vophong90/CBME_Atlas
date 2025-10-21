'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';

/** ==== Inline icons (same set as layout) ==== */
type IconProps = React.SVGProps<SVGSVGElement>;
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
type NavItem = {
  key: 'surveys' | 'targeting' | 'progress' | 'results';
  label: string;
  href: string;
  desc: string;
  Icon: (p: IconProps) => JSX.Element;
};
const NAV: NavItem[] = [
  { key: 'surveys',   label: 'Surveys',   href: '/quality-assurance/surveys',   desc: 'Tạo & quản lý khảo sát, cấu hình câu hỏi, bật/tắt.', Icon: ClipboardIcon },
  { key: 'targeting', label: 'Targeting', href: '/quality-assurance/targeting', desc: 'Chọn đối tượng theo bộ lọc giảng viên / sinh viên / hỗ trợ.', Icon: UsersIcon },
  { key: 'progress',  label: 'Progress',  href: '/quality-assurance/progress',  desc: 'Theo dõi đã nộp / chưa nộp, gửi nhắc nhở.', Icon: ActivityIcon },
  { key: 'results',   label: 'Results',   href: '/quality-assurance/results',   desc: 'Xem kết quả và báo cáo tổng hợp.', Icon: BarChartIcon },
];

export default function QualityAssurancePage() {
  const pathname = usePathname() || '';
  const router = useRouter();

  // (Tuỳ chọn) tự chuyển /quality-assurance -> /quality-assurance/surveys
  useEffect(() => {
    if (pathname === '/quality-assurance') router.replace('/quality-assurance/surveys');
  }, [pathname, router]);

  const [collapsed, setCollapsed] = useState(false);
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

  const title = useMemo(() => 'Đảm bảo chất lượng', []);
  const subtitle = 'Quản lý khảo sát, chọn đối tượng, theo dõi tiến độ và xem kết quả — tất cả trong một nơi.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white text-slate-900">
      <div className="mx-auto flex max-w-[1400px]">
        {/* (Nếu bạn dùng layout.tsx, phần sidebar nằm ở layout; ở đây chỉ giữ nội dung) */}
        <section className="flex-1">
          {/* Hero */}
          <div className="p-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold">{title}</h1>
                  <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
                </div>
                <button
                  onClick={() => setCollapsed((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 active:scale-[0.98]"
                >
                  {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
                  {collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {NAV.map((n) => (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 active:scale-[0.98]"
                  >
                    Đi tới {n.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Quick actions / cards */}
          <div className="grid grid-cols-1 gap-4 px-4 pb-10 md:grid-cols-2 xl:grid-cols-4">
            {NAV.map((n) => {
              const Icon = n.Icon;
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-slate-50">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-semibold">{n.label}</div>
                      <div className="text-xs text-slate-500">{n.desc}</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-slate-600">
                    Mở {n.label} <span className="opacity-60">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
