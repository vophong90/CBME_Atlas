'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/360-eval/evaluate', label: 'Thực hiện đánh giá' },
  { href: '/360-eval/forms',    label: 'Quản lý biểu mẫu' },    // QA dùng
  { href: '/360-eval/results',  label: 'Kết quả theo MSSV' },   // QA tra cứu
];

export default function Eval360Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  return (
    <div className="py-6">
      <div className="mb-4 flex gap-2">
        {TABS.map(t => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 py-1.5 rounded-lg text-sm ${active ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
