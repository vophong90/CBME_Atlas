// app/api/teacher/observations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase, createServiceClient } from '@/lib/supabaseServer';

type Item = {
  item_key: string;
  selected_level: string;
  score?: number | null;
  comment?: string | null;
};

export async function GET(req: Request) {
  try {
    const supabase = getSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const mssv = url.searchParams.get('mssv') || undefined;
    const course_code = url.searchParams.get('course_code') || undefined;

    // Lịch sử đánh giá của GV
    let q = supabase
      .from('observations')
      .select(
        'id, rubric_id, student_user_id, status, total_score, course_code, created_at, submitted_at'
      )
      .eq('teacher_user_id', user.id)
      .order('created_at', { ascending: false });

    if (course_code) q = q.eq('course_code', course_code);

    // (tuỳ) lọc theo mssv -> resolve user_id từ students
    if (mssv) {
      const st = await supabase
        .from('students')
        .select('user_id')
        .ilike('mssv', mssv)
        .limit(1)
        .maybeSingle();

      if (st.data?.user_id) q = q.eq('student_user_id', st.data.user_id);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      rubric_id?: string | number;
      student_user_id?: string;
      framework_id?: string | null;
      course_code?: string | null;
      status?: 'draft' | 'submitted';
      overall_comment?: string | null;
      items?: Item[];
    };

    const rubric_id = body.rubric_id as any;
    const student_user_id = String(body.student_user_id ?? '');
    const framework_id = body.framework_id ?? null;
    const course_code = body.course_code ?? null;
    const status = (body.status ?? 'draft') as 'draft' | 'submitted';
    const overall_comment = body.overall_comment ?? null;
    const items = Array.isArray(body.items) ? (body.items as Item[]) : [];

    if (!rubric_id || !student_user_id || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'rubric_id, student_user_id, items are required' },
        { status: 400 }
      );
    }

    // 1) Tạo observation (RLS theo teacher)
    const { data: obs, error: oerr } = await supabase
      .from('observations')
      .insert({
        rubric_id,
        student_user_id,
        teacher_user_id: user.id,
        framework_id,
        course_code,
        status,
        overall_comment,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (oerr) return NextResponse.json({ error: oerr.message }, { status: 400 });

    // 2) Chèn item scores
    if (items.length > 0) {
      const payload = items.map((it) => ({
        observation_id: obs.id,
        item_key: it.item_key,
        selected_level: it.selected_level,
        score: it.score ?? null,
        comment: it.comment ?? null,
      }));

      const { error: serr } = await supabase.from('observation_item_scores').insert(payload);
      if (serr) return NextResponse.json({ error: serr.message }, { status: 400 });
    }

    // 3) Nếu submitted -> gọi RPC để đổ kết quả sang student_clo_results (service role)
    if (status === 'submitted') {
      const admin = createServiceClient();
      const { error: rerr } = await admin.rpc('compute_observation_clo_results', {
        p_observation_id: obs.id,
      });
      if (rerr) {
        return NextResponse.json(
          { error: `compute_observation_clo_results: ${rerr.message}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ observation: obs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
