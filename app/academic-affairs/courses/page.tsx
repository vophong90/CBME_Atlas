'use client';

import { useEffect, useMemo, useState } from 'react';

type FrameworkOpt = { id: string; label: string };
type DeptOpt = { id: string; name: string; code?: string };
type CourseRow = {
  id: string;
  code: string;
  name: string | null;
  department_id: string | null;
  department: { id: string; name: string } | null;
};

export default function CoursesManagePage() {
  const [frameworks, setFrameworks] = useState<FrameworkOpt[]>([]);
  const [departments, setDepartments] = useState<DeptOpt[]>([]);
  const [frameworkId, setFrameworkId] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [rows, setRows] = useState<CourseRow[]>([]);
  const [total, setTotal] = useState(0);

  // Fetch frameworks + departments
  useEffect(() => {
    (async () => {
      try {
        const [fwR, depR] = await Promise.all([
          fetch('/api/academic-affairs/frameworks').then(r => r.json()),
          fetch('/api/academic-affairs/departments/list').then(r => r.json()),
        ]);
        setFrameworks(fwR.items || []);
        setDepartments(depR.items || []);
        // auto chọn khung mới nhất nếu chưa chọn
        if (!frameworkId && fwR.items?.[0]?.id) setFrameworkId(fwR.items[0].id);
      } catch { /* noop */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch courses khi đổi framework/q/page
  async function loadCourses(fp = frameworkId, fq = q, p = page) {
    if (!fp) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('framework_id', fp);
      if (fq) params.set('q', fq);
      params.set('page', String(p));
      params.set('page_size', String(pageSize));
      const js = await fetch(`/api/academic-affairs/courses/list?${params.toString()}`).then(r => r.json());
      setRows(js.items || []);
      setTotal(js.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (frameworkId) {
      setPage(1);
      loadCourses(frameworkId, q, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkId]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function formatDeptName(id: string | null) {
    if (!id) return '— Chưa gán —';
    const d = departments.find(x => x.id === id);
    return d?.name || '—';
  }

  async function onAssign(course: CourseRow, deptId: string | null) {
    if (!frameworkId) return;
    const res = await fetch('/api/academic-affairs/courses/assign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        framework_id: frameworkId,
        course_code: course.code,
        department_id: deptId,
      }),
    });
    const js = await res.json();
    if (!res.ok || !js?.ok) {
      alert(js?.error || 'Gán bộ môn thất bại');
      return;
    }
    // Cập nhật ngay trên UI
    setRows(prev =>
      prev.map(r =>
        r.id === course.id
          ? { ...r, department_id: deptId, department: deptId ? { id: deptId, name: formatDeptName(deptId) } : null }
          : r
      )
    );
  }

  // UI
  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Quản lý học phần</h1>
            <p className="text-sm text-slate-600">Gán bộ môn quản lý cho mỗi học phần để đồng bộ với Hộp thư góp ý và trang Bộ môn.</p>
          </div>

          <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Khung chương trình</label>
              <select
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
                className="min-w-[260px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="">— Chọn khung —</option>
                {frameworks.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Tìm học phần</label>
              <div className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); loadCourses(frameworkId, q, 1); } }}
                  placeholder="Nhập mã hoặc tên học phần…"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                />
                <button
                  onClick={() => { setPage(1); loadCourses(frameworkId, q, 1); }}
                  className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98]"
                >
                  Tìm
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="pb-2 pr-4">Mã học phần</th>
                <th className="pb-2 pr-4">Tên học phần</th>
                <th className="pb-2 pr-4">Bộ môn quản lý</th>
                <th className="pb-2 pr-2">Gán</th>
              </tr>
            </thead>
            <tbody>
              {!frameworkId ? (
                <tr><td colSpan={4} className="py-6 text-center text-slate-500">Hãy chọn khung chương trình để bắt đầu.</td></tr>
              ) : loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-3 pr-4"><div className="h-5 w-24 animate-pulse rounded bg-slate-200" /></td>
                    <td className="py-3 pr-4"><div className="h-5 w-64 animate-pulse rounded bg-slate-200" /></td>
                    <td className="py-3 pr-4"><div className="h-5 w-40 animate-pulse rounded bg-slate-200" /></td>
                    <td className="py-3 pr-2"><div className="h-8 w-20 animate-pulse rounded bg-slate-200" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-slate-500">Không có học phần nào.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-3 pr-4 font-mono">{r.code}</td>
                    <td className="py-3 pr-4">{r.name || <span className="text-slate-400">—</span>}</td>
                    <td className="py-3 pr-4">
                      <select
                        value={r.department_id || ''}
                        onChange={(e) => onAssign(r, e.target.value || null)}
                        className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                      >
                        <option value="">— Chưa gán —</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-2">
                      <button
                        onClick={() => loadCourses(frameworkId, q, page)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                        title="Làm mới dòng"
                      >
                        Làm mới
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <div>Tổng: {total}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const p = Math.max(1, page - 1); setPage(p); loadCourses(frameworkId, q, p); }}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                ← Trước
              </button>
              <span>Trang {page}/{totalPages}</span>
              <button
                onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); loadCourses(frameworkId, q, p); }}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
