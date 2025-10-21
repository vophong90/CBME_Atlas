// app/api/student/feedback/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      student_id?: string | null;
      kind?: string;
      target?: string;
      text?: string;
    };

    const kind = (body.kind || '').trim();
    const target = (body.target || '').trim();
    const text = String(body.text ?? '').trim();
    const student_id = body.student_id || null;

    if (!kind || !target || !text) {
      return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role, bypass RLS
    const payload = { student_id, kind, target, text };

    const { error } = await db.from('feedbacks').insert(payload);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Bảng feedbacks chưa tồn tại' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
