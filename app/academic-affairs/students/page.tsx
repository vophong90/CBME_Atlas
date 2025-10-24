'use client';

import { useEffect, useMemo, useState } from 'react';

type Framework = {
  id: string;
  doi_tuong: string;
  chuyen_nganh: string;
  nien_khoa: string;
  created_at: string;
};

type Student = {
  id: string;
  user_id: string | null;
  student_code: string | null;
  full_name: string | null;
  mssv: string | null;
  framework_id: string;
};

type CreateBody = {
  framework_id?: string;
  mssv?: string;
  full_name?: string;
  email?: string;
  password?: string;
};

export default function StudentsPage() {
  // --- Framework ---
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedFw, setSelectedFw] = useState<string>('');

  // --- Create one ---
  const [mssv, setMssv] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- CSV upload ---
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // --- List/search/pagination ---
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);

  // --- State ---
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (msg: string) => setLog((s) => [msg, ...s]);

  // Load frameworks
  async function loadFrameworks() {
    setLoading(true);
    try {
      const res = await fetch('/api/academic-affairs/framework');
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi tải danh sách khung');
      setFrameworks(js.data || []);
    } catch (e: any) {
      pushLog(`⚠️ ${e?.message || 'Không tải được khung'}`);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadFrameworks(); }, []);

  const fwInfo = useMemo(() => frameworks.find((f) => f.id === selectedFw), [frameworks, selectedFw]);

  // Load list students
  async function loadStudents(p = page) {
    if (!selectedFw) { setRows([]); setTotal(0); return; }
    try {
      const sp = new URLSearchParams({
        framework_id: selectedFw,
        q: q || '',
        page: String(p),
        limit: String(limit),
      });
      const res = await fetch(`/api/academic-affairs/students?` + sp.toString());
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi tải danh sách SV');
      setRows(js.data || []);
      setTotal(js.count || 0);
    } catch (e: any) {
      pushLog(`❌ ${e?.message || 'Lỗi tải danh sách SV'}`);
    }
  }
  useEffect(() => { if (selectedFw) loadStudents(1); }, [selectedFw]); // reset page when fw changes

  // Create one
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
      setMssv(''); setFullName(''); setEmail(''); setPassword('');
      loadStudents(page); // refresh list
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
        const firstErr = results.find((r: any) => !r?.ok)?.error || '(không rõ lỗi)';
        pushLog(`ℹ️ Lỗi ví dụ: ${firstErr}`);
      }
      setCsvFile(null);
      loadStudents(page); // refresh list
    } catch (e: any) {
      pushLog(`❌ ${e?.message || 'Lỗi upload CSV'}`);
    } finally {
      setLoading(false);
    }
  }

  // Actions: reset password / delete
  async function resetPassword(student_id: string) {
    const suggest = window.prompt('Nhập mật khẩu mới (để trống = hệ thống tự sinh):', '');
    try {
      const res = await fetch('/api/academic-affairs/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, new_password: suggest || undefined }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Đặt lại mật khẩu thất bại');
      pushLog(`🔐 Mật khẩu mới: ${js.password}`);
      window.alert(`Mật khẩu mới: ${js.password}`);
    } catch (e: any) {
      pushLog(`❌ ${e?.message || 'Lỗi đặt lại mật khẩu'}`);
    }
  }

  async function deleteStudent(student_id: string) {
    if (!window.confirm('Bạn chắc muốn xóa sinh viên này? Thao tác này không thể hoàn tác.')) return;
    try {
      const res = await fetch('/api/academic-affairs/students', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Xóa thất bại');
      pushLog(`🗑️ Đã xóa sinh viên`);
      loadStudents(page);
    } catch (e: any) {
      pushLog(`❌ ${e?.message || 'Lỗi xóa sinh viên'}`);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tài khoản sinh viên</h1>

      {/* Chọn khung */}
      <section className="bg-white rounded-xl border p-4 space-y-2">
        <div className="font-medium">Chọn khung CTĐT</div>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={selectedFw}
          onChange={(e) => { setSelectedFw(e.target.value); setPage(1); }}
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
            <input className="w-full border rounded-lg px-3 py-2" value={mssv} onChange={(e) => setMssv(e.target.value)} placeholder="VD: 22DH001"/>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Họ tên</label>
            <input className="w-full border rounded-lg px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A"/>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input className="w-full border rounded-lg px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="sv@example.edu.vn"/>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Mật khẩu (tùy chọn)</label>
            <input className="w-full border rounded-lg px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Bỏ trống sẽ dùng Password123!"/>
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
          CSV cần **header**: <code>MSSV,Họ tên,Email,Mật khẩu</code>. Có thể bỏ trống <i>Mật khẩu</i> — hệ thống dùng mặc định <code>Password123!</code>.
        </p>
        <div className="flex items-center gap-3">
          <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="block"/>
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
      </section>

      {/* Danh sách sinh viên + tìm kiếm */}
      <section className="bg-white rounded-xl border p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-1">Tìm kiếm (MSSV / Họ tên)</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); loadStudents(1); } }}
              placeholder="Nhập từ khóa rồi Enter"
            />
          </div>
          <button
            onClick={() => { setPage(1); loadStudents(1); }}
            disabled={!selectedFw}
            className={!selectedFw ? 'px-4 py-2 rounded-lg bg-gray-300 text-white cursor-not-allowed'
              : 'px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700'}
          >
            Tìm
          </button>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 font-medium">MSSV</th>
                <th className="px-3 py-2 font-medium">Họ tên</th>
                <th className="px-3 py-2 font-medium w-40">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td className="px-3 py-4 text-slate-500" colSpan={3}>Không có dữ liệu</td></tr>
              ) : rows.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">{s.mssv || s.student_code || ''}</td>
                  <td className="px-3 py-2">{s.full_name || ''}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => resetPassword(s.id)}
                        className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                      >
                        Đặt lại mật khẩu
                      </button>
                      <button
                        onClick={() => deleteStudent(s.id)}
                        className="px-2 py-1 rounded border border-red-600 text-red-600 text-xs hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <div>Tổng: <b>{total}</b> — Trang <b>{page}</b> / {Math.max(1, Math.ceil(total / limit))}</div>
          <div className="flex gap-2">
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); loadStudents(p); }}
              disabled={page <= 1}
              className={page <= 1 ? 'px-3 py-1.5 rounded bg-gray-200 text-white cursor-not-allowed'
                : 'px-3 py-1.5 rounded border hover:bg-gray-50'}
            >
              ← Trước
            </button>
            <button
              onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); loadStudents(p); }}
              disabled={page >= totalPages}
              className={page >= totalPages ? 'px-3 py-1.5 rounded bg-gray-200 text-white cursor-not-allowed'
                : 'px-3 py-1.5 rounded border hover:bg-gray-50'}
            >
              Sau →
            </button>
          </div>
        </div>
      </section>

      {/* Nhật ký */}
      <section className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Kết quả thao tác</h2>
          <button className="text-xs underline text-slate-500" onClick={() => setLog([])} disabled={!log.length}>Xoá log</button>
        </div>
        {!log.length ? (
          <p className="text-sm text-slate-500 mt-1">Chưa có log.</p>
        ) : (
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
