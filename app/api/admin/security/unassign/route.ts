// app/api/admin/security/unassign/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { user_id, role_id } = await req.json();
    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'Missing user_id/role_id' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('staff_user_id', user_id)
      .eq('role_id', role_id)
      .is('department_id', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
