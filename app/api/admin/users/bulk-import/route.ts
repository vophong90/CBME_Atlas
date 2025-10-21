// app/api/admin/users/bulk-import/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Row = {
  email: string;
  full_name: string;
  department_code?: string | null;
  roles?: string | null; // ví dụ: "lecturer;qa"
  password?: string | null; // nếu không cung cấp => random
};

function randomPass(len = 12) {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$_-';
  return Array.from({ length: len }, () => s[Math.floor(Math.random() * s.length)]).join('');
}

/** Tìm userId theo email.
 * 1) Thử getUserByEmail (nếu SDK có)
 * 2) Fallback: duyệt listUsers theo trang (cap 10 trang)
 */
async function findUserIdByEmail(email: string): Promise<string | null> {
  // @ts-ignore - 1 số phiên bản supabase-js chưa khai báo getUserByEmail
  if (typeof supabaseAdmin.auth.admin.getUserByEmail === 'function') {
    // @ts-ignore
    const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (!error && data?.user?.id) return data.user.id;
  }

  // Fallback: paginate listUsers
  const perPage = 1000; // tuỳ số lượng user của bạn
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const hit = data?.users?.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (hit?.id) return hit.id;
    if (!data?.users?.length) break; // hết
  }
  return null;
}

export async function POST(req: Request) {
  const rows: Row[] = await req.json();
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const row of rows) {
    try {
      const pass = row.password || randomPass();

      // 1) tạo account auth (nếu chưa tồn tại)
      const { data: createRes, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: row.email,
        password: pass,
        email_confirm: true,
      });

      let uid: string | null = createRes?.user?.id ?? null;

      if (!uid) {
        // Nếu đã tồn tại, tìm userId theo email
        if (createErr?.message?.toLowerCase()?.includes('already')) {
          uid = await findUserIdByEmail(row.email);
        } else if (createErr) {
          results.push({ email: row.email, ok: false, error: createErr.message });
          continue;
        }
      }

      if (!uid) {
        results.push({ email: row.email, ok: false, error: 'Cannot resolve user id' });
        continue;
      }

      // 2) upsert staff profile
      const { error: staffErr } = await supabaseAdmin.from('staff').upsert({
        user_id: uid,
        email: row.email,
        full_name: row.full_name,
        is_active: true,
      });
      if (staffErr) {
        results.push({ email: row.email, ok: false, error: staffErr.message });
        continue;
      }

      // 3) department nếu có
      let depId: string | null = null;
      if (row.department_code) {
        const { data: dep, error: depErr } = await supabaseAdmin
          .from('departments')
          .select('id')
          .eq('code', row.department_code)
          .maybeSingle();

        if (!depErr && dep?.id) {
          depId = dep.id;
          await supabaseAdmin
            .from('staff_departments')
            .upsert({ staff_user_id: uid, department_id: depId, is_head: false });
        }
      }

      // 4) gán roles
      if (row.roles) {
        const codes = row.roles.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        if (codes.length) {
          const { data: roleRows } = await supabaseAdmin
            .from('roles')
            .select('id, code')
            .in('code', codes);

          for (const r of roleRows || []) {
            await supabaseAdmin
              .from('user_roles')
              .upsert({ staff_user_id: uid, role_id: r.id, department_id: depId });
          }
        }
      }

      results.push({ email: row.email, ok: true });
    } catch (e: any) {
      results.push({ email: row.email, ok: false, error: e?.message || 'unknown' });
    }
  }

  return NextResponse.json({ results });
}
