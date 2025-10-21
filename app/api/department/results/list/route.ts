// app/api/department/results/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id') || '';
    const course_code = searchParams.get('course_code') || '';
    const mssv = searchParams.get('mssv') || '';

    if (!framework_id) {
      return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role, bypass RLS

    let q = db
      .from('student_clo_results_uploads')
      .select('*', { count: 'exact' })
      .eq('framework_id', framework_id)
      .order('updated_at', { ascending: false });

    if (course_code) q = q.eq('course_code', course_code);
    if (mssv) q = q.eq('mssv', mssv);

    const { data, error, count } = await q;

    if (error) {
      // Bảng chưa tồn tại => trả rỗng
      if (error.code === '42P01') return NextResponse.json({ data: [], count: 0 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data ?? [], count: count ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
