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

function normalizeResult(input: string): 'achieved' | 'not_yet' {
  const s = (input || '').toLowerCase().trim();
  if (['achieved','đạt','dat','pass','passed','1','true'].includes(s)) return 'achieved';
  return 'not_yet';
}
const labelStatus = (s: 'achieved' | 'not_yet') => (s === 'achieved' ? 'Đạt' : 'Không đạt');

export default function UploadPage() {
  const { frameworkId, courseCode } = useDepartmentCtx();

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [keyword, setKeyword] = useState(''); // MSSV hoặc Họ tên

  // ===== upload CSV =====
  async function doUpload() {
    if (!frameworkId || !pickedFile) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('framework_id', frameworkId);
      fd.append('file', pickedFile);
      const res = await fetch('/api/department/results/upload', { method: 'POST', body: fd });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Upload lỗi');
      alert(`Đã tải ${js.inserted} dòng.`);
      setPickedFile(null);
      await listUploads();
    } catch (e: any) {
      alert(e?.message || 'Upload lỗi');
    } finally {
      setLoading(false);
    }
  }

  // ===== list uploads (lọc theo framework + courseCode từ header) =====
  async function listUploads() {
    if (!frameworkId) { setRows([]); return; }
    const p = new URLSearchParams();
    p.set('framework_id', frameworkId);
    if (courseCode) p.set('course_code', courseCode);

    const res = await fetch(`/api/department/results/list?${p.toString()}`, { cache: 'no-store' });
    const js = await res.json();
    if (res.ok) setRows(js.data || []);
    else setRows([]);
  }
  useEffect(() => { listUploads(); /* eslint-disable-next-line */ }, [frameworkId, courseCode]);

  // ===== client-side filter theo MSSV hoặc Họ tên =====
  const filtered = useMemo(() => {
    const kw = (keyword || '').toLowerCase().trim();
    if (!kw) return rows;
    return rows.filter(r =>
      r.mssv?.toLowerCase().includes(kw) ||
      (r.student_full_name || '').toLowerCase().includes(kw)
    );
  }, [rows, keyword]);

  // ===== inline update / delete =====
  async function updateResult(id: string, next: 'achieved' | 'not_yet') {
    try {
      const res = await fetch('/api/department/results/item', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, result: next }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Cập nhật lỗi');
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: next, updated_at: new Date().toISOString() } : r));
    } catch (e: any) {
      alert(e?.message || 'Cập nhật lỗi');
    }
  }

  async function deleteRow(id: string) {
    if (!confirm('Xoá dòng này?')) return;
    try {
      const res = await fetch(`/api/department/results/item?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Xoá lỗi');
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Xoá lỗi');
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      {/* header + hướng dẫn */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-semibold">Tải lên kết quả đo lường CLO</h2>
        <div className="text-xs text-slate-600 md:text-right">
          CSV cột: <b>MSSV, Mã học phần, Mã CLO, Kết quả (Đạt|Không đạt)</b> • cũng chấp nhận <i>achieved/not_yet</i>.
        </div>
      </div>

      {/* hàng điều khiển: 2 cột gọn, tránh “vỡ” */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 items-start">
        {/* cột 1-2: file + nút */}
        <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setPickedFile(e.target.files?.[0] || null)}
            className="block w-full bg-white text-slate-900"
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

        {/* cột 3: chỉ còn ô tìm theo MSSV/Họ tên + nút làm mới */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <input
            placeholder="Tìm MSSV / Họ tên"
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 sm:w-64"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button onClick={listUploads} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
            Làm mới
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-600">
        Đang có <b>{filtered.length}</b> dòng khớp bộ lọc{courseCode ? <> (Học phần: <i>{courseCode}</i>)</> : null}.
      </div>

      {/* bảng: giữ min width để không “bể” cột */}
      <div className="overflow-auto border rounded">
        <table className="min-w-[920px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['MSSV','Họ tên sinh viên','Học phần','Mã CLO','Kết quả','Cập nhật',''].map((h) => (
                <th key={h} className="border-b px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="odd:bg-gray-50">
                <td className="border-b px-3 py-2">{r.mssv}</td>
                <td className="border-b px-3 py-2">{r.student_full_name || '—'}</td>
                <td className="border-b px-3 py-2">
                  {r.course_code} — {r.course_name || '—'}
                </td>
                <td className="border-b px-3 py-2">{r.clo_code}</td>
                <td className="border-b px-3 py-2">
                  <select
                    className="rounded border bg-white px-2 py-1 text-slate-900"
                    value={r.status}
                    onChange={(e) => updateResult(r.id, normalizeResult(e.target.value))}
                  >
                    <option value="achieved">Đạt</option>
                    <option value="not_yet">Không đạt</option>
                  </select>
                </td>
                <td className="border-b px-3 py-2">{r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td>
                <td className="border-b px-3 py-2">
                  <button className="text-red-600 hover:underline" onClick={() => deleteRow(r.id)}>
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
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
