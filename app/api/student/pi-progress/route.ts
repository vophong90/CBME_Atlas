// app/api/student/pi-progress/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

type Row = {
  student_id: string;
  framework_id: string;
  pi_code: string;
  pi_description: string;
  course_code: string;
  clo_code: string;
  level: string | number | null;
  status: 'achieved' | 'not_yet' | string | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const student_id = (searchParams.get('student_id') || '').trim();
    if (!student_id) {
      return NextResponse.json({ error: 'Thiếu student_id' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role

    // 1) Lấy framework của sinh viên
    const { data: stu, error: e0 } = await db
      .from('students')
      .select('framework_id')
      .eq('id', student_id)
      .single();

    if (e0 || !stu?.framework_id) {
      return NextResponse.json({ error: 'Không tìm thấy framework của SV' }, { status: 400 });
    }

    // 2) Lấy toàn bộ item PI của framework (gồm bản ghi SV này & người khác)
    const { data: rows, error } = await db
      .from('v_student_pi_items')
      .select('student_id, framework_id, pi_code, pi_description, course_code, clo_code, level, status')
      .eq('framework_id', stu.framework_id as string);

    if (error) {
      // View chưa tồn tại
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const all: Row[] = (rows ?? []) as Row[];

    // 3) Gom nhóm theo PI
    const map: Record<
      string,
      { pi: { code: string; description: string }; items: Array<{ course_code: string; clo_code: string; level: string; status: string }> }
    > = {};

    for (const r of all) {
      if (!map[r.pi_code]) {
        map[r.pi_code] = {
          pi: { code: r.pi_code, description: r.pi_description },
          items: [],
        };
      }
    }

    // 4) Thêm các bản ghi của chính SV
    for (const r of all) {
      if (r.student_id === student_id) {
        map[r.pi_code].items.push({
          course_code: r.course_code,
          clo_code: r.clo_code,
          level: String(r.level ?? ''),
          status: String(r.status ?? 'not_yet'),
        });
      }
    }

    // 5) Bổ sung những CLO/khóa học chưa có của SV này thành not_yet
    for (const r of all) {
      if (r.student_id !== student_id) {
        const items = map[r.pi_code].items;
        const exists = items.find(
          (it) => it.course_code === r.course_code && it.clo_code === r.clo_code
        );
        if (!exists) {
          items.push({
            course_code: r.course_code,
            clo_code: r.clo_code,
            level: String(r.level ?? ''),
            status: 'not_yet',
          });
        }
      }
    }

    // 6) Trả kết quả
    return NextResponse.json({ data: Object.values(map) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
