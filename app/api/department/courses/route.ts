// app/api/department/courses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const frameworkId = url.searchParams.get('framework_id') || '';
    const q = (url.searchParams.get('q') || '').trim();

    // ⭐ MUST await — lấy Supabase client có session từ cookies
    const sb = await getSupabaseFromRequest();

    // Lấy user id
    const { data: userRes, error: eUser } = await sb.auth.getUser();
    if (eUser) {
      return NextResponse.json({ error: eUser.message }, { status: 401 });
    }
    const uid = userRes?.user?.id;
    if (!uid) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    // Lấy department_id của user (từ bảng staff)
    const { data: me, error: e0 } = await sb
      .from('staff')
      .select('department_id')
      .eq('user_id', uid)
      .maybeSingle();

    if (e0) {
      return NextResponse.json({ error: e0.message }, { status: 400 });
    }
    if (!me?.department_id) {
      return NextResponse.json(
        { data: [], department_id: null },
        { status: 200 }
      );
    }

    const deptId = me.department_id as string;

    // Query từ VIEW
    let query = sb
      .from('v_courses_with_department')
      .select(
        'course_id, framework_id, course_code, course_name, department_id, department_name'
      )
      .eq('department_id', deptId)
      .order('course_code', { ascending: true });

    if (frameworkId) query = query.eq('framework_id', frameworkId);

    if (q) {
      query = query.or(
        `course_code.ilike.%${q}%,course_name.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const items = (data || []).map((r: any) => ({
      code: r.course_code,
      name: r.course_name,
    }));

    return NextResponse.json(
      { data: items, department_id: deptId },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}
