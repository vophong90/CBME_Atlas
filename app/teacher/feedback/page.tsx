'use client';

import React, { useState } from 'react';

type Student = { mssv: string; user_id: string; full_name?: string; cohort?: string; class_name?: string };

export default function TeacherFeedbackPage() {
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
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="flex gap-2 md:col-span-2">
            <input className="rounded-xl border border-slate-300 px-3 py-2 flex-1" placeholder="Nhập MSSV" value={mssv} onChange={e=>setMssv(e.target.value)} />
            <button className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50" onClick={lookupStudent}>Tìm</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Mã học phần (optional)" value={courseCode} onChange={e=>setCourseCode(e.target.value)} />
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="CLO liên quan, cách nhau dấu phẩy" value={cloIds} onChange={e=>setCloIds(e.target.value)} />
          </div>
        </div>
      </div>

      {student && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
          <div><b>{student.full_name || 'Sinh viên'}</b> • MSSV: {student.mssv}</div>
          <div className="text-slate-500">Lớp: {student.class_name || '—'} • Khoá: {student.cohort || '—'}</div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <textarea className="w-full rounded-2xl border border-slate-300 p-3 min-h-[140px] outline-none focus:ring"
                  placeholder="Nội dung phản hồi (tích cực, hướng dẫn cải thiện…)"
                  value={message} onChange={e=>setMessage(e.target.value)} />
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm" onClick={moderate}>
            Kiểm tra nội dung
          </button>
          <span className={`text-sm ${moderationPass==null?'text-slate-500': moderationPass ? 'text-emerald-600' : 'text-red-600'}`}>
            {moderationPass==null ? 'Chưa kiểm tra' : moderationPass ? 'Đạt kiểm duyệt ✓' : 'Chưa đạt ✗'}
          </span>
          <div className="ml-auto" />
          <button
            disabled={!moderationPass}
            className={['px-4 py-2 rounded-xl font-semibold',
                        moderationPass ? 'bg-slate-900 text-white hover:opacity-95 active:scale-[0.99]' : 'bg-slate-300 text-white cursor-not-allowed'].join(' ')}
            onClick={send}>
            Gửi phản hồi
          </button>
        </div>
      </div>
    </section>
  );
}
