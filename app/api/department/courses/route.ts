// app/api/department/courses/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';

/**
 * Trả về danh sách học phần cho framework_id.
 * Ưu tiên bảng "courses" (nếu có cột framework_id).
 * Nếu không có/không khớp, fallback lấy DISTINCT course_code từ pi_clo_links & plo_clo_links.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const framework_id = searchParams.get('framework_id') || '';
  if (!framework_id) return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 });

  // 1) Thử lấy từ bảng courses
  const tryCourses = await supabaseAdmin
    .from('courses')
    .select('code,name,framework_id')
    .eq('framework_id', framework_id);

  let list: { code: string; name?: string }[] = [];
  if (tryCourses.data && tryCourses.data.length) {
    list = tryCourses.data.map(c => ({ code: c.code, name: (c as any).name }));
  } else {
    // 2) Fallback: lấy từ link tables
    const [pi, plo] = await Promise.all([
      supabaseAdmin.from('pi_clo_links').select('course_code').eq('framework_id', framework_id),
      supabaseAdmin.from('plo_clo_links').select('course_code').eq('framework_id', framework_id),
    ]);
    const set = new Set<string>();
    (pi.data || []).forEach(r => set.add(r.course_code));
    (plo.data || []).forEach(r => set.add(r.course_code));
    list = Array.from(set).sort().map(code => ({ code }));
  }

  return NextResponse.json({ data: list });
}
