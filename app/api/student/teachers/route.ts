// app/api/student/teachers/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const db = createServiceClient(); // service-role, bypass RLS

    const { data, error } = await db.from('teachers').select('full_name');

    if (error) {
      // Nếu bảng chưa tồn tại → trả rỗng thay vì lỗi build
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const list = Array.from(new Set((data ?? []).map((t: any) => String(t.full_name))))
      .filter(Boolean)
      .sort();

    return NextResponse.json({ data: list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
