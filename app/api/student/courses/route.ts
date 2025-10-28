// app/api/student/courses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const studentId = url.searchParams.get('student_id') || '';
    const explicitFw = url.searchParams.get('framework_id') || '';

    const db = createServiceClient();

    // 1) Xác định framework_id (ưu tiên query param, sau đó từ bảng students)
    let frameworkId = explicitFw;
    if (!frameworkId && studentId) {
      const { data: stu, error: eStu } = await db
        .from('students')
        .select('framework_id')
        .eq('id', studentId)
        .maybeSingle();
      if (eStu) throw eStu;
      frameworkId = stu?.framework_id || '';
    }

    // 2) Lấy courses + thông tin bộ môn (departments)
    let q = db
      .from('courses')
      .select('course_code, course_name, department:departments(id, name)')
      .order('course_code', { ascending: true });

    if (frameworkId) q = q.eq('framework_id', frameworkId);

    const { data, error } = await q;
    if (error) throw error;

    // 3) Map về shape mà trang Feedback đang dùng
    const items = (data ?? []).map((r: any) => ({
      code: r.course_code,
      name: r.course_name ?? null,
      department: r.department
        ? { id: r.department.id, name: r.department.name }
        : null,
    }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: e?.message || 'Server error' },
      { status: 200 }
    );
  }
}
