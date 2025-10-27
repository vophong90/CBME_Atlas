'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Framework = { id: string; doi_tuong: string; chuyen_nganh: string; nien_khoa: string };
type Student = {
  id: string;
  user_id: string | null;
  mssv?: string | null;
  student_code?: string | null;
  full_name?: string | null;
  cohort?: string | null;     // có thể null (tuỳ schema)
  class_name?: string | null; // có thể null (tuỳ schema)
};

export default function TeacherFeedbackPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>('');

  const [q, setQ] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [courseCode, setCourseCode] = useState('');
  const [cloIds, setCloIds] = useState('');

  const [message, setMessage] = useState('');
  const [moderationPass, setModerationPass] = useState<boolean | null>(null);

  const [loadingFw, setLoadingFw] = useState(false);
  const [loadingFind, setLoadingFind] = useState(false);
  const [loadingModerate, setLoadingModerate] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);

  // Tải danh sách khung CT
  useEffect(() => {
    (async () => {
      try {
        setLoadingFw(true);
        const r = await fetch('/api/frameworks');
        const d = await r.json();
        if (r.ok) {
          setFrameworks(d.items || []);
          if ((d.items || []).length && !frameworkId) setFrameworkId(d.items[0].id);
        } else {
          alert(d.error || 'Không tải được khung chương trình');
        }
      } finally {
        setLoadingFw(false);
      }
    })();
  }, []); // init

  // Tìm SV theo khung + q
  async function searchStudents() {
    setSelectedStudent(null);
    setModerationPass(null);
    try {
      setLoadingFind(true);
      const url = new URL('/api/teacher/students', window.location.origin);
      if (frameworkId) url.searchParams.set('framework_id', frameworkId);
      if (q.trim()) url.searchParams.set('q', q.trim());
      const r = await fetch(url.toString());
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || 'Không tìm được sinh viên');
        setStudents([]);
        return;
      }
      setStudents(d.items || []);
    } finally {
      setLoadingFind(false);
    }
  }

  // Kiểm duyệt bằng GPT (model 5) — nếu OK mới bật nút Gửi
  async function moderate() {
    if (!message.trim()) { alert('Nội dung trống'); return; }
    try {
      setLoadingModerate(true);
      const r = await fetch('/api/teacher/feedback/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const d = await r.json();
      setModerationPass(!!d?.ok);
      if (!d?.ok) alert(d?.reason || 'Không đạt kiểm duyệt');
    } finally {
      setLoadingModerate(false);
    }
  }

  async function send() {
    if (!selectedStudent) { alert('Chưa chọn sinh viên'); return; }
    if (!selectedStudent.user_id) { alert('Sinh viên chưa có tài khoản người dùng'); return; }
    if (!message.trim()) { alert('Nội dung trống'); return; }
    if (!moderationPass) { alert('Vui lòng kiểm tra & đạt kiểm duyệt trước khi gửi'); return; }

    try {
      setLoadingSend(true);
      const payload = {
        student_user_id: selectedStudent.user_id,
        message,
        course_code: courseCode || null,
        clo_ids: cloIds ? cloIds.split(',').map(s => s.trim()).filter(Boolean) : null,
      };
      const r = await fetch('/api/teacher/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || 'Gửi thất bại');
        return;
      }
      alert('Đã gửi phản hồi cho SV (vào hộp thư của SV).');
      // reset message + trạng thái duyệt
      setMessage('');
      setModerationPass(null);
    } finally {
      setLoadingSend(false);
    }
  }

  const canSend = useMemo(
    () => !!selectedStudent && !!selectedStudent.user_id && !!moderationPass && !loadingSend,
    [selectedStudent, moderationPass, loadingSend]
  );

  return (
    <section className="space-y-5">
      {/* Khung chương trình */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Khung chương trình</label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={frameworkId}
              onChange={e => { setFrameworkId(e.target.value); setStudents([]); setSelectedStudent(null); setModerationPass(null); }}
              disabled={loadingFw}
            >
              {frameworks.map(f => (
                <option key={f.id} value={f.id}>
                  {`${f.doi_tuong} • ${f.chuyen_nganh} • NK ${f.nien_khoa}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tìm & chọn Sinh viên */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Tìm sinh viên (MSSV / Họ tên)</label>
            <div className="flex gap-2">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 flex-1"
                value={q}
                onChange={e=>setQ(e.target.value)}
                placeholder="VD: 2212345 hoặc Nguyễn Văn A"
              />
              <button
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                onClick={searchStudents}
                disabled={loadingFind}
              >
                {loadingFind ? 'Đang tìm…' : 'Tìm'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mã học phần (tuỳ chọn)</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="VD: IMMU101"
              value={courseCode}
              onChange={e=>setCourseCode(e.target.value)}
            />
          </div>
        </div>

        {/* Kết quả + chọn SV */}
        <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-2">MSSV</th>
                <th className="text-left p-2">Họ tên</th>
                <th className="text-left p-2">User</th>
                <th className="text-left p-2">Chọn</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className={selectedStudent?.id === s.id ? 'bg-emerald-50' : ''}>
                  <td className="p-2">{s.mssv || s.student_code || '—'}</td>
                  <td className="p-2">{s.full_name || '—'}</td>
                  <td className="p-2">{s.user_id ? 'Đã liên kết' : <span className="text-red-600">Chưa có</span>}</td>
                  <td className="p-2">
                    <button
                      className="px-2 py-1 rounded-lg border hover:bg-slate-50"
                      onClick={() => { setSelectedStudent(s); setModerationPass(null); }}
                    >
                      Chọn
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td className="p-3 text-slate-500" colSpan={4}>Nhập từ khoá rồi bấm “Tìm” để hiển thị danh sách.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedStudent && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
            <div><b>{selectedStudent.full_name || 'Sinh viên'}</b> • MSSV: {selectedStudent.mssv || selectedStudent.student_code || '—'}</div>
            <div className="text-slate-500">User liên kết: {selectedStudent.user_id ? 'Có' : 'Chưa có'}</div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">CLO liên quan (tuỳ chọn)</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Nhập mã CLO, cách nhau dấu phẩy"
              value={cloIds}
              onChange={e=>setCloIds(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Soạn & kiểm duyệt & gửi */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium mb-1">Nội dung góp ý</label>
        <textarea
          className="w-full rounded-2xl border border-slate-300 p-3 min-h-[140px] outline-none focus:ring"
          placeholder="Nội dung phản hồi (tích cực, hướng dẫn cải thiện…)"
          value={message}
          onChange={e=>{ setMessage(e.target.value); setModerationPass(null); }}
        />

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm"
            onClick={moderate}
            disabled={loadingModerate || !message.trim()}
          >
            {loadingModerate ? 'Đang kiểm tra…' : 'Kiểm tra bằng GPT'}
          </button>

          <span className={`text-sm ${moderationPass==null?'text-slate-500': moderationPass ? 'text-emerald-600' : 'text-red-600'}`}>
            {moderationPass==null ? 'Chưa kiểm tra' : moderationPass ? 'Đạt kiểm duyệt ✓' : 'Chưa đạt ✗'}
          </span>

          <div className="ml-auto" />
          <button
            disabled={!canSend}
            className={[
              'px-4 py-2 rounded-xl font-semibold',
              canSend ? 'bg-slate-900 text-white hover:opacity-95 active:scale-[0.99]' : 'bg-slate-300 text-white cursor-not-allowed'
            ].join(' ')}
            onClick={send}
          >
            {loadingSend ? 'Đang gửi…' : 'Gửi phản hồi'}
          </button>
        </div>
      </div>
    </section>
  );
}
