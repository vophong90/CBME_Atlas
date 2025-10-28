// app/api/student/courses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const student_id = url.searchParams.get('student_id');
    const framework_id_qs = url.searchParams.get('framework_id') || '';

    const db = createServiceClient();

    // Nếu có student_id mà chưa truyền framework_id, lấy framework_id của SV
    let framework_id = framework_id_qs;
    if (!framework_id && student_id) {
      const { data: sv, error: e1 } = await db
        .from('students')
        .select('framework_id')
        .eq('user_id', student_id)
        .maybeSingle();
      if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
      framework_id = sv?.framework_id || '';
    }

    // Định danh FK để embed ra 1 object: department:{id,name}
    // Nếu tên FK khác, đổi "courses_department_id_fkey" cho khớp tên FK thật trong Supabase.
    let q = db
      .from('courses')
      .select(`
        course_code,
        course_name,
        department_id,
        department:departments!courses_department_id_fkey ( id, name )
      `)
      .order('course_code', { ascending: true });

    if (framework_id) q = q.eq('framework_id', framework_id);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r: any) => {
      // Fallback nếu supabase vẫn trả "departments" (mảng) thay vì "department"
      const dept =
        r?.department ??
        (Array.isArray(r?.departments) ? r.departments[0] : r?.departments) ??
        null;

      return {
        code: r.course_code,
        name: r.course_name,
        department: dept ? { id: dept.id, name: dept.name } : null,
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
