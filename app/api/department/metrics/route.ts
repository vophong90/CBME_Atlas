// app/api/department/metrics/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';

/**
 * GET ?framework_id=&course_code=
 * Trả về [{ clo_code, total, achieved, not_yet }]
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const framework_id = searchParams.get('framework_id') || '';
  const course_code = searchParams.get('course_code') || '';

  if (!framework_id) return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 });

  let q = supabaseAdmin
    .from('student_clo_results_uploads')
    .select('mssv,course_code,clo_code,status')
    .eq('framework_id', framework_id);

  if (course_code) q = q.eq('course_code', course_code);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const agg = new Map<string, { total: number; achieved: number; not_yet: number }>();
  (data || []).forEach((r: any) => {
    const key = `${r.course_code}::${r.clo_code}`;
    const cur = agg.get(key) || { total: 0, achieved: 0, not_yet: 0 };
    cur.total += 1;
    if (r.status === 'achieved') cur.achieved += 1;
    else cur.not_yet += 1;
    agg.set(key, cur);
  });

  const res = Array.from(agg.entries()).map(([k, v]) => {
    const [course, clo] = k.split('::');
    return { course_code: course, clo_code: clo, ...v };
  });

  return NextResponse.json({ data: res });
}
