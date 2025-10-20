// app/api/student/plo-progress/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const student_id = searchParams.get('student_id') || '';
  if (!student_id) return NextResponse.json({ error: 'Thiếu student_id' }, { status: 400 });

  const { data: stu, error: e0 } = await supabaseAdmin
    .from('students')
    .select('framework_id')
    .eq('id', student_id)
    .single();
  if (e0 || !stu?.framework_id) return NextResponse.json({ error: 'Không tìm thấy framework của SV' }, { status: 400 });

  const { data: rows, error } = await supabaseAdmin
    .from('v_student_plo_items')
    .select('student_id, framework_id, plo_code, plo_description, course_code, clo_code, level, status')
    .eq('framework_id', stu.framework_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const dataMap: Record<string, { plo: { code: string; description: string }, items: any[] }> = {};
  for (const r of rows || []) {
    if (!dataMap[r.plo_code]) {
      dataMap[r.plo_code] = { plo: { code: r.plo_code, description: r.plo_description }, items: [] };
    }
  }
  for (const r of rows || []) {
    if (r.student_id === student_id) {
      dataMap[r.plo_code].items.push({
        course_code: r.course_code,
        clo_code: r.clo_code,
        level: r.level,
        status: r.status,
      });
    }
  }
  for (const r of rows || []) {
    if (r.student_id !== student_id) {
      const exists = dataMap[r.plo_code].items.find(
        (it) => it.course_code === r.course_code && it.clo_code === r.clo_code
      );
      if (!exists) {
        dataMap[r.plo_code].items.push({
          course_code: r.course_code,
          clo_code: r.clo_code,
          level: r.level,
          status: 'not_yet',
        });
      }
    }
  }

  return NextResponse.json({ data: Object.values(dataMap) });
}
