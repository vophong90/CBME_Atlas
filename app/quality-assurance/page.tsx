'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Users2,
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';

type NavItem = {
  key: 'surveys' | 'targeting' | 'progress' | 'results';
  label: string;
  href: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  {
    key: 'surveys',
    label: 'Surveys',
    href: '/quality-assurance/surveys',
    desc: 'Tạo & quản lý khảo sát, cấu hình câu hỏi, bật/tắt.',
    icon: ClipboardList,
  },
  {
    key: 'targeting',
    label: 'Targeting',
    href: '/quality-assurance/targeting',
    desc: 'Chọn đối tượng: giảng viên / sinh viên / bộ phận hỗ trợ theo bộ lọc.',
    icon: Users2,
  },
  {
    key: 'progress',
    label: 'Progress',
    href: '/quality-assurance/progress',
    desc: 'Theo dõi đã nộp / chưa nộp, gửi nhắc nhở.',
    icon: Activity,
  },
  {
    key: 'results',
    label: 'Results',
    href: '/quality-assurance/results',
    desc: 'Xem kết quả và báo cáo tổng hợp.',
    icon: BarChart3,
  },
];

export default function QualityAssurancePage() {
  const pathname = usePathname();
  const router = useRouter();

  // Sidebar state (desktop) + ghi nhớ bằng localStorage
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

  // Mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => setCollapsed((v) => !v);

  // Nếu người dùng truy cập /quality-assurance gốc, có thể tự chuyển về surveys (tuỳ nhu cầu).
  // BẬT chuyển hướng mặc định bằng cách bỏ comment 2 dòng dưới.
  // useEffect(() => {
  //   if (pathname === '/quality-assurance') router.replace('/quality-assurance/surveys');
  // }, [pathname, router]);

  const title = useMemo(() => 'Đảm bảo chất lượng', []);
  const subtitle =
    'Quản lý khảo sát, chọn đối tượng, theo dõi tiến độ và xem kết quả — tất cả trong một nơi.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white text-slate-900">
      {/* Top bar (mobile) */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden">
        <button
          aria-label="Mở menu"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 active:scale-95"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 truncate">
          <div className="text-base font-semibold">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar (desktop) */}
        <aside
          className={[
            'hidden md:flex md:sticky md:top-0 md:h-[100dvh] md:flex-col md:border-r md:border-slate-200 md:bg-white',
            collapsed ? 'md:w-16' : 'md:w-72',
          ].join(' ')}
        >
          {/* Brand + collapse */}
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow">
                QA
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-5">Quality Assurance</span>
                  <span className="text-xs text-slate-500">CBME Atlas</span>
                </div>
              )}
            </div>
            <button
              aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              onClick={toggleCollapsed}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 hover:bg-slate-50 active:scale-95"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Nav */}
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
                    active
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                >
                  <Icon className="mr-2 h-5 w-5 shrink-0" />
                  {/* Label + desc (ẩn khi thu gọn) */}
                  <div className={collapsed ? 'sr-only' : 'flex min-w-0 flex-col'}>
                    <span className="truncate text-sm font-medium">{item.label}</span>
                    <span className="truncate text-xs text-slate-500">{item.desc}</span>
                  </div>

                  {/* Tooltip khi thu gọn */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer mini */}
          <div className="border-t border-slate-200 p-3 text-center text-xs text-slate-500">
            {collapsed ? 'v1.0' : 'CBME Atlas · QA Module · v1.0'}
          </div>
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
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold leading-5">Quality Assurance</span>
                    <span className="text-xs text-slate-500">CBME Atlas</span>
                  </div>
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
                        active
                          ? 'bg-slate-900 text-white shadow'
                          : 'text-slate-700 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      <Icon className="mr-2 h-5 w-5" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.label}</div>
                        <div className="truncate text-xs text-slate-500">{item.desc}</div>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Content */}
        <section className="flex-1">
          {/* Hero */}
          <div className="hidden md:block p-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-semibold">{title}</h1>
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
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
              const Icon = n.icon;
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
