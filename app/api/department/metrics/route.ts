// app/api/department/metrics/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const db = createServiceClient();
  try {
    const { searchParams } = req.nextUrl;
    const framework_id = searchParams.get('framework_id') || '';
    const course_code  = searchParams.get('course_code') || '';

    if (!framework_id) {
      return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });
    }

    // Lấy thô và gộp ở server (an toàn, không lệ thuộc group của PostgREST)
    let q = db
      .from('student_clo_results_uploads')
      .select('course_code, clo_code, status')
      .eq('framework_id', framework_id);

    if (course_code) q = q.eq('course_code', course_code);

    const { data, error } = await q;
    if (error) throw error;

    type Row = { course_code: string; clo_code: string; status: 'achieved'|'not_yet' };
    const agg = new Map<string, { course_code: string; clo_code: string; total: number; achieved: number; not_yet: number }>();

    (data as Row[] | null ?? []).forEach(r => {
      const key = `${r.course_code}|${r.clo_code}`;
      if (!agg.has(key)) agg.set(key, { course_code: r.course_code, clo_code: r.clo_code, total: 0, achieved: 0, not_yet: 0 });
      const x = agg.get(key)!;
      x.total += 1;
      if (r.status === 'achieved') x.achieved += 1; else x.not_yet += 1;
    });

    const rows = Array.from(agg.values())
      .sort((a, b) => a.course_code.localeCompare(b.course_code) || a.clo_code.localeCompare(b.clo_code));

    return NextResponse.json({ data: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
