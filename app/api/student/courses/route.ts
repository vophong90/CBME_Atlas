export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * GET /api/student/courses?student_id=...
 * Trả về danh sách học phần của sinh viên (ưu tiên từ kết quả đã có),
 * kèm thông tin Bộ môn quản lý.
 *
 * Output: [{ code, name, department: { id, name } }]
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const studentId = String(url.searchParams.get('student_id') ?? '').trim();
    if (!studentId) return NextResponse.json({ items: [] });

    const db = createServiceClient();

    // 1) Lấy thông tin SV (mssv, framework_id)
    const { data: st, error: eSt } = await db
      .from('students')
      .select('id, mssv, framework_id')
      .eq('id', studentId)
      .maybeSingle();

    if (eSt) return NextResponse.json({ error: eSt.message }, { status: 400 });
    if (!st) return NextResponse.json({ items: [] });

    // 2) Lấy danh sách course_code SV đã có kết quả tải lên (nếu có)
    const { data: codes } = await db
      .from('student_clo_results_uploads')
      .select('course_code')
      .eq('mssv', st.mssv)
      .eq('framework_id', st.framework_id);

    const courseCodes = Array.from(new Set((codes || []).map((x) => x.course_code).filter(Boolean)));

    // 3) Lấy học phần theo courseCodes; nếu trống, fallback tất cả học phần trong framework SV
    let coursesQuery = db
      .from('v_courses_with_department')
      .select('course_id, framework_id, course_code, course_name, department_id, department_name')
      .eq('framework_id', st.framework_id);

    if (courseCodes.length > 0) {
      coursesQuery = coursesQuery.in('course_code', courseCodes);
    }

    const { data: rows, error: eCourses } = await coursesQuery;
    if (eCourses) return NextResponse.json({ error: eCourses.message }, { status: 400 });

    const items = (rows || []).map((r) => ({
      code: r.course_code,
      name: r.course_name,
      department: r.department_id ? { id: r.department_id, name: r.department_name } : null,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
