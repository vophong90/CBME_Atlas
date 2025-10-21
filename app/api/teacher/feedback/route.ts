// app/api/teacher/feedback/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseServer';

type Body = {
  student_user_id?: string;
  message?: string;
  course_code?: string | null;
  clo_ids?: string[] | null;
};

export async function POST(req: Request) {
  try {
    const supabase = getSupabase(); // KHÔNG cần await

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Body;
    const student_user_id = String(body.student_user_id ?? '').trim();
    const message = String(body.message ?? '').trim();
    const course_code = body.course_code ?? null;
    const clo_ids = Array.isArray(body.clo_ids) ? body.clo_ids : null;

    if (!student_user_id || !message) {
      return NextResponse.json(
        { error: 'student_user_id and message are required' },
        { status: 400 }
      );
    }

    // (1) Moderation server-side (UI nên gọi trước, đây là lớp bảo vệ bổ sung)
    const origin = new URL(req.url).origin;
    const mRes = await fetch(`${origin}/api/student/feedback/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, kind: 'faculty', target: student_user_id }),
    });

    const mJs = await mRes.json().catch(() => ({}));
    if (!mRes.ok || !mJs?.ok) {
      const reason = mJs?.reason || 'Moderation blocked';
      return NextResponse.json({ error: `Moderation failed: ${reason}` }, { status: 400 });
    }

    // (2) Insert feedback (GV -> SV) dưới RLS của user hiện tại
    const { data, error } = await supabase
      .from('feedbacks')
      .insert({
        user_id: user.id,          // người gửi (teacher)
        sender_role: 'teacher',
        target_type: 'student',
        to_user_id: student_user_id,
        visibility: 'student',
        message,
        course_code: course_code ?? null,
        clo_ids: clo_ids ?? null,  // jsonb[]/jsonb tuỳ schema
        moderation_status: 'pass',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ item: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
