// app/teacher/evaluate/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

/** ========= Types ========= */
type Student = {
  mssv: string;
  user_id: string;
  full_name?: string;
  cohort?: string;
  class_name?: string;
};

type RubricColumn = { key: string; label: string; score?: number };
type RubricItem = { id: string; label: string; clo_ids?: string[] };
type Rubric = {
  id: number;
  name: string;                      // tiêu đề rubric
  definition: { columns: RubricColumn[]; rows: RubricItem[] };
  framework_id?: string | null;
  course_code?: string | null;
};

type GradeState = Record<
  string, // row.id
  { selected_level: string; score?: number; comment?: string }
>;

type ObservationListItem = {
  id: string;
  created_at: string;
  status?: 'draft' | 'submitted';
  student_mssv: string;
  student_full_name?: string | null;
  rubric_title: string;
  course_code?: string | null;
};

type ObservationDetail = {
  id: string;
  rubric_id: number;
  rubric_title?: string;
  course_code?: string | null;
  framework_id?: string | null;
  student_user_id: string;
  student_mssv?: string;
  student_full_name?: string;
  status: 'draft' | 'submitted';
  overall_comment?: string | null;
  items: Array<{ item_key: string; selected_level: string; score?: number | null; comment?: string | null }>;
};

/** ========= Component ========= */
export default function TeacherEvaluatePage() {
  /** ------- Filters ------- */
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [courseCode, setCourseCode] = useState<string>('');

  /** ------- Rubrics ------- */
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState<number | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRubric, setLoadingRubric] = useState(false);

  /** ------- Student pick ------- */
  const [studentQ, setStudentQ] = useState('');       // tìm theo MSSV/họ tên
  const [searchingStu, setSearchingStu] = useState(false);
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);

  /** ------- Grading state ------- */
  const [items, setItems] = useState<GradeState>({});
  const [overallComment, setOverallComment] = useState('');
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null); // nếu đang sửa

  /** ------- History table ------- */
  const [hist, setHist] = useState<ObservationListItem[]>([]);
  const [histQ, setHistQ] = useState('');   // tìm riêng bảng “Đã chấm”
  const [loadingHist, setLoadingHist] = useState(false);

  /** ========= Load rubrics list ========= */
  useEffect(() => {
    const run = async () => {
      setLoadingList(true);
      try {
        const p = new URLSearchParams();
        if (frameworkId) p.set('framework_id', frameworkId);
        if (courseCode) p.set('course_code', courseCode);
        const r = await fetch(`/api/teacher/rubrics?${p.toString()}`, { cache: 'no-store' });
        const d = await r.json();
        setRubrics(r.ok ? (d.items || []) : []);
      } finally {
        setLoadingList(false);
      }
    };
    run();
  }, [frameworkId, courseCode]);

  /** ========= Load rubric detail when pick ========= */
  useEffect(() => {
    const run = async () => {
      setRubric(null);
      setItems({});
      setOverallComment('');
      setStudent(null);
      setStudentResults([]);
      setEditingObservationId(null);

      if (!rubricId) return;
      setLoadingRubric(true);
      try {
        const r = await fetch(`/api/teacher/rubrics/${rubricId}`, { cache: 'no-store' });
        const d = await r.json();
        if (r.ok) setRubric(d.item || null);
      } finally {
        setLoadingRubric(false);
      }
    };
    run();
  }, [rubricId]);

  const rows: RubricItem[] = useMemo(() => rubric?.definition?.rows || [], [rubric]);
  const cols: RubricColumn[] = useMemo(() => rubric?.definition?.columns || [], [rubric]);

  /** ========= Student search (only after rubric selected) ========= */
  async function searchStudents() {
    if (!rubricId) return; // chặn khi chưa chọn rubric
    const q = studentQ.trim();
    if (!q) { setStudentResults([]); return; }
    setSearchingStu(true);
    try {
      const p = new URLSearchParams();
      if (frameworkId) p.set('framework_id', frameworkId);
      p.set('q', q); // backend: tìm theo mssv hoặc họ tên
      const r = await fetch(`/api/teacher/students?${p.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      setStudentResults(r.ok ? (d.items || []) : []);
    } finally {
      setSearchingStu(false);
    }
  }

  /** ========= Actions on rubric grading ========= */
  function setSelection(rowId: string, level: string) {
    setItems(s => ({ ...s, [rowId]: { ...(s[rowId] || {}), selected_level: level } }));
  }
  function setItemComment(rowId: string, comment: string) {
    setItems(s => ({ ...s, [rowId]: { ...(s[rowId] || {}), comment } }));
  }

  async function submitObservation(status: 'draft' | 'submitted') {
    if (!rubric || !student) { alert('Chưa chọn Rubric / Sinh viên'); return; }
    const payload = {
      id: editingObservationId || undefined,        // nếu đang sửa thì gửi kèm id
      rubric_id: rubric.id,
      student_user_id: student.user_id,
      framework_id: frameworkId || null,
      course_code: courseCode || null,
      status,
      overall_comment: overallComment || null,
      items: Object.entries(items).map(([item_key, v]) => ({
        item_key,
        selected_level: v.selected_level,
        score: v.score ?? null,
        comment: v.comment ?? null,
      })),
    };

    const method = editingObservationId ? 'PATCH' : 'POST';
    const r = await fetch('/api/teacher/observations', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'Lỗi lưu đánh giá'); return; }

    alert(status === 'submitted' ? 'Đã gửi đánh giá & cập nhật kết quả SV' : (editingObservationId ? 'Đã cập nhật nháp' : 'Đã lưu nháp'));
    setEditingObservationId(null);
    await Promise.all([reloadHistory(), reloadRubricAfterSave()]);
  }

  // sau khi lưu có thể muốn giữ nguyên rubric hoặc refresh state; ở đây chỉ reload bảng lịch sử
  async function reloadHistory() {
    await loadHistory(); // gọi hàm bên dưới
  }
  async function reloadRubricAfterSave() {
    // giữ nguyên state lựa chọn để GV có thể tiếp tục chấm SV khác
    setStudent(null);
    setStudentQ('');
    setStudentResults([]);
  }

  /** ========= History: list teacher's observations ========= */
  async function loadHistory() {
    setLoadingHist(true);
    try {
      const p = new URLSearchParams();
      if (frameworkId) p.set('framework_id', frameworkId);
      if (courseCode) p.set('course_code', courseCode);
      if (histQ.trim()) p.set('q', histQ.trim()); // tìm theo MSSV/tên ở bảng lịch sử
      const r = await fetch(`/api/teacher/observations?${p.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      setHist(r.ok ? (d.items || []) : []);
    } finally {
      setLoadingHist(false);
    }
  }
  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [frameworkId, courseCode]);

  async function editObservation(id: string) {
    // nạp chi tiết quan sát -> đưa vào form chấm để sửa
    const r = await fetch(`/api/teacher/observations/${encodeURIComponent(id)}`, { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok || !d.item) { alert(d.error || 'Không tải được bản chấm'); return; }
    const obs: ObservationDetail = d.item;

    // đảm bảo rubric hiện hành đúng với observation (nếu khác -> load rubric đó)
    if (!rubric || rubric.id !== obs.rubric_id) {
      setRubricId(obs.rubric_id);
      // đợi rubric load xong mới set tiếp state — đơn giản nhất: poll ngắn
      const waitRubric = async () => {
        for (let i = 0; i < 30; i++) { // ~3s
          await new Promise(res => setTimeout(res, 100));
          if (rubric && rubric.id === obs.rubric_id) break;
        }
      };
      await waitRubric();
    }

    // set student
    setStudent({
      user_id: obs.student_user_id,
      mssv: obs.student_mssv || '',
      full_name: obs.student_full_name || undefined,
    });

    // map items
    const next: GradeState = {};
    (obs.items || []).forEach(it => {
      next[it.item_key] = {
        selected_level: it.selected_level,
        score: it.score ?? undefined,
        comment: it.comment ?? undefined,
      };
    });
    setItems(next);
    setOverallComment(obs.overall_comment || '');
    setEditingObservationId(obs.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteObservation(id: string) {
    if (!confirm('Xoá bản chấm này?')) return;
    const r = await fetch(`/api/teacher/observations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'Xoá lỗi'); return; }
    await loadHistory();
  }

  /** ========= Render ========= */
  return (
    <section className="space-y-6">
      {/* ===== Filters: Framework & Course & Rubric ===== */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Framework ID"
            value={frameworkId}
            onChange={(e) => setFrameworkId(e.target.value)}
          />
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Mã học phần (VD: TM101)"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
          />
          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={rubricId ?? ''}
            onChange={(e) => setRubricId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">-- Chọn rubric --</option>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}{r.course_code ? ` • ${r.course_code}` : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center text-sm text-slate-500">
            {loadingList ? 'Đang tải rubrics…' : (rubrics.length ? `${rubrics.length} rubric` : 'Không có rubric')}
          </div>
        </div>
      </div>

      {/* ===== Student picker: chỉ hiển thị khi đã chọn rubric ===== */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold">Chọn sinh viên để chấm</div>
        {!rubricId && (
          <div className="text-sm text-slate-500">Chọn rubric trước khi tìm sinh viên.</div>
        )}
        {rubricId && (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 md:flex-1"
                placeholder="Tìm theo MSSV hoặc họ tên"
                value={studentQ}
                onChange={(e) => setStudentQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchStudents(); }}
              />
              <button
                className="rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
                onClick={searchStudents}
                disabled={searchingStu}
              >
                {searchingStu ? 'Đang tìm…' : 'Tìm'}
              </button>
            </div>

            {/* Selected student card */}
            {student && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
                <div><b>{student.full_name || 'Sinh viên'}</b> • MSSV: {student.mssv}</div>
                <div className="text-slate-500">Lớp: {student.class_name || '—'} • Khoá: {student.cohort || '—'}</div>
              </div>
            )}

            {/* Search results */}
            {studentResults.length > 0 && (
              <div className="mt-3 overflow-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left">MSSV</th>
                      <th className="border-b px-3 py-2 text-left">Họ tên</th>
                      <th className="border-b px-3 py-2 text-left">Lớp/Khoá</th>
                      <th className="border-b px-3 py-2 text-left w-32">Chọn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentResults.map((s) => (
                      <tr key={s.user_id} className="odd:bg-gray-50">
                        <td className="border-b px-3 py-2">{s.mssv}</td>
                        <td className="border-b px-3 py-2">{s.full_name || '—'}</td>
                        <td className="border-b px-3 py-2">{s.class_name || '—'} / {s.cohort || '—'}</td>
                        <td className="border-b px-3 py-2">
                          <button
                            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                            onClick={() => { setStudent(s); setStudentResults([]); }}
                          >
                            Chọn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== Rubric grading ===== */}
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {loadingRubric && (
          <div className="space-y-3">
            <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 p-3">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-64 rounded bg-slate-200" />
                <div className="mt-2 h-24 w-full rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {!loadingRubric && !rubric && (
          <div className="text-sm text-slate-500">
            {loadingList ? 'Đang tải danh sách rubric…' : 'Chọn một rubric để bắt đầu chấm.'}
          </div>
        )}

        {!loadingRubric && rubric && (
          <>
            <div className="text-sm text-slate-500">
              Rubric: <b>{rubric.name}</b> {rubric.course_code ? `• ${rubric.course_code}` : ''}
              {editingObservationId ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-800">Đang sửa</span> : null}
            </div>

            {/* rows */}
            <div className="space-y-4">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="font-medium">{row.label}</div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {cols.map((c) => (
                      <label key={c.key} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`row_${row.id}`}
                          checked={items[row.id]?.selected_level === c.key}
                          onChange={() => setSelection(row.id, c.key)}
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                  <textarea
                    placeholder="Nhận xét ngắn cho tiêu chí này"
                    className="mt-2 w-full rounded-xl border border-slate-300 p-2 text-sm"
                    value={items[row.id]?.comment || ''}
                    onChange={(e) => setItemComment(row.id, e.target.value)}
                  />
                  {row.clo_ids?.length ? (
                    <div className="mt-2 text-xs text-slate-500">Liên quan CLO: {row.clo_ids.join(', ')}</div>
                  ) : null}
                </div>
              ))}
              {rows.length === 0 && (
                <div className="text-sm text-slate-500">Rubric chưa có tiêu chí.</div>
              )}
            </div>

            <div>
              <textarea
                placeholder="Nhận xét tổng quan"
                className="w-full rounded-xl border border-slate-300 p-2"
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50"
                onClick={() => submitObservation('draft')}
                disabled={!student}
                title={!student ? 'Chọn sinh viên trước' : ''}
              >
                {editingObservationId ? 'Cập nhật nháp' : 'Lưu nháp'}
              </button>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:opacity-95 active:scale-[0.99]"
                onClick={() => submitObservation('submitted')}
                disabled={!student}
                title={!student ? 'Chọn sinh viên trước' : ''}
              >
                {editingObservationId ? 'Cập nhật & Gửi' : 'Gửi đánh giá'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== History / Past observations ===== */}
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-base font-semibold">Đã chấm</div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <input
              placeholder="Tìm MSSV / họ tên"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:w-72"
              value={histQ}
              onChange={(e) => setHistQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadHistory(); }}
            />
            <button onClick={loadHistory} className="rounded-xl border px-3 py-2 hover:bg-gray-50">
              {loadingHist ? 'Đang lọc…' : 'Lọc'}
            </button>
          </div>
        </div>

        <div className="overflow-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b px-3 py-2 text-left">Thời gian</th>
                <th className="border-b px-3 py-2 text-left">MSSV</th>
                <th className="border-b px-3 py-2 text-left">Họ tên</th>
                <th className="border-b px-3 py-2 text-left">Học phần</th>
                <th className="border-b px-3 py-2 text-left">Rubric</th>
                <th className="border-b px-3 py-2 text-left">Trạng thái</th>
                <th className="w-40 border-b px-3 py-2 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {hist.map((h) => (
                <tr key={h.id} className="odd:bg-gray-50">
                  <td className="border-b px-3 py-2">{new Date(h.created_at).toLocaleString()}</td>
                  <td className="border-b px-3 py-2">{h.student_mssv}</td>
                  <td className="border-b px-3 py-2">{h.student_full_name || '—'}</td>
                  <td className="border-b px-3 py-2">{h.course_code || '—'}</td>
                  <td className="border-b px-3 py-2">{h.rubric_title}</td>
                  <td className="border-b px-3 py-2">{h.status === 'submitted' ? 'Đã gửi' : 'Nháp'}</td>
                  <td className="border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                        onClick={() => editObservation(h.id)}
                      >
                        Sửa
                      </button>
                      <button
                        className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                        onClick={() => deleteObservation(h.id)}
                      >
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {hist.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                    {loadingHist ? 'Đang tải…' : 'Chưa có bản chấm nào.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
