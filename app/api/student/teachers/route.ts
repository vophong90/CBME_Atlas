// app/api/student/teachers/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const db = createServiceClient();

    // Lấy danh sách giảng viên từ bảng staff (is_active = true)
    // Alias quan hệ department để nhận object { id, name }
    // LƯU Ý: nếu tên FK khác "staff_department_id_fkey", hãy thay đúng tên FK của bạn.
    const { data, error } = await db
      .from('staff')
      .select(`
        user_id,
        full_name,
        department_id,
        department:departments!staff_department_id_fkey ( id, name )
      `)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const items = (data || []).map((r: any) => {
      // Fallback: nếu vì lý do nào đó Supabase vẫn trả "departments" (mảng) thay vì "department"
      const dept =
        r?.department ??
        (Array.isArray(r?.departments) ? r.departments[0] : r?.departments) ??
        null;

      return {
        user_id: r.user_id,
        full_name: r.full_name,
        department_id: r.department_id ?? (dept ? dept.id : null),
        department_name: dept ? dept.name : null,
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
