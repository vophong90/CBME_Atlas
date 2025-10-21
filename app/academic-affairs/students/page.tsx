'use client';

import { useEffect, useState } from 'react';

type Framework = {
  id: string;
  doi_tuong: string;
  chuyen_nganh: string;
  nien_khoa: string;
};

export default function StudentsPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [studentCsv, setStudentCsv] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/academic-affairs/framework');
      const js = await res.json();
      setFrameworks(js.data || []);
      if (!selectedId && js.data?.length) setSelectedId(js.data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createStudentOne(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      framework_id: selectedId,
      mssv: String(fd.get('mssv') || ''),
      full_name: String(fd.get('full_name') || ''),
      dob: String(fd.get('dob') || ''),
      email: String(fd.get('email') || ''),
      password: String(fd.get('password') || 'Password123!'),
    };
    const res = await fetch('/api/academic-affairs/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const js = await res.json();
    if (!res.ok) alert(js.error || 'Lỗi tạo tài khoản');
    else alert('Đã tạo tài khoản sinh viên!');
    (e.target as HTMLFormElement).reset();
  }

  async function uploadStudentsCSV() {
    if (!selectedId || !studentCsv) return;
    const fd = new FormData();
    fd.append('framework_id', selectedId);
    fd.append('file', studentCsv);
    const res = await fetch('/api/academic-affairs/students', { method: 'POST', body: fd });
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Upload lỗi'); return; }
    alert('Kết quả tạo tài khoản: ' + JSON.stringify(js.results, null, 2));
    setStudentCsv(null);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tài khoản sinh viên</h1>

      <section className="rounded-xl border bg-white p-5 shadow space-y-6">
        {/* Khung áp dụng */}
        <div>
          <label className="block text-sm font-semibold mb-1">Khung chương trình áp dụng</label>
          <select
            className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
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
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Đơn lẻ */}
          <form onSubmit={createStudentOne} className="rounded-lg border p-4">
            <h3 className="font-semibold">Tạo đơn lẻ</h3>
            <p className="text-xs text-slate-600 mb-3">Gắn với khung đang chọn</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">MSSV</label>
                <input name="mssv" className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Họ tên</label>
                <input name="full_name" className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Ngày sinh (YYYY-MM-DD)</label>
                <input name="dob" className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300" placeholder="2003-08-15" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input name="email" type="email" className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Mật khẩu mặc định</label>
                <input name="password" className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300" placeholder="Password123!" />
              </div>
            </div>
            <button
              disabled={!selectedId}
              className={
                !selectedId
                  ? 'mt-3 px-4 py-2 rounded-lg font-semibold bg-gray-300 text-white cursor-not-allowed'
                  : 'mt-3 px-4 py-2 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700'
              }
            >
              Tạo tài khoản
            </button>
          </form>

          {/* CSV batch */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Tải CSV danh sách sinh viên</h3>
            <p className="text-xs text-slate-600">
              Cột: <strong>MSSV,Họ tên,Ngày sinh(YYYY-MM-DD),Email,Mật khẩu</strong>
            </p>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="file"
                accept=".csv"
                className="block w-full"
                onChange={(e) => setStudentCsv(e.target.files?.[0] || null)}
                disabled={!selectedId}
              />
              <button
                onClick={uploadStudentsCSV}
                disabled={!selectedId || !studentCsv}
                className={
                  !selectedId || !studentCsv
                    ? 'px-3 py-1.5 rounded bg-gray-300 text-white text-sm cursor-not-allowed'
                    : 'px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700'
                }
              >
                Tải lên & tạo tài khoản
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
