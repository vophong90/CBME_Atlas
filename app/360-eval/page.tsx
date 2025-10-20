'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Task = {
  id: number;
  status: string;
  group_code: 'self'|'peer'|'faculty'|'supervisor'|'patient';
  campaign: { id: number; name: string; course_code?: string|null };
  evaluatee: { id: string };
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Đánh giá đa nguồn (360°)</h1>
      <p className="text-sm text-gray-600">Các phiếu cần bạn đánh giá.</p>

      {loading && <div className="text-gray-500 text-sm">Đang tải…</div>}

      {!loading && items.length === 0 && (
        <div className="text-gray-600 text-sm">Hiện chưa có phiếu nào.</div>
      )}

      <div className="grid gap-3">
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/360-eval/fill/${it.id}`}
            className="border rounded-xl p-4 hover:bg-gray-50 transition flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{it.campaign?.name || 'Chiến dịch'}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Nhóm: <b>{it.group_code}</b>
                {it.campaign?.course_code ? <> • Học phần: {it.campaign.course_code}</> : null}
              </div>
            </div>
            <div className="text-sm text-[#0E7BD0]">Mở →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
