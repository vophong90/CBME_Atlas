// app/department/metrics/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDepartmentCtx } from '../context';

type SumRow = { course_code: string; clo_code: string; total: number; achieved: number; not_yet: number };

type HeatRow = { mssv: string; full_name?: string };
type HeatCol = { key: string; course_code: string; clo_code: string; course_name?: string };

export default function MetricsPage() {
  const { frameworkId, courseCode } = useDepartmentCtx();

  // ===== Summary =====
  const [items, setItems] = useState<SumRow[]>([]);
  async function loadMetrics() {
    if (!frameworkId) { setItems([]); return; }
    const p = new URLSearchParams({ framework_id: frameworkId });
    if (courseCode) p.set('course_code', courseCode);
    const res = await fetch(`/api/department/metrics?${p.toString()}`, { cache: 'no-store' });
    const js = await res.json();
    setItems(res.ok ? (js.data || []) : []);
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
    setTimeout(()=>URL.revokeObjectURL(url), 400);
  }
  useEffect(() => { loadMetrics(); /* eslint-disable-next-line */ }, [frameworkId, courseCode]);

  // ===== Heatmap =====
  const [loadingHeat, setLoadingHeat] = useState(false);
  const [courses, setCourses] = useState<string[]>(courseCode ? [courseCode] : []);
  const [availableCols, setAvailableCols] = useState<HeatCol[]>([]);
  const [pickedCols, setPickedCols] = useState<string[]>([]);
  const [hRows, setHRows] = useState<HeatRow[]>([]);
  const [hCols, setHCols] = useState<HeatCol[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, 1|0|null>>>({});

  useEffect(() => {
    if (courseCode && !courses.length) setCourses([courseCode]);
  }, [courseCode]);

  async function fetchAvailableCols() {
    if (!frameworkId || courses.length === 0) { setAvailableCols([]); setPickedCols([]); return; }
    setLoadingHeat(true);
    try {
      const res = await fetch('/api/department/metrics/heatmap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ framework_id: frameworkId, course_codes: courses }),
      });
      const js = await res.json();
      if (res.ok) {
        const cols = js.data?.cols || [];
        setAvailableCols(cols);
        setPickedCols(cols.map((c: HeatCol) => c.key));
      } else {
        setAvailableCols([]); setPickedCols([]);
      }
    } finally {
      setLoadingHeat(false);
    }
  }

  async function loadHeatmap() {
    if (!frameworkId || pickedCols.length === 0) { setHRows([]); setHCols([]); setValues({}); return; }
    setLoadingHeat(true);
    try {
      const cols = availableCols.filter(c => pickedCols.includes(c.key)).map(c => ({ course_code: c.course_code, clo_code: c.clo_code }));
      const res = await fetch('/api/department/metrics/heatmap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ framework_id: frameworkId, course_codes: courses, columns: cols }),
      });
      const js = await res.json();
      if (res.ok) {
        setHRows(js.data?.rows || []);
        setHCols(js.data?.cols || []);
        setValues(js.data?.values || {});
      } else {
        setHRows([]); setHCols([]); setValues({});
      }
    } finally {
      setLoadingHeat(false);
    }
  }

  const pickedCount = pickedCols.length;

  return (
    <section className="space-y-6 rounded-xl border bg-white p-5 shadow-sm">
      {/* ===== Tổng hợp ===== */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kết quả đo lường (tổng hợp)</h2>
        <div className="flex items-center gap-2">
          <button onClick={loadMetrics} className="rounded-lg border px-3 py-2 hover:bg-gray-50">Làm mới</button>
          <button onClick={exportCSV} className="rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-700">Xuất CSV</button>
        </div>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{['Học phần','CLO','Tổng','Đạt','Chưa đạt'].map(h=><th key={h} className="border-b px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((m,i)=>(
              <tr key={i} className="odd:bg-gray-50">
                <td className="border-b px-3 py-2">{m.course_code}</td>
                <td className="border-b px-3 py-2">{m.clo_code}</td>
                <td className="border-b px-3 py-2">{m.total}</td>
                <td className="border-b px-3 py-2 text-emerald-700">{m.achieved}</td>
                <td className="border-b px-3 py-2 text-rose-700">{m.not_yet}</td>
              </tr>
            ))}
            {items.length===0 && (<tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Chưa có dữ liệu.</td></tr>)}
          </tbody>
        </table>
      </div>

      {/* ===== Heatmap (chỉ MSSV × CLO, bỏ cột Họ tên) ===== */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
          <div className="text-base font-semibold">Heatmap theo MSSV × CLO</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              placeholder="Nhập nhiều mã học phần (phân cách dấu phẩy)"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 md:w-96"
              value={courses.join(',')}
              onChange={(e) => setCourses(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
            <button onClick={fetchAvailableCols} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
              Lấy danh sách CLO
            </button>
            <button onClick={loadHeatmap} disabled={pickedCount===0 || loadingHeat}
              className={`rounded-lg px-3 py-2 text-white ${pickedCount===0 || loadingHeat ? 'bg-gray-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'}`}>
              {loadingHeat ? 'Đang tải…' : `Vẽ heatmap (${pickedCount})`}
            </button>
          </div>
        </div>

        {availableCols.length > 0 && (
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-medium">Chọn CLO muốn hiển thị:</div>
            <div className="flex flex-wrap gap-2">
              {availableCols.map(c => (
                <label key={c.key} className="inline-flex items-center gap-2 rounded border px-2 py-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={pickedCols.includes(c.key)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setPickedCols(prev => on ? [...prev, c.key] : prev.filter(k => k !== c.key));
                    }}
                  />
                  <span className="text-sm">{c.course_code} • {c.clo_code}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {hCols.length > 0 && (
          <div className="overflow-auto rounded border">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 border-b bg-gray-50 px-3 py-2 text-left">MSSV</th>
                  {hCols.map(c => (
                    <th key={c.key} className="border-b px-3 py-2 text-left">
                      <div className="text-[11px] opacity-70">{c.course_code}</div>
                      <div className="font-medium">{c.clo_code}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hRows.map(r => (
                  <tr key={r.mssv} className="odd:bg-gray-50">
                    <td className="sticky left-0 z-10 border-b bg-white px-3 py-2">{r.mssv}</td>
                    {hCols.map(c => {
                      const v = values?.[r.mssv]?.[c.key] ?? null;
                      const cls =
                        v === 1 ? 'bg-emerald-200 text-emerald-900'
                        : v === 0 ? 'bg-rose-200 text-rose-900'
                        : 'bg-gray-50 text-gray-400';
                      return <td key={c.key} className={`border-b px-3 py-2 text-center ${cls}`}>{v === null ? '—' : v === 1 ? 'Đạt' : 'Chưa'}</td>;
                    })}
                  </tr>
                ))}
                {hRows.length === 0 && (
                  <tr><td colSpan={1 + hCols.length} className="px-3 py-6 text-center text-gray-500">Chưa có dữ liệu.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
