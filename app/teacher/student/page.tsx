'use client';

import React, { useEffect, useMemo, useState } from 'react';

type FrameworkOpt = { id: string; label: string };
type PendingRow = {
  mssv: string;
  full_name: string;
  course_code: string;
  course_name: string;
  clo_code: string;
  clo_title: string | null; // sẽ hiển thị '—' nếu null
  updated_at: string;
};

export default function TeacherStudentPage() {
  const [frameworks, setFrameworks] = useState<FrameworkOpt[]>([]);
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [q, setQ] = useState('');
  const [courseCode, setCourseCode] = useState('');

  const [items, setItems] = useState<PendingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [matchedStudents, setMatchedStudents] = useState(0);

  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);

  // Load frameworks
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/frameworks');
        const d = await r.json();
        if (r.ok) {
          setFrameworks(d.items || []);
          // auto chọn khung đầu tiên nếu chưa chọn
          if (!frameworkId && d.items?.[0]?.id) setFrameworkId(d.items[0].id);
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce nhập q
  useEffect(() => {
    setTyping(true);
    const t = setTimeout(() => setTyping(false), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch pending-clos mỗi khi filter thay đổi (và q hết typing)
  useEffect(() => {
    if (!frameworkId || typing) return;

    (async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams();
        p.set('framework_id', frameworkId);
        if (q) p.set('q', q);
        if (courseCode) p.set('course_code', courseCode);
        p.set('limit', String(limit));
        p.set('offset', String(offset));

        const r = await fetch(`/api/teacher/pending-clos?${p.toString()}`);
        const d = await r.json();
        if (r.ok) {
          setItems(d.items || []);
          setTotal(d.total || 0);
          setMatchedStudents(d.matched_students || 0);
        } else {
          setItems([]);
          setTotal(0);
          setMatchedStudents(0);
          alert(d.error || 'Lỗi tải dữ liệu');
        }
      } catch (e: any) {
        setItems([]);
        setTotal(0);
        setMatchedStudents(0);
        alert(e?.message || 'Lỗi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, [frameworkId, q, courseCode, limit, offset, typing]);

  // Reset về trang 1 khi đổi filter
  useEffect(() => {
    setOffset(0);
  }, [frameworkId, q, courseCode]);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil((total || 0) / limit)), [total, limit]);

  return (
    <section className="space-y-4">
      {/* Bộ lọc */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-3">
          {/* Chọn Khung */}
          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={frameworkId}
            onChange={(e) => setFrameworkId(e.target.value)}
          >
            <option value="">— Chọn Khung —</option>
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>

          {/* Tìm nhanh SV (MSSV/Họ tên) */}
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Tìm nhanh sinh viên (MSSV hoặc Họ tên)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {/* Lọc mã học phần (tùy chọn) */}
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Mã học phần (lọc tuỳ chọn)"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
          />

          {/* Thông tin tổng quan */}
          <div className="flex items-center text-sm text-slate-600">
            <div className="rounded-xl border border-slate-200 px-3 py-2 w-full">
              {frameworkId
                ? <>Đã khớp <b>{matchedStudents}</b> SV • Tổng dòng CLO chưa đạt: <b>{total}</b></>
                : <>Hãy chọn Khung trước</>}
            </div>
          </div>
        </div>
      </div>

      {/* Bảng kết quả */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-medium">CLO đã học nhưng <span className="text-red-600">chưa đạt</span></div>
          <div className="text-sm text-slate-500">Trang {page}/{pageCount} • {total} dòng</div>
        </div>

        {/* Header */}
        <div className="grid grid-cols-5 gap-0 px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
          <div>MSSV</div>
          <div>Họ tên</div>
          <div>Tên học phần</div>
          <div>Mã CLO</div>
          <div>Nội dung CLO</div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-5 gap-0 px-4 py-3 animate-pulse">
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-4 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-52 bg-slate-200 rounded" />
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-4 w-64 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">Không có CLO chưa đạt theo bộ lọc.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((r, idx) => (
              <div key={`${r.mssv}-${r.course_code}-${r.clo_code}-${idx}`} className="grid grid-cols-5 gap-0 px-4 py-2 text-sm">
                <div className="truncate">{r.mssv}</div>
                <div className="truncate">{r.full_name || '—'}</div>
                <div className="truncate" title={r.course_name}>
                  {r.course_name || r.course_code || '—'}
                </div>
                <div className="truncate">{r.clo_code}</div>
                <div className="truncate" title={r.clo_title || ''}>
                  {r.clo_title || '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            ← Trước
          </button>
          <div className="text-xs text-slate-500">
            Hiển thị {items.length} / {total}
          </div>
          <button
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={loading || offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Sau →
          </button>
        </div>
      </div>
    </section>
  );
}
