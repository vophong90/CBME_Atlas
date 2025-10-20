'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Student = { mssv: string; user_id: string; full_name?: string; cohort?: string; class_name?: string };
type Rubric = { id: number; name: string; definition: any; framework_id?: string | null; course_code?: string | null };
type PendingCLO = { clo_id: string; clo_title: string; course_code: string | null };

type RubricItem = { id: string; label: string; clo_ids?: string[] };
type RubricColumn = { key: string; label: string; score?: number };

export default function TeacherTab() {
  const [tab, setTab] = useState<'evaluate'|'student'|'feedback'>('evaluate');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Giảng viên</h1>

      <div className="flex gap-2">
        <button className={`px-3 py-1 rounded-lg border ${tab==='evaluate'?'bg-gray-100':''}`} onClick={()=>setTab('evaluate')}>1) Đánh giá</button>
        <button className={`px-3 py-1 rounded-lg border ${tab==='student'?'bg-gray-100':''}`} onClick={()=>setTab('student')}>2) Thông tin sinh viên</button>
        <button className={`px-3 py-1 rounded-lg border ${tab==='feedback'?'bg-gray-100':''}`} onClick={()=>setTab('feedback')}>3) Phản hồi (GV → SV)</button>
      </div>

      {tab==='evaluate' && <EvaluatePanel />}
      {tab==='student' && <StudentPanel />}
      {tab==='feedback' && <FeedbackPanel />}
    </div>
  );
}

function EvaluatePanel() {
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [courseCode, setCourseCode] = useState<string>('');
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState<number | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);

  const [mssv, setMssv] = useState('');
  const [student, setStudent] = useState<Student | null>(null);

  const [items, setItems] = useState<Record<string, { selected_level: string; score?: number; comment?: string }>>({});
  const [overallComment, setOverallComment] = useState('');

  // fetch rubrics
  useEffect(() => {
    const p = new URLSearchParams();
    if (frameworkId) p.set('framework_id', frameworkId);
    if (courseCode) p.set('course_code', courseCode);
    fetch(`/api/teacher/rubrics?${p.toString()}`).then(r=>r.json()).then(d=>setRubrics(d.items || []));
  }, [frameworkId, courseCode]);

  // fetch rubric detail
  useEffect(() => {
    if (!rubricId) { setRubric(null); return; }
    fetch(`/api/teacher/rubrics/${rubricId}`).then(r=>r.json()).then(d=>setRubric(d.item));
  }, [rubricId]);

  const rows: RubricItem[] = useMemo(() => rubric?.definition?.rows || [], [rubric]);
  const cols: RubricColumn[] = useMemo(() => rubric?.definition?.columns || [], [rubric]);

  async function lookupStudent() {
    if (!mssv) return;
    const r = await fetch(`/api/teacher/student-lookup?mssv=${encodeURIComponent(mssv)}`);
    const d = await r.json();
    if (r.ok) setStudent(d.student);
    else { alert(d.error || 'Không tìm thấy MSSV'); setStudent(null); }
  }

  function setSelection(rowId: string, level: string) {
    setItems(s => ({ ...s, [rowId]: { ...(s[rowId]||{}), selected_level: level } }));
  }

  function setItemComment(rowId: string, comment: string) {
    setItems(s => ({ ...s, [rowId]: { ...(s[rowId]||{}), comment } }));
  }

  async function submitObservation(status: 'draft'|'submitted') {
    if (!rubric || !student) { alert('Chưa chọn Rubric / SV'); return; }
    const payload = {
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
        comment: v.comment ?? null
      }))
    };
    const r = await fetch('/api/teacher/observations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'Lỗi lưu đánh giá'); return; }
    alert(status==='submitted' ? 'Đã gửi đánh giá & cập nhật kết quả SV' : 'Đã lưu nháp');
    setItems({});
    setOverallComment('');
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <input className="border rounded-lg p-2" placeholder="Framework ID (nếu có)" value={frameworkId} onChange={e=>setFrameworkId(e.target.value)} />
        <input className="border rounded-lg p-2" placeholder="Mã học phần (VD: TM101)" value={courseCode} onChange={e=>setCourseCode(e.target.value)} />
        <select className="border rounded-lg p-2" value={rubricId ?? ''} onChange={e=>setRubricId(e.target.value?Number(e.target.value):null)}>
          <option value="">-- Chọn rubric --</option>
          {rubrics.map(r => <option key={r.id} value={r.id}>{r.name} {r.course_code ? `• ${r.course_code}`:''}</option>)}
        </select>
        <div className="flex gap-2">
          <input className="border rounded-lg p-2 flex-1" placeholder="Nhập MSSV" value={mssv} onChange={e=>setMssv(e.target.value)} />
          <button className="px-3 py-2 rounded-lg border" onClick={lookupStudent}>Tìm</button>
        </div>
      </div>

      {student && (
        <div className="p-3 border rounded-xl text-sm text-gray-700">
          <div><b>{student.full_name || 'Sinh viên'}</b> • MSSV: {student.mssv}</div>
          <div>Lớp: {student.class_name || '—'} • Khoá: {student.cohort || '—'}</div>
        </div>
      )}

      {rubric && (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">Rubric: <b>{rubric.name}</b></div>
          <div className="space-y-4">
            {rows.map((row: RubricItem) => (
              <div key={row.id} className="border rounded-xl p-3">
                <div className="font-medium">{row.label}</div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {cols.map(c => (
                    <label key={c.key} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`row_${row.id}`}
                        checked={items[row.id]?.selected_level === c.key}
                        onChange={()=>setSelection(row.id, c.key)}
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  placeholder="Nhận xét ngắn cho tiêu chí này"
                  className="mt-2 w-full border rounded-lg p-2 text-sm"
                  value={items[row.id]?.comment || ''}
                  onChange={e=>setItemComment(row.id, e.target.value)}
                />
                {row.clo_ids?.length ? (
                  <div className="mt-2 text-xs text-gray-500">Liên quan CLO: {row.clo_ids.join(', ')}</div>
                ) : null}
              </div>
            ))}
          </div>
          <div>
            <textarea
              placeholder="Nhận xét tổng quan"
              className="w-full border rounded-lg p-2"
              value={overallComment}
              onChange={e=>setOverallComment(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-lg border" onClick={()=>submitObservation('draft')}>Lưu nháp</button>
            <button className="px-4 py-2 rounded-lg border bg-gray-100" onClick={()=>submitObservation('submitted')}>Gửi đánh giá</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentPanel() {
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [courseCode, setCourseCode] = useState<string>('');
  const [mssv, setMssv] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [items, setItems] = useState<PendingCLO[]>([]);
  const [loading, setLoading] = useState(false);

  async function lookupStudent() {
    const r = await fetch(`/api/teacher/student-lookup?mssv=${encodeURIComponent(mssv)}`);
    const d = await r.json();
    if (r.ok) setStudent(d.student);
    else { alert(d.error || 'Không tìm thấy MSSV'); setStudent(null); }
  }

  async function fetchPending() {
    if (!student) { alert('Chưa có SV'); return; }
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('student_user_id', student.user_id);
      if (frameworkId) p.set('framework_id', frameworkId);
      if (courseCode) p.set('course_code', courseCode);
      const r = await fetch(`/api/teacher/student-pending-clos?${p.toString()}`);
      const d = await r.json();
      if (r.ok) setItems(d.items || []);
      else alert(d.error || 'Lỗi tải CLO chưa đạt');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-4 gap-3">
        <input className="border rounded-lg p-2" placeholder="Framework ID (nếu có)" value={frameworkId} onChange={e=>setFrameworkId(e.target.value)} />
        <input className="border rounded-lg p-2" placeholder="Mã học phần (lọc, tuỳ chọn)" value={courseCode} onChange={e=>setCourseCode(e.target.value)} />
        <div className="flex gap-2">
          <input className="border rounded-lg p-2 flex-1" placeholder="Nhập MSSV" value={mssv} onChange={e=>setMssv(e.target.value)} />
          <button className="px-3 py-2 rounded-lg border" onClick={lookupStudent}>Tìm</button>
        </div>
        <button className="px-3 py-2 rounded-lg border" onClick={fetchPending}>Tải CLO chưa đạt</button>
      </div>

      {student && (
        <div className="p-3 border rounded-xl text-sm text-gray-700">
          <div><b>{student.full_name || 'Sinh viên'}</b> • MSSV: {student.mssv}</div>
          <div>Lớp: {student.class_name || '—'} • Khoá: {student.cohort || '—'}</div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {loading && <div className="text-sm text-gray-500">Đang tải…</div>}
        {!loading && items.map(it => (
          <div key={`${it.clo_id}-${it.course_code || ''}`} className="border rounded-xl p-3">
            <div className="text-sm font-medium">{it.clo_id} — {it.clo_title}</div>
            <div className="text-xs text-gray-500 mt-1">Học phần: {it.course_code || '—'}</div>
            <div className="mt-2">
              <a className="text-xs underline cursor-pointer"
                 onClick={()=>alert('Gợi ý kế hoạch bồi dưỡng: (tùy chỉnh sau)')}>
                Gợi ý kế hoạch bồi dưỡng
              </a>
              {' '}•{' '}
              <a className="text-xs underline cursor-pointer"
                 onClick={()=>alert('Tạo phiên đánh giá: (prefill ở tab Đánh giá)')}>
                Tạo phiên đánh giá
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackPanel() {
  const [mssv, setMssv] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [message, setMessage] = useState('');
  const [moderationPass, setModerationPass] = useState<boolean | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [cloIds, setCloIds] = useState('');

  async function lookupStudent() {
    const r = await fetch(`/api/teacher/student-lookup?mssv=${encodeURIComponent(mssv)}`);
    const d = await r.json();
    if (r.ok) setStudent(d.student);
    else { alert(d.error || 'Không tìm thấy MSSV'); setStudent(null); }
  }

  async function moderate() {
    const r = await fetch('/api/teacher/feedback/moderate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const d = await r.json();
    setModerationPass(!!d?.ok);
    if (!d?.ok) alert(d?.reason || 'Không đạt kiểm duyệt');
  }

  async function send() {
    if (!student) { alert('Chưa có SV'); return; }
    const payload = {
      student_user_id: student.user_id,
      message,
      course_code: courseCode || null,
      clo_ids: cloIds ? cloIds.split(',').map(s=>s.trim()).filter(Boolean) : null
    };
    const r = await fetch('/api/teacher/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'Gửi thất bại'); return; }
    alert('Đã gửi phản hồi cho SV');
    setMessage(''); setModerationPass(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="border rounded-lg p-2 flex-1" placeholder="Nhập MSSV" value={mssv} onChange={e=>setMssv(e.target.value)} />
        <button className="px-3 py-2 rounded-lg border" onClick={lookupStudent}>Tìm</button>
      </div>

      {student && (
        <div className="p-3 border rounded-xl text-sm text-gray-700">
          <div><b>{student.full_name || 'Sinh viên'}</b> • MSSV: {student.mssv}</div>
          <div>Lớp: {student.class_name || '—'} • Khoá: {student.cohort || '—'}</div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <input className="border rounded-lg p-2" placeholder="Mã học phần (optional)" value={courseCode} onChange={e=>setCourseCode(e.target.value)} />
        <input className="border rounded-lg p-2" placeholder="CLO liên quan, cách nhau dấu phẩy" value={cloIds} onChange={e=>setCloIds(e.target.value)} />
      </div>

      <textarea className="w-full border rounded-lg p-2 min-h-[120px]" placeholder="Nội dung phản hồi (tích cực, hướng dẫn cải thiện…)"
        value={message} onChange={e=>setMessage(e.target.value)} />

      <div className="flex items-center gap-2">
        <button className="px-4 py-2 rounded-lg border" onClick={moderate}>Kiểm tra</button>
        <span className={`text-sm ${moderationPass==null?'text-gray-400': moderationPass ? 'text-green-600' : 'text-red-600'}`}>
          {moderationPass==null ? 'Chưa kiểm tra' : moderationPass ? 'Đạt kiểm duyệt ✓' : 'Chưa đạt ✗'}
        </span>
        <div className="flex-1" />
        <button
          disabled={!moderationPass}
          className={`px-4 py-2 rounded-lg border ${moderationPass ? 'bg-gray-100' : 'opacity-50 cursor-not-allowed'}`}
          onClick={send}
        >Gửi</button>
      </div>
    </div>
  );
}
