'use client';

import { useEffect, useState } from 'react';
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

const uid = () => Math.random().toString(36).slice(2,10);

export default function RubricsPage() {
  const { frameworkId, courseCode, formatFw, frameworks } = useDepartmentCtx();
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [editing, setEditing] = useState<Rubric | null>(null);

  const makeEmpty = (): Rubric => ({
    framework_id: frameworkId,
    course_code: courseCode || '',
    title: `Rubric ${courseCode || ''}`,
    columns: ['Mức 1', 'Mức 2', 'Mức 3', 'Mức 4'],
    rows: [{ id: uid(), criterion: 'Tiêu chí 1', clo_code: '', cells: [uid(), uid(), uid(), uid()].map(id => ({ id, label: '' })) }],
    threshold: 70,
  });

  async function loadRubrics() {
    if (!frameworkId) { setRubrics([]); return; }
    const p = new URLSearchParams();
    p.set('framework_id', frameworkId);
    if (courseCode) p.set('course_code', courseCode);
    const res = await fetch(`/api/department/rubrics?${p.toString()}`);
    const js = await res.json();
    if (res.ok) setRubrics(js.data || []);
  }

  async function saveRubric() {
    if (!editing) return;
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
    const res = await fetch(`/api/department/rubrics?id=${id}`, { method: 'DELETE' });
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
    next.rows.push({ id: uid(), criterion: `Tiêu chí ${editing.rows.length + 1}`, clo_code: '', cells: editing.columns.map(()=>({ id: uid(), label: '' })) });
    setEditing(next);
  };
  const removeRow = (rid: string) => { if (!editing) return; setEditing({ ...editing, rows: editing.rows.filter(r => r.id !== rid) }); };

  useEffect(() => { loadRubrics(); /* eslint-disable-next-line */ }, [frameworkId, courseCode]);

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quản lý Rubric</h2>
        <div className="flex items-center gap-2">
          <button onClick={loadRubrics} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Làm mới</button>
          <button
            onClick={() => setEditing(makeEmpty())}
            disabled={!frameworkId}
            className={!frameworkId ? 'px-3 py-2 rounded-lg bg-gray-300 text-white cursor-not-allowed' : 'px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700'}
          >
            + Tạo rubric
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rubrics.map((r: any) => (
          <div key={r.id} className="rounded-lg border p-3">
            <div className="font-semibold">{r.title}</div>
            <div className="text-xs text-gray-600 mt-1">{r.course_code} • Ngưỡng: {r.threshold ?? 70}%</div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setEditing({
                  id: r.id, framework_id: r.framework_id, course_code: r.course_code,
                  title: r.title, columns: r.definition?.columns || [], rows: r.definition?.rows || [], threshold: r.threshold ?? 70,
                })}
                className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
              >Sửa</button>
              <button onClick={() => deleteRubric(r.id)} className="px-3 py-1.5 rounded border border-red-300 text-red-700 text-sm hover:bg-red-50">Xoá</button>
            </div>
          </div>
        ))}
        {rubrics.length === 0 && <div className="text-sm text-gray-500">Chưa có rubric.</div>}
      </div>

      {editing && (
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{editing.id ? 'Sửa rubric' : 'Tạo rubric'}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded border text-sm">Đóng</button>
              <button onClick={saveRubric} className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700">Lưu</button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Khung</label>
              <input value={formatFw(frameworks.find(f=>f.id===frameworkId)) || editing.framework_id} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Học phần</label>
              <input value={editing.course_code} onChange={(e)=>setEditing(p=>p?{...p, course_code: e.target.value}:p)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Tiêu đề rubric</label>
              <input value={editing.title} onChange={(e)=>setEditing(p=>p?{...p, title: e.target.value}:p)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Ngưỡng đạt (%)</label>
              <input type="number" min={0} max={100} value={editing.threshold} onChange={(e)=>setEditing(p=>p?{...p, threshold: Number(e.target.value)}:p)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Cột (mức đánh giá)</div>
              <button onClick={addColumn} className="px-3 py-1.5 rounded border text-sm">+ Cột</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {editing.columns.map((col, idx) => (
                <div key={idx} className="flex items-center gap-2 border rounded-lg px-2 py-1">
                  <input value={col} onChange={(e)=>setEditing(p=>{ if(!p) return p; const n={...p}; n.columns[idx]=e.target.value; return n; })} className="border rounded px-2 py-1 text-sm" />
                  <button onClick={()=>removeColumn(idx)} className="text-xs text-red-600 hover:underline">Xoá</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Dòng (tiêu chí) & liên kết CLO</div>
              <button onClick={addRow} className="px-3 py-1.5 rounded border text-sm">+ Dòng</button>
            </div>

            <div className="mt-2 overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left border-b w-[26rem]">Tiêu chí</th>
                    <th className="px-3 py-2 text-left border-b w-[10rem]">CLO</th>
                    {editing.columns.map((c,i)=>(<th key={i} className="px-3 py-2 text-left border-b">{c}</th>))}
                    <th className="px-3 py-2 text-left border-b"> </th>
                  </tr>
                </thead>
                <tbody>
                  {editing.rows.map((r,ri)=>(
                    <tr key={r.id} className="odd:bg-gray-50">
                      <td className="px-3 py-2 border-b">
                        <input value={r.criterion} onChange={(e)=>setEditing(p=>{ if(!p) return p; const n={...p}; n.rows[ri].criterion=e.target.value; return n; })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="px-3 py-2 border-b">
                        <input value={r.clo_code || ''} onChange={(e)=>setEditing(p=>{ if(!p) return p; const n={...p}; n.rows[ri].clo_code=e.target.value; return n; })} className="w-full border rounded px-2 py-1" placeholder="VD: CLO1" />
                      </td>
                      {r.cells.map((cell,ci)=>(
                        <td key={cell.id} className="px-3 py-2 border-b">
                          <input value={cell.label} onChange={(e)=>setEditing(p=>{ if(!p) return p; const n={...p}; n.rows[ri].cells[ci].label=e.target.value; return n; })} className="w-full border rounded px-2 py-1" placeholder="-" />
                        </td>
                      ))}
                      <td className="px-3 py-2 border-b">
                        <button onClick={()=>removeRow(r.id)} className="text-xs text-red-600 hover:underline">Xoá</button>
                      </td>
                    </tr>
                  ))}
                  {editing.rows.length===0 && (<tr><td colSpan={editing.columns.length+3} className="px-3 py-6 text-center text-gray-500">Chưa có dòng.</td></tr>)}
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
