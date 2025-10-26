// app/teacher/evaluate/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/authFetch';

type FrameworkOpt = { id: string; label: string };
type CourseOpt    = { course_code: string; course_name?: string | null };

type Rubric = {
  id: string;
  name: string; // map từ rubrics.title
  definition: {
    columns: Array<{ key: string; label: string }>;
    rows: Array<{ id: string; label: string; clo_ids?: string[] }>;
  };
  framework_id?: string | null;
  course_code?: string | null;
  threshold?: number | null;
};
type RubricItem   = Rubric['definition']['rows'][number];
type RubricColumn = Rubric['definition']['columns'][number];

type Student = { user_id: string; mssv: string; full_name?: string | null; framework_id?: string | null };

type HistoryRow = {
  id: string;
  created_at: string;
  submitted_at?: string | null;
  status: 'draft'|'submitted';
  course_code?: string | null;
  framework_id?: string | null;
  student_user_id: string;
  student_mssv?: string | null;
  student_full_name?: string | null;
  rubric_id: string;
  rubric_title?: string | null;
};

export default function TeacherEvaluatePage() {
  // ====== Bộ lọc: khung → học phần → rubric ======
  const [frameworks, setFrameworks] = useState<FrameworkOpt[]>([]);
  const [frameworkId, setFrameworkId] = useState('');
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [courseCode, setCourseCode] = useState('');
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState<string | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);

  // ====== Chọn sinh viên ======
  const [students, setStudents] = useState<Student[]>([]);
  const [studentFilter, setStudentFilter] = useState('');
  const [mssvQuick, setMssvQuick] = useState('');
  const [student, setStudent] = useState<Student | null>(null);

  // ====== Chấm rubric ======
  const [grading, setGrading] = useState<Record<string, { selected_level?: string; comment?: string }>>({});
  const [overallComment, setOverallComment] = useState('');
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [loadingRubric, setLoadingRubric] = useState(false);

  // ====== Lịch sử ======
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [histQ, setHistQ] = useState('');

  // --- load frameworks ---
  useEffect(() => {
    (async () => {
      const r = await fetch('/api/common/frameworks', { cache: 'no-store' });
      const d = await r.json();
      setFrameworks(d.items || []);
    })();
  }, []);

  // --- khi chọn framework: load courses + students và reset chain ---
  useEffect(() => {
    setCourseCode('');
    setRubricId(null);
    setRubric(null);
    setStudents([]);
    setStudent(null);
    setGrading({});
    setOverallComment('');
    setEditingObservationId(null);
    setHistory([]);

    if (!frameworkId) { setCourses([]); return; }

    (async () => {
      const p = new URLSearchParams({ framework_id: frameworkId });
      const rc = await fetch(`/api/common/courses?${p.toString()}`, { cache: 'no-store' });
      const dc = await rc.json();
      setCourses(dc.items || []);
    })();

    (async () => {
      const p = new URLSearchParams({ framework_id: frameworkId });
      const rs = await fetch(`/api/common/students?${p.toString()}`, { cache: 'no-store' });
      const ds = await rs.json();
      setStudents(ds.items || []);
    })();
  }, [frameworkId]);

  // --- khi chọn course: load rubrics & reset các phần sau ---
  useEffect(() => {
    setRubricId(null);
    setRubric(null);
    setStudent(null);
    setGrading({});
    setOverallComment('');
    setEditingObservationId(null);

    if (!frameworkId || !courseCode) { setRubrics([]); return; }
    const p = new URLSearchParams({ framework_id: frameworkId, course_code: courseCode });

    authFetch(`/api/teacher/rubrics?${p.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setRubrics(d.items || []))
      .catch(() => setRubrics([]));
  }, [frameworkId, courseCode]);

  // --- khi chọn rubric: tải chi tiết rubric ---
  useEffect(() => {
    setRubric(null);
    setStudent(null);
    setGrading({});
    setOverallComment('');
    setEditingObservationId(null);
    if (!rubricId) return;

    setLoadingRubric(true);
    authFetch(`/api/teacher/rubrics/${rubricId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setRubric(d.item || null))
      .finally(() => setLoadingRubric(false));
  }, [rubricId]);

  // --- Lịch sử (theo framework/course, có thể lọc thêm bằng q) ---
  async function loadHistory() {
    if (!frameworkId) { setHistory([]); return; }
    const p = new URLSearchParams();
    p.set('framework_id', frameworkId);
    if (courseCode) p.set('course_code', courseCode);
    if (histQ.trim()) p.set('q', histQ.trim());
    const r = await authFetch(`/api/teacher/observations?${p.toString()}`, { cache: 'no-store' });
    const d = await r.json();
    setHistory(r.ok ? (d.items || []) : []);
  }
  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [frameworkId, courseCode]);

  // --- Lọc dropdown sinh viên theo gõ nhanh ---
  const filteredStudents = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      (s.mssv || '').toLowerCase().includes(q) ||
      (s.full_name || '').toLowerCase().includes(q)
    );
  }, [students, studentFilter]);

  async function quickFindMssv() {
    if (!mssvQuick.trim()) return;
    const r = await authFetch(`/api/teacher/student-lookup?mssv=${encodeURIComponent(mssvQuick.trim())}`);
    const d = await r.json();
    if (!r.ok) return alert(d.error || 'Không tìm thấy MSSV');
    setStudent(d.student);
  }

  // --- helpers chấm ---
  const rows: RubricItem[]   = useMemo(() => rubric?.definition?.rows || [], [rubric]);
  const cols: RubricColumn[] = useMemo(() => rubric?.definition?.columns || [], [rubric]);

  function pickLevel(rowId: string, key: string) {
    setGrading(s => ({ ...s, [rowId]: { ...(s[rowId] || {}), selected_level: key } }));
  }
  function setRowComment(rowId: string, txt: string) {
    setGragingSafe(rowId, txt);
  }
  function setGragingSafe(rowId: string, txt: string) {
    setGrading(s => ({ ...s, [rowId]: { ...(s[rowId] || {}), comment: txt } }));
  }

  async function submitObservation(status: 'draft'|'submitted') {
    if (!rubric || !student) return alert('Hãy chọn rubric và sinh viên.');
    const payload = {
      id: editingObservationId || undefined,
      rubric_id: rubric.id,
      student_user_id: student.user_id,
      framework_id: frameworkId || null,
      course_code: courseCode || null,
      status,
      overall_comment: overallComment || null,
      items: Object.entries(grading).map(([item_key, v]) => ({
        item_key,
        selected_level: v.selected_level || '',
        comment: v.comment || null,
      })),
    };
    const r = await authFetch('/api/teacher/observations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) return alert(d.error || 'Lỗi lưu đánh giá');

    alert(status === 'submitted' ? 'Đã gửi đánh giá' : 'Đã lưu nháp');
    setEditingObservationId(null);
    setGrading({});
    setOverallComment('');
    await loadHistory();
  }

  function startEdit(h: HistoryRow) {
    // cố gắng đồng bộ filter để rubric hiện đúng
    if (h.framework_id) setFrameworkId(h.framework_id);
    if (h.course_code) setCourseCode(h.course_code);

    setRubricId(h.rubric_id);
    setStudent({ user_id: h.student_user_id, mssv: h.student_mssv || '', full_name: h.student_full_name || '' });
    setEditingObservationId(h.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteObs(id: string) {
    if (!confirm('Xoá bản chấm này?')) return;
    const r = await authFetch(`/api/teacher/observations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return alert(d.error || 'Xoá thất bại.');
    await loadHistory();
  }

  // ====================== UI ======================
  return (
    <section className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-4 gap-3">
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm text-slate-900"
            value={frameworkId}
            onChange={(e) => setFrameworkId(e.target.value)}
          >
            <option value="">-- Chọn khung --</option>
            {frameworks.map(f => <option key={f.id} value={f.id} className="text-slate-900">{f.label}</option>)}
          </select>

          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm text-slate-900"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            disabled={!frameworkId}
          >
            <option value="">-- Chọn học phần --</option>
            {courses.map(c => (
              <option key={c.course_code} value={c.course_code} className="text-slate-900">
                {c.course_code} — {c.course_name || c.course_code}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm text-slate-900"
            value={rubricId ?? ''}
            onChange={(e) => setRubricId(e.target.value ? String(e.target.value) : null)}
            disabled={!courseCode}
          >
            <option value="">-- Chọn rubric --</option>
            {rubrics.map(r => <option key={r.id} value={r.id} className="text-slate-900">{r.name}</option>)}
          </select>

          <div className="flex items-center">
            <span className="text-sm text-slate-600">Chọn khung & học phần</span>
          </div>
        </div>
      </div>

      {/* Student picker */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold mb-2">Chọn sinh viên để chấm</div>
        {!rubric && <div className="text-sm text-slate-500">Chọn khung, học phần và rubric trước khi chọn sinh viên.</div>}

        <div className="grid md:grid-cols-3 gap-3 mt-1">
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-2">
            <input
              placeholder="Tìm nhanh MSSV / họ tên"
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm flex-1"
              value={studentFilter}
              onChange={(e)=>setStudentFilter(e.target.value)}
              disabled={!rubric}
            />
            <select
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm text-slate-900 sm:w-80"
              value={student?.user_id ?? ''}
              onChange={(e) => {
                const sv = students.find(s => s.user_id === e.target.value) || null;
                setStudent(sv);
              }}
              disabled={!rubric}
            >
              <option value="">-- Chọn sinh viên --</option>
              {filteredStudents.map(s => (
                <option key={s.user_id} value={s.user_id} className="text-slate-900">
                  {s.mssv} — {s.full_name || 'SV'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm flex-1"
              placeholder="Nhập MSSV để tìm nhanh"
              value={mssvQuick}
              onChange={(e)=>setMssvQuick(e.target.value)}
              disabled={!rubric}
            />
            <button
              onClick={quickFindMssv}
              disabled={!rubric || !mssvQuick.trim()}
              className="h-10 px-3 rounded-xl border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Tìm
            </button>
          </div>
        </div>
      </div>

      {/* Grading form */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {!rubric && <div className="text-sm text-slate-500">Chọn rubric để bắt đầu chấm.</div>}
        {rubric && (
          <>
            <div className="mb-2 text-sm text-slate-600">
              Rubric: <b>{rubric.name}</b> {student ? <>• SV: <b>{student.full_name}</b> ({student.mssv})</> : null}
            </div>

            {loadingRubric ? (
              <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
            ) : (
              <div className="space-y-4">
                {rows.map(row => (
                  <div key={row.id} className="border border-slate-200 rounded-xl p-3">
                    <div className="font-medium">{row.label}</div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {cols.map(c => (
                        <label key={c.key} className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`row_${row.id}`}
                            checked={grading[row.id]?.selected_level === c.key}
                            onChange={() => pickLevel(row.id, c.key)}
                          />
                          <span>{c.label}</span>
                        </label>
                      ))}
                    </div>
                    <textarea
                      placeholder="Nhận xét cho tiêu chí này (tuỳ chọn)"
                      className="mt-2 w-full rounded-xl border border-slate-300 p-2 text-sm"
                      value={grading[row.id]?.comment || ''}
                      onChange={(e)=>setRowComment(row.id, e.target.value)}
                    />
                    {row.clo_ids?.length ? (
                      <div className="mt-1 text-xs text-slate-500">Liên quan CLO: {row.clo_ids.join(', ')}</div>
                    ) : null}
                  </div>
                ))}
                <div>
                  <textarea
                    placeholder="Nhận xét tổng quan"
                    className="w-full rounded-xl border border-slate-300 p-2 text-sm"
                    value={overallComment}
                    onChange={(e)=>setOverallComment(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={()=>submitObservation('draft')}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-sm hover:bg-slate-50"
                    disabled={!student}
                  >
                    Lưu nháp
                  </button>
                  <button
                    onClick={()=>submitObservation('submitted')}
                    className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm hover:opacity-95 active:scale-[0.99]"
                    disabled={!student}
                  >
                    Gửi đánh giá
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* History table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Đã chấm</div>
          <div className="flex gap-2">
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Tìm MSSV / họ tên"
              value={histQ}
              onChange={(e)=>setHistQ(e.target.value)}
            />
            <button onClick={loadHistory} className="h-10 px-3 rounded-xl border text-sm hover:bg-slate-50">Lọc</button>
          </div>
        </div>

        <div className="overflow-auto border rounded">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Thời gian','MSSV','Họ tên','Học phần','Rubric','Trạng thái','Thao tác'].map(h => (
                  <th key={h} className="px-3 py-2 text-left border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="odd:bg-gray-50">
                  <td className="px-3 py-2 border-b">{new Date(h.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 border-b">{h.student_mssv || '—'}</td>
                  <td className="px-3 py-2 border-b">{h.student_full_name || '—'}</td>
                  <td className="px-3 py-2 border-b">{h.course_code || '—'}</td>
                  <td className="px-3 py-2 border-b">{h.rubric_title || '—'}</td>
                  <td className="px-3 py-2 border-b">{h.status === 'submitted' ? 'Đã gửi' : 'Nháp'}</td>
                  <td className="px-3 py-2 border-b">
                    <div className="flex gap-2">
                      <button className="text-blue-700 hover:underline" onClick={()=>startEdit(h)}>Sửa</button>
                      <button className="text-red-700 hover:underline" onClick={()=>deleteObs(h.id)}>Xoá</button>
                    </div>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Chưa có bản chấm nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
