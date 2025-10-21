// app/api/student/courses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const student_id = searchParams.get('student_id') || '';
    if (!student_id) {
      return NextResponse.json({ error: 'Thiếu student_id' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role

    const { data, error } = await db
      .from('student_clo_results')
      .select('course_code')
      .eq('student_id', student_id);

    if (error) {
      // Nếu bảng chưa có, trả về rỗng
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const list = Array.from(
      new Set((data ?? []).map((r: any) => String(r.course_code)))
    )
      .filter(Boolean)
      .sort();

    return NextResponse.json({ data: list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
