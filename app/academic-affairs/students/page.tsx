'use client';

import { useEffect, useMemo, useState } from 'react';

type Framework = {
  id: string;
  doi_tuong: string;
  chuyen_nganh: string;
  nien_khoa: string;
  created_at: string;
};

type CreateBody = {
  framework_id?: string;
  mssv?: string;
  full_name?: string;
  email?: string;
  password?: string;
};

export default function StudentsPage() {
  // --- Framework chọn khung ---
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedFw, setSelectedFw] = useState<string>('');

  // --- Form tạo 1 sinh viên ---
  const [mssv, setMssv] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- Upload CSV ---
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // --- Trạng thái / Kết quả ---
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // Tải danh sách frameworks (giống trang framework)
  async function loadFrameworks() {
    setLoading(true);
    try {
      const res = await fetch('/api/academic-affairs/framework');
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi tải danh sách khung');
      setFrameworks(js.data || []);
    } catch (e: any) {
      setLog((s) => [`⚠️ ${e?.message || 'Không tải được khung'}`, ...s]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadFrameworks(); }, []);

  const fwInfo = useMemo(
    () => frameworks.find((f) => f.id === selectedFw),
    [frameworks, selectedFw]
  );

  // Helper log
  const pushLog = (msg: string) => setLog((s) => [msg, ...s]);

  // Gửi tạo 1 sinh viên
  async function createOne() {
    if (!selectedFw) { pushLog('⚠️ Chưa chọn khung'); return; }
    if (!mssv || !fullName || !email) { pushLog('⚠️ Thiếu MSSV/Họ tên/Email'); return; }

    const body: CreateBody = {
      framework_id: selectedFw,
      mssv,
      full_name: fullName,
      email,
      password: password || undefined,
    };

    setLoading(true);
    try {
      const res = await fetch('/api/academic-affairs/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Tạo tài khoản thất bại');
      pushLog(`✅ Tạo thành công: ${js?.student?.full_name || fullName} (${mssv})`);
      // reset form nhẹ
      setMssv(''); setFullName(''); setEmail(''); setPassword('');
    } catch (e: any) {
      pushLog(`❌ ${e?.message || 'Lỗi tạo tài khoản'}`);
    } finally {
      setLoading(false);
    }
  }

  // Upload CSV
  async function uploadCsv() {
    if (!selectedFw) { pushLog('⚠️ Chưa chọn khung'); return; }
    if (!csvFile) { pushLog('⚠️ Chưa chọn file CSV'); return; }

    const fd = new FormData();
    fd.append('framework_id', selectedFw);
    fd.append('file', csvFile);

    setLoading(true);
    try {
      const res = await fetch('/api/academic-affairs/students', { method: 'POST', body: fd });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Upload CSV thất bại');

      const results = Array.isArray(js.results) ? js.results : [];
      const ok = results.filter((r: any) => r?.ok).length;
      const fail = results.length - ok;

      pushLog(`✅ Upload CSV xong: ${ok} thành công, ${fail} lỗi`);
      if (fail > 0) {
        // hiện chi tiết lỗi đầu tiên
        const firstErr = results.find((r: any) => !r?.ok)?.error || '(không rõ lỗi)';
        pushLog(`ℹ️ Lỗi ví dụ: ${firstErr}`);
      }
      setCsvFile(null);
    } catch (e: any) {
      pushLog(`❌ ${e?.message || 'Lỗi upload CSV'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tài khoản sinh viên</h1>

      {/* Chọn khung */}
      <section className="bg-white rounded-xl border p-4 space-y-2">
        <div className="font-medium">Chọn khung CTĐT</div>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={selectedFw}
          onChange={(e) => setSelectedFw(e.target.value)}
        >
          <option value="">-- Chọn khung --</option>
          {frameworks.map((f) => (
            <option key={f.id} value={f.id}>
              {f.doi_tuong} · {f.chuyen_nganh} · {f.nien_khoa}
            </option>
          ))}
        </select>
        {fwInfo && (
          <p className="text-xs text-slate-600">
            Tạo lúc: {new Date(fwInfo.created_at).toLocaleString()}
          </p>
        )}
      </section>

      {/* Tạo 1 tài khoản */}
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Tạo một sinh viên</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1">MSSV</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={mssv}
              onChange={(e) => setMssv(e.target.value)}
              placeholder="VD: 22DH001"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Họ tên</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sv@example.edu.vn"
              type="email"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Mật khẩu (tùy chọn)</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Bỏ trống sẽ dùng Password123!"
              type="password"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={createOne}
            disabled={!selectedFw || loading || !mssv || !fullName || !email}
            className={
              !selectedFw || loading || !mssv || !fullName || !email
                ? 'px-4 py-2 rounded-lg bg-gray-300 text-white cursor-not-allowed'
                : 'px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700'
            }
          >
            Tạo tài khoản
          </button>
        </div>
      </section>

      {/* Upload CSV */}
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Tải danh sách từ CSV</h2>
        <p className="text-sm text-slate-600">
          CSV cần **header** (tiếng Việt cũng được): <code>MSSV,Họ tên,Email,Mật khẩu</code>.
          Có thể bỏ trống cột <i>Mật khẩu</i> — hệ thống dùng mặc định <code>Password123!</code>.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="block"
          />
          {csvFile && <span className="text-xs text-slate-500 truncate" title={csvFile.name}>{csvFile.name}</span>}
          <div className="flex-1" />
          <button
            onClick={uploadCsv}
            disabled={!selectedFw || !csvFile || loading}
            className={
              !selectedFw || !csvFile || loading
                ? 'px-4 py-2 rounded-lg bg-gray-300 text-white cursor-not-allowed'
                : 'px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700'
            }
          >
            Tải lên CSV
          </button>
        </div>

        {/* Ví dụ CSV */}
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-slate-700">Ví dụ CSV</summary>
          <pre className="mt-2 p-2 bg-slate-50 rounded text-xs overflow-auto">
{`MSSV,Họ tên,Email,Mật khẩu
22DH0001,Nguyễn Văn A,a@uni.edu.vn,Password123!
22DH0002,Trần Thị B,b@uni.edu.vn,
`}
          </pre>
        </details>
      </section>

      {/* Nhật ký kết quả */}
      <section className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Kết quả thao tác</h2>
          <button
            className="text-xs underline text-slate-500"
            onClick={() => setLog([])}
            disabled={!log.length}
          >
            Xoá log
          </button>
        </div>
        {!log.length ? (
          <p className="text-sm text-slate-500 mt-1">Chưa có log.</p>
        ) : (
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
