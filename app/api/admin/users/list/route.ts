// app/api/admin/users/list/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1) Lấy staff từ schema public.staff (nguồn dữ liệu chính)
    const { data: staffRows, error: staffErr } = await supabaseAdmin
      .from('staff')
      .select('user_id,email,full_name,is_active')
      .order('full_name', { ascending: true });

    if (staffErr) {
      return NextResponse.json({ error: staffErr.message }, { status: 400 });
    }
    if (!staffRows?.length) return NextResponse.json({ rows: [] });

    const uids = staffRows.map((s) => s.user_id);

    // Chuẩn bị map kết quả phụ (an toàn: lỗi join -> bỏ qua, vẫn trả staff)
    let depMap = new Map<string, string>();     // department_id -> department_code
    let userDeps = new Map<string, string[]>(); // staff_user_id -> [department_code]
    let roleCodeMap = new Map<string, string>();   // role_id -> code
    let roleLabelMap = new Map<string, string>();  // role_id -> label
    let userRoles = new Map<string, { code: string; label: string }[]>(); // staff_user_id -> roles

    // 2) (TUỲ) staff_departments → departments.code
    try {
      const { data: sdeps, error: sdErr } = await supabaseAdmin
        .from('staff_departments')
        .select('staff_user_id, department_id')
        .in('staff_user_id', uids);

      if (!sdErr && sdeps?.length) {
        const depIds = Array.from(new Set(sdeps.map((d: any) => d.department_id).filter(Boolean)));
        if (depIds.length) {
          const { data: deps, error: depErr } = await supabaseAdmin
            .from('departments')
            .select('id, code')
            .in('id', depIds);
          if (!depErr && deps) deps.forEach((d: any) => depMap.set(d.id, d.code));
        }
        sdeps.forEach((d: any) => {
          const arr = userDeps.get(d.staff_user_id) || [];
          const code = depMap.get(d.department_id);
          if (code) {
            if (!arr.includes(code)) arr.push(code);
            userDeps.set(d.staff_user_id, arr);
          }
        });
      }
    } catch { /* bỏ qua join nếu lỗi */ }

    // 3) (TUỲ) user_roles → roles.{code,label}
    try {
      const { data: uroles, error: urErr } = await supabaseAdmin
        .from('user_roles')
        .select('staff_user_id, role_id')
        .in('staff_user_id', uids);

      if (!urErr && uroles?.length) {
        const roleIds = Array.from(new Set(uroles.map((r: any) => r.role_id).filter(Boolean)));
        if (roleIds.length) {
          const { data: roles, error: roleErr } = await supabaseAdmin
            .from('roles')
            .select('id, code, label')
            .in('id', roleIds);
          if (!roleErr && roles) {
            roles.forEach((r: any) => {
              roleCodeMap.set(r.id, r.code);
              roleLabelMap.set(r.id, r.label);
            });
          }
        }
        uroles.forEach((r: any) => {
          const list = userRoles.get(r.staff_user_id) || [];
          const code = roleCodeMap.get(r.role_id);
          const label = roleLabelMap.get(r.role_id);
          if (code && label) {
            if (!list.find((x) => x.code === code)) list.push({ code, label });
            userRoles.set(r.staff_user_id, list);
          }
        });
      }
    } catch { /* bỏ qua join nếu lỗi */ }

    // 4) Gộp kết quả
    const rows = staffRows.map((s) => {
      const deps = userDeps.get(s.user_id) || [];
      const roles = userRoles.get(s.user_id) || [];
      return {
        user_id: s.user_id,
        email: s.email,
        full_name: s.full_name,
        is_active: s.is_active,
        departments: deps,                    // mảng code bộ môn (có thể rỗng)
        roles: roles.map((r) => r.code),      // mảng code vai trò (có thể rỗng)
        role_labels: roles.map((r) => r.label), // mảng label tiếng Việt (có thể rỗng)
      };
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
