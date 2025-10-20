// app/api/student/pi-progress/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const student_id = searchParams.get('student_id') || '';
  if (!student_id) return NextResponse.json({ error: 'Thiếu student_id' }, { status: 400 });

  // Lấy framework của SV
  const { data: stu, error: e0 } = await supabaseAdmin
    .from('students')
    .select('framework_id')
    .eq('id', student_id)
    .single();
  if (e0 || !stu?.framework_id) return NextResponse.json({ error: 'Không tìm thấy framework của SV' }, { status: 400 });

  // Lấy items từ view cho framework đó; gom cả dòng null student_id (chưa có kết quả)
  const { data: rows, error } = await supabaseAdmin
    .from('v_student_pi_items')
    .select('student_id, framework_id, pi_code, pi_description, course_code, clo_code, level, status')
    .eq('framework_id', stu.framework_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Với SV cụ thể: status lấy theo record student_id trùng, nếu không có thì coi là "not_yet"
  const dataMap: Record<string, { pi: { code: string; description: string }, items: any[] }> = {};
  for (const r of rows || []) {
    if (!dataMap[r.pi_code]) {
      dataMap[r.pi_code] = { pi: { code: r.pi_code, description: r.pi_description }, items: [] };
    }
  }
  // Ưu tiên record của SV
  for (const r of rows || []) {
    if (r.student_id === student_id) {
      dataMap[r.pi_code].items.push({
        course_code: r.course_code,
        clo_code: r.clo_code,
        level: r.level,
        status: r.status,
      });
    }
  }
  // Thêm các CLO chưa có bản ghi cho SV -> not_yet
  for (const r of rows || []) {
    if (r.student_id !== student_id) {
      const exists = dataMap[r.pi_code].items.find(
        (it) => it.course_code === r.course_code && it.clo_code === r.clo_code
      );
      if (!exists) {
        dataMap[r.pi_code].items.push({
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
