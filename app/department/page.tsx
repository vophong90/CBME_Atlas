'use client';

import { useEffect, useMemo, useState } from 'react';

/* =========================
 * Types
 * ========================= */
type Level = '1' | '2' | '3' | '4';
type Achieve = 'achieved' | 'not_yet';

type Framework = { id: string; doi_tuong?: string; chuyen_nganh?: string; nien_khoa?: string; created_at?: string };
type Course = { code: string; name?: string };

type CourseDetail = {
  course: Course;
  clos: Array<{
    clo_code: string;
    title?: string;
    pis: { pi_code: string; level: Level }[];
    plos: { plo_code: string; level: Level }[];
  }>;
};

type ResultRow = {
  mssv: string;
  course_code: string;
  clo_code: string;
  level: Level;
  status: Achieve;
  plo_code?: string;
};

type RubricCell = { id: string; label: string };
type RubricRow = { id: string; criterion: string; clo_code?: string; cells: RubricCell[] };
type Rubric = {
  id?: string;
  framework_id: string;
  course_code: string;
  title: string;
  columns: string[];
  rows: RubricRow[];
  threshold: number; // %
};

type InboxItem = { id: string; created_at: string; student_id?: string | null; target: string; text: string };

/* =========================
 * Helpers
 * ========================= */
const uid = () => Math.random().toString(36).slice(2, 10);

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function formatFw(f?: Framework) {
  if (!f) return '';
  const parts = [f.doi_tuong, f.chuyen_nganh, f.nien_khoa].filter(Boolean);
  return parts.join(' • ');
}

/* =========================
 * Page
 * ========================= */
export default function DepartmentPage() {
  const [tab, setTab] = useState<'upload' | 'courses' | 'rubrics' | 'metrics' | 'inbox'>('upload');
  const [loading, setLoading] = useState(false);

  // Framework & course
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>('');
  const selectedFw = useMemo(() => frameworks.find((f) => f.id === frameworkId), [frameworks, frameworkId]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCode, setCourseCode] = useState<string>('');

  // Upload results
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [listFilter, setListFilter] = useState<{ course_code: string; mssv: string }>({ course_code: '', mssv: '' });
  const [uploaded, setUploaded] = useState<ResultRow[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Course detail
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [detailFilter, setDetailFilter] = useState('');

  // Rubrics
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [editing, setEditing] = useState<Rubric | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<Array<{ course_code: string; clo_code: string; total: number; achieved: number; not_yet: number }>>([]);

  // Inbox
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [inboxRange, setInboxRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  /* =========================
   * Fetch base: frameworks
   * ========================= */
  async function loadFrameworks() {
    // cố gắng dùng route cũ /api/academic-affairs/framework (đã có trong dự án của bạn)
    let res = await fetch('/api/academic-affairs/framework').catch(() => null);
    if (res && res.ok) {
      const js = await res.json();
      setFrameworks(js.data || []);
      if (!frameworkId && js.data?.length) setFrameworkId(js.data[0].id);
      return;
    }
    // fallback (nếu bạn có route khác)
    const rf = await fetch('/api/frameworks').catch(() => null);
    if (rf && rf.ok) {
      const js = await rf.json();
      setFrameworks(js.data || []);
      if (!frameworkId && js.data?.length) setFrameworkId(js.data[0].id);
    }
  }

  /* =========================
   * Fetch courses by framework
   * ========================= */
  async function loadCourses() {
    if (!frameworkId) return;
    const res = await fetch(`/api/department/courses?framework_id=${frameworkId}`);
    const js = await res.json();
    if (res.ok) {
      setCourses(js.data || []);
      if (!courseCode && js.data?.length) setCourseCode(js.data[0].code);
    } else {
      alert(js.error || 'Lỗi tải học phần');
    }
  }

  /* =========================
   * Upload results & list
   * ========================= */
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
      await listUploads(); // refresh
    } catch (e: any) {
      alert(e?.message || 'Upload lỗi');
    } finally {
      setLoading(false);
    }
  }

  async function listUploads() {
    if (!frameworkId) return;
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

  /* =========================
   * Course detail
   * ========================= */
  async function loadDetail() {
    if (!frameworkId || !courseCode) {
      setDetail(null);
      return;
    }
    const res = await fetch(`/api/department/courses/${encodeURIComponent(courseCode)}/detail?framework_id=${frameworkId}`);
    const js = await res.json();
    if (res.ok) setDetail(js.data || null);
    else alert(js.error || 'Lỗi tải chi tiết học phần');
  }

  /* =========================
   * Rubrics CRUD
   * ========================= */
  function makeEmptyRubric(): Rubric {
    return {
      framework_id: frameworkId,
      course_code: courseCode || '',
      title: `Rubric ${courseCode || ''}`,
      columns: ['Mức 1', 'Mức 2', 'Mức 3', 'Mức 4'],
      rows: [
        { id: uid(), criterion: 'Tiêu chí 1', clo_code: '', cells: [uid(), uid(), uid(), uid()].map((id) => ({ id, label: '' })) },
      ],
      threshold: 70,
    };
  }

  async function loadRubrics() {
    if (!frameworkId) return;
    const p = new URLSearchParams();
    p.set('framework_id', frameworkId);
    if (courseCode) p.set('course_code', courseCode);
    const res = await fetch(`/api/department/rubrics?${p.toString()}`);
    const js = await res.json();
    if (res.ok) setRubrics(js.data || []);
  }

  async function saveRubric() {
    if (!editing) return;
    const payload = {
      id: editing.id,
      framework_id: editing.framework_id,
      course_code: editing.course_code,
      title: editing.title,
      columns: editing.columns,
      rows: editing.rows,
      threshold: editing.threshold,
    };

    const isNew = !editing.id;
    const url = '/api/department/rubrics';
    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const js = await res.json();
    if (!res.ok) {
      alert(js.error || 'Lưu rubric lỗi');
      return;
    }
    setEditing(null);
    await loadRubrics();
  }

  async function deleteRubric(id: string) {
    if (!confirm('Xoá rubric này?')) return;
    const res = await fetch(`/api/department/rubrics?id=${id}`, { method: 'DELETE' });
    const js = await res.json();
    if (!res.ok) {
      alert(js.error || 'Xoá lỗi');
      return;
    }
    await loadRubrics();
  }

  function addColumn() {
    if (!editing) return;
    const label = prompt('Tên cột/mức đánh giá mới:', `Mức ${editing.columns.length + 1}`) || '';
    if (!label) return;
    const colId = uid();
    const next = { ...editing };
    next.columns = [...next.columns, label];
    next.rows = next.rows.map((r) => ({ ...r, cells: [...r.cells, { id: uid(), label: '' }] }));
    setEditing(next);
  }

  function removeColumn(idx: number) {
    if (!editing) return;
    if (editing.columns.length <= 1) return alert('Cần tối thiểu 1 cột.');
    const next = { ...editing };
    next.columns = editing.columns.filter((_, i) => i !== idx);
    next.rows = editing.rows.map((r) => ({ ...r, cells: r.cells.filter((_, i) => i !== idx) }));
    setEditing(next);
  }

  function addRow() {
    if (!editing) return;
    const next = { ...editing };
    next.rows.push({
      id: uid(),
      criterion: `Tiêu chí ${editing.rows.length + 1}`,
      clo_code: '',
      cells: editing.columns.map(() => ({ id: uid(), label: '' })),
    });
    setEditing(next);
  }

  function removeRow(rid: string) {
    if (!editing) return;
    const next = { ...editing, rows: editing.rows.filter((r) => r.id !== rid) };
    setEditing(next);
  }

  /* =========================
   * Metrics + export
   * ========================= */
  async function loadMetrics() {
    if (!frameworkId) return;
    const p = new URLSearchParams();
    p.set('framework_id', frameworkId);
    if (courseCode) p.set('course_code', courseCode);
    const res = await fetch(`/api/department/metrics?${p.toString()}`);
    const js = await res.json();
    if (res.ok) setMetrics(js.data || []);
  }

  async function exportCSV() {
    if (!frameworkId || !courseCode) {
      alert('Chọn framework & học phần để xuất CSV.');
      return;
    }
    const res = await fetch('/api/department/metrics/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ framework_id: frameworkId, course_code: courseCode }),
    });
    if (!res.ok) {
      const txt = await res.text();
      alert(`Export lỗi: ${txt.slice(0, 200)}`);
      return;
    }
    const blob = await res.blob();
    saveBlob(blob, `results_${courseCode}.csv`);
  }

  /* =========================
   * Inbox
   * ========================= */
  async function loadInbox() {
    if (!courseCode) {
      setInbox([]);
      return;
    }
    const p = new URLSearchParams();
    p.set('course_code', courseCode);
    if (inboxRange.from) p.set('from', inboxRange.from);
    if (inboxRange.to) p.set('to', inboxRange.to);
    const res = await fetch(`/api/department/inbox?${p.toString()}`);
    const js = await res.json();
    if (res.ok) setInbox(js.data || []);
  }

  /* =========================
   * Effects
   * ========================= */
  useEffect(() => {
    loadFrameworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (frameworkId) {
      loadCourses();
      setCourseCode(''); // reset để tránh mismatch
      setDetail(null);
      setRubrics([]);
      setMetrics([]);
      setInbox([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkId]);

  useEffect(() => {
    if (tab === 'upload') listUploads();
    if (tab === 'courses') {
      loadCourses();
      if (courseCode) loadDetail();
    }
    if (tab === 'rubrics') loadRubrics();
    if (tab === 'metrics') loadMetrics();
    if (tab === 'inbox') loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'courses' && courseCode) loadDetail();
    if (tab === 'rubrics') loadRubrics();
    if (tab === 'metrics') loadMetrics();
    if (tab === 'inbox') loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseCode]);

  /* =========================
   * Render
   * ========================= */
  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* Title + global filters */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Bộ môn</h1>
            <p className="text-sm text-gray-600">Quản lý kết quả đo lường, học phần, rubric & hộp thư góp ý.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Khung chương trình</label>
              <select
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm min-w-[280px]"
              >
                <option value="">— Chọn khung —</option>
                {frameworks.map((f) => (
                  <option key={f.id} value={f.id}>
                    {formatFw(f) || f.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Học phần</label>
              <select
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm min-w-[220px]"
              >
                <option value="">— Tất cả —</option>
                {courses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}{c.name ? ` • ${c.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ['upload', '1) Upload kết quả'],
            ['courses', '2) Học phần & CLO'],
            ['rubrics', '3) Rubric'],
            ['metrics', '4) Kết quả đo lường'],
            ['inbox', '5) Hộp thư góp ý'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={
                tab === key
                  ? 'px-4 py-2 rounded-lg bg-brand-600 text-white'
                  : 'px-4 py-2 rounded-lg border hover:bg-gray-50'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 1) Upload results */}
      {tab === 'upload' && (
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tải lên kết quả đo lường</h2>
            <div className="text-xs text-gray-600">
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
                className={
                  !frameworkId || !pickedFile || loading
                    ? 'px-4 py-2 rounded-lg bg-gray-300 text-white cursor-not-allowed'
                    : 'px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700'
                }
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
              <button onClick={listUploads} className="px-3 py-2 rounded-lg border hover:bg-gray-50">
                Làm mới
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-600">Đang có <b>{uploadedCount}</b> dòng khớp bộ lọc.</div>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['MSSV','Học phần','CLO','Trạng thái','Cập nhật'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploaded.map((r, i) => (
                  <tr key={i} className="odd:bg-gray-50">
                    <td className="px-3 py-2 border-b">{(r as any).mssv}</td>
                    <td className="px-3 py-2 border-b">{r.course_code}</td>
                    <td className="px-3 py-2 border-b">{r.clo_code}</td>
                    <td className="px-3 py-2 border-b">{(r as any).status === 'achieved' ? 'Đạt' : 'Chưa đạt'}</td>
                    <td className="px-3 py-2 border-b">{(r as any).updated_at ? new Date((r as any).updated_at).toLocaleString() : ''}</td>
                  </tr>
                ))}
                {uploaded.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">Chưa có dữ liệu.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 2) Courses & details */}
      {tab === 'courses' && (
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Học phần & chi tiết CLO–PI/PLO</h2>
            <div className="flex items-center gap-2">
              <input
                placeholder="Tìm kiếm trong CLO/PI/PLO"
                className="border rounded-lg px-3 py-2 text-sm"
                value={detailFilter}
                onChange={(e) => setDetailFilter(e.target.value)}
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
                        if (!detailFilter.trim()) return true;
                        const target = `${c.clo_code} ${c.title || ''} ${c.pis.map(p => p.pi_code).join(' ')} ${c.plos.map(p => p.plo_code).join(' ')}`.toLowerCase();
                        return target.includes(detailFilter.toLowerCase());
                      })
                      .map((c) => (
                        <tr key={c.clo_code} className="odd:bg-gray-50 align-top">
                          <td className="px-3 py-2 border-b">{c.clo_code}</td>
                          <td className="px-3 py-2 border-b">{c.title || ''}</td>
                          <td className="px-3 py-2 border-b">
                            {c.pis.length ? c.pis.map((p) => (<span key={p.pi_code} className="inline-block mr-2 mb-1 rounded border px-2 py-0.5">{p.pi_code} <small className="opacity-70">({p.level})</small></span>)) : <span className="text-xs text-gray-500">—</span>}
                          </td>
                          <td className="px-3 py-2 border-b">
                            {c.plos.length ? c.plos.map((p) => (<span key={p.plo_code} className="inline-block mr-2 mb-1 rounded border px-2 py-0.5">{p.plo_code} <small className="opacity-70">({p.level})</small></span>)) : <span className="text-xs text-gray-500">—</span>}
                          </td>
                        </tr>
                      ))}
                    {detail.clos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-gray-500">Chưa có CLO.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3) Rubrics */}
      {tab === 'rubrics' && (
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quản lý Rubric</h2>
            <div className="flex items-center gap-2">
              <button onClick={loadRubrics} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Làm mới</button>
              <button
                onClick={() => setEditing(makeEmptyRubric())}
                disabled={!frameworkId}
                className={!frameworkId ? 'px-3 py-2 rounded-lg bg-gray-300 text-white cursor-not-allowed' : 'px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700'}
              >
                + Tạo rubric
              </button>
            </div>
          </div>

          {/* List */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rubrics.map((r: any) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="font-semibold">{r.title}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {r.course_code} • Ngưỡng: {r.threshold ?? 70}%
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() =>
                      setEditing({
                        id: r.id,
                        framework_id: r.framework_id,
                        course_code: r.course_code,
                        title: r.title,
                        columns: r.definition?.columns || [],
                        rows: r.definition?.rows || [],
                        threshold: r.threshold ?? 70,
                      })
                    }
                    className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                  >
                    Sửa
                  </button>
                  <button onClick={() => deleteRubric(r.id)} className="px-3 py-1.5 rounded border border-red-300 text-red-700 text-sm hover:bg-red-50">Xoá</button>
                </div>
              </div>
            ))}
            {rubrics.length === 0 && <div className="text-sm text-gray-500">Chưa có rubric.</div>}
          </div>

          {/* Editor */}
          {editing && (
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{editing.id ? 'Sửa rubric' : 'Tạo rubric'}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded border text-sm">Đóng</button>
                  <button onClick={saveRubric} className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700">Lưu</button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Khung</label>
                  <input value={formatFw(selectedFw) || editing.framework_id} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Học phần</label>
                  <input
                    value={editing.course_code}
                    onChange={(e) => setEditing((p) => p ? { ...p, course_code: e.target.value } : p)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Ví dụ: IM201"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Tiêu đề rubric</label>
                  <input
                    value={editing.title}
                    onChange={(e) => setEditing((p) => p ? { ...p, title: e.target.value } : p)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Ngưỡng đạt (%)</label>
                  <input
                    type="number" min={0} max={100}
                    value={editing.threshold}
                    onChange={(e) => setEditing((p) => p ? { ...p, threshold: Number(e.target.value) } : p)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Columns */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Cột (mức đánh giá)</div>
                  <div className="flex items-center gap-2">
                    <button onClick={addColumn} className="px-3 py-1.5 rounded border text-sm">+ Cột</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {editing.columns.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2 border rounded-lg px-2 py-1">
                      <input
                        value={col}
                        onChange={(e) => {
                          const next = { ...editing };
                          next.columns[idx] = e.target.value;
                          setEditing(next);
                        }}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      <button onClick={() => removeColumn(idx)} className="text-xs text-red-600 hover:underline">Xoá</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows grid */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Dòng (tiêu chí) & liên kết CLO</div>
                  <button onClick={addRow} className="px-3 py-1.5 rounded border text-sm">+ Dòng</button>
                </div>

                <div className="mt-2 overflow-auto border rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left border-b w-[26rem]">Tiêu chí</th>
                        <th className="px-3 py-2 text-left border-b w-[10rem]">CLO</th>
                        {editing.columns.map((c, i) => (
                          <th key={i} className="px-3 py-2 text-left border-b">{c}</th>
                        ))}
                        <th className="px-3 py-2 text-left border-b"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {editing.rows.map((r, ri) => (
                        <tr key={r.id} className="odd:bg-gray-50">
                          <td className="px-3 py-2 border-b">
                            <input
                              value={r.criterion}
                              onChange={(e) => {
                                const next = { ...editing };
                                next.rows[ri].criterion = e.target.value;
                                setEditing(next);
                              }}
                              className="w-full border rounded px-2 py-1"
                            />
                          </td>
                          <td className="px-3 py-2 border-b">
                            <input
                              value={r.clo_code || ''}
                              onChange={(e) => {
                                const next = { ...editing };
                                next.rows[ri].clo_code = e.target.value;
                                setEditing(next);
                              }}
                              className="w-full border rounded px-2 py-1"
                              placeholder="VD: CLO1"
                            />
                          </td>
                          {r.cells.map((cell, ci) => (
                            <td key={cell.id} className="px-3 py-2 border-b">
                              <input
                                value={cell.label}
                                onChange={(e) => {
                                  const next = { ...editing };
                                  next.rows[ri].cells[ci].label = e.target.value;
                                  setEditing(next);
                                }}
                                className="w-full border rounded px-2 py-1"
                                placeholder="-"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 border-b">
                            <button onClick={() => removeRow(r.id)} className="text-xs text-red-600 hover:underline">Xoá</button>
                          </td>
                        </tr>
                      ))}
                      {editing.rows.length === 0 && (
                        <tr>
                          <td colSpan={editing.columns.length + 3} className="px-3 py-6 text-center text-gray-500">Chưa có dòng.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="mt-2 text-xs text-gray-600">
                  * Quy tắc chấm: phía giảng viên sẽ nhập mức đạt cho từng tiêu chí (theo cột). Trung bình % của các tiêu chí liên kết cùng một <b>CLO</b> ≥ <b>ngưỡng</b> thì coi là <b>Đạt</b>.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4) Metrics */}
      {tab === 'metrics' && (
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Kết quả đo lường (tổng hợp)</h2>
            <div className="flex items-center gap-2">
              <button onClick={loadMetrics} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Làm mới</button>
              <button
                onClick={exportCSV}
                className="px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
              >
                Xuất CSV (MSSV × CLO)
              </button>
            </div>
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Học phần','CLO','Tổng','Đạt','Chưa đạt'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => (
                  <tr key={i} className="odd:bg-gray-50">
                    <td className="px-3 py-2 border-b">{m.course_code}</td>
                    <td className="px-3 py-2 border-b">{m.clo_code}</td>
                    <td className="px-3 py-2 border-b">{m.total}</td>
                    <td className="px-3 py-2 border-b text-emerald-700">{m.achieved}</td>
                    <td className="px-3 py-2 border-b text-rose-700">{m.not_yet}</td>
                  </tr>
                ))}
                {metrics.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">Chưa có dữ liệu.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5) Inbox */}
      {tab === 'inbox' && (
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Hộp thư góp ý (theo học phần)</h2>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={inboxRange.from}
                onChange={(e) => setInboxRange((p) => ({ ...p, from: e.target.value }))}
                className="border rounded-lg px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-600">→</span>
              <input
                type="datetime-local"
                value={inboxRange.to}
                onChange={(e) => setInboxRange((p) => ({ ...p, to: e.target.value }))}
                className="border rounded-lg px-2 py-1 text-sm"
              />
              <button onClick={loadInbox} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Lọc</button>
            </div>
          </div>

          <div className="space-y-3">
            {inbox.map((m) => (
              <div key={m.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">{m.target}</div>
                  <div className="text-xs text-gray-600">{new Date(m.created_at).toLocaleString()}</div>
                </div>
                <div className="mt-1">{m.text}</div>
                {m.student_id ? (
                  <div className="mt-1 text-xs text-gray-500">SV: {m.student_id}</div>
                ) : (
                  <div className="mt-1 text-xs text-gray-500">SV: Ẩn danh</div>
                )}
              </div>
            ))}
            {inbox.length === 0 && <div className="text-sm text-gray-500">Chưa có góp ý.</div>}
          </div>
        </section>
      )}
    </main>
  );
}
