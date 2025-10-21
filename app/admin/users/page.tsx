'use client';
import { useEffect, useMemo, useState } from 'react';

type StaffRow = { user_id: string; email: string; full_name: string; is_active: boolean; roles: string[]; departments: string[] };

export default function AdminUsersPage() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [q, setQ] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [form, setForm] = useState<{ email: string; full_name: string; roles: string; department_code?: string }>({ email: '', full_name: '', roles: '' });
  const [resetTarget, setResetTarget] = useState<{ user_id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // TODO: fetch dữ liệu thật từ /api (hiện mock)
  useEffect(() => {
    setRows([
      { user_id: 'uuid-1', email: 'gv1@uni.edu', full_name: 'GV Một', is_active: true, roles: ['lecturer','qa'], departments: ['YHCT'] },
      { user_id: 'uuid-2', email: 'admin@uni.edu', full_name: 'Quản trị', is_active: true, roles: ['admin'], departments: [] },
    ]);
  }, []);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter(r => [r.email, r.full_name, ...r.roles, ...r.departments].join(' ').toLowerCase().includes(k));
  }, [q, rows]);

  async function onImportConfirm() {
    // gửi JSON đã map từ CSV lên API
    const payload = csvPreview.map(x => ({
      email: x.email,
      full_name: x.full_name,
      department_code: x.department_code || null,
      roles: x.roles || null,
      password: x.password || null,
    }));
    const res = await fetch('/api/admin/users/bulk-import', { method: 'POST', body: JSON.stringify(payload) });
    const json = await res.json();
    alert('Import done:\n' + JSON.stringify(json.results, null, 2));
    setShowImport(false);
    setCsvPreview([]);
    // TODO: refetch
  }

  async function onResetPassword() {
    if (!resetTarget || !newPassword) return;
    const res = await fetch('/api/admin/reset-password', { method: 'POST', body: JSON.stringify({ userId: resetTarget.user_id, newPassword }) });
    const json = await res.json();
    if (json?.ok) alert(`Đã đặt lại mật khẩu cho ${resetTarget.email}`);
    else alert(`Lỗi: ${json?.error || 'unknown'}`);
    setResetTarget(null);
    setNewPassword('');
  }

  function parseCSV(text: string) {
    // Parser nhỏ (khuyên dùng PapaParse ở client nếu bạn muốn robust)
    // CSV header: email,full_name,department_code,roles,password
    const lines = text.trim().split(/\r?\n/);
    const header = lines.shift()!.split(',').map(s => s.trim());
    const arr = lines.map(line => {
      const cells = line.split(',').map(s => s.trim());
      const obj: any = {};
      header.forEach((h, i) => obj[h] = cells[i] ?? '');
      return obj;
    });
    setCsvPreview(arr);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Quản lý nhân sự</div>
          <div className="text-slate-600 text-sm">Tạo/Sửa/Xoá tài khoản, gán vai trò, đặt lại mật khẩu, import CSV.</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="rounded-xl border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Import CSV</button>
          <button className="rounded-xl bg-slate-900 px-3 py-1.5 text-white">+ Thêm nhân sự</button>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex items-center gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên, email, vai trò, bộ môn..." className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2">Họ tên</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Bộ môn</th>
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.user_id} className="border-t">
                  <td className="px-3 py-2">{r.full_name}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{r.departments.join(', ') || '-'}</td>
                  <td className="px-3 py-2">{r.roles.join(', ')}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="rounded-lg border px-2 py-1 mr-2 hover:bg-slate-50">Sửa</button>
                    <button className="rounded-lg border px-2 py-1 mr-2 hover:bg-slate-50" onClick={() => setResetTarget({ user_id: r.user_id, email: r.email })}>Đặt lại mật khẩu</button>
                    <button className="rounded-lg border px-2 py-1 text-red-600 hover:bg-red-50">Xoá</button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={5}>Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import CSV modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-lg font-semibold">Import CSV</div>
            <p className="text-sm text-slate-500">Header yêu cầu: <code>email,full_name,department_code,roles,password</code></p>
            <textarea rows={6} onChange={e => parseCSV(e.target.value)} placeholder="Dán CSV vào đây..." className="mt-3 w-full rounded-xl border border-slate-200 p-2 font-mono text-xs"></textarea>
            {csvPreview.length > 0 && (
              <div className="mt-3 rounded-xl border border-slate-200 p-2">
                <div className="text-sm font-medium mb-2">Xem trước ({csvPreview.length})</div>
                <div className="max-h-56 overflow-auto text-xs">
                  <table className="min-w-full">
                    <thead><tr>{Object.keys(csvPreview[0]).map(h => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
                    <tbody>{csvPreview.map((r,i) => <tr key={i}>{Object.values(r).map((v,j) => <td key={j} className="px-2 py-1">{String(v)}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setShowImport(false); setCsvPreview([]); }} className="rounded-xl border px-3 py-1.5">Huỷ</button>
              <button onClick={onImportConfirm} className="rounded-xl bg-slate-900 px-3 py-1.5 text-white">Nhập</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-lg font-semibold">Đặt lại mật khẩu</div>
            <div className="mt-1 text-sm text-slate-600">{resetTarget.email}</div>
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mật khẩu mới" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setResetTarget(null)} className="rounded-xl border px-3 py-1.5">Huỷ</button>
              <button onClick={onResetPassword} className="rounded-xl bg-slate-900 px-3 py-1.5 text-white">Cập nhật</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
