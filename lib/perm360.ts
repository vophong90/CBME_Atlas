// lib/perm360.ts
import { createServiceClient } from '@/lib/supabaseServer';

/** Chuẩn hoá lấy các code từ kết quả join (có thể là roles[] hoặc role) */
function extractCodes(row: any): string[] {
  const out: string[] = [];

  // Trường hợp phổ biến: roles: { code }[]
  if (Array.isArray(row?.roles)) {
    for (const x of row.roles) {
      if (x?.code) out.push(String(x.code));
    }
  }

  // Một số nơi có alias "role" thay vì "roles"
  const maybeRole = row?.role;
  if (maybeRole) {
    if (Array.isArray(maybeRole)) {
      for (const x of maybeRole) if (x?.code) out.push(String(x.code));
    } else if (maybeRole?.code) {
      out.push(String(maybeRole.code));
    }
  }

  // Phương án dự phòng nếu có alias phẳng role_code
  if (row?.role_code) out.push(String(row.role_code));

  return out;
}

/** Lấy danh sách mã role (vd: ['admin','qa',...]) của user */
export async function getUserRoleCodes(userId: string): Promise<string[]> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('user_roles')
    .select(
      `
      role_id,
      roles:roles!inner ( code )
    `
    )
    .eq('staff_user_id', userId);

  if (error) return [];

  const codes = ((data as any[]) || []).flatMap(extractCodes).filter(Boolean);
  // unique
  return Array.from(new Set(codes));
}

/** Kiểm tra user có bất kỳ role nào trong danh sách mong muốn không */
export async function hasAnyRole(userId: string, want: string[]): Promise<boolean> {
  const codes = await getUserRoleCodes(userId);
  return codes.some((c) => want.includes(c));
}

/** Chặn truy cập nếu KHÔNG phải QA hoặc ADMIN (dùng trong API routes) */
export async function ensureQA(userId?: string) {
  if (!userId) return { ok: false, status: 401, error: 'UNAUTHORIZED' } as const;
  const ok = await hasAnyRole(userId, ['qa', 'admin']);
  return ok ? ({ ok: true } as const) : ({ ok: false, status: 403, error: 'FORBIDDEN' } as const);
}
