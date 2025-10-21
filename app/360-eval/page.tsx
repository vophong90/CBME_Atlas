'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Task = {
  id: number;
  status: string; // e.g. 'pending' | 'submitted' | ...
  group_code: 'self' | 'peer' | 'faculty' | 'supervisor' | 'patient';
  campaign: { id: number; name: string; course_code?: string | null };
  evaluatee: { id: string };
};

const GROUP_LABEL: Record<Task['group_code'], string> = {
  self: 'Tự đánh giá',
  peer: 'Bạn học',
  faculty: 'Giảng viên',
  supervisor: 'Người hướng dẫn',
  patient: 'Bệnh nhân',
};

export default function Eval360Home() {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch('/api/360/my-tasks');
      const d = await r.json();
      setItems(d.items || []);
      setLoading(false);
    })();
  }, []);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Phiếu cần đánh giá</h2>
        <button
          onClick={() => location.reload()}
          className="px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
        >
          Làm mới
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">Đang tải…</div>}
      {empty && <div className="text-sm text-gray-600">Hiện chưa có phiếu nào.</div>}

      <div className="grid gap-3">
        {items.map((it) => {
          const statusPill =
            it.status === 'submitted'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-brand-50 text-brand-700 border-brand-300';
          return (
            <Link
              key={it.id}
              href={`/360-eval/fill/${it.id}`}
              className="border rounded-xl p-4 hover:bg-brand-50 transition flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{it.campaign?.name || 'Chiến dịch'}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Nhóm: <b>{GROUP_LABEL[it.group_code] || it.group_code}</b>
                  {it.campaign?.course_code ? <> • Học phần: {it.campaign.course_code}</> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${statusPill}`}>
                  {it.status}
                </span>
                <span className="text-sm text-brand-700">Mở →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
