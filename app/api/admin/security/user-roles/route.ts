// app/api/admin/security/user-roles/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Hỗ trợ ?user_ids=a&user_ids=b hoặc ?user_ids=a,b
  const fromRepeat = searchParams.getAll('user_ids');
  const flat = fromRepeat
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);

  if (!flat.length) return NextResponse.json({ map: {} });

  try {
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('staff_user_id, role_id, department_id')
      .in('staff_user_id', flat)
      .is('department_id', null); // chỉ lấy role "toàn hệ"

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const map: Record<string, string[]> = {};
    (data || []).forEach((r: any) => {
      if (!map[r.staff_user_id]) map[r.staff_user_id] = [];
      map[r.staff_user_id].push(r.role_id);
    });

    return NextResponse.json({ map });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
