'use client';

import { useEffect, useState } from 'react';
import { useDepartmentCtx } from '../context';

type Level = '1' | '2' | '3' | '4';
type CourseDetail = {
  course: { code: string; name?: string };
  clos: Array<{
    clo_code: string;
    title?: string;
    pis: { pi_code: string; level: Level }[];
    plos: { plo_code: string; level: Level }[];
  }>;
};

export default function CoursesPage() {
  const { frameworkId, courseCode } = useDepartmentCtx();
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [q, setQ] = useState('');

  async function loadDetail() {
    if (!frameworkId || !courseCode) { setDetail(null); return; }
    const res = await fetch(`/api/department/courses/${encodeURIComponent(courseCode)}/detail?framework_id=${frameworkId}`);
    const js = await res.json();
    if (res.ok) setDetail(js.data || null);
  }

  useEffect(() => { loadDetail(); /* eslint-disable-next-line */ }, [frameworkId, courseCode]);

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Học phần & chi tiết CLO–PI/PLO</h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="Tìm trong CLO/PI/PLO"
            className="border rounded-lg px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={loadDetail} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Làm mới</button>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="font-semibold">Học phần: {courseCode || '—'}</div>
        {!detail && <div className="text-sm text-gray-600 mt-1">Chọn học phần để xem chi tiết.</div>}

        {detail && (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left border-b">CLO</th>
                  <th className="px-3 py-2 text-left border-b">Mô tả</th>
                  <th className="px-3 py-2 text-left border-b">PI (level)</th>
                  <th className="px-3 py-2 text-left border-b">PLO (level)</th>
                </tr>
              </thead>
              <tbody>
                {detail.clos
                  .filter((c) => {
                    if (!q.trim()) return true;
                    const target = `${c.clo_code} ${c.title || ''} ${c.pis.map(p => p.pi_code).join(' ')} ${c.plos.map(p => p.plo_code).join(' ')}`.toLowerCase();
                    return target.includes(q.toLowerCase());
                  })
                  .map((c) => (
                    <tr key={c.clo_code} className="odd:bg-gray-50 align-top">
                      <td className="px-3 py-2 border-b">{c.clo_code}</td>
                      <td className="px-3 py-2 border-b">{c.title || ''}</td>
                      <td className="px-3 py-2 border-b">
                        {c.pis.length ? c.pis.map((p) => (
                          <span key={p.pi_code} className="inline-block mr-2 mb-1 rounded border px-2 py-0.5">
                            {p.pi_code} <small className="opacity-70">({p.level})</small>
                          </span>
                        )) : <span className="text-xs text-gray-500">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b">
                        {c.plos.length ? c.plos.map((p) => (
                          <span key={p.plo_code} className="inline-block mr-2 mb-1 rounded border px-2 py-0.5">
                            {p.plo_code} <small className="opacity-70">({p.level})</small>
                          </span>
                        )) : <span className="text-xs text-gray-500">—</span>}
                      </td>
                    </tr>
                  ))}
                {detail.clos.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Chưa có CLO.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
