// app/api/student/teachers/route.ts
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

    // 1) Xác định framework_id
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

    // 2) Nếu biết framework_id, gom bộ môn đang quản lý ít nhất 1 course của framework đó
    let deptIds: string[] = [];
    if (frameworkId) {
      const { data: courses, error: eCourses } = await db
        .from('courses')
        .select('department_id')
        .eq('framework_id', frameworkId)
        .not('department_id', 'is', null);
      if (eCourses) throw eCourses;
      const set = new Set<string>();
      for (const r of courses ?? []) if (r.department_id) set.add(r.department_id);
      deptIds = [...set];
    }

    // 3) Lấy danh sách giảng viên (staff) + tên bộ môn
    let q = db
      .from('staff')
      .select('user_id, full_name, department_id, department:departments(id, name)')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (deptIds.length > 0) q = q.in('department_id', deptIds);

    const { data, error } = await q;
    if (error) throw error;

    const items = (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      department_id: r.department_id ?? null,
      department_name: r?.department?.name ?? null,
    }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: e?.message || 'Server error' },
      { status: 200 }
    );
  }
}
