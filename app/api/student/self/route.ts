// app/api/student/self/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    // Lấy user hiện tại từ cookie (RLS)
    const sb = createServerClient();
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();

    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Thử RLS trước
    const r1 = await sb
      .from('students')
      .select('id, full_name, mssv, framework_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (r1.data) return NextResponse.json({ data: r1.data });
    if (r1.error && r1.error.code !== 'PGRST116') {
      // nếu có lỗi khác RLS/no row, thử service-role (fallback)
    }

    // Fallback: service-role (trường hợp RLS chặn hoặc table chưa có policy)
    const db = createServiceClient();
    const { data, error } = await db
      .from('students')
      .select('id, full_name, mssv, framework_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: null }); // chưa tạo bảng -> trả rỗng
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
