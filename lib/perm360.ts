// lib/perm360.ts
import { createServiceClient } from '@/lib/supabaseServer';

function truthy(x: any) {
  return x === true || x === 'true' || x === 1 || x === '1';
}

/** Lấy role codes từ user_roles (thử staff_user_id và user_id; có join và fallback) */
async function getUserRoleCodesFromUserRoles(userId: string): Promise<string[]> {
  const sb = createServiceClient();
  const codes = new Set<string>();

  const attempts = [
    { col: 'staff_user_id', val: userId },
    { col: 'user_id',       val: userId },
  ];

  for (const a of attempts) {
    // 1) thử join thẳng
    let jr = await sb
      .from('user_roles')
      .select('role_id, roles:roles ( code )')
      .eq(a.col as any, a.val);

    if (!jr.error && jr.data?.length) {
      for (const row of jr.data as any[]) {
        if (Array.isArray(row?.roles)) {
          for (const r of row.roles) {
            if (r?.code) codes.add(String(r.code).toLowerCase());
          }
        }
      }
      // nếu đã có code từ join thì khỏi fallback
      if (codes.size) break;

      // 2) fallback: tra bảng roles theo role_id
      const roleIds = (jr.data as any[]).map((d) => d?.role_id).filter(Boolean);
      if (roleIds.length) {
        const rs = await sb.from('roles').select('code').in('id', roleIds);
        if (!rs.error && rs.data?.length) {
          for (const r of rs.data) if (r?.code) codes.add(String(r.code).toLowerCase());
        }
        if (codes.size) break;
      }
    }
  }

  return Array.from(codes);
}

/** Lấy cờ/roles từ profiles (fallback) */
async function getProfileFlags(userId: string) {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('profiles')
    .select('role, is_admin, is_qa, roles')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return { role: null as string|null, is_admin: false, is_qa: false, roles: [] as string[] };
  }

  const role = data.role ? String(data.role).toLowerCase() : null;
  const is_admin = truthy((data as any).is_admin);
  const is_qa = truthy((data as any).is_qa);

  let rolesArr: string[] = [];
  const raw = (data as any).roles;
  if (Array.isArray(raw)) {
    // hỗ trợ cả mảng code thuần lẫn mảng object { code }
    rolesArr = raw
      .map((x) => (x?.code ?? x))
      .map((v: any) => String(v).toLowerCase())
      .filter(Boolean);
  }

  return { role, is_admin, is_qa, roles: rolesArr };
}

/** Public: lấy danh sách role codes (kết hợp user_roles + profiles) */
export async function getUserRoleCodes(userId: string): Promise<string[]> {
  const fromUserRoles = await getUserRoleCodesFromUserRoles(userId);
  const pf = await getProfileFlags(userId);
  const all = new Set<string>([
    ...fromUserRoles,
    ...(pf.role ? [pf.role] : []),
    ...pf.roles,
    ...(pf.is_admin ? ['admin'] : []),
    ...(pf.is_qa ? ['qa'] : []),
  ]);
  return Array.from(all);
}

/** Public: kiểm tra có bất kỳ role nào mong muốn không */
export async function hasAnyRole(userId: string, want: string[]): Promise<boolean> {
  const codes = await getUserRoleCodes(userId);
  const wantSet = new Set(want.map((w) => w.toLowerCase()));
  return codes.some((c) => wantSet.has(c.toLowerCase()));
}

/** Guard QA/Admin cho API routes */
export async function ensureQA(userId?: string) {
  if (!userId) return { ok: false, status: 401, error: 'UNAUTHORIZED' } as const;

  // pass nếu có 'qa' hoặc 'admin' ở bất kỳ nguồn nào
  const ok = await hasAnyRole(userId, ['qa', 'admin']);
  return ok ? ({ ok: true } as const) : ({ ok: false, status: 403, error: 'FORBIDDEN' } as const);
}
