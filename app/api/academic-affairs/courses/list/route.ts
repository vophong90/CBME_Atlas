// app/api/academic-affairs/courses/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const framework_id = url.searchParams.get('framework_id');
    const q = (url.searchParams.get('q') || '').trim();

    const db = createServiceClient();

    // Định danh quan hệ bằng tên FK để nhận về 1 object: department:{id,name}
    // Nếu tên FK khác, đổi courses_department_id_fkey cho khớp schema.
    let query = db
      .from('courses')
      .select(
        `
        id,
        framework_id,
        course_code,
        course_name,
        department_id,
        department:departments!courses_department_id_fkey ( id, name )
      `
      )
      .order('course_code', { ascending: true });

    if (framework_id) query = query.eq('framework_id', framework_id);
    if (q) query = query.or(`course_code.ilike.%${q}%,course_name.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r: any) => {
      // Phòng hờ trường hợp lib vẫn trả mảng:
      const dept =
        r?.department ??
        (Array.isArray(r?.departments) ? r.departments[0] : r?.departments) ??
        null;

      return {
        id: r.id,
        code: r.course_code,
        name: r.course_name,
        framework_id: r.framework_id,
        department_id: r.department_id ?? (dept?.id ?? null),
        department: dept ? { id: dept.id, name: dept.name } : null,
      };
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
