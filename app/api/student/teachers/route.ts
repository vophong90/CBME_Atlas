export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * GET /api/student/teachers?student_id=...
 * Trả về danh sách giảng viên dạy các học phần của SV (uniq),
 * dựa trên course_lecturers + courses của framework SV.
 *
 * Output: [{ user_id, full_name, department_id?, department_name? }]
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const studentId = String(url.searchParams.get('student_id') ?? '').trim();
    if (!studentId) return NextResponse.json({ items: [] });

    const db = createServiceClient();

    // 1) SV info
    const { data: st, error: eSt } = await db
      .from('students')
      .select('id, mssv, framework_id')
      .eq('id', studentId)
      .maybeSingle();

    if (eSt) return NextResponse.json({ error: eSt.message }, { status: 400 });
    if (!st) return NextResponse.json({ items: [] });

    // 2) Course codes theo SV
    const { data: codes } = await db
      .from('student_clo_results_uploads')
      .select('course_code')
      .eq('mssv', st.mssv)
      .eq('framework_id', st.framework_id);

    const courseCodes = Array.from(new Set((codes || []).map((x) => x.course_code).filter(Boolean)));

    // 3) Lấy course_id từ course_code trong framework SV
    let coursesQuery = db
      .from('courses')
      .select('id, course_code, department_id')
      .eq('framework_id', st.framework_id);

    if (courseCodes.length > 0) {
      coursesQuery = coursesQuery.in('course_code', courseCodes);
    }

    const { data: courses, error: eCourses } = await coursesQuery;
    if (eCourses) return NextResponse.json({ error: eCourses.message }, { status: 400 });
    const courseIds = (courses || []).map((c) => c.id);

    if (courseIds.length === 0) return NextResponse.json({ items: [] });

    // 4) course_lecturers → staff
    const { data: links, error: eLinks } = await db
      .from('course_lecturers')
      .select('course_id, lecturer_user_id')
      .in('course_id', courseIds);

    if (eLinks) return NextResponse.json({ error: eLinks.message }, { status: 400 });

    const lecturerIds = Array.from(new Set((links || []).map((l) => l.lecturer_user_id)));

    if (lecturerIds.length === 0) return NextResponse.json({ items: [] });

    const { data: staff, error: eStaff } = await db
      .from('staff')
      .select('user_id, full_name, department_id')
      .in('user_id', lecturerIds);

    if (eStaff) return NextResponse.json({ error: eStaff.message }, { status: 400 });

    // Map department names
    const deptIds = Array.from(new Set((staff || []).map((s) => s.department_id).filter(Boolean)));
    let deptMap = new Map<string, { name: string }>();
    if (deptIds.length > 0) {
      const { data: depts } = await db.from('departments').select('id, name').in('id', deptIds as string[]);
      (depts || []).forEach((d) => deptMap.set(d.id, { name: d.name }));
    }

    const items = Array.from(
      new Map(
        (staff || []).map((s) => [
          s.user_id,
          {
            user_id: s.user_id,
            full_name: s.full_name,
            department_id: s.department_id,
            department_name: s.department_id ? deptMap.get(s.department_id)?.name ?? null : null,
          },
        ])
      ).values()
    );

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
