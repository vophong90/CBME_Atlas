// app/api/department/metrics/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * GET ?framework_id=&course_code=
 * Trả về [{ course_code, clo_code, total, achieved, not_yet }]
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id') || '';
    const course_code = searchParams.get('course_code') || '';

    if (!framework_id) {
      return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role, bypass RLS

    let q = db
      .from('student_clo_results_uploads')
      .select('mssv,course_code,clo_code,status')
      .eq('framework_id', framework_id);

    if (course_code) q = q.eq('course_code', course_code);

    const { data, error } = await q;

    if (error) {
      // Bảng chưa tồn tại → trả rỗng
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const agg = new Map<string, { total: number; achieved: number; not_yet: number }>();

    for (const r of data ?? []) {
      const key = `${r.course_code}::${r.clo_code}`;
      const cur = agg.get(key) ?? { total: 0, achieved: 0, not_yet: 0 };
      cur.total += 1;
      if (r.status === 'achieved') cur.achieved += 1;
      else cur.not_yet += 1;
      agg.set(key, cur);
    }

    const res = Array.from(agg.entries()).map(([k, v]) => {
      const [course, clo] = k.split('::');
      return { course_code: course, clo_code: clo, ...v };
    });

    return NextResponse.json({ data: res });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
