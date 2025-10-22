import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { department_id, user_id } = await req.json();
    if (!department_id) return NextResponse.json({ error: 'Missing department_id' }, { status: 400 });

    // Bỏ cờ head của tất cả trong BM
    const { error: e1 } = await supabaseAdmin
      .from('staff')
      .update({ is_head: false })
      .eq('department_id', department_id);
    if (e1) throw e1;

    if (user_id) {
      // set head cho user này (đảm bảo user thuộc đúng BM)
      const { error: e2 } = await supabaseAdmin
        .from('staff')
        .update({ is_head: true, department_id }) // ép về đúng BM nếu chưa
        .eq('user_id', user_id);
      if (e2) throw e2;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 400 });
  }
}
