// app/api/department/inbox/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * GET ?course_code=CS101 (có thể nhiều, cách nhau dấu phẩy)
 *     &from=2025-01-01&to=2025-01-31 (tuỳ chọn)
 * Trả góp ý từ bảng feedbacks với kind='course' và target ∈ (mã học phần)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cc = (searchParams.get('course_code') || '').trim();
    const from = (searchParams.get('from') || '').trim();
    const to = (searchParams.get('to') || '').trim();

    if (!cc) return NextResponse.json({ error: 'Thiếu course_code' }, { status: 400 });
    const codes = cc.split(',').map((s) => s.trim()).filter(Boolean);
    if (!codes.length) return NextResponse.json({ error: 'course_code rỗng' }, { status: 400 });

    const db = createServiceClient(); // service-role, bypass RLS

    let q = db
      .from('feedbacks')
      .select('id,created_at,student_id,target,text')
      .eq('kind', 'course')
      .in('target', codes)
      .order('created_at', { ascending: false });

    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);

    const { data, error } = await q;

    if (error) {
      // Nếu bảng chưa tồn tại
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
