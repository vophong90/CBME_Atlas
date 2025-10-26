// app/api/common/students/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * GET /api/common/students?framework_id=...&q=...&limit=...
 * - framework_id: (bắt buộc) UUID của khung
 * - q: (tuỳ chọn) chuỗi tìm kiếm theo mssv / họ tên / student_code
 * - limit: (tuỳ chọn) số lượng tối đa, mặc định 200, [10..1000]
 *
 * Trả về:
 * { items: Array<{ user_id, mssv, full_name, student_code?, framework_id }> }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = (searchParams.get('framework_id') || '').trim();
    const q = (searchParams.get('q') || '').trim();
    const limitRaw = Number(searchParams.get('limit') || 200);
    const limit = Math.max(10, Math.min(1000, isNaN(limitRaw) ? 200 : limitRaw));

    if (!framework_id) {
      return NextResponse.json({ error: 'framework_id is required' }, { status: 400 });
    }

    const db = createServiceClient();

    let query = db
      .from('students')
      .select('user_id,mssv,full_name,student_code,framework_id')
      .eq('framework_id', framework_id)
      .order('mssv', { ascending: true })
      .limit(limit);

    if (q) {
      // tìm theo mssv | họ tên | student_code
      // supabase-js: biểu thức OR, dùng cú pháp filter DSL
      query = query.or(
        `mssv.ilike.%${q}%,full_name.ilike.%${q}%,student_code.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    // Nếu table chưa tồn tại => trả rỗng (tránh vỡ UI)
    if (error && (error as any).code === '42P01') {
      return NextResponse.json({ items: [] });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
