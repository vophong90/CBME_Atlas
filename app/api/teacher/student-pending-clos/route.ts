import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/getSupabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const student_user_id = url.searchParams.get('student_user_id');
  const framework_id = url.searchParams.get('framework_id') || null;
  const course_code = url.searchParams.get('course_code') || null;

  if (!student_user_id) return NextResponse.json({ error: 'student_user_id is required' }, { status: 400 });

  const { data, error } = await supabase
    .rpc('student_pending_clos', { p_student_user_id: student_user_id, p_framework_id: framework_id, p_course_code: course_code });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}
