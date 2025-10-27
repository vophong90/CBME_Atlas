'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Framework = { id: string; label: string }; // khớp /api/frameworks
type Student = {
  id: string;
  user_id: string | null;
  mssv?: string | null;
  student_code?: string | null;
  full_name?: string | null;
  label?: string; // khớp /api/teacher/students
};

export default function TeacherFeedbackPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>('');

  // combobox SV
  const [openBox, setOpenBox] = useState(false);
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // nội dung & moderation
  const [message, setMessage] = useState('');
  const [moderationPass, setModerationPass] = useState<boolean | null>(null);

  // loading flags
  const [loadingFw, setLoadingFw] = useState(false);
  const [loadingFind, setLoadingFind] = useState(false);
  const [loadingModerate, setLoadingModerate] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpenBox(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Tải danh sách khung chương trình (dùng /api/frameworks: [{id,label}])
  useEffect(() => {
    (async () => {
      try {
        setLoadingFw(true);
        const r = await fetch('/api/frameworks');
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Không tải được khung chương trình');
        setFrameworks(d.items || []);
        if ((d.items || []).length && !frameworkId) setFrameworkId(d.items[0].id);
      } catch (e: any) {
        alert(e?.message || 'Không tải được khung chương trình');
      } finally {
        setLoadingFw(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce tìm SV
  useEffect(() => {
    if (!frameworkId) return;
    const timer = setTimeout(async () => {
      try {
        setLoadingFind(true);
        const url = new URL('/api/teacher/students', window.location.origin);
        url.searchParams.set('framework_id', frameworkId);
        if (q.trim()) url.searchParams.set('q', q.trim());
        const r = await fetch(url.toString());
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Không tìm được sinh viên');
        setStudents(d.items || []);
      } catch (e: any) {
        setStudents([]);
      } finally {
        setLoadingFind(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [frameworkId, q]);

  // Đổi khung → reset SV & moderation
  useEffect(() => {
    setSelectedStudent(null);
    setQ('');
    setModerationPass(null);
  }, [frameworkId]);

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
      {/* 1) Chọn khung chương trình */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium mb-1">Khung chương trình</label>
        <select
          className="w-full rounded-xl border border-slate-300 px-3 py-2"
          value={frameworkId}
          onChange={e => setFrameworkId(e.target.value)}
          disabled={loadingFw}
        >
          {frameworks.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* 2) Chọn sinh viên (combobox — 1 menu có ô gõ để tìm) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" ref={boxRef}>
        <label className="block text-sm font-medium mb-1">Sinh viên</label>

        <div className="relative">
          {/* Ô hiển thị + mở menu */}
          <button
            type="button"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-left flex items-center justify-between"
            onClick={() => setOpenBox(v => !v)}
            disabled={!frameworkId}
          >
            <span>
              {selectedStudent
                ? `${selectedStudent.mssv ?? selectedStudent.student_code ?? '—'} — ${selectedStudent.full_name ?? '—'}`
                : (frameworkId ? 'Chọn sinh viên…' : 'Chọn khung trước')}
            </span>
            <span className="text-slate-500">▾</span>
          </button>

          {/* Panel dropdown */}
          {openBox && (
            <div className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="p-2 border-b bg-slate-50">
                <input
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Gõ MSSV hoặc họ tên để lọc…"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
              </div>
              <div className="max-h-72 overflow-auto">
                {loadingFind && <div className="p-3 text-sm text-slate-500">Đang tải…</div>}
                {!loadingFind && students.length === 0 && (
                  <div className="p-3 text-sm text-slate-500">Không có kết quả</div>
                )}
                <ul className="py-1">
                  {students.map(s => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={[
                          'w-full px-3 py-2 text-left text-sm hover:bg-slate-50',
                          selectedStudent?.id === s.id ? 'bg-emerald-50' : ''
                        ].join(' ')}
                        onClick={() => { setSelectedStudent(s); setOpenBox(false); setModerationPass(null); }}
                      >
                        {(s.mssv ?? s.student_code ?? '—') + ' — ' + (s.full_name ?? '—')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="mt-3 text-sm text-slate-600">
            User liên kết: {selectedStudent.user_id ? 'Có' : <span className="text-red-600">Chưa có</span>}
          </div>
        )}
      </div>

      {/* 3) Soạn & kiểm duyệt & gửi */}
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
