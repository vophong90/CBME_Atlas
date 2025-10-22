// app/admin/users/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

// =====================
// Vai trò -> Nhãn tiếng Việt
// =====================
const ROLE_VI: Record<string, string> = {
  admin: 'Quản trị',
  lecturer: 'Giảng viên',
  qa: 'Đảm bảo chất lượng',
  department_head: 'Trưởng bộ môn',
  support: 'Hỗ trợ',
  student: 'Sinh viên',
};
function labelRoles(codes: string[] = []) {
  return codes.map((c) => ROLE_VI[c] ?? c);
}

// =====================
// UI helper classes (đồng bộ màu)
// =====================
const BTN_PRIMARY =
  'rounded-xl bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700 disabled:opacity-60';
const BTN_OUTLINE =
  'rounded-xl border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60';
const BTN_DANGER =
  'rounded-xl border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-60';
const INPUT =
  'w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring focus:ring-indigo-100';
const INPUT_SM =
  'w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:ring focus:ring-indigo-100';

type StaffRow = {
  user_id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  departments: string[]; // hiển thị mã/tên bộ môn
};

// tách chuỗi "a;b, c" -> ["a","b","c"]
function splitCodes(s: string) {
  return (s || '')
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Parser CSV nhỏ gọn:
 * - Hỗ trợ dấu phẩy trong ô có ngoặc kép
 * - Hỗ trợ escape `""` -> `"`
 * - KHÔNG hỗ trợ ô đa dòng (nên để mỗi bản ghi 1 dòng)
 */
function splitCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // có thể là escaped double-quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}

function parseCsvText(text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  // bỏ dòng trống đầu/cuối
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return [];

  const header = splitCSVLine(lines[0]);
  const rows: any[] = [];
  for (let li = 1; li < lines.length; li++) {
    const raw = lines[li];
    if (!raw.trim()) continue;
    const cells = splitCSVLine(raw);
    const obj: any = {};
    header.forEach((h, i) => {
      obj[h] = cells[i] ?? '';
    });
    rows.push(obj);
  }
  return rows;
}

export default function AdminUsersPage() {
  // =====================
  // States chính
  // =====================
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [q, setQ] = useState('');

  // =====================
  // Import CSV
  // =====================
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // =====================
  // Tạo nhanh 1 nhân sự
  // =====================
  const [newRowMode, setNewRowMode] = useState(false);
  const [newRow, setNewRow] = useState({
    email: '',
    full_name: '',
    department_code: '',
    roles: '',
    password: '',
  });
  const [creating, setCreating] = useState(false);

  // =====================
  // Reset password
  // =====================
  const [resetTarget, setResetTarget] = useState<{ user_id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // =====================
  // Sửa thông tin (inline)
  // =====================
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<{
    user_id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    department_codes: string; // nhập CSV/; phân tách
    role_codes: string; // nhập CSV/;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // =====================
  // Mock load (bạn thay bằng fetch /api thật)
  // =====================
  useEffect(() => {
    // TODO: thay bằng fetch('/api/admin/users/list') để lấy dữ liệu thật
    setRows([
      {
        user_id: 'uuid-1',
        email: 'gv1@uni.edu',
        full_name: 'GV Một',
        is_active: true,
        roles: ['lecturer', 'qa'],
        departments: ['YHCT'],
      },
      {
        user_id: 'uuid-2',
        email: 'admin@uni.edu',
        full_name: 'Quản trị',
        is_active: true,
        roles: ['admin'],
        departments: [],
      },
    ]);
  }, []);

  // =====================
  // Tìm kiếm nhanh
  // =====================
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      [r.email, r.full_name, ...r.roles, ...r.departments].join(' ').toLowerCase().includes(k),
    );
  }, [q, rows]);

  // =====================
  // CSV handlers — KHÔNG dùng papaparse
  // =====================
  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setImportFile(f);
    setCsvPreview([]);
    if (!f) return;
    const text = await f.text();
    const parsed = parseCsvText(text);
    const norm = parsed.map((r) => ({
      email: (r.email || '').trim(),
      full_name: (r.full_name || '').trim(),
      department_code: (r.department_code || '').trim(),
      roles: (r.roles || '').trim(), // ví dụ: "lecturer;qa"
      password: (r.password || '').trim(),
    }));
    const missing = norm.filter((r) => !r.email || !r.full_name).length;
    if (missing) alert(`Có ${missing} dòng thiếu email hoặc full_name. Vui lòng kiểm tra lại file.`);
    setCsvPreview(norm);
  }

  async function onImportConfirm() {
    if (!csvPreview.length) return;
    setImporting(true);
    try {
      const payload = csvPreview.map((x) => ({
        email: x.email,
        full_name: x.full_name,
        department_code: x.department_code || null,
        roles: x.roles || null,
        password: x.password || null,
      }));
      const res = await fetch('/api/admin/users/bulk-import', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      alert('Import xong:\n' + JSON.stringify(json.results, null, 2));
      setShowImport(false);
      setImportFile(null);
      setCsvPreview([]);
      // TODO: refetch danh sách thật
    } finally {
      setImporting(false);
    }
  }

  // =====================
  // Tạo nhanh 1 nhân sự
  // =====================
  function openNewRow() {
    setNewRowMode(true);
    setNewRow({ email: '', full_name: '', department_code: '', roles: '', password: '' });
  }
  async function createNewUser() {
    if (!newRow.email || !newRow.full_name) {
      alert('Vui lòng nhập tối thiểu Email và Họ tên');
      return;
    }
    setCreating(true);
    try {
      const payload = [
        {
          email: newRow.email,
          full_name: newRow.full_name,
          department_code: newRow.department_code || null,
          roles: newRow.roles || null, // ví dụ "lecturer;qa"
          password: newRow.password || null,
        },
      ];
      const res = await fetch('/api/admin/users/bulk-import', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      const r = json?.results?.[0];
      if (r?.ok) {
        alert('Đã tạo tài khoản mới!');
        setNewRowMode(false);
        // TODO: refetch danh sách thật; tạm append mock
        setRows((old) => [
          ...old,
          {
            user_id: 'temp-' + Date.now(),
            email: newRow.email,
            full_name: newRow.full_name,
            is_active: true,
            roles: splitCodes(newRow.roles),
            departments: newRow.department_code ? [newRow.department_code] : [],
          },
        ]);
      } else {
        alert('Lỗi: ' + (r?.error || 'unknown'));
      }
    } finally {
      setCreating(false);
    }
  }

  // =====================
  // Sửa thông tin (inline)
  // =====================
  function onEdit(r: StaffRow) {
    setEditId(r.user_id);
    setEditRow({
      user_id: r.user_id,
      email: r.email,
      full_name: r.full_name,
      is_active: r.is_active,
      department_codes: r.departments.join(';'),
      role_codes: r.roles.join(';'),
    });
  }
  function onCancelEdit() {
    setEditId(null);
    setEditRow(null);
  }
  async function onSaveEdit() {
    if (!editRow) return;
    setSaving(true);
    try {
      const payload = {
        user_id: editRow.user_id,
        email: editRow.email?.trim(),
        full_name: editRow.full_name?.trim(),
        is_active: !!editRow.is_active,
        department_codes: splitCodes(editRow.department_codes),
        role_codes: splitCodes(editRow.role_codes),
      };
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json?.ok) {
        alert('Cập nhật lỗi: ' + (json?.error || 'unknown'));
        return;
      }
      // Cập nhật UI
      setRows((old) =>
        old.map((x) =>
          x.user_id === editRow.user_id
            ? {
                ...x,
                email: payload.email || x.email,
                full_name: payload.full_name || x.full_name,
                is_active: payload.is_active,
                roles: payload.role_codes,
                departments: payload.department_codes,
              }
            : x,
        ),
      );
      onCancelEdit();
    } finally {
      setSaving(false);
    }
  }

  // =====================
  // Reset password
  // =====================
  async function onResetPassword() {
    if (!resetTarget || !newPassword) return;
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId: resetTarget.user_id, newPassword }),
    });
    const json = await res.json();
    if (json?.ok) alert(`Đã đặt lại mật khẩu cho ${resetTarget.email}`);
    else alert(`Lỗi: ${json?.error || 'unknown'}`);
    setResetTarget(null);
    setNewPassword('');
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Quản lý nhân sự</div>
          <div className="text-slate-600 text-sm">
            Tạo/Sửa/Xoá tài khoản, gán vai trò, đặt lại mật khẩu, import CSV.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className={BTN_OUTLINE}>
            Import CSV
          </button>
          <button onClick={openNewRow} className={BTN_PRIMARY}>
            + Thêm nhân sự
          </button>
        </div>
      </header>

      {/* Search + Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên, email, vai trò, bộ môn..."
            className={INPUT}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2">Họ tên</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Bộ môn</th>
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2">Kích hoạt</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {/* Dòng nhập mới */}
              {newRowMode && (
                <tr className="border-t bg-indigo-50/30">
                  <td className="px-3 py-2">
                    <input
                      value={newRow.full_name}
                      onChange={(e) => setNewRow((s) => ({ ...s, full_name: e.target.value }))}
                      placeholder="Họ tên"
                      className={INPUT_SM}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={newRow.email}
                      onChange={(e) => setNewRow((s) => ({ ...s, email: e.target.value }))}
                      placeholder="email@uni.edu"
                      className={INPUT_SM}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={newRow.department_code}
                      onChange={(e) =>
                        setNewRow((s) => ({ ...s, department_code: e.target.value }))
                      }
                      placeholder="Mã bộ môn (vd: YHCT)"
                      className={INPUT_SM}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={newRow.roles}
                      onChange={(e) => setNewRow((s) => ({ ...s, roles: e.target.value }))}
                      placeholder="Vai trò (vd: lecturer;qa)"
                      className={INPUT_SM}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-center">—</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <input
                        value={newRow.password}
                        onChange={(e) => setNewRow((s) => ({ ...s, password: e.target.value }))}
                        placeholder="Mật khẩu (tuỳ chọn)"
                        className="w-48 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:ring focus:ring-indigo-100"
                      />
                      <button onClick={() => setNewRowMode(false)} className={BTN_OUTLINE}>
                        Huỷ
                      </button>
                      <button onClick={createNewUser} disabled={creating} className={BTN_PRIMARY}>
                        {creating ? 'Đang tạo...' : 'Tạo'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Dòng dữ liệu */}
              {filtered.map((r) =>
                editId === r.user_id && editRow ? (
                  // === Chế độ SỬA ===
                  <tr key={r.user_id} className="border-t bg-yellow-50/50">
                    <td className="px-3 py-2">
                      <input
                        value={editRow.full_name}
                        onChange={(e) =>
                          setEditRow((s) => (s ? { ...s, full_name: e.target.value } : s))
                        }
                        className={INPUT_SM}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={editRow.email}
                        onChange={(e) =>
                          setEditRow((s) => (s ? { ...s, email: e.target.value } : s))
                        }
                        className={INPUT_SM}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={editRow.department_codes}
                        onChange={(e) =>
                          setEditRow((s) => (s ? { ...s, department_codes: e.target.value } : s))
                        }
                        placeholder="Mã bộ môn; phân tách ; hoặc ,"
                        className={INPUT_SM}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={editRow.role_codes}
                        onChange={(e) =>
                          setEditRow((s) => (s ? { ...s, role_codes: e.target.value } : s))
                        }
                        placeholder="Vai trò; (vd: lecturer;qa)"
                        className={INPUT_SM}
                      />
                      <div className="mt-1 text-[11px] text-slate-500">
                        {labelRoles(splitCodes(editRow.role_codes)).join(', ') || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!editRow.is_active}
                          onChange={(e) =>
                            setEditRow((s) => (s ? { ...s, is_active: e.target.checked } : s))
                          }
                        />
                        <span>Kích hoạt</span>
                      </label>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={onCancelEdit} className={`${BTN_OUTLINE} mr-2`}>
                        Huỷ
                      </button>
                      <button onClick={onSaveEdit} disabled={saving} className={BTN_PRIMARY}>
                        {saving ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </td>
                  </tr>
                ) : (
                  // === Chế độ XEM ===
                  <tr key={r.user_id} className="border-t">
                    <td className="px-3 py-2">{r.full_name}</td>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.departments.join(', ') || '-'}</td>
                    <td className="px-3 py-2">{labelRoles(r.roles).join(', ')}</td>
                    <td className="px-3 py-2">
                      {r.is_active ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className={`${BTN_OUTLINE} mr-2`} onClick={() => onEdit(r)}>
                        Sửa
                      </button>
                      <button
                        className={`${BTN_OUTLINE} mr-2`}
                        onClick={() => setResetTarget({ user_id: r.user_id, email: r.email })}
                      >
                        Đặt lại mật khẩu
                      </button>
                      <button className={BTN_DANGER} onClick={() => alert('TODO: Xoá người dùng')}>
                        Xoá
                      </button>
                    </td>
                  </tr>
                ),
              )}

              {!filtered.length && (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                    Không có dữ liệu
                  </td>
                </tr>
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
            <p className="text-sm text-slate-500">
              Chọn tệp .csv với header:{' '}
              <code>email,full_name,department_code,roles,password</code>
            </p>

            <div className="mt-3 flex items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFileChange}
                className="block w-full text-sm"
              />
              {importFile && (
                <span className="text-xs text-slate-600">
                  {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            {csvPreview.length > 0 && (
              <div className="mt-3 rounded-xl border border-slate-200 p-2">
                <div className="mb-2 text-sm font-medium">Xem trước ({csvPreview.length} dòng)</div>
                <div className="max-h-56 overflow-auto text-xs">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        {Object.keys(csvPreview[0]).map((h) => (
                          <th key={h} className="px-2 py-1 text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((r, i) => (
                        <tr key={i} className="border-t">
                          {Object.values(r).map((v, j) => (
                            <td key={j} className="px-2 py-1">
                              {String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportFile(null);
                  setCsvPreview([]);
                }}
                className={BTN_OUTLINE}
              >
                Huỷ
              </button>
              <button
                onClick={onImportConfirm}
                disabled={!csvPreview.length || importing}
                className={BTN_PRIMARY}
              >
                {importing ? 'Đang nhập...' : 'Nhập'}
              </button>
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
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mật khẩu mới"
              className={`${INPUT} mt-3`}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setResetTarget(null)} className={BTN_OUTLINE}>
                Huỷ
              </button>
              <button onClick={onResetPassword} className={BTN_PRIMARY} disabled={!newPassword}>
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
