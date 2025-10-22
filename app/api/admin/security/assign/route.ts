// app/api/admin/security/assign/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { user_id, role_id } = await req.json();
    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'Missing user_id/role_id' }, { status: 400 });
    }

    // Tránh trùng lặp: kiểm tra trước
    const { data: existing, error: chkErr } = await supabaseAdmin
      .from('user_roles')
      .select('staff_user_id')
      .eq('staff_user_id', user_id)
      .eq('role_id', role_id)
      .is('department_id', null)
      .maybeSingle();

    if (chkErr) return NextResponse.json({ error: chkErr.message }, { status: 400 });
    if (existing) return NextResponse.json({ ok: true, already: true });

    const { error } = await supabaseAdmin
      .from('user_roles')
      .insert({ staff_user_id: user_id, role_id, department_id: null });

    if (error) {
      // Thông điệp dễ hiểu nếu cột NOT NULL
      if (error.message?.toLowerCase().includes('null value in column "department_id"')) {
        return NextResponse.json(
          { error: 'Schema user_roles.department_id đang NOT NULL. Hãy cho phép NULL để gán role toàn hệ.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
