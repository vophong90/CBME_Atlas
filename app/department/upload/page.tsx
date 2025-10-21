'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDepartmentCtx } from '../context';

type ResultRow = {
  mssv: string;
  course_code: string;
  clo_code: string;
  status: 'achieved' | 'not_yet';
  updated_at?: string;
};

export default function UploadPage() {
  const { frameworkId } = useDepartmentCtx();

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState<ResultRow[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [listFilter, setListFilter] = useState<{ course_code: string; mssv: string }>({ course_code: '', mssv: '' });

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

  async function listUploads() {
    if (!frameworkId) { setUploaded([]); setUploadedCount(0); return; }
    const p = new URLSearchParams();
    p.set('framework_id', frameworkId);
    if (listFilter.course_code) p.set('course_code', listFilter.course_code);
    if (listFilter.mssv) p.set('mssv', listFilter.mssv);
    const res = await fetch(`/api/department/results/list?${p.toString()}`);
    const js = await res.json();
    if (res.ok) {
      setUploaded(js.data || []);
      setUploadedCount(js.count || 0);
    }
  }

  useEffect(() => { listUploads(); /* eslint-disable-next-line */ }, [frameworkId]);

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tải lên kết quả đo lường</h2>
        <div className="text-xs text-slate-600">
          CSV cột: <b>MSSV, Mã học phần, Mã CLO, Trạng thái(achieved|not_yet)</b> (có thể kèm PLO/Level)
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2 flex items-center gap-2">
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
            className={!frameworkId || !pickedFile || loading
              ? 'px-4 py-2 rounded-lg bg-gray-300 text-white cursor-not-allowed'
              : 'px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700'}
          >
            Tải lên
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <input
            placeholder="Lọc MSSV"
            className="border rounded-lg px-3 py-2 text-sm"
            value={listFilter.mssv}
            onChange={(e) => setListFilter((p) => ({ ...p, mssv: e.target.value }))}
          />
          <input
            placeholder="Lọc học phần"
            className="border rounded-lg px-3 py-2 text-sm"
            value={listFilter.course_code}
            onChange={(e) => setListFilter((p) => ({ ...p, course_code: e.target.value }))}
          />
          <button onClick={listUploads} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Làm mới</button>
        </div>
      </div>

      <div className="text-sm text-slate-600">Đang có <b>{uploadedCount}</b> dòng khớp bộ lọc.</div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{['MSSV','Học phần','CLO','Trạng thái','Cập nhật'].map((h) => (<th key={h} className="px-3 py-2 text-left border-b">{h}</th>))}</tr>
          </thead>
          <tbody>
            {uploaded.map((r, i) => (
              <tr key={i} className="odd:bg-gray-50">
                <td className="px-3 py-2 border-b">{r.mssv}</td>
                <td className="px-3 py-2 border-b">{r.course_code}</td>
                <td className="px-3 py-2 border-b">{r.clo_code}</td>
                <td className="px-3 py-2 border-b">{r.status === 'achieved' ? 'Đạt' : 'Chưa đạt'}</td>
                <td className="px-3 py-2 border-b">{r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td>
              </tr>
            ))}
            {uploaded.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Chưa có dữ liệu.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
