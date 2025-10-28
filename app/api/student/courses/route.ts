// app/api/student/courses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient, getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paramStudentId = (searchParams.get('student_id') || '').trim();

    const admin = createServiceClient(); // service-role (bỏ qua RLS)
    let studentId = paramStudentId;

    // Nếu caller không truyền student_id → dò theo auth session (user_id)
    if (!studentId) {
      const sb = getSupabaseFromRequest(req);
      const { data: { user } } = await sb.auth.getUser();
      if (user?.id) {
        const { data: stu } = await admin
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        if (stu?.id) studentId = stu.id as string;
      }
    }

    if (!studentId) {
      // Không xác định được sinh viên → trả mảng trống (để UI không vỡ)
      return NextResponse.json<string[]>([]);
    }

    // Lấy thông tin sinh viên: framework_id + mssv (để lọc kết quả tải lên nếu có)
    const { data: student, error: eStu } = await admin
      .from('students')
      .select('framework_id, mssv')
      .eq('id', studentId)
      .maybeSingle();

    if (eStu) return NextResponse.json<string[]>([], { status: 200 });
    const frameworkId = student?.framework_id || null;
    const mssv = student?.mssv || null;

    // 1) Ưu tiên lấy các học phần đã có kết quả tải lên cho đúng sinh viên
    let courseCodes: string[] = [];
    if (mssv) {
      const { data: up, error: eUp } = await admin
        .from('student_clo_results_uploads')
        .select('course_code')
        .eq('mssv', mssv);

      if (!eUp && up) {
        courseCodes = Array.from(new Set(up.map(r => String(r.course_code)).filter(Boolean)));
      }
    }

    // 2) Nếu chưa có kết quả tải lên → fallback: toàn bộ courses theo framework_id
    if ((!courseCodes || courseCodes.length === 0) && frameworkId) {
      const { data: all, error: eAll } = await admin
        .from('courses')
        .select('course_code')
        .eq('framework_id', frameworkId);

      if (!eAll && all) {
        courseCodes = Array.from(new Set(all.map(r => String(r.course_code)).filter(Boolean)));
      }
    }

    // Trả ra mảng đã sort (string[])
    return NextResponse.json<string[]>(courseCodes.sort());
  } catch {
    // Không lộ lỗi nội bộ ra UI — trả mảng rỗng để an toàn
    return NextResponse.json<string[]>([], { status: 200 });
  }
}
