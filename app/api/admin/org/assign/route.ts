import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { department_id, user_ids } = await req.json();
    if (!department_id || !Array.isArray(user_ids) || !user_ids.length) {
      return NextResponse.json({ error: 'Missing department_id/user_ids' }, { status: 400 });
    }
    // chuyển BM: reset is_head=false nếu đang là head ở BM khác
    const updates = user_ids.map((uid: string) => ({
      user_id: uid,
      department_id,
      is_head: false,
    }));
    const { error } = await supabaseAdmin.from('staff').upsert(updates, { onConflict: 'user_id' });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: user_ids.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 400 });
  }
}
