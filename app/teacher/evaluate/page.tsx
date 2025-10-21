'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Student = { mssv: string; user_id: string; full_name?: string; cohort?: string; class_name?: string };
type Rubric = { id: number; name: string; definition: any; framework_id?: string | null; course_code?: string | null };
type RubricItem = { id: string; label: string; clo_ids?: string[] };
type RubricColumn = { key: string; label: string; score?: number };

export default function TeacherEvaluatePage() {
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [courseCode, setCourseCode] = useState<string>('');
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState<number | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRubric, setLoadingRubric] = useState(false);

  const [mssv, setMssv] = useState('');
  const [student, setStudent] = useState<Student | null>(null);

  const [items, setItems] = useState<Record<string, { selected_level: string; score?: number; comment?: string }>>({});
  const [overallComment, setOverallComment] = useState('');

  // fetch rubrics
  useEffect(() => {
    const p = new URLSearchParams();
    if (frameworkId) p.set('framework_id', frameworkId);
    if (courseCode) p.set('course_code', courseCode);
    setLoadingList(true);
    fetch(`/api/teacher/rubrics?${p.toString()}`)
      .then(r=>r.json()).then(d=>setRubrics(d.items || []))
      .finally(()=>setLoadingList(false));
  }, [frameworkId, courseCode]);

  // fetch rubric detail
  useEffect(() => {
    if (!rubricId) { setRubric(null); return; }
    setLoadingRubric(true);
    fetch(`/api/teacher/rubrics/${rubricId}`)
      .then(r=>r.json()).then(d=>setRubric(d.item))
      .finally(()=>setLoadingRubric(false));
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
    setItems({}); setOverallComment('');
  }

  return (
    <section className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-4 gap-3">
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Framework ID (nếu có)" value={frameworkId} onChange={e=>setFrameworkId(e.target.value)} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Mã học phần (VD: TM101)" value={courseCode} onChange={e=>setCourseCode(e.target.value)} />
          <select className="rounded-xl border border-slate-300 px-3 py-2" value={rubricId ?? ''} onChange={e=>setRubricId(e.target.value?Number(e.target.value):null)}>
            <option value="">-- Chọn rubric --</option>
            {rubrics.map(r => <option key={r.id} value={r.id}>{r.name} {r.course_code ? `• ${r.course_code}`:''}</option>)}
          </select>
          <div className="flex gap-2">
            <input className="rounded-xl border border-slate-300 px-3 py-2 flex-1" placeholder="Nhập MSSV" value={mssv} onChange={e=>setMssv(e.target.value)} />
            <button className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50" onClick={lookupStudent}>Tìm</button>
          </div>
        </div>
      </div>

      {/* Student card */}
      {student && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
          <div><b>{student.full_name || 'Sinh viên'}</b> • MSSV: {student.mssv}</div>
          <div className="text-slate-500">Lớp: {student.class_name || '—'} • Khoá: {student.cohort || '—'}</div>
        </div>
      )}

      {/* Rubric skeleton / detail */}
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {loadingRubric && (
          <div className="space-y-3">
            <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
            {Array.from({length:4}).map((_,i)=>(
              <div key={i} className="border border-slate-200 rounded-xl p-3 animate-pulse">
                <div className="h-4 w-40 bg-slate-200 rounded" />
                <div className="mt-2 h-4 w-64 bg-slate-200 rounded" />
                <div className="mt-2 h-24 w-full bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {!loadingRubric && !rubric && (
          <div className="text-sm text-slate-500">{loadingList ? 'Đang tải danh sách rubric…' : 'Chọn một rubric để bắt đầu chấm.'}</div>
        )}

        {!loadingRubric && rubric && (
          <>
            <div className="text-sm text-slate-500">Rubric: <b>{rubric.name}</b></div>
            <div className="space-y-4">
              {rows.map((row: RubricItem) => (
                <div key={row.id} className="border border-slate-200 rounded-xl p-3">
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
                    className="mt-2 w-full rounded-xl border border-slate-300 p-2 text-sm"
                    value={items[row.id]?.comment || ''}
                    onChange={e=>setItemComment(row.id, e.target.value)}
                  />
                  {row.clo_ids?.length ? (
                    <div className="mt-2 text-xs text-slate-500">Liên quan CLO: {row.clo_ids.join(', ')}</div>
                  ) : null}
                </div>
              ))}
            </div>
            <div>
              <textarea
                placeholder="Nhận xét tổng quan"
                className="w-full rounded-xl border border-slate-300 p-2"
                value={overallComment}
                onChange={e=>setOverallComment(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50" onClick={()=>submitObservation('draft')}>Lưu nháp</button>
              <button className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-95 active:scale-[0.99]" onClick={()=>submitObservation('submitted')}>Gửi đánh giá</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
