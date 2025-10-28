'use client';

import { useEffect, useMemo, useState } from 'react';

type CourseRow = {
  framework_id: string;
  code: string;
  name: string | null;
  department_id: string | null;
  department: { id: string; name: string } | null;
};

type Dept = { id: string; name: string };

export default function AcademicAffairsCoursesPage() {
  const [frameworkId, setFrameworkId] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [dirty, setDirty] = useState<Record<string, string | null>>({}); // key `${fw}|${code}` -> dept_id|null

  // Load frameworks (tận dụng API có sẵn: /api/academic-affairs/framework/list)
  const [frameworks, setFrameworks] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/academic-affairs/framework/list');
        const js = await r.json();
        setFrameworks(js.items || []);
      } catch {}
    })();
  }, []);

  // Load departments
  useEffect(() => {
    (async () => {
      try {
        // Dùng bảng departments trực tiếp qua route tạm:
        // bạn có thể thay bằng API riêng nếu đã có.
        const r = await fetch('/api/academic-affairs/departments/list', { method: 'POST' })
          .catch(() => null as any);
        if (r && r.ok) {
          const js = await r.json();
          setDepts((js.items || []).map((d: any) => ({ id: d.id, name: d.name })));
        } else {
          // fallback: gọi trực tiếp PostgREST (nếu mở)
          const r2 = await fetch('/api/academic-affairs/framework/graph'); // placeholder để tránh lỗi
          setDepts([]); // nếu chưa có API, vẫn cho user gán null
        }
      } catch {
        setDepts([]);
      }
    })();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (frameworkId) params.set('framework_id', frameworkId);
      if (q.trim()) params.set('q', q.trim());
      const r = await fetch(`/api/academic-affairs/courses/list?` + params.toString());
      const js = await r.json();
      setRows(js.items || []);
      setDirty({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [frameworkId]);

  const modifiedCount = useMemo(() => Object.keys(dirty).length, [dirty]);

  async function saveChanges() {
    if (!modifiedCount) return;
    const items = Object.entries(dirty).map(([k, v]) => {
      const [fw, code] = k.split('|');
      return { framework_id: fw, course_code: code, department_id: v };
    });
    const r = await fetch('/api/academic-affairs/courses/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const js = await r.json();
    if (!r.ok || !js?.ok) {
      alert(js?.error || 'Cập nhật thất bại');
      return;
    }
    await loadData();
  }

  return (
    <section className="space-y-4">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Quản lý học phần</h1>
            <p className="text-sm text-slate-600">Gán học phần cho Bộ môn quản lý để đồng bộ các chức năng khác.</p>
          </div>
          <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Khung chương trình</label>
              <select
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
                className="min-w-[260px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="">— Chọn khung —</option>
                {frameworks.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {[f.doi_tuong, f.chuyen_nganh, f.nien_khoa].filter(Boolean).join(' • ') || f.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Tìm kiếm</label>
              <div className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Mã/tên học phần…"
                  className="min-w-[220px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                />
                <button
                  onClick={loadData}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Làm mới
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            {loading ? 'Đang tải…' : `Tìm thấy ${rows.length} học phần`}
          </div>
          <button
            disabled={!modifiedCount}
            onClick={saveChanges}
            className={[
              'rounded-xl px-4 py-2 text-sm font-semibold',
              modifiedCount ? 'bg-brand-600 text-white hover:opacity-95 active:scale-[0.99]' : 'bg-slate-300 text-white cursor-not-allowed',
            ].join(' ')}
          >
            Lưu thay đổi {modifiedCount ? `(${modifiedCount})` : ''}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2">Mã học phần</th>
                <th className="px-3 py-2">Tên học phần</th>
                <th className="px-3 py-2 w-[280px]">Bộ môn quản lý</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const key = `${r.framework_id}|${r.code}`;
                const cur = key in dirty ? dirty[key] : r.department_id;
                return (
                  <tr key={key} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.code}</td>
                    <td className="px-3 py-2">{r.name || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2">
                      <select
                        value={cur || ''}
                        onChange={(e) =>
                          setDirty((d) => ({ ...d, [key]: e.target.value ? e.target.value : null }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                      >
                        <option value="">— Chưa gán —</option>
                        {depts.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && !loading && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-slate-400">Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
