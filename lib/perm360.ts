// lib/perm360.ts
import { createServiceClient } from '@/lib/supabaseServer';

function truthy(x: any) {
  return x === true || x === 'true' || x === 1 || x === '1';
}

/** Lấy role codes từ user_roles (thử staff_user_id và user_id; join + fallback) */
async function getUserRoleCodesFromUserRoles(userId: string): Promise<string[]> {
  const sb = createServiceClient();
  const codes = new Set<string>();

  const attempts = [
    { col: 'staff_user_id', val: userId },
    { col: 'user_id',       val: userId },
  ] as const;

  for (const a of attempts) {
    try {
      // Ép về any để tránh "Type instantiation is excessively deep..."
      const q: any = (sb as any)
        .from('user_roles')
        .select('role_id, roles:roles ( code )');

      const jr: any = await q.eq(a.col as any, a.val);
      if (jr?.error) continue;

      const rows: any[] = jr?.data || [];

      // Lấy code từ join roles:roles ( code )
      for (const row of rows) {
        const arr: any[] = Array.isArray(row?.roles) ? row.roles : [];
        for (const r of arr) {
          if (r?.code) codes.add(String(r.code).toLowerCase());
        }
      }

      if (codes.size) break;

      // Fallback: lấy code từ bảng roles theo role_id
      const roleIds = rows.map((r) => r?.role_id).filter(Boolean);
      if (roleIds.length) {
        const rs: any = await (sb as any).from('roles').select('code').in('id', roleIds);
        if (!rs?.error && Array.isArray(rs?.data)) {
          for (const r of rs.data) if (r?.code) codes.add(String(r.code).toLowerCase());
        }
        if (codes.size) break;
      }
    } catch {
      // bỏ qua và thử attempt tiếp theo
    }
  }

  return Array.from(codes);
}

/** Lấy cờ/roles từ profiles (fallback) */
async function getProfileFlags(userId: string) {
  const sb = createServiceClient();
  try {
    const r: any = await (sb as any)
      .from('profiles')
      .select('role, is_admin, is_qa, roles')
      .eq('id', userId)
      .maybeSingle();

    const data = r?.data || null;

    const role = data?.role ? String(data.role).toLowerCase() : null;
    const is_admin = truthy(data?.is_admin);
    const is_qa = truthy(data?.is_qa);

    let rolesArr: string[] = [];
    const raw = data?.roles;
    if (Array.isArray(raw)) {
      rolesArr = raw
        .map((x: any) => (x?.code ?? x))
        .map((v: any) => String(v).toLowerCase())
        .filter(Boolean);
    }

    return { role, is_admin, is_qa, roles: rolesArr };
  } catch {
    return { role: null as string | null, is_admin: false, is_qa: false, roles: [] as string[] };
  }
}

/** Public: tổng hợp role codes từ nhiều nguồn */
export async function getUserRoleCodes(userId: string): Promise<string[]> {
  const a = await getUserRoleCodesFromUserRoles(userId);
  const pf = await getProfileFlags(userId);
  const all = new Set<string>([
    ...a,
    ...(pf.role ? [pf.role] : []),
    ...pf.roles,
    ...(pf.is_admin ? ['admin'] : []),
    ...(pf.is_qa ? ['qa'] : []),
  ]);
  return Array.from(all);
}

/** Public: có bất kỳ role nào mong muốn không */
export async function hasAnyRole(userId: string, want: string[]): Promise<boolean> {
  const codes = await getUserRoleCodes(userId);
  const wantSet = new Set(want.map((w) => w.toLowerCase()));
  return codes.some((c) => wantSet.has(String(c).toLowerCase()));
}

/** Guard QA/Admin cho API routes */
export async function ensureQA(userId?: string) {
  if (!userId) return { ok: false, status: 401, error: 'UNAUTHORIZED' } as const;
  const ok = await hasAnyRole(userId, ['qa', 'admin']);
  return ok ? ({ ok: true } as const) : ({ ok: false, status: 403, error: 'FORBIDDEN' } as const);
}
