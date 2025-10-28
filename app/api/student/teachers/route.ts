// app/api/student/teachers/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const admin = createServiceClient(); // service-role

    // Đúng theo schema hiện có: bảng 'staff' (không phải 'teachers')
    const { data, error } = await admin
      .from('staff')
      .select('full_name, is_active');

    if (error) {
      // Bảng chưa có → trả mảng rỗng để UI không vỡ
      return NextResponse.json<string[]>([]);
    }

    const names = Array.from(
      new Set(
        (data || [])
          .filter(r => r && r.is_active !== false)
          .map(r => String(r.full_name || '').trim())
          .filter(Boolean)
      )
    ).sort();

    return NextResponse.json<string[]>(names);
  } catch {
    return NextResponse.json<string[]>([], { status: 200 });
  }
}
