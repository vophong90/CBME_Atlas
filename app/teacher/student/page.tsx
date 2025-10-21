'use client';

import React, { useState } from 'react';

type Student = { mssv: string; user_id: string; full_name?: string; cohort?: string; class_name?: string };
type PendingCLO = { clo_id: string; clo_title: string; course_code: string | null };

export default function TeacherStudentPage() {
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
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-4 gap-3">
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Framework ID (nếu có)" value={frameworkId} onChange={e=>setFrameworkId(e.target.value)} />
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Mã học phần (lọc, tuỳ chọn)" value={courseCode} onChange={e=>setCourseCode(e.target.value)} />
          <div className="flex gap-2">
            <input className="rounded-xl border border-slate-300 px-3 py-2 flex-1" placeholder="Nhập MSSV" value={mssv} onChange={e=>setMssv(e.target.value)} />
            <button className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50" onClick={lookupStudent}>Tìm</button>
          </div>
          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:opacity-95 active:scale-[0.99]" onClick={fetchPending}>
            Tải CLO chưa đạt
          </button>
        </div>
      </div>

      {student && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
          <div><b>{student.full_name || 'Sinh viên'}</b> • MSSV: {student.mssv}</div>
          <div className="text-slate-500">Lớp: {student.class_name || '—'} • Khoá: {student.cohort || '—'}</div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {loading && Array.from({length:4}).map((_,i)=>(
          <div key={i} className="border border-slate-200 rounded-2xl p-3 animate-pulse">
            <div className="h-4 w-2/3 bg-slate-200 rounded" />
            <div className="mt-2 h-3 w-1/3 bg-slate-200 rounded" />
          </div>
        ))}
        {!loading && items.map(it => (
          <div key={`${it.clo_id}-${it.course_code || ''}`} className="border border-slate-200 rounded-2xl p-3 bg-white shadow-sm">
            <div className="text-sm font-medium">{it.clo_id} — {it.clo_title}</div>
            <div className="text-xs text-slate-500 mt-1">Học phần: {it.course_code || '—'}</div>
            <div className="mt-2">
              <a className="text-xs underline cursor-pointer" onClick={()=>alert('Gợi ý kế hoạch bồi dưỡng: (tùy chỉnh sau)')}>Gợi ý kế hoạch bồi dưỡng</a>
              {' '}•{' '}
              <a className="text-xs underline cursor-pointer" onClick={()=>alert('Tạo phiên đánh giá: (prefill ở trang Đánh giá)')}>Tạo phiên đánh giá</a>
            </div>
          </div>
        ))}
        {!loading && items.length===0 && student && (
          <div className="text-sm text-slate-500">Không có CLO chưa đạt theo bộ lọc.</div>
        )}
      </div>
    </section>
  );
}
