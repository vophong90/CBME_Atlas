// app/api/teacher/student-pending-clos/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await getSupabaseFromRequest();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const student_user_id = url.searchParams.get('student_user_id');
  const framework_id    = url.searchParams.get('framework_id'); // optional

  if (!student_user_id) {
    return NextResponse.json({ error: 'student_user_id is required' }, { status: 400 });
  }

  // 1) Lấy MSSV + Họ tên + framework (nếu chưa truyền)
  let stuQ = supabase
    .from('students')
    .select('mssv, full_name, framework_id')
    .eq('user_id', student_user_id);

  if (framework_id) stuQ = stuQ.eq('framework_id', framework_id);

  const { data: stuRows, error: stuErr } = await stuQ.limit(1);
  if (stuErr) return NextResponse.json({ error: stuErr.message }, { status: 400 });
  if (!stuRows || !stuRows[0]) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const student = stuRows[0];
  const fwId = framework_id || student.framework_id;

  // 2) Lấy SCRU: chỉ "not_yet"
  const { data: scruRows, error: scruErr } = await supabase
    .from('student_clo_results_uploads')
    .select('course_code, clo_code, updated_at')
    .eq('framework_id', fwId)
    .eq('mssv', student.mssv)
    .eq('status', 'not_yet')
    .order('updated_at', { ascending: false });

  if (scruErr) return NextResponse.json({ error: scruErr.message }, { status: 400 });

  if (!scruRows || scruRows.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // 3) Map tên học phần
  const courseCodes = Array.from(new Set(scruRows.map(r => r.course_code).filter(Boolean))) as string[];
  let courseNameMap = new Map<string, string>();
  if (courseCodes.length > 0) {
    const { data: courseRows, error: cErr } = await supabase
      .from('courses')
      .select('course_code, course_name')
      .eq('framework_id', fwId)
      .in('course_code', courseCodes);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
    courseNameMap = new Map((courseRows || []).map(c => [c.course_code, c.course_name || '']));
  }

  // 4) Map nội dung CLO
  const cloCodes = Array.from(new Set(scruRows.map(r => r.clo_code).filter(Boolean))) as string[];
  let cloTextMap = new Map<string, string>(); // key = `${course_code}::${clo_code}`
  if (courseCodes.length > 0 && cloCodes.length > 0) {
    const { data: cloRows, error: cloErr } = await supabase
      .from('clos')
      .select('course_code, clo_code, clo_text')
      .eq('framework_id', fwId)
      .in('course_code', courseCodes)
      .in('clo_code', cloCodes);
    if (cloErr) return NextResponse.json({ error: cloErr.message }, { status: 400 });
    cloTextMap = new Map((cloRows || []).map(c => [`${c.course_code}::${c.clo_code}`, c.clo_text || '']));
  }

  // 5) Kết quả 5 cột theo yêu cầu
  const items = scruRows.map(r => {
    const key = `${r.course_code}::${r.clo_code}`;
    return {
      mssv: student.mssv,
      full_name: student.full_name,
      course_code: r.course_code,
      course_name: courseNameMap.get(r.course_code) || '',
      clo_code: r.clo_code,
      clo_text: cloTextMap.get(key) || null,
      updated_at: r.updated_at,
    };
  });

  return NextResponse.json({ items });
}
