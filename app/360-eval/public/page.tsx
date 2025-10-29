'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type PublicForm = { title: string; group_code: string; slug: string; updated_at?: string };

export default function PublicFormsPage() {
  const [items, setItems] = useState<PublicForm[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/360/public/forms');
        const d = await r.json();
        setItems(d.items || []);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  const filtered = items.filter(f => {
    if (!q.trim()) return true;
    const s = (f.title + ' ' + f.group_code).toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Biểu mẫu đánh giá 360° (công khai)</h1>
        <p className="text-sm text-slate-600">Chọn biểu mẫu phù hợp và bắt đầu đánh giá.</p>
        <div className="mt-3">
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Tìm theo tiêu đề/nhóm…"
          />
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(f => (
          <Link
            key={f.slug}
            href={`/360-eval/public/${f.slug}`}
            className="rounded-xl border bg-white p-4 hover:bg-brand-50/40 transition"
          >
            <div className="text-sm text-slate-500">Nhóm: {f.group_code}</div>
            <div className="text-base font-medium">{f.title}</div>
            {f.updated_at && (
              <div className="text-xs text-slate-500 mt-1">Cập nhật: {new Date(f.updated_at).toLocaleString('vi-VN')}</div>
            )}
          </Link>
        ))}
        {!filtered.length && (
          <div className="rounded-xl border bg-white p-6 text-center text-slate-500">
            Chưa có biểu mẫu công khai.
          </div>
        )}
      </div>
    </div>
  );
}
