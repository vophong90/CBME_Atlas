// app/api/student/courses/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const student_id = searchParams.get('student_id') || '';
  if (!student_id) return NextResponse.json({ error: 'Thiếu student_id' }, { status: 400 });

  // lấy course từ kết quả CLO của SV (đã/đang học)
  const { data, error } = await supabaseAdmin
    .from('student_clo_results')
    .select('course_code')
    .eq('student_id', student_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const list = Array.from(new Set((data || []).map((r: any) => r.course_code))).sort();
  return NextResponse.json({ data: list });
}
