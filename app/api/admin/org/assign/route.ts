// app/api/admin/org/assign/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// POST { department_id: string, user_ids: string[] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { department_id, user_ids } = body || {};
    if (!department_id || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'Missing department_id or user_ids' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('staff')
      .update({ department_id })
      .in('user_id', user_ids)
      .select('user_id,department_id');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
