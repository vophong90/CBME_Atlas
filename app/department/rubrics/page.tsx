// app/department/rubrics/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDepartmentCtx } from '../context';

type RubricCell = { id: string; label: string };
type RubricRow  = { id: string; criterion: string; clo_code?: string; cells: RubricCell[] };
type Rubric = {
  id?: string;
  framework_id: string;
  course_code: string;
  title: string;
  columns: string[];
  rows: RubricRow[];
  threshold: number;
};

type ServerRubric = {
  id: string;
  framework_id: string;
  course_code: string;
  title: string;
  threshold: number | null;
  definition: {
    columns?: string[];
    rows?: RubricRow[];
  } | null;
  updated_at?: string | null;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function RubricsPage() {
  const { frameworkId, courseCode, formatFw, frameworks } = useDepartmentCtx();

  const [rubrics, setRubrics] = useState<ServerRubric[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Rubric | null>(null);

  const makeEmpty = (): Rubric => ({
    framework_id: frameworkId,
    course_code: courseCode || '',
    title: `Rubric ${courseCode || ''}`,
    columns: ['Mức 1', 'Mức 2', 'Mức 3', 'Mức 4'],
    rows: [
      {
        id: uid(),
        criterion: 'Tiêu chí 1',
        clo_code: '',
        cells: [uid(), uid(), uid(), uid()].map(id => ({ id, label: '' })),
      },
    ],
    threshold: 70,
  });

  async function loadRubrics() {
    if (!frameworkId) { setRubrics([]); return; }
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('framework_id', frameworkId);
      if (courseCode) p.set('course_code', courseCode);
      const res = await fetch(`/api/department/rubrics?${p.toString()}`, { cache: 'no-store' });
      const js = await res.json();
      setRubrics(res.ok ? (js.data || []) : []);
    } finally {
      setLoading(false);
    }
  }

  async function saveRubric() {
    if (!editing) return;
    if (!editing.framework_id) return alert('Thiếu framework_id.');
    if (!editing.course_code) return alert('Thiếu mã học phần.');

    const isNew = !editing.id;
    const res = await fetch('/api/department/rubrics', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(editing),
    });
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Lưu rubric lỗi'); return; }
    setEditing(null);
    await loadRubrics();
  }

  async function deleteRubric(id: string) {
    if (!confirm('Xoá rubric này?')) return;
    const res = await fetch(`/api/department/rubrics?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Xoá lỗi'); return; }
    await loadRubrics();
  }

  const addColumn = () => {
    if (!editing) return;
    const label = prompt('Tên cột mới:', `Mức ${editing.columns.length + 1}`) || '';
    if (!label) return;
    const next = { ...editing };
    next.columns = [...next.columns, label];
    next.rows = next.rows.map(r => ({ ...r, cells: [...r.cells, { id: uid(), label: '' }] }));
    setEditing(next);
  };

  const removeColumn = (idx: number) => {
    if (!editing) return;
    if (editing.columns.length <= 1) return alert('Cần tối thiểu 1 cột.');
    const next = { ...editing };
    next.columns = next.columns.filter((_, i) => i !== idx);
    next.rows = next.rows.map(r => ({ ...r, cells: r.cells.filter((_, i) => i !== idx) }));
    setEditing(next);
  };

  const addRow = () => {
    if (!editing) return;
    const next = { ...editing };
    next.rows.push({
      id: uid(),
      criterion: `Tiêu chí ${editing.rows.length + 1}`,
      clo_code: '',
      cells: editing.columns.map(() => ({ id: uid(), label: '' })),
    });
    setEditing(next);
  };

  const removeRow = (rid: string) => {
    if (!editing) return;
    setEditing({ ...editing, rows: editing.rows.filter(r => r.id !== rid) });
  };

  const beginEdit = (r: ServerRubric) => {
    const def = r.definition || {};
    const cols = Array.isArray(def.columns) && def.columns.length ? def.columns : ['Mức 1', 'Mức 2', 'Mức 3', 'Mức 4'];
    const rows = Array.isArray(def.rows) && def.rows.length
      ? def.rows
      : [{
          id: uid(),
          criterion: 'Tiêu chí 1',
          clo_code: '',
          cells: cols.map(() => ({ id: uid(), label: '' })),
        }];
    setEditing({
      id: r.id,
      framework_id: r.framework_id,
      course_code: r.course_code,
      title: r.title,
      columns: cols,
      rows,
      threshold: r.threshold ?? 70,
    });
  };

  const totalRubricsText = useMemo(() => {
    if (!frameworkId) return 'Chưa chọn khung.';
    if (courseCode) return `Có ${rubrics.length} rubric trong học phần ${courseCode}.`;
    return `Có ${rubrics.length} rubric trong khung đã chọn.`;
  }, [frameworkId, courseCode, rubrics.length]);

  useEffect(() => { loadRubrics(); /* eslint-disable-next-line */ }, [frameworkId, courseCode]);

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quản lý Rubric</h2>
        <div className="flex items-center gap-2">
          <button onClick={loadRubrics} className="rounded-lg border px-3 py-2 hover:bg-gray-50">Làm mới</button>
          <button
            onClick={() => setEditing(makeEmpty())}
            disabled={!frameworkId}
            className={!frameworkId
              ? 'cursor-not-allowed rounded-lg bg-gray-300 px-3 py-2 text-white'
              : 'rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-700'}
          >
            + Tạo rubric
          </button>
        </div>
      </div>

      {/* ===== BẢNG LIỆT KÊ RUBRICS THEO KHUNG + HỌC PHẦN ===== */}
      <div className="rounded border">
        <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2 text-sm">
          <div className="font-medium">Danh sách rubric</div>
          <div className="text-slate-600">{loading ? 'Đang tải…' : totalRubricsText}</div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b px-3 py-2 text-left">Tiêu đề</th>
                <th className="border-b px-3 py-2 text-left">Học phần</th>
                <th className="border-b px-3 py-2 text-left">Ngưỡng</th>
                <th className="border-b px-3 py-2 text-left">Số tiêu chí</th>
                <th className="border-b px-3 py-2 text-left">Cập nhật</th>
                <th className="border-b px-3 py-2 text-left w-40">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rubrics.map(r => {
                const cols = r.definition?.columns ?? [];
                const rows = r.definition?.rows ?? [];
                return (
                  <tr key={r.id} className="odd:bg-gray-50">
                    <td className="border-b px-3 py-2">{r.title}</td>
                    <td className="border-b px-3 py-2">{r.course_code}</td>
                    <td className="border-b px-3 py-2">{(r.threshold ?? 70)}%</td>
                    <td className="border-b px-3 py-2">{Array.isArray(rows) ? rows.length : 0}</td>
                    <td className="border-b px-3 py-2">{r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}</td>
                    <td className="border-b px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => beginEdit(r)}
                          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => deleteRubric(r.id)}
                          className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rubrics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    {frameworkId
                      ? (courseCode ? 'Chưa có rubric cho học phần này.' : 'Chưa có rubric trong khung đã chọn.')
                      : 'Chọn khung chương trình để xem.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== FORM TẠO / SỬA RUBRIC ===== */}
      {editing && (
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{editing.id ? 'Sửa rubric' : 'Tạo rubric'}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(null)} className="rounded border px-3 py-1.5 text-sm">Đóng</button>
              <button onClick={saveRubric} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">Lưu</button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Khung</label>
              <input
                value={formatFw(frameworks.find(f => f.id === frameworkId)) || editing.framework_id}
                disabled
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Học phần</label>
              <input
                value={editing.course_code}
                onChange={(e) => setEditing(p => p ? { ...p, course_code: e.target.value } : p)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Tiêu đề rubric</label>
              <input
                value={editing.title}
                onChange={(e) => setEditing(p => p ? { ...p, title: e.target.value } : p)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Ngưỡng đạt (%)</label>
              <input
                type="number" min={0} max={100}
                value={editing.threshold}
                onChange={(e) => setEditing(p => p ? { ...p, threshold: Number(e.target.value) } : p)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Cột (mức đánh giá)</div>
              <button onClick={addColumn} className="rounded border px-3 py-1.5 text-sm">+ Cột</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {editing.columns.map((col, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border px-2 py-1">
                  <input
                    value={col}
                    onChange={(e) =>
                      setEditing(p => {
                        if (!p) return p;
                        const n = { ...p };
                        n.columns[idx] = e.target.value;
                        return n;
                      })
                    }
                    className="rounded border px-2 py-1 text-sm"
                  />
                  <button onClick={() => removeColumn(idx)} className="text-xs text-red-600 hover:underline">Xoá</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Dòng (tiêu chí) & liên kết CLO</div>
              <button onClick={addRow} className="rounded border px-3 py-1.5 text-sm">+ Dòng</button>
            </div>

            <div className="mt-2 overflow-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[26rem] border-b px-3 py-2 text-left">Tiêu chí</th>
                    <th className="w-[10rem] border-b px-3 py-2 text-left">CLO</th>
                    {editing.columns.map((c, i) => (
                      <th key={i} className="border-b px-3 py-2 text-left">{c}</th>
                    ))}
                    <th className="border-b px-3 py-2 text-left"> </th>
                  </tr>
                </thead>
                <tbody>
                  {editing.rows.map((r, ri) => (
                    <tr key={r.id} className="odd:bg-gray-50">
                      <td className="border-b px-3 py-2">
                        <input
                          value={r.criterion}
                          onChange={(e) =>
                            setEditing(p => {
                              if (!p) return p;
                              const n = { ...p };
                              n.rows[ri].criterion = e.target.value;
                              return n;
                            })
                          }
                          className="w-full rounded border px-2 py-1"
                        />
                      </td>
                      <td className="border-b px-3 py-2">
                        <input
                          value={r.clo_code || ''}
                          onChange={(e) =>
                            setEditing(p => {
                              if (!p) return p;
                              const n = { ...p };
                              n.rows[ri].clo_code = e.target.value;
                              return n;
                            })
                          }
                          className="w-full rounded border px-2 py-1"
                          placeholder="VD: CLO1"
                        />
                      </td>
                      {r.cells.map((cell, ci) => (
                        <td key={cell.id} className="border-b px-3 py-2">
                          <input
                            value={cell.label}
                            onChange={(e) =>
                              setEditing(p => {
                                if (!p) return p;
                                const n = { ...p };
                                n.rows[ri].cells[ci].label = e.target.value;
                                return n;
                              })
                            }
                            className="w-full rounded border px-2 py-1"
                            placeholder="-"
                          />
                        </td>
                      ))}
                      <td className="border-b px-3 py-2">
                        <button onClick={() => removeRow(r.id)} className="text-xs text-red-600 hover:underline">
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                  {editing.rows.length === 0 && (
                    <tr>
                      <td colSpan={editing.columns.length + 3} className="px-3 py-6 text-center text-gray-500">
                        Chưa có dòng.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-xs text-gray-600">
              * Quy tắc chấm: GV nhập mức đạt cho từng tiêu chí (theo cột). Trung bình % của các tiêu chí liên kết cùng một <b>CLO</b> ≥ <b>ngưỡng</b> thì coi là <b>Đạt</b>.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
