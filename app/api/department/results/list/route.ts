// app/api/department/results/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const db = createServiceClient();
  try {
    const { searchParams } = req.nextUrl;
    const framework_id = searchParams.get('framework_id') || '';
    const course_code = searchParams.get('course_code') || '';
    const mssv = searchParams.get('mssv') || '';

    if (!framework_id) {
      return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });
    }

    // 1) lấy uploads
    let q = db
      .from('student_clo_results_uploads')
      .select('id,mssv,framework_id,course_code,clo_code,status,updated_at')
      .eq('framework_id', framework_id);

    if (course_code) q = q.eq('course_code', course_code);
    if (mssv) q = q.ilike('mssv', `%${mssv}%`);
    q = q.order('updated_at', { ascending: false });

    const { data: uploads, error } = await q;
    if (error) throw error;

    // 2) map for joins
    const mssvSet = Array.from(new Set(uploads.map((r) => r.mssv).filter(Boolean)));
    const courseSet = Array.from(new Set(uploads.map((r) => r.course_code).filter(Boolean)));

    // students (theo framework nếu có gắn)
    const [studentsRes, coursesRes] = await Promise.all([
      db.from('students')
        .select('mssv,full_name,framework_id')
        .in('mssv', mssvSet.length ? mssvSet : ['__none__']),
      db.from('courses')
        .select('course_code,course_name,framework_id')
        .eq('framework_id', framework_id)
        .in('course_code', courseSet.length ? courseSet : ['__none__']),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (coursesRes.error) throw coursesRes.error;

    const stuMap = new Map<string, string>();
    for (const s of (studentsRes.data ?? [])) {
      if (!s.mssv) continue;
      stuMap.set(s.mssv, s.full_name || '');
    }

    const courseMap = new Map<string, string>();
    for (const c of (coursesRes.data ?? [])) {
      courseMap.set(c.course_code, c.course_name || '');
    }

    // 3) merge
    const data = (uploads ?? []).map((r) => ({
      id: r.id,
      mssv: r.mssv,
      student_full_name: stuMap.get(r.mssv) || null,
      course_code: r.course_code,
      course_name: courseMap.get(r.course_code) || null,
      clo_code: r.clo_code,
      status: r.status as 'achieved' | 'not_yet',
      updated_at: r.updated_at,
    }));

    return NextResponse.json(
      { data, count: data.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
