export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const frameworkId = url.searchParams.get('framework_id') || '';
    const q            = (url.searchParams.get('q') || '').trim();

    const sb = getSupabaseFromRequest(req); // RLS theo session

    // Lấy dept_id của user đang đăng nhập
    const { data: userRes, error: eUser } = await sb.auth.getUser();
    if (eUser) return NextResponse.json({ error: eUser.message }, { status: 401 });
    const uid = userRes?.user?.id;
    if (!uid) return NextResponse.json({ data: [] }, { status: 200 });

    // Tuỳ schema của bạn: bảng nào lưu mapping user→department
    // Ví dụ ở đây là 'staff(user_id, department_id)'
    const { data: me, error: e0 } = await sb
      .from('staff')
      .select('department_id')
      .eq('user_id', uid)
      .maybeSingle();

    if (e0) return NextResponse.json({ error: e0.message }, { status: 400 });
    if (!me?.department_id) {
      return NextResponse.json({ data: [], department_id: null }, { status: 200 });
    }
    const deptId = me.department_id as string;

    // Đọc từ VIEW để luôn có trạng thái gán bộ môn mới nhất
    let query = sb
      .from('v_courses_with_department')
      .select('code, name')
      .eq('department_id', deptId);

    if (frameworkId) query = query.eq('framework_id', frameworkId);
    if (q)           query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
    query = query.order('code', { ascending: true });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Khớp shape DepartmentProvider mong đợi: { data: Array<{code,name}> }
    return NextResponse.json({ data: data ?? [], department_id: deptId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
