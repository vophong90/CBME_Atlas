'use client';
import { useEffect, useState } from 'react';
type Role = { id: string; code: string; label: string };
type Perm = { id: string; key: string; label: string };

export default function AdminSecurityPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({}); // role_id -> perm_id -> checked

  useEffect(() => {
    // TODO: fetch thật từ /api
    const r = [
      { id: 'r1', code: 'lecturer', label: 'Giảng viên' },
      { id: 'r5', code: 'admin', label: 'Quản trị viên' },
    ];
    const p = [
      { id: 'p1', key: 'users.read', label: 'Xem nhân sự' },
      { id: 'p2', key: 'users.write', label: 'Sửa nhân sự' },
    ];
    setRoles(r); setPerms(p);
    setMatrix({ r1: { p1: true, p2: false }, r5: { p1: true, p2: true } });
  }, []);

  function toggle(roleId: string, permId: string) {
    setMatrix(m => ({ ...m, [roleId]: { ...(m[roleId]||{}), [permId]: !m[roleId]?.[permId] } }));
  }

  async function save() {
    // POST matrix lên /api/admin/security/role-permissions
    alert('Đã lưu (demo)');
  }

  return (
    <div className="space-y-4">
      <header>
        <div className="text-xl font-semibold">Bảo mật hệ thống</div>
        <div className="text-slate-600 text-sm">Ma trận quyền theo vai trò. Check để cấp, bỏ check để thu hồi.</div>
      </header>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Permission</th>
              {roles.map(r => <th key={r.id} className="px-3 py-2 text-left">{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {perms.map(p => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.key}</div>
                </td>
                {roles.map(r => (
                  <td key={r.id} className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!matrix[r.id]?.[p.id]}
                      onChange={() => toggle(r.id, p.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 text-right">
          <button onClick={save} className="rounded-xl bg-slate-900 px-3 py-1.5 text-white">Lưu</button>
        </div>
      </div>
    </div>
  );
}
