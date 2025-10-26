// app/api/teacher/pending-clos/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function toInt(v: any, d: number) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

export async function GET(req: Request) {
  const supabase = getSupabaseFromRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const framework_id = url.searchParams.get('framework_id') || '';
  const q            = url.searchParams.get('q')?.trim() || '';
  const course_code  = url.searchParams.get('course_code')?.trim() || '';
  const limit        = Math.min(toInt(url.searchParams.get('limit'), 50), 200);
  const offset       = toInt(url.searchParams.get('offset'), 0);

  if (!framework_id) {
    return NextResponse.json({ error: 'framework_id is required' }, { status: 400 });
  }

  // 1) Lấy page dữ liệu
  const { data: rows, error } = await supabase.rpc('teacher_pending_clos', {
    p_framework_id: framework_id,
    p_q: q || null,
    p_course_code: course_code || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 2) Tách items + meta
  let total = 0;
  let matched_students = 0;
  const items = (rows || []).map((r: any) => {
    total = r.total_count ?? total;
    matched_students = r.matched_students ?? matched_students;
    return {
      mssv: r.mssv,
      full_name: r.full_name,
      course_code: r.course_code,
      course_name: r.course_name,
      clo_code: r.clo_code,
      clo_text: r.clo_text,
      updated_at: r.updated_at,
    };
  });

  // 3) Nếu không có dòng → gọi counts để vẫn trả meta
  if (!items.length) {
    const { data: cRows, error: cErr } = await supabase.rpc('teacher_pending_clos_counts', {
      p_framework_id: framework_id,
      p_q: q || null,
      p_course_code: course_code || null,
    });
    if (!cErr && Array.isArray(cRows) && cRows[0]) {
      total = Number(cRows[0].total_count) || 0;
      matched_students = Number(cRows[0].matched_students) || 0;
    }
  }

  return NextResponse.json({
    items,
    total,
    matched_students,
    limit,
    offset,
  });
}
