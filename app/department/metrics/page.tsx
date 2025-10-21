'use client';

import { useEffect, useState } from 'react';
import { useDepartmentCtx } from '../context';

type Row = { course_code: string; clo_code: string; total: number; achieved: number; not_yet: number };

export default function MetricsPage() {
  const { frameworkId, courseCode } = useDepartmentCtx();
  const [items, setItems] = useState<Row[]>([]);

  async function loadMetrics() {
    if (!frameworkId) { setItems([]); return; }
    const p = new URLSearchParams();
    p.set('framework_id', frameworkId);
    if (courseCode) p.set('course_code', courseCode);
    const res = await fetch(`/api/department/metrics?${p.toString()}`);
    const js = await res.json();
    if (res.ok) setItems(js.data || []);
  }

  async function exportCSV() {
    if (!frameworkId) return alert('Chọn framework trước.');
    const res = await fetch('/api/department/metrics/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ framework_id: frameworkId, course_code: courseCode || null }),
    });
    if (!res.ok) { const t = await res.text(); alert(`Export lỗi: ${t.slice(0,200)}`); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `results_${courseCode || 'all'}.csv`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }

  useEffect(() => { loadMetrics(); /* eslint-disable-next-line */ }, [frameworkId, courseCode]);

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kết quả đo lường (tổng hợp)</h2>
        <div className="flex items-center gap-2">
          <button onClick={loadMetrics} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Làm mới</button>
          <button onClick={exportCSV} className="px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700">Xuất CSV</button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{['Học phần','CLO','Tổng','Đạt','Chưa đạt'].map(h=><th key={h} className="px-3 py-2 text-left border-b">{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((m,i)=>(
              <tr key={i} className="odd:bg-gray-50">
                <td className="px-3 py-2 border-b">{m.course_code}</td>
                <td className="px-3 py-2 border-b">{m.clo_code}</td>
                <td className="px-3 py-2 border-b">{m.total}</td>
                <td className="px-3 py-2 border-b text-emerald-700">{m.achieved}</td>
                <td className="px-3 py-2 border-b text-rose-700">{m.not_yet}</td>
              </tr>
            ))}
            {items.length===0 && (<tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Chưa có dữ liệu.</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
