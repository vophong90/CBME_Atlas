'use client';

import React, { useEffect, useState } from 'react';

type FrameworkOpt = { id: string; label: string };
type StudentOpt   = { user_id: string; mssv: string; full_name: string; label: string };

type Row = {
  mssv: string;
  full_name: string;
  course_code: string;
  course_name: string;
  clo_code: string;
  clo_text: string | null;
  updated_at: string;
};

const INPUT =
  'h-10 text-sm rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-brand-300';

export default function TeacherStudentPage() {
  const [frameworks, setFrameworks] = useState<FrameworkOpt[]>([]);
  const [frameworkId, setFrameworkId] = useState('');
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [studentUserId, setStudentUserId] = useState('');

  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // Load khung
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/frameworks', { credentials: 'include' });
        const d = await r.json();
        if (r.ok) {
          setFrameworks(d.items || []);
          // tự chọn khung đầu tiên nếu chưa chọn
          if (!frameworkId && d.items?.[0]?.id) setFrameworkId(d.items[0].id);
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khi chọn khung -> load danh sách SV của khung
  useEffect(() => {
    setStudents([]);
    setStudentUserId('');
    setItems([]);
    if (!frameworkId) return;

    (async () => {
      try {
        const r = await fetch(`/api/teacher/students?framework_id=${frameworkId}`, {
          credentials: 'include',
        });
        const d = await r.json();
        if (r.ok) {
          setStudents(d.items || []);
        } else {
          setStudents([]);
          alert(d.error || 'Lỗi tải danh sách sinh viên');
        }
      } catch (e: any) {
        setStudents([]);
        alert(e?.message || 'Lỗi tải danh sách sinh viên');
      }
    })();
  }, [frameworkId]);

  // Tải CLO chưa đạt của 1 SV
  async function loadPending() {
    if (!frameworkId) return alert('Vui lòng chọn Khung');
    if (!studentUserId) return alert('Vui lòng chọn Sinh viên');

    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('student_user_id', studentUserId);
      p.set('framework_id', frameworkId);
      const r = await fetch(`/api/teacher/student-pending-clos?${p.toString()}`, {
        credentials: 'include',
      });
      const d = await r.json();
      if (r.ok) {
        setItems(d.items || []);
      } else {
        setItems([]);
        alert(d.error || 'Lỗi tải CLO chưa đạt');
      }
    } catch (e: any) {
      setItems([]);
      alert(e?.message || 'Lỗi tải CLO chưa đạt');
    } finally {
      setLoading(false);
    }
  }

  // Tự tải khi đổi SV
  useEffect(() => {
    if (frameworkId && studentUserId) loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentUserId]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-3 gap-3">
          {/* Khung */}
          <select
            className={INPUT}
            value={frameworkId}
            onChange={(e) => setFrameworkId(e.target.value)}
          >
            <option value="">— Chọn Khung —</option>
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>

          {/* Sinh viên */}
          <select
            className={INPUT}
            value={studentUserId}
            onChange={(e) => setStudentUserId(e.target.value)}
            disabled={!frameworkId || students.length === 0}
          >
            <option value="">
              {frameworkId
                ? students.length
                  ? '— Chọn Sinh viên —'
                  : 'Không có SV trong khung'
                : 'Hãy chọn Khung trước'}
            </option>
            {students.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Nút tải lại */}
          <button
            className="h-10 text-sm rounded-lg bg-slate-900 text-white px-3 hover:opacity-95 disabled:opacity-50"
            onClick={loadPending}
            disabled={!frameworkId || !studentUserId || loading}
          >
            {loading ? 'Đang tải…' : 'Tải CLO chưa đạt'}
          </button>
        </div>
      </div>

      {/* Bảng 5 cột */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-medium">
          CLO đã học nhưng <span className="text-red-600">chưa đạt</span>
        </div>

        {/* Header */}
        <div className="grid grid-cols-5 px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
          <div>MSSV</div>
          <div>Họ tên</div>
          <div>Tên học phần</div>
          <div>Mã CLO</div>
          <div>Nội dung CLO</div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-5 gap-0 px-4 py-3 animate-pulse"
              >
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-4 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-52 bg-slate-200 rounded" />
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-64 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : !frameworkId || !studentUserId ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Hãy chọn <b>Khung</b> và <b>Sinh viên</b> để xem dữ liệu.
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Không có CLO chưa đạt.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((r, idx) => (
              <div
                key={`${r.mssv}-${r.course_code}-${r.clo_code}-${idx}`}
                className="grid grid-cols-5 px-4 py-2 text-sm"
              >
                <div className="truncate">{r.mssv}</div>
                <div className="truncate">{r.full_name || '—'}</div>
                <div className="truncate" title={r.course_name}>
                  {r.course_name || r.course_code || '—'}
                </div>
                <div className="truncate">{r.clo_code}</div>
                <div className="truncate" title={r.clo_text || ''}>
                  {r.clo_text || '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
