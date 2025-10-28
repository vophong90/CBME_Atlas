'use client';
import { useEffect, useState } from 'react';

type FormRow = {
  id: string;
  title: string;
  group_code: string;
  rubric_id: string;
  framework_id?: string|null;
  course_code?: string|null;
  status: 'active'|'inactive';
};

export default function Eval360FormsPage() {
  const [items, setItems] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('peer');
  const [rubricId, setRubricId] = useState('');
  const [status, setStatus] = useState<'active'|'inactive'>('active');
  const [rubrics, setRubrics] = useState<Array<{ id: string; title: string }>>([]);
  const [editingId, setEditingId] = useState<string|undefined>();

  async function load() {
    setLoading(true);
    const r = await fetch('/api/360/forms?status=active'); // có thể thêm filter group_code
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  }
  useEffect(()=>{ load(); }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/rubrics/list');
      const d = await r.json();
      setRubrics((d.items || []).map((x: any) => ({ id: x.id, title: x.title })));
    })();
  }, []);

  async function save() {
    if (!title || !rubricId) return alert('Thiếu tiêu đề/biểu mẫu');
    const r = await fetch('/api/360/forms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: editingId,
        title, group_code: group, rubric_id: rubricId, status
      })
    });
    const d = await r.json();
    if (!r.ok) return alert(d?.error || 'Lỗi lưu');
    setTitle(''); setRubricId(''); setEditingId(undefined);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Xoá biểu mẫu?')) return;
    const r = await fetch(`/api/360/forms?id=${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) return alert(d?.error || 'Lỗi xoá');
    load();
  }

  function edit(it: FormRow) {
    setEditingId(it.id);
    setTitle(it.title);
    setGroup(it.group_code);
    setRubricId(it.rubric_id);
    setStatus(it.status);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold mb-2">{editingId ? 'Sửa biểu mẫu' : 'Tạo biểu mẫu'}</div>
        <div className="grid gap-3 md:grid-cols-3">
          <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Tiêu đề"
                 className="rounded-lg border px-3 py-2 text-sm" />
          <select value={group} onChange={(e)=>setGroup(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm">
            <option value="faculty">Giảng viên</option>
            <option value="peer">Sinh viên đánh giá nhau</option>
            <option value="self">Sinh viên tự đánh giá</option>
            <option value="supervisor">Người hướng dẫn</option>
            <option value="patient">Bệnh nhân</option>
          </select>
          <select value={rubricId} onChange={(e)=>setRubricId(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm">
            <option value="">— Chọn rubric —</option>
            {rubrics.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <select value={status} onChange={(e)=>setStatus(e.target.value as any)}
                  className="rounded-lg border px-3 py-2 text-sm">
            <option value="active">Kích hoạt</option>
            <option value="inactive">Ngừng</option>
          </select>
          <div className="md:col-span-3 flex gap-2">
            <button onClick={save} className="rounded-lg bg-brand-600 px-4 py-2 text-white">Lưu</button>
            {editingId && (
              <button onClick={() => { setEditingId(undefined); setTitle(''); setRubricId(''); }}
                      className="rounded-lg border px-4 py-2">Huỷ</button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold mb-2">Danh sách biểu mẫu</div>
        {loading ? 'Đang tải…' : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-3 py-2 text-left">Tiêu đề</th>
                  <th className="border px-3 py-2">Nhóm</th>
                  <th className="border px-3 py-2">Trạng thái</th>
                  <th className="border px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id}>
                    <td className="border px-3 py-2">{it.title}</td>
                    <td className="border px-3 py-2 text-center">{it.group_code}</td>
                    <td className="border px-3 py-2 text-center">{it.status}</td>
                    <td className="border px-3 py-2 text-right">
                      <button onClick={()=>edit(it)} className="mr-2 rounded border px-2 py-1">Sửa</button>
                      <button onClick={()=>remove(it.id)} className="rounded border px-2 py-1 text-red-600">Xoá</button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td className="border px-3 py-4 text-center text-slate-500" colSpan={4}>Chưa có biểu mẫu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
