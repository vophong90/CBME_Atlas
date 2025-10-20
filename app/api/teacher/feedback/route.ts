import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/getSupabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { student_user_id, message, course_code, clo_ids } = body as {
    student_user_id: string, message: string, course_code?: string | null, clo_ids?: string[] | null
  };
  if (!student_user_id || !message) {
    return NextResponse.json({ error: 'student_user_id and message are required' }, { status: 400 });
  }

  // (1) Moderation local kiểm tra nhanh để đảm bảo client không lách (bạn vẫn nên gọi /moderate ở UI trước)
  const m = await fetch(`${new URL(req.url).origin}/api/teacher/feedback/moderate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  const mjs = await m.json();
  if (!m.ok || !mjs?.ok) {
    return NextResponse.json({ error: `Moderation failed: ${mjs?.reason || 'blocked'}` }, { status: 400 });
  }

  // (2) Insert feedback (GV -> SV)
  const { data, error } = await supabase.from('feedbacks').insert({
    user_id: user.id,
    sender_role: 'teacher',
    target_type: 'student',
    to_user_id: student_user_id,
    visibility: 'student',
    message,
    course_code: course_code ?? null,
    clo_ids: clo_ids ?? null,
    moderation_status: 'pass'  // đã qua moderation
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
