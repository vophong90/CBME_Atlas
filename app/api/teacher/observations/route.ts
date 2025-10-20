import { NextResponse } from 'next/server';
import { getSupabase, supabaseAdmin } from '@/lib/getSupabaseServer';

export const dynamic = 'force-dynamic';

type Item = { item_key: string; selected_level: string; score?: number | null; comment?: string | null; };

export async function GET(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const mssv = url.searchParams.get('mssv') || undefined;
  const course_code = url.searchParams.get('course_code') || undefined;

  // Lịch sử đánh giá của GV
  let q = supabase.from('observations').select('id, rubric_id, student_user_id, status, total_score, course_code, created_at, submitted_at').eq('teacher_user_id', user.id).order('created_at', { ascending: false });
  if (course_code) q = q.eq('course_code', course_code);

  // (tuỳ) lọc theo mssv -> cần resolve user_id từ students
  if (mssv) {
    const st = await supabase.from('students').select('user_id').ilike('mssv', mssv).limit(1).maybeSingle();
    if (st.data?.user_id) q = q.eq('student_user_id', st.data.user_id);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function POST(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    rubric_id,
    student_user_id,
    framework_id,
    course_code,
    status,                 // 'draft' | 'submitted'
    overall_comment,
    items                   // Item[]
  } = body as {
    rubric_id: number;
    student_user_id: string;
    framework_id?: string | null;
    course_code?: string | null;
    status: 'draft'|'submitted';
    overall_comment?: string | null;
    items: Item[];
  };

  if (!rubric_id || !student_user_id || !Array.isArray(items)) {
    return NextResponse.json({ error: 'rubric_id, student_user_id, items are required' }, { status: 400 });
  }

  // 1) Tạo observation (RLS theo teacher)
  const { data: obs, error: oerr } = await supabase
    .from('observations')
    .insert({
      rubric_id,
      student_user_id,
      teacher_user_id: user.id,
      framework_id: framework_id ?? null,
      course_code: course_code ?? null,
      status,
      overall_comment: overall_comment ?? null,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null
    })
    .select()
    .single();

  if (oerr) return NextResponse.json({ error: oerr.message }, { status: 400 });

  // 2) Chèn item scores
  if (items.length) {
    const payload = items.map((it: Item) => ({
      observation_id: obs.id,
      item_key: it.item_key,
      selected_level: it.selected_level,
      score: it.score ?? null,
      comment: it.comment ?? null
    }));

    const { error: serr } = await supabase.from('observation_item_scores').insert(payload);
    if (serr) return NextResponse.json({ error: serr.message }, { status: 400 });
  }

  // 3) Nếu submitted -> gọi RPC để đổ kết quả sang student_clo_results (dùng service role)
  if (status === 'submitted') {
    const { error: rerr } = await supabaseAdmin.rpc('compute_observation_clo_results', { p_observation_id: obs.id });
    if (rerr) return NextResponse.json({ error: `compute_observation_clo_results: ${rerr.message}` }, { status: 400 });
  }

  return NextResponse.json({ observation: obs });
}
