// components/framework/FrameworkForm.tsx
'use client';

import type { Framework } from '@/lib/framework-types';

export default function FrameworkForm({
  loading, frameworks, selectedId, setSelectedId,
  form, setForm, onCreate, onDelete,
}: {
  loading: boolean;
  frameworks: Framework[];
  selectedId: string;
  setSelectedId: (v: string) => void;
  form: { doi_tuong: string; chuyen_nganh: string; nien_khoa: string };
  setForm: (v: { doi_tuong: string; chuyen_nganh: string; nien_khoa: string }) => void;
  onCreate: () => void;
  onDelete: () => void;
}) {
  const selected = frameworks.find((f) => f.id === selectedId);

  return (
    <section className="bg-white rounded-xl border p-4 space-y-4">
      <div className="grid md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-4">
          <label className="block text-sm font-semibold mb-1">Đối tượng</label>
          <input className="w-full border rounded-lg px-3 py-2"
                 placeholder="Ví dụ: Đại học / Sau đại học"
                 value={form.doi_tuong}
                 onChange={(e) => setForm({ ...form, doi_tuong: e.target.value })}/>
        </div>
        <div className="md:col-span-4">
          <label className="block text-sm font-semibold mb-1">Chuyên ngành</label>
          <input className="w-full border rounded-lg px-3 py-2"
                 placeholder="Ví dụ: YHCT / Dược cổ truyền"
                 value={form.chuyen_nganh}
                 onChange={(e) => setForm({ ...form, chuyen_nganh: e.target.value })}/>
        </div>
        <div className="md:col-span-4">
          <label className="block text-sm font-semibold mb-1">Niên khoá</label>
          <input className="w-full border rounded-lg px-3 py-2"
                 placeholder="Ví dụ: 2025-2031"
                 value={form.nien_khoa}
                 onChange={(e) => setForm({ ...form, nien_khoa: e.target.value })}/>
        </div>

        <div className="md:col-span-8">
          <label className="block text-sm font-semibold mb-1">Chọn khung</label>
          <select className="w-full border rounded-lg px-3 py-2" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">-- Chọn --</option>
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.doi_tuong} · {f.chuyen_nganh} · {f.nien_khoa}
              </option>
            ))}
          </select>
          {selected && (
            <p className="text-xs text-slate-600 mt-1">Tạo lúc: {new Date(selected.created_at).toLocaleString()}</p>
          )}
        </div>

        <div className="md:col-span-4 flex gap-2 justify-end">
          <button onClick={onCreate}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700"
                  disabled={loading}>Tạo khung</button>
          <button onClick={onDelete} disabled={!selectedId || loading}
                  className={!selectedId || loading
                    ? 'px-4 py-2 rounded-lg border text-gray-400 bg-gray-100 cursor-not-allowed'
                    : 'px-4 py-2 rounded-lg border border-red-600 text-red-600 hover:bg-red-50'}>
            Xoá khung
          </button>
        </div>
      </div>
    </section>
  );
}
