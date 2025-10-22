// app/api/admin/users/update/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Body JSON:
 * {
 *   user_id: string,
 *   email?: string,
 *   full_name?: string,
 *   is_active?: boolean,
 *   department_codes?: string[],  // vd: ["YHCT", "YHHĐ"]
 *   role_codes?: string[]         // vd: ["lecturer","qa"]
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      user_id,
      email,
      full_name,
      is_active,
      department_codes = [],
      role_codes = [],
    } = body || {};

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // TODO: Kiểm tra quyền của caller là admin (đọc session -> verify trong DB)
    // ===== 1) Đồng bộ email ở Auth (nếu có đổi) =====
    if (email && typeof email === 'string') {
      const { error: upAuthErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        email,
      });
      if (upAuthErr) {
        return NextResponse.json(
          { error: `Auth update email failed: ${upAuthErr.message}` },
          { status: 400 },
        );
      }
    }

    // ===== 2) Upsert staff =====
    {
      const { error: staffErr } = await supabaseAdmin.from('staff').upsert(
        {
          user_id,
          email: email ?? undefined,
          full_name: full_name ?? undefined,
          is_active: typeof is_active === 'boolean' ? is_active : undefined,
        },
        { onConflict: 'user_id' }, // nếu staff.user_id là unique
      );
      if (staffErr) {
        return NextResponse.json(
          { error: `Upsert staff failed: ${staffErr.message}` },
          { status: 400 },
        );
      }
    }

    // ===== 3) Cập nhật staff_departments =====
    // Chiến lược: xóa hết rồi ghi lại theo danh sách mới (đơn giản, rõ ràng)
    let depIds: string[] = [];
    await supabaseAdmin.from('staff_departments').delete().eq('staff_user_id', user_id);

    if (Array.isArray(department_codes) && department_codes.length) {
      const { data: deps, error: depErr } = await supabaseAdmin
        .from('departments')
        .select('id, code')
        .in('code', department_codes);

      if (depErr) {
        return NextResponse.json(
          { error: `Select departments failed: ${depErr.message}` },
          { status: 400 },
        );
      }

      depIds = (deps || []).map((d: any) => d.id);
      if (depIds.length) {
        const upserts = depIds.map((department_id) => ({
          staff_user_id: user_id,
          department_id,
          is_head: false,
        }));
        const { error: sdErr } = await supabaseAdmin
          .from('staff_departments')
          .upsert(upserts);
        if (sdErr) {
          return NextResponse.json(
            { error: `Upsert staff_departments failed: ${sdErr.message}` },
            { status: 400 },
          );
        }
      }
    }

    // ===== 4) Cập nhật user_roles =====
    // Xóa hết -> thêm mới theo danh sách role_codes
    await supabaseAdmin.from('user_roles').delete().eq('staff_user_id', user_id);

    if (Array.isArray(role_codes) && role_codes.length) {
      const { data: roles, error: roleErr } = await supabaseAdmin
        .from('roles')
        .select('id, code')
        .in('code', role_codes);
      if (roleErr) {
        return NextResponse.json(
          { error: `Select roles failed: ${roleErr.message}` },
          { status: 400 },
        );
      }

      const roleIds = (roles || []).map((r: any) => r.id);
      if (roleIds.length) {
        // Gán department_id là bộ môn đầu tiên (nếu có), hoặc null
        const department_id = depIds[0] ?? null;
        const upserts = roleIds.map((role_id) => ({
          staff_user_id: user_id,
          role_id,
          department_id,
        }));
        const { error: urErr } = await supabaseAdmin.from('user_roles').upsert(upserts);
        if (urErr) {
          return NextResponse.json(
            { error: `Upsert user_roles failed: ${urErr.message}` },
            { status: 400 },
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
