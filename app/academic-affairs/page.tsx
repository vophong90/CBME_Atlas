// app/academic-affairs/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Framework = {
  id: string;
  doi_tuong: string;
  chuyen_nganh: string;
  nien_khoa: string;
  created_at: string;
};

export default function AcademicAffairsPage() {
  const [loading, setLoading] = useState(false);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });

  async function fetchFrameworks() {
    const res = await fetch('/api/academic-affairs/framework');
    const js = await res.json();
    setFrameworks(js.data || []);
    if (!selectedId && js.data?.length) setSelectedId(js.data[0].id);
  }

  useEffect(() => {
    fetchFrameworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createFramework() {
    setLoading(true);
    try {
      const res = await fetch('/api/academic-affairs/framework', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi tạo khung');
      setForm({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });
      await fetchFrameworks();
    } finally {
      setLoading(false);
    }
  }

  async function deleteFramework() {
    if (!selectedId) return;
    if (!confirm('Xoá khung này? Toàn bộ PLO/PI/Liên kết/Sinh viên liên quan cũng sẽ bị xoá.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/academic-affairs/framework?id=${selectedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi xoá khung');
      setSelectedId('');
      await fetchFrameworks();
    } finally {
      setLoading(false);
    }
  }

  async function uploadCSV(kind: string, file: File | null) {
    if (!selectedId || !file) return;
    const fd = new FormData();
    fd.append('framework_id', selectedId);
    fd.append('kind', kind);
    fd.append('file', file);
    const res = await fetch('/api/academic-affairs/upload', { method: 'POST', body: fd });
    const js = await res.json();
    if (!res.ok) alert(js.error || 'Upload lỗi'); else alert('Tải lên thành công!');
  }

  async function createStudentOne(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      framework_id: selectedId,
      mssv: String(fd.get('mssv') || ''),
      full_name: String(fd.get('full_name') || ''),
      dob: String(fd.get('dob') || ''), // YYYY-MM-DD
      email: String(fd.get('email') || ''),
      password: String(fd.get('password') || 'Password123!'),
    };
    const res = await fetch('/api/academic-affairs/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const js = await res.json();
    if (!res.ok) alert(js.error || 'Lỗi tạo tài khoản'); else alert('Đã tạo tài khoản sinh viên!');
    (e.target as HTMLFormElement).reset();
  }

  async function uploadStudentsCSV(file: File | null) {
    if (!selectedId || !file) return;
    const fd = new FormData();
    fd.append('framework_id', selectedId);
    fd.append('file', file);
    const res = await fetch('/api/academic-affairs/students', { method: 'POST', body: fd });
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Upload lỗi'); return; }
    alert('Kết quả tạo tài khoản: ' + JSON.stringify(js.results, null, 2));
  }

  const selected = frameworks.find((f) => f.id === selectedId);

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-10">
      <h1 className="text-2xl font-bold">Quản lý đào tạo</h1>

      {/* Chọn khung hiện hành */}
      <section className="rounded-xl border bg-white p-5 shadow">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-1">Khung chương trình hiện hành</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— Chưa chọn —</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.doi_tuong} • {f.chuyen_nganh} • {f.nien_khoa}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-gray-600 mt-1">
                Tạo lúc: {new Date(selected.created_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={deleteFramework}
              disabled={!selectedId || loading}
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            >
              Xoá khung
            </button>
          </div>
        </div>
      </section>

      {/* 1) Tạo Khung CTĐT */}
      <section className="rounded-xl border bg-white p-5 shadow">
        <h2 className="text-lg font-semibold">1) Tạo Khung chương trình đào tạo</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Đối tượng</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ví dụ: Đại học / Sau đại học"
              value={form.doi_tuong}
              onChange={(e) => setForm({ ...form, doi_tuong: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Chuyên ngành</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ví dụ: Bác sĩ Y học cổ truyền"
              value={form.chuyen_nganh}
              onChange={(e) => setForm({ ...form, chuyen_nganh: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Niên khoá</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ví dụ: 2025-2031"
              value={form.nien_khoa}
              onChange={(e) => setForm({ ...form, nien_khoa: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={createFramework}
            disabled={loading || !form.doi_tuong || !form.chuyen_nganh || !form.nien_khoa}
            className="px-4 py-2 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700"
          >
            Tạo khung
          </button>
        </div>

        {/* Uploads */}
        <div className="mt-8 grid lg:grid-cols-3 gap-6">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Tải PLO (CSV)</h3>
            <p className="text-xs text-gray-600">2 cột: Mã PLO, Nội dung PLO</p>
            <input
              type="file"
              accept=".csv"
              className="mt-2 block w-full"
              onChange={(e) => uploadCSV('plo', e.target.files?.[0] || null)}
              disabled={!selectedId}
            />
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Tải PI (CSV)</h3>
            <p className="text-xs text-gray-600">2 cột: Mã PI, Nội dung PI</p>
            <input
              type="file"
              accept=".csv"
              className="mt-2 block w-full"
              onChange={(e) => uploadCSV('pi', e.target.files?.[0] || null)}
              disabled={!selectedId}
            />
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Liên kết PLO–PI (CSV)</h3>
            <p className="text-xs text-gray-600">2 cột: Mã PLO, Mã PI</p>
            <input
              type="file"
              accept=".csv"
              className="mt-2 block w-full"
              onChange={(e) => uploadCSV('plo_pi', e.target.files?.[0] || null)}
              disabled={!selectedId}
            />
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Liên kết PLO–CLO (CSV)</h3>
            <p className="text-xs text-gray-600">4 cột: Mã PLO, Mã học phần, Mã CLO, Mức độ liên kết PLO-PLO</p>
            <input
              type="file"
              accept=".csv"
              className="mt-2 block w-full"
              onChange={(e) => uploadCSV('plo_clo', e.target.files?.[0] || null)}
              disabled={!selectedId}
            />
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Liên kết PI–CLO (CSV)</h3>
            <p className="text-xs text-gray-600">4 cột: Mã PI, Mã học phần, Mã CLO, Mức độ liên kết PI-CLO</p>
            <input
              type="file"
              accept=".csv"
              className="mt-2 block w-full"
              onChange={(e) => uploadCSV('pi_clo', e.target.files?.[0] || null)}
              disabled={!selectedId}
            />
          </div>
        </div>
      </section>

      {/* 2) Tạo tài khoản sinh viên */}
      <section className="rounded-xl border bg-white p-5 shadow">
        <h2 className="text-lg font-semibold">2) Tạo tài khoản sinh viên</h2>

        <div className="grid lg:grid-cols-2 gap-6 mt-4">
          {/* Đơn lẻ */}
          <form onSubmit={createStudentOne} className="rounded-lg border p-4">
            <h3 className="font-semibold">Tạo đơn lẻ</h3>
            <p className="text-xs text-gray-600 mb-3">Gắn với khung đang chọn</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">MSSV</label>
                <input name="mssv" className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Họ tên</label>
                <input name="full_name" className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Ngày sinh (YYYY-MM-DD)</label>
                <input name="dob" className="w-full border rounded-lg px-3 py-2" placeholder="2003-08-15" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input name="email" type="email" className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Mật khẩu mặc định</label>
                <input name="password" className="w-full border rounded-lg px-3 py-2" placeholder="Password123!" />
              </div>
            </div>
            <button
              disabled={!selectedId}
              className="mt-3 px-4 py-2 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700"
            >
              Tạo tài khoản
            </button>
          </form>

          {/* CSV batch */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Tải CSV danh sách sinh viên</h3>
            <p className="text-xs text-gray-600">
              Cột: <strong>MSSV,Họ tên,Ngày sinh(YYYY-MM-DD),Email,Mật khẩu</strong>
            </p>
            <input
              type="file"
              accept=".csv"
              className="mt-2 block w-full"
              onChange={(e) => uploadStudentsCSV(e.target.files?.[0] || null)}
              disabled={!selectedId}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
