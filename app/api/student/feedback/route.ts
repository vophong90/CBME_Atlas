// app/api/student/feedback/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const { student_id, kind, target, text } = await req.json();
  if (!kind || !target || !text) {
    return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
  }
  const payload = { student_id: student_id || null, kind, target, text: String(text).trim() };
  const { error } = await supabaseAdmin.from('feedbacks').insert(payload);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
