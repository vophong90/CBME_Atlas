// app/api/admin/users/list/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Tránh cache ở build time
export const dynamic = 'force-dynamic';

/**
 * Trả về:
 * { rows: Array<{ user_id, email, full_name, is_active, departments: string[], roles: string[] }> }
 */
export async function GET() {
  try {
    // 1) Lấy staff
    const { data: staffRows, error: staffErr } = await supabaseAdmin
      .from('staff') // public.staff
      .select('user_id,email,full_name,is_active')
      .order('full_name', { ascending: true });

    if (staffErr) {
      return NextResponse.json({ error: staffErr.message }, { status: 400 });
    }
    if (!staffRows?.length) {
      return NextResponse.json({ rows: [] });
    }

    const uids = staffRows.map((s) => s.user_id);

    // 2) staff_departments -> departments (code)
    const { data: sdeps, error: sdErr } = await supabaseAdmin
      .from('staff_departments')
      .select('staff_user_id, department_id')
      .in('staff_user_id', uids);

    if (sdErr) {
      return NextResponse.json({ error: sdErr.message }, { status: 400 });
    }

    const depIds = Array.from(
      new Set((sdeps || []).map((d: any) => d.department_id).filter(Boolean)),
    );

    let depMap = new Map<string, string>();
    if (depIds.length) {
      const { data: deps, error: depErr } = await supabaseAdmin
        .from('departments')
        .select('id, code')
        .in('id', depIds);
      if (depErr) {
        return NextResponse.json({ error: depErr.message }, { status: 400 });
      }
      (deps || []).forEach((d: any) => depMap.set(d.id, d.code));
    }

    // 3) user_roles -> roles (code)
    const { data: uroles, error: urErr } = await supabaseAdmin
      .from('user_roles')
      .select('staff_user_id, role_id')
      .in('staff_user_id', uids);

    if (urErr) {
      return NextResponse.json({ error: urErr.message }, { status: 400 });
    }

    const roleIds = Array.from(
      new Set((uroles || []).map((r: any) => r.role_id).filter(Boolean)),
    );

    let roleMap = new Map<string, string>();
    if (roleIds.length) {
      const { data: roles, error: roleErr } = await supabaseAdmin
        .from('roles')
        .select('id, code')
        .in('id', roleIds);
      if (roleErr) {
        return NextResponse.json({ error: roleErr.message }, { status: 400 });
      }
      (roles || []).forEach((r: any) => roleMap.set(r.id, r.code));
    }

    // 4) Gộp dữ liệu
    const rows = staffRows.map((s) => {
      const depsForUser = (sdeps || [])
        .filter((d: any) => d.staff_user_id === s.user_id)
        .map((d: any) => depMap.get(d.department_id) || null)
        .filter(Boolean);

      const rolesForUser = (uroles || [])
        .filter((r: any) => r.staff_user_id === s.user_id)
        .map((r: any) => roleMap.get(r.role_id) || null)
        .filter(Boolean);

      return {
        user_id: s.user_id,
        email: s.email,
        full_name: s.full_name,
        is_active: s.is_active,
        departments: Array.from(new Set(depsForUser as string[])),
        roles: Array.from(new Set(rolesForUser as string[])),
      };
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
