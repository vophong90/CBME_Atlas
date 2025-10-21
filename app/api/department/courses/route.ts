// app/api/department/courses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * Trả về danh sách học phần cho framework_id.
 * Ưu tiên bảng "courses" (nếu có cột framework_id).
 * Nếu không có/không khớp, fallback lấy DISTINCT course_code từ pi_clo_links & plo_clo_links.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id') || '';
    if (!framework_id) {
      return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role, bypass RLS

    // 1) Thử lấy từ bảng courses
    const tryCourses = await db
      .from('courses')
      .select('code,name,framework_id')
      .eq('framework_id', framework_id);

    // Nếu bảng tồn tại và có dữ liệu → dùng luôn
    if (!tryCourses.error && tryCourses.data && tryCourses.data.length) {
      const list = tryCourses.data.map((c: any) => ({
        code: c.code as string,
        name: (c as any).name as string | undefined,
      }));
      return NextResponse.json({ data: list });
    }

    // Nếu lỗi khác 42P01 (table not found) → trả lỗi
    if (tryCourses.error && tryCourses.error.code !== '42P01') {
      return NextResponse.json({ error: tryCourses.error.message }, { status: 400 });
    }

    // 2) Fallback: lấy DISTINCT từ link tables
    const [pi, plo] = await Promise.all([
      db.from('pi_clo_links').select('course_code').eq('framework_id', framework_id),
      db.from('plo_clo_links').select('course_code').eq('framework_id', framework_id),
    ]);

    if (pi.error && pi.error.code !== '42P01') {
      return NextResponse.json({ error: pi.error.message }, { status: 400 });
    }
    if (plo.error && plo.error.code !== '42P01') {
      return NextResponse.json({ error: plo.error.message }, { status: 400 });
    }

    const set = new Set<string>();
    (pi.data ?? []).forEach((r: any) => set.add(r.course_code as string));
    (plo.data ?? []).forEach((r: any) => set.add(r.course_code as string));

    const list = Array.from(set)
      .sort()
      .map((code) => ({ code }));

    return NextResponse.json({ data: list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
