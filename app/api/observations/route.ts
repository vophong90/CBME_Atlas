import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
// import type { Database } from '@/types/supabase'; // nếu bạn có types, bỏ comment và <Database> bên dưới

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient/*<Database>*/({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { student_code, course_code, rubric_title, items } = body as {
      student_code: string;
      course_code: string;
      rubric_title: string;
      items: Array<{ code: string; level_rank: number }>;
    };
    if (!student_code || !course_code || !rubric_title || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, message: 'Thiếu tham số' }, { status: 400 });
    }

    // Lookups theo schema bạn đã dán
    const { data: stu, error: eStu } = await supabase
      .from('students')
      .select('id')
      .eq('student_code', student_code)
      .single();
    if (eStu || !stu) return NextResponse.json({ ok: false, message: 'Không tìm thấy sinh viên' }, { status: 400 });

    const { data: course, error: eCourse } = await supabase
      .from('courses')
      .select('id')
      .eq('course_code', course_code) // đúng cột
      .single();
    if (eCourse || !course) return NextResponse.json({ ok: false, message: 'Không tìm thấy học phần' }, { status: 400 });

    const { data: rubric, error: eRub } = await supabase
      .from('rubrics')
      .select('id')
      .eq('course_code', course_code)
      .eq('title', rubric_title) // đúng cột
      .single();
    if (eRub || !rubric) return NextResponse.json({ ok: false, message: 'Không tìm thấy rubric' }, { status: 400 });

    // Tạo Observation: CHỐT kind='teacher' và rater_id=user.id
    const { data: obs, error: eObs } = await supabase
      .from('observations')
      .insert({
        student_id: stu.id,
        course_id: course.id,
        rubric_id: rubric.id,
        rater_id: user.id,
        observed_at: new Date().toISOString(),
        consent: false,
        kind: 'teacher',
      })
      .select()
      .single();
    if (eObs || !obs) {
      return NextResponse.json({ ok: false, message: eObs?.message || 'Không tạo được observation' }, { status: 400 });
    }

    // Lấy rubric items theo rubric_id (nếu bảng tồn tại)
    const { data: ritems, error: eItems } = await supabase
      .from('rubric_items')
      .select('id, code')
      .eq('rubric_id', rubric.id);
    if (eItems) {
      return NextResponse.json({ ok: false, message: eItems.message }, { status: 400 });
    }
    const code2id = new Map((ritems || []).map((r: any) => [r.code, r.id]));

    // Dựng payload điểm
    const scoresPayload = items.map(it => {
      const rid = code2id.get(it.code);
      if (!rid) throw new Error(`Rubric item code không hợp lệ: ${it.code}`);
      return {
        observation_id: obs.id,
        rubric_item_id: rid,
        level_rank: it.level_rank,
        level_label: it.level_rank === 2 ? 'Khá' : it.level_rank === 1 ? 'Đạt' : 'Không đạt',
      };
    });

    const { error: eScores } = await supabase.from('observation_item_scores').insert(scoresPayload);
    if (eScores) {
      return NextResponse.json({ ok: false, message: eScores.message }, { status: 400 });
    }

    // Gọi RPC tính CLO (nếu đã có)
    const { error: eRpc } = await supabase.rpc('compute_observation_clo_results', { p_observation_id: obs.id });
    if (eRpc) {
      // Không chặn flow chính; trả warning nếu muốn:
      // return NextResponse.json({ ok: true, id: obs.id, warn: `RPC failed: ${eRpc.message}` });
    }

    return NextResponse.json({ ok: true, id: obs.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
