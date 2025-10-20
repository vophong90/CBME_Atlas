// app/api/department/results/list/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const framework_id = searchParams.get('framework_id') || '';
  const course_code = searchParams.get('course_code') || '';
  const mssv = searchParams.get('mssv') || '';

  if (!framework_id) return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 });

  let q = supabaseAdmin
    .from('student_clo_results_uploads')
    .select('*', { count: 'exact' })
    .eq('framework_id', framework_id)
    .order('updated_at', { ascending: false });

  if (course_code) q = q.eq('course_code', course_code);
  if (mssv) q = q.eq('mssv', mssv);

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data, count: count || 0 });
}
