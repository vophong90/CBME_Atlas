'use client';

import { useEffect, useState } from 'react';
import { useDepartmentCtx } from '../context';

type InboxItem = { id: string; created_at: string; student_id?: string | null; target: string; text: string };

export default function InboxPage() {
  const { courseCode } = useDepartmentCtx();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  async function loadInbox() {
    if (!courseCode) { setItems([]); return; }
    const p = new URLSearchParams();
    p.set('course_code', courseCode);
    if (range.from) p.set('from', range.from);
    if (range.to) p.set('to', range.to);
    const res = await fetch(`/api/department/inbox?${p.toString()}`);
    const js = await res.json();
    if (res.ok) setItems(js.data || []);
  }

  useEffect(() => { loadInbox(); /* eslint-disable-next-line */ }, [courseCode]);
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Hộp thư góp ý (theo học phần)</h2>
        <div className="flex items-center gap-2">
          <input type="datetime-local" value={range.from} onChange={(e)=>setRange(p=>({...p, from: e.target.value}))} className="border rounded-lg px-2 py-1 text-sm" />
          <span className="text-sm text-gray-600">→</span>
          <input type="datetime-local" value={range.to} onChange={(e)=>setRange(p=>({...p, to: e.target.value}))} className="border rounded-lg px-2 py-1 text-sm" />
          <button onClick={loadInbox} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Lọc</button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map(m=>(
          <div key={m.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">{m.target}</div>
              <div className="text-xs text-gray-600">{new Date(m.created_at).toLocaleString()}</div>
            </div>
            <div className="mt-1">{m.text}</div>
            <div className="mt-1 text-xs text-gray-500">SV: {m.student_id || 'Ẩn danh'}</div>
          </div>
        ))}
        {items.length===0 && <div className="text-sm text-gray-500">Chưa có góp ý.</div>}
      </div>
    </section>
  );
}
