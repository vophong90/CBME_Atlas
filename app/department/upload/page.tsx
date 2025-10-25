// app/department/upload/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDepartmentCtx } from '../context';

type ResultRow = {
  id: string;
  mssv: string;
  student_full_name?: string | null;
  course_code: string;
  course_name?: string | null;
  clo_code: string;
  status: 'achieved' | 'not_yet';
  updated_at?: string | null;
};

type CourseOpt = { course_code: string; course_name?: string | null };

function toLabelStatus(s: 'achieved' | 'not_yet') {
  return s === 'achieved' ? 'Đạt' : 'Không đạt';
}
function normalizeResult(input: string): 'achieved' | 'not_yet' {
  const s = (input || '').toLowerCase().trim();
  if (['achieved', 'dat', 'đạt', 'pass', 'passed', '1', 'true'].includes(s)) return 'achieved';
  return 'not_yet';
}

export default function UploadPage() {
  const { frameworkId } = useDepartmentCtx();

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState<ResultRow[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);

  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>(''); // filter + upload helper
  const [mssvFilter, setMssvFilter] = useState('');

  // ====== load courses for dropdown ======
  useEffect(() => {
    async function loadCourses() {
      if (!frameworkId) { setCourses([]); return; }
      const p = new URLSearchParams({ framework_id: frameworkId, kind: 'courses' });
      const res = await fetch(`/api/academic-affairs/list?${p.toString()}`, { cache: 'no-store' });
      const js = await res.json();
      if (res.ok && Array.isArray(js.data)) {
        setCourses(js.data as CourseOpt[]);
      } else {
        setCourses([]);
      }
    }
    loadCourses();
  }, [frameworkId]);

  // ====== upload CSV ======
  async function doUpload() {
    if (!frameworkId || !pickedFile) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('framework_id', frameworkId);
      fd.append('file', pickedFile);
      // server chấp nhận header có thể là "Kết quả" hoặc "Trạng thái"
      const res = await fetch('/api/department/results/upload', { method: 'POST', body: fd });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Upload lỗi');
      alert(`Đã tải ${js.inserted} dòng.`);
      setPickedFile(null);
      await listUploads(); // refresh
    } catch (e: any) {
      alert(e?.message || 'Upload lỗi');
    } finally {
      setLoading(false);
    }
  }

  // ====== list uploaded ======
  async function listUploads() {
    if (!frameworkId) { setUploaded([]); setUploadedCount(0); return; }
    const p = new URLSearchParams();
    p.set('framework_id', frameworkId);
    if (selectedCourse) p.set('course_code', selectedCourse);
    if (mssvFilter) p.set('mssv', mssvFilter.trim());
    const res = await fetch(`/api/department/results/list?${p.toString()}`, { cache: 'no-store' });
    const js = await res.json();
    if (res.ok) {
      setUploaded(js.data || []);
      setUploadedCount(js.count || (js.data?.length ?? 0));
    } else {
      setUploaded([]); setUploadedCount(0);
    }
  }
  useEffect(() => { listUploads(); /* eslint-disable-next-line */ }, [frameworkId]);

  // ====== inline update (result) ======
  async function updateResult(id: string, next: 'achieved' | 'not_yet') {
    try {
      const res = await fetch('/api/department/results/item', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, result: next }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Cập nhật lỗi');

      setUploaded((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: next, updated_at: new Date().toISOString() } : r))
      );
    } catch (e: any) {
      alert(e?.message || 'Cập nhật lỗi');
    }
  }

  // ====== delete row ======
  async function deleteRow(id: string) {
    if (!confirm('Xoá dòng này?')) return;
    try {
      const res = await fetch(`/api/department/results/item?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Xoá lỗi');
      setUploaded((prev) => prev.filter((r) => r.id !== id));
      setUploadedCount((c) => Math.max(0, c - 1));
    } catch (e: any) {
      alert(e?.message || 'Xoá lỗi');
    }
  }

  const courseMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of courses) m.set(c.course_code, c.course_name || c.course_code);
    return m;
  }, [courses]);

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-semibold">Tải lên kết quả đo lường CLO</h2>
        <div className="text-xs text-slate-600">
          CSV cột: <b>MSSV, Mã học phần, Mã CLO, Kết quả(Đạt|Không đạt)</b> • chấp nhận <i>achieved/not_yet</i>.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* file + upload */}
        <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setPickedFile(e.target.files?.[0] || null)}
            className="block w-full"
            disabled={!frameworkId}
          />
          <button
            onClick={doUpload}
            disabled={!frameworkId || !pickedFile || loading}
            className={`px-4 py-2 rounded-lg text-white ${(!frameworkId || !pickedFile || loading)
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-700'}`}
          >
            {loading ? 'Đang tải...' : 'Tải lên'}
          </button>
        </div>

        {/* filter row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <input
            placeholder="Lọc MSSV"
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-40"
            value={mssvFilter}
            onChange={(e) => setMssvFilter(e.target.value)}
          />
          <select
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-56"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="">— Tất cả học phần —</option>
            {courses.map((c) => (
              <option key={c.course_code} value={c.course_code}>
                {c.course_code} — {c.course_name || c.course_code}
              </option>
            ))}
          </select>
          <button onClick={listUploads} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Làm mới</button>
        </div>
      </div>

      <div className="text-sm text-slate-600">
        Đang có <b>{uploadedCount}</b> dòng khớp bộ lọc.
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['MSSV','Họ tên sinh viên','Học phần','Mã CLO','Kết quả','Cập nhật',''].map((h) => (
                <th key={h} className="px-3 py-2 text-left border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uploaded.map((r) => (
              <tr key={r.id} className="odd:bg-gray-50">
                <td className="px-3 py-2 border-b">{r.mssv}</td>
                <td className="px-3 py-2 border-b">{r.student_full_name || '—'}</td>
                <td className="px-3 py-2 border-b">
                  {r.course_code} — {r.course_name || courseMap.get(r.course_code) || '—'}
                </td>
                <td className="px-3 py-2 border-b">{r.clo_code}</td>
                <td className="px-3 py-2 border-b">
                  <select
                    className="border rounded px-2 py-1"
                    value={r.status}
                    onChange={(e) => updateResult(r.id, normalizeResult(e.target.value))}
                  >
                    <option value="achieved">Đạt</option>
                    <option value="not_yet">Không đạt</option>
                  </select>
                </td>
                <td className="px-3 py-2 border-b">
                  {r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}
                </td>
                <td className="px-3 py-2 border-b">
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => deleteRow(r.id)}
                    title="Xoá dòng"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {uploaded.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Chưa có dữ liệu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
