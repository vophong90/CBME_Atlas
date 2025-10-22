// app/api/admin/org/unassign/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// POST { user_id: string }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id } = body || {};
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('staff')
      .update({ department_id: null })
      .eq('user_id', user_id)
      .select('user_id');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
