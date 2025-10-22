'use client';

import { useEffect, useMemo, useState } from 'react';

// ===== UI helpers: đồng bộ palette brand =====
const BTN_BRAND =
  'px-3 py-1.5 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed';
const BTN_BRAND_OUTLINE =
  'px-3 py-1.5 rounded-lg font-semibold border border-brand-300 text-brand-700 hover:bg-brand-50 disabled:opacity-60';
const BTN_NEUTRAL_OUTLINE =
  'px-3 py-1.5 rounded-lg font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60';
const BTN_DANGER_OUTLINE =
  'px-3 py-1.5 rounded-lg font-semibold border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60';

const INPUT =
  'w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300';
const INPUT_SM =
  'w-full border rounded-lg px-2 py-1 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300';

// ===== Types =====
type StaffRow = {
  user_id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  // các field khác nếu API có trả cũng không dùng ở UI này
};

// --- CSV parser đơn giản (không hỗ trợ nhiều dòng trong 1 ô) ---
function splitCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}
function parseCsvText(text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    .filter((l) => l.trim().length);
  if (!lines.length) return [];
  const header = splitCSVLine(lines[0]).map(h => h.trim());
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const obj: any = {};
    header.forEach((h, j) => (obj[h] = cells[j] ?? ''));
    rows.push(obj);
  }
  return rows;
}

export default function AdminUsersPage() {
  // ===== state danh sách / tải =====
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [q, setQ] = useState('');

  // ===== import CSV =====
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // ===== tạo nhanh 1 user =====
  const [newRowMode, setNewRowMode] = useState(false);
  const [newRow, setNewRow] = useState({ email: '', full_name: '', password: '' });
  const [creating, setCreating] = useState(false);

  // ===== reset password modal =====
  const [resetTarget, setResetTarget] = useState<{ user_id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // ===== sửa inline =====
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<{ user_id: string; email: string; full_name: string; is_active: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  // ===== xóa =====
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ===== fetch danh sách thật từ /api/admin/users/list =====
  async function refetchList() {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/admin/users/list', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fetch list failed');
      setRows((json.rows || []) as StaffRow[]);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Không tải được danh sách.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refetchList(); }, []);

  // ===== lọc nhanh =====
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      [r.email, r.full_name].join(' ').toLowerCase().includes(k),
    );
  }, [q, rows]);

  // ===== import CSV =====
  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setImportFile(f);
    setCsvPreview([]);
    if (!f) return;
    const text = await f.text();
    const parsed = parseCsvText(text);
    // chỉ lấy 3 cột này nếu có; bỏ qua cột khác
    const norm = parsed.map((r) => ({
      email: (r.email || '').trim(),
      full_name: (r.full_name || '').trim(),
      password: (r.password || '').trim(),
    }));
    const missing = norm.filter((r) => !r.email || !r.full_name).length;
    if (missing) alert(`Có ${missing} dòng thiếu email hoặc full_name.`);
    setCsvPreview(norm);
  }
  async function onImportConfirm() {
    if (!csvPreview.length) return;
    setImporting(true);
    try {
      // API bulk-import chấp nhận thiếu department_code/roles -> server sẽ random password nếu trống
      const payload = csvPreview.map((x) => ({
        email: x.email,
        full_name: x.full_name,
        password: x.password || null,
      }));
      const res = await fetch('/api/admin/users/bulk-import', { method: 'POST', body: JSON.stringify(payload) });
      const json = await res.json();
      alert('Kết quả:\n' + JSON.stringify(json.results, null, 2));
      setShowImport(false); setImportFile(null); setCsvPreview([]);
      await refetchList();
    } finally { setImporting(false); }
  }

  // ===== tạo nhanh 1 user =====
  function openNewRow() {
    setNewRowMode(true);
    setNewRow({ email: '', full_name: '', password: '' });
  }
  async function createNewUser() {
    if (!newRow.email || !newRow.full_name) { alert('Nhập Email & Họ tên'); return; }
    setCreating(true);
    try {
      const payload = [{ email: newRow.email, full_name: newRow.full_name, password: newRow.password || null }];
      const res = await fetch('/api/admin/users/bulk-import', { method: 'POST', body: JSON.stringify(payload) });
      const json = await res.json();
      const r = json?.results?.[0];
      if (!r?.ok) { alert('Lỗi: ' + (r?.error || 'unknown')); return; }
      setNewRowMode(false); await refetchList();
    } finally { setCreating(false); }
  }

  // ===== sửa inline =====
  function onEdit(r: StaffRow) {
    setEditId(r.user_id);
    setEditRow({ user_id: r.user_id, email: r.email, full_name: r.full_name, is_active: r.is_active });
  }
  function onCancelEdit() { setEditId(null); setEditRow(null); }
  async function onSaveEdit() {
    if (!editRow) return;
    setSaving(true);
    try {
      // chỉ cập nhật trường cơ bản, không đụng vai trò/bộ môn
      const payload = {
        user_id: editRow.user_id,
        email: editRow.email?.trim(),
        full_name: editRow.full_name?.trim(),
        is_active: !!editRow.is_active,
      };
      const res = await fetch('/api/admin/users/update', { method: 'POST', body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json?.ok) { alert('Cập nhật lỗi: ' + (json?.error || 'unknown')); return; }
      await refetchList(); onCancelEdit();
    } finally { setSaving(false); }
  }

  // ===== reset password =====
  async function onResetPassword() {
    if (!resetTarget || !newPassword) return;
    const res = await fetch('/api/admin/reset-password', { method: 'POST', body: JSON.stringify({ userId: resetTarget.user_id, newPassword }) });
    const json = await res.json();
    if (!json?.ok) alert(`Lỗi: ${json?.error || 'unknown'}`); else alert(`Đã đặt lại mật khẩu cho ${resetTarget.email}`);
    setResetTarget(null); setNewPassword('');
  }

  // ===== xóa user =====
  async function onDeleteUser(user: StaffRow) {
    if (!confirm(`Xoá tài khoản: ${user.full_name} (${user.email})?`)) return;
    setDeletingId(user.user_id);
    try {
      const res = await fetch('/api/admin/users/delete', { method: 'POST', body: JSON.stringify({ userId: user.user_id }) });
      const json = await res.json();
      if (!res.ok || !json?.ok) { alert(json?.error || 'Xoá thất bại'); return; }
      await refetchList();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý nhân sự</h1>

      {!!errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          Không tải được danh sách: {errorMsg}
        </div>
      )}

      <section className="rounded-xl border bg-white p-5 shadow space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-slate-600 text-sm">Tạo/Sửa/Xoá, đặt lại mật khẩu, import CSV.</div>
          <div className="flex items-center gap-2">
            <button onClick={refetchList} className={BTN_BRAND_OUTLINE}>Làm mới</button>
            <button onClick={() => setShowImport(true)} className={BTN_NEUTRAL_OUTLINE}>Import CSV</button>
            <button onClick={openNewRow} className={BTN_BRAND}>+ Thêm nhân sự</button>
          </div>
        </div>

        {/* Tìm kiếm */}
        <div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, email..." className={INPUT} />
        </div>

        {/* Bảng */}
        <div className="rounded-lg border">
          {loading ? (
            <div className="p-6 text-slate-500 text-sm">Đang tải dữ liệu nhân sự…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Kích hoạt</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Dòng thêm mới */}
                  {newRowMode && (
                    <tr className="border-t bg-slate-50">
                      <td className="px-3 py-2">
                        <input value={newRow.full_name} onChange={(e)=>setNewRow(s=>({...s,full_name:e.target.value}))} placeholder="Họ tên" className={INPUT_SM}/>
                      </td>
                      <td className="px-3 py-2">
                        <input value={newRow.email} onChange={(e)=>setNewRow(s=>({...s,email:e.target.value}))} placeholder="email@uni.edu" className={INPUT_SM}/>
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-center">—</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <input value={newRow.password} onChange={(e)=>setNewRow(s=>({...s,password:e.target.value}))} placeholder="Mật khẩu (tuỳ chọn)" className="w-48 border rounded-lg px-2 py-1 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"/>
                          <button onClick={()=>setNewRowMode(false)} className={BTN_NEUTRAL_OUTLINE}>Huỷ</button>
                          <button onClick={createNewUser} disabled={creating} className={BTN_BRAND}>{creating?'Đang tạo...':'Tạo'}</button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Dòng dữ liệu */}
                  {filtered.map((r) =>
                    editId === r.user_id && editRow ? (
                      <tr key={r.user_id} className="border-t bg-yellow-50/50">
                        <td className="px-3 py-2">
                          <input value={editRow.full_name} onChange={(e)=>setEditRow(s=>s?{...s,full_name:e.target.value}:s)} className={INPUT_SM}/>
                        </td>
                        <td className="px-3 py-2">
                          <input value={editRow.email} onChange={(e)=>setEditRow(s=>s?{...s,email:e.target.value}:s)} className={INPUT_SM}/>
                        </td>
                        <td className="px-3 py-2">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={!!editRow.is_active} onChange={(e)=>setEditRow(s=>s?{...s,is_active:e.target.checked}:s)} />
                            <span>Kích hoạt</span>
                          </label>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={onCancelEdit} className={`${BTN_NEUTRAL_OUTLINE} mr-2`}>Huỷ</button>
                          <button onClick={onSaveEdit} disabled={saving} className={BTN_BRAND}>{saving?'Đang lưu...':'Lưu'}</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.user_id} className="border-t">
                        <td className="px-3 py-2">{r.full_name}</td>
                        <td className="px-3 py-2">{r.email}</td>
                        <td className="px-3 py-2">
                          {r.is_active ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Active</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Inactive</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button className={`${BTN_NEUTRAL_OUTLINE} mr-2`} onClick={() => onEdit(r)}>Sửa</button>
                          <button className={`${BTN_NEUTRAL_OUTLINE} mr-2`} onClick={() => setResetTarget({ user_id: r.user_id, email: r.email })}>Đặt lại mật khẩu</button>
                          <button className={BTN_DANGER_OUTLINE} onClick={() => onDeleteUser(r)} disabled={deletingId===r.user_id}>
                            {deletingId===r.user_id ? 'Đang xoá...' : 'Xoá'}
                          </button>
                        </td>
                      </tr>
                    )
                  )}

                  {!filtered.length && !loading && (
                    <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={4}>Không có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Import CSV modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl border bg-white p-4 shadow">
            <div className="text-lg font-semibold">Import CSV</div>
            <p className="text-sm text-slate-600">
              Header tối thiểu: <code>email,full_name</code>. (Tuỳ chọn: <code>password</code>)
            </p>

            <div className="mt-3 flex items-center gap-3">
              <input type="file" accept=".csv,text/csv" onChange={handleImportFileChange} className="block w-full" />
              {importFile && <span className="text-xs text-slate-600">{importFile.name} ({(importFile.size/1024).toFixed(1)} KB)</span>}
            </div>

            {csvPreview.length > 0 && (
              <div className="mt-3 rounded-lg border p-2">
                <div className="mb-2 text-sm font-medium">Xem trước ({csvPreview.length} dòng)</div>
                <div className="max-h-56 overflow-auto text-xs">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        {Object.keys(csvPreview[0]).map((h)=><th key={h} className="px-2 py-1 text-left">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((r,i)=>(
                        <tr key={i} className="border-t">
                          {Object.values(r).map((v,j)=><td key={j} className="px-2 py-1">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button onClick={()=>{setShowImport(false); setImportFile(null); setCsvPreview([]);}} className={BTN_NEUTRAL_OUTLINE}>Huỷ</button>
              <button onClick={onImportConfirm} disabled={!csvPreview.length || importing} className={BTN_BRAND}>{importing?'Đang nhập...':'Nhập'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-4 shadow">
            <div className="text-lg font-semibold">Đặt lại mật khẩu</div>
            <div className="mt-1 text-sm text-slate-600">{resetTarget.email}</div>
            <input value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="Mật khẩu mới" className={`${INPUT} mt-3`} />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={()=>setResetTarget(null)} className={BTN_NEUTRAL_OUTLINE}>Huỷ</button>
              <button onClick={onResetPassword} disabled={!newPassword} className={BTN_BRAND}>Cập nhật</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
