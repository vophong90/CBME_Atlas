'use client';

// app/admin/security/page.tsx
import { useEffect, useMemo, useRef, useState } from 'react';

type Role = { id: string; code: string; label: string };
type Staff = { user_id: string; full_name: string; email: string; is_active: boolean };

const BTN_BRAND =
  'px-3 py-1.5 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed';
const BTN_OUTLINE =
  'px-3 py-1.5 rounded-lg font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60';
const INPUT =
  'w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300';

async function fetchJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const text = await res.text();
  try {
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status} ${res.statusText}`);
    return data;
  } catch {
    throw new Error(`HTTP ${res.status} ${res.statusText} — Expected JSON but got: ${text.slice(0, 140)}...`);
  }
}

export default function AdminSecurityPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [rows, setRows] = useState<Staff[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // map user -> Set<role_id>
  const [mapUserRoles, setMapUserRoles] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // debounce search
  const debRef = useRef<number | null>(null);
  function onSearchChange(v: string) {
    setQ(v);
    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(() => {
      setPage(1);
      void loadStaff(1, v);
    }, 300);
  }

  async function loadRoles() {
    const { roles } = await fetchJSON('/api/admin/security/roles');
    setRoles(roles || []);
  }

  async function loadStaff(p = page, keyword = q) {
    const qs = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (keyword.trim()) qs.set('q', keyword.trim());
    const { rows, total } = await fetchJSON('/api/admin/security/staff?' + qs.toString());
    setRows(rows || []);
    setTotal(total || 0);

    // fetch role map cho các user hiển thị
    const ids = (rows || []).map((r: Staff) => r.user_id);
    if (ids.length) {
      const usp = new URLSearchParams();
      ids.forEach((id: string) => usp.append('user_ids', id));
      const { map } = await fetchJSON('/api/admin/security/user-roles?' + usp.toString());
      const next: Record<string, Set<string>> = {};
      ids.forEach((id) => {
        const arr: string[] = (map && map[id]) || [];
        next[id] = new Set(arr);
      });
      setMapUserRoles(next);
    } else {
      setMapUserRoles({});
    }
  }

  async function refetchAll() {
    try {
      setLoading(true); setErr('');
      await Promise.all([loadRoles(), loadStaff(1, '')]);
      setQ(''); setPage(1);
    } catch (e: any) {
      setErr(e?.message || 'Không tải được dữ liệu');
      setRows([]); setRoles([]); setMapUserRoles({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refetchAll(); }, []);

  // phân trang
  const totalPages = Math.max(1, Math.ceil(total / limit));
  async function goto(p: number) {
    const np = Math.min(Math.max(1, p), totalPages);
    setPage(np);
    await loadStaff(np, q);
  }

  // toggle checkbox
  async function onToggle(userId: string, roleId: string) {
    const has = mapUserRoles[userId]?.has(roleId);
    // optimistic
    setMapUserRoles((m) => {
      const next = { ...m };
      const s = new Set(next[userId] || []);
      if (has) s.delete(roleId);
      else s.add(roleId);
      next[userId] = s;
      return next;
    });

    try {
      if (has) {
        await fetchJSON('/api/admin/security/unassign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ user_id: userId, role_id: roleId }),
        });
      } else {
        await fetchJSON('/api/admin/security/assign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ user_id: userId, role_id: roleId }),
        });
      }
    } catch (e: any) {
      // rollback nếu lỗi
      setMapUserRoles((m) => {
        const next = { ...m };
        const s = new Set(next[userId] || []);
        if (has) s.add(roleId);
        else s.delete(roleId);
        next[userId] = s;
        return next;
      });
      alert(e?.message || 'Không cập nhật được quyền');
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <div className="text-xl font-semibold">Bảo mật hệ thống</div>
        <div className="text-slate-600 text-sm">
          Ma trận phân quyền: <strong>Nhân sự × Vai trò</strong>. Tick để cấp, bỏ tick để thu hồi.
        </div>
      </header>

      {!!err && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          {err}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-3 shadow">
        {/* Thanh công cụ */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="grow min-w-[220px]">
            <input
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm theo tên hoặc email…"
              className={INPUT}
            />
          </div>
          <button onClick={() => goto(1)} className={BTN_OUTLINE}>Tìm</button>
          <button onClick={() => refetchAll()} className={BTN_OUTLINE}>Làm mới</button>
        </div>

        {/* Bảng ma trận */}
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2 w-[320px]">Nhân sự</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-3 py-2 whitespace-nowrap">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-6 text-slate-500" colSpan={roles.length + 1}>Đang tải…</td></tr>
              ) : rows.length ? (
                rows.map((u) => (
                  <tr key={u.user_id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                      {!u.is_active && (
                        <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-[2px] text-[11px] text-slate-600">Inactive</span>
                      )}
                    </td>
                    {roles.map((r) => {
                      const checked = !!mapUserRoles[u.user_id]?.has(r.id);
                      return (
                        <td key={r.id} className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={() => onToggle(u.user_id, r.id)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr><td className="px-3 py-6 text-slate-500" colSpan={roles.length + 1}>Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Trang {page}/{Math.max(1, Math.ceil(total / limit))} • Tổng {total}
          </div>
          <div className="flex gap-2">
            <button className={BTN_OUTLINE} onClick={() => goto(1)} disabled={page <= 1}>Đầu</button>
            <button className={BTN_OUTLINE} onClick={() => goto(page - 1)} disabled={page <= 1}>← Trước</button>
            <button className={BTN_OUTLINE} onClick={() => goto(page + 1)} disabled={page >= totalPages}>Sau →</button>
            <button className={BTN_OUTLINE} onClick={() => goto(totalPages)} disabled={page >= totalPages}>Cuối</button>
          </div>
        </div>
      </div>
    </div>
  );
}
