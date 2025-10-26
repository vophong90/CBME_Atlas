// app/api/teacher/observations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest, createServiceClient } from '@/lib/supabaseServer';

type Item = {
  item_key: string;
  selected_level: string;
  score?: number | null;
  comment?: string | null;
};

/** Helper: tra course_id từ framework_id + course_code */
async function resolveCourseId(supabase: any, framework_id?: string | null, course_code?: string | null) {
  if (!framework_id || !course_code) return null;
  const { data, error } = await supabase
    .from('courses')
    .select('id')
    .eq('framework_id', framework_id)
    .eq('course_code', course_code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const framework_id = url.searchParams.get('framework_id') || undefined;
    const course_code  = url.searchParams.get('course_code')  || undefined;
    const q            = url.searchParams.get('q')            || undefined;

    // nếu có filter học phần, đổi sang course_id
    let course_id: string | null = null;
    if (framework_id && course_code) {
      course_id = await resolveCourseId(supabase, framework_id, course_code);
      if (!course_id) return NextResponse.json({ items: [] }); // không có học phần này
    }

    // Lấy danh sách observation của GV hiện tại (RLS đã chặn theo rater_id rồi)
    let obsQ = supabase
      .from('observations')
      .select('id, rubric_id, student_id, course_id, observed_at, note, kind')
      .order('observed_at', { ascending: false });

    if (course_id) obsQ = obsQ.eq('course_id', course_id);

    const { data: obs, error: obsErr } = await obsQ;
    if (obsErr) return NextResponse.json({ error: obsErr.message }, { status: 400 });
    if (!obs || obs.length === 0) return NextResponse.json({ items: [] });

    // join thêm thông tin SV + rubric + course code/name
    const studentIds = Array.from(new Set(obs.map(o => o.student_id).filter(Boolean)));
    const rubricIds  = Array.from(new Set(obs.map(o => o.rubric_id).filter(Boolean)));
    const courseIds  = Array.from(new Set(obs.map(o => o.course_id).filter(Boolean)));

    const [{ data: students, error: stuErr },
           { data: rubrics,  error: rubErr },
           { data: courses,  error: crsErr }] = await Promise.all([
      supabase.from('students').select('user_id, mssv, full_name').in('user_id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('rubrics').select('id, title'),
      supabase.from('courses').select('id, course_code'),
    ]);
    if (stuErr) return NextResponse.json({ error: stuErr.message }, { status: 400 });
    if (rubErr) return NextResponse.json({ error: rubErr.message }, { status: 400 });
    if (crsErr) return NextResponse.json({ error: crsErr.message }, { status: 400 });

    const stuMap = new Map((students || []).map(s => [s.user_id, s]));
    const rubMap = new Map((rubrics  || []).map(r => [r.id, r]));
    const crsMap = new Map((courses  || []).map(c => [c.id, c]));

    let items = (obs || []).map(o => {
      const st = stuMap.get(o.student_id);
      const rb = rubMap.get(o.rubric_id);
      const cs = crsMap.get(o.course_id);
      return {
        id: o.id as string,
        created_at: o.observed_at ?? null,      // UI dùng created_at: map từ observed_at
        submitted_at: null,                      // bảng hiện tại không có; để null
        status: (o.kind === 'submitted' ? 'submitted' : 'draft') as 'draft'|'submitted',
        course_code: cs?.course_code ?? null,
        framework_id: framework_id ?? null,
        student_user_id: o.student_id as string,
        student_mssv: st?.mssv ?? null,
        student_full_name: st?.full_name ?? null,
        rubric_id: o.rubric_id as string,
        rubric_title: rb?.title ?? null,
      };
    });

    if (q) {
      const qq = q.toLowerCase();
      items = items.filter(x =>
        (x.student_mssv || '').toLowerCase().includes(qq) ||
        (x.student_full_name || '').toLowerCase().includes(qq)
      );
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      id?: string; // nếu update
      rubric_id?: string;
      student_user_id?: string;              // từ UI cũ -> map sang student_id
      framework_id?: string | null;          // chỉ dùng để resolve course_id
      course_code?: string | null;           // chỉ dùng để resolve course_id
      status?: 'draft' | 'submitted';        // map sang "kind"
      overall_comment?: string | null;       // map sang "note"
      items?: Item[];
    };

    const id = body.id || undefined;
    const rubric_id = String(body.rubric_id || '');
    const student_id = String(body.student_user_id || '');
    const kind = (body.status === 'submitted' ? 'submitted' : 'draft') as 'submitted'|'draft';
    const note = body.overall_comment ?? null;

    if (!rubric_id || !student_id) {
      return NextResponse.json({ error: 'rubric_id, student_user_id là bắt buộc' }, { status: 400 });
    }

    // resolve course_id nếu có filter khung + mã học phần
    let course_id: string | null = null;
    if (body.framework_id && body.course_code) {
      course_id = await resolveCourseId(supabase, body.framework_id, body.course_code);
      if (!course_id) return NextResponse.json({ error: 'Không tìm thấy học phần' }, { status: 400 });
    }

    // UPDATE (nếu có id)
    if (id) {
      // đảm bảo thuộc về rater hiện tại (RLS cũng đã lọc nhưng kiểm tra rõ ràng)
      const { data: own, error: chkErr } = await supabase
        .from('observations')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (chkErr) return NextResponse.json({ error: chkErr.message }, { status: 400 });
      if (!own)   return NextResponse.json({ error: 'Không có quyền cập nhật' }, { status: 403 });

      const { data: upd, error: updErr } = await supabase
        .from('observations')
        .update({
          rubric_id,
          student_id,
          course_id: course_id ?? null,
          rater_id: user.id,
          kind,
          note,
          observed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

      // Xử lý item scores (nếu bạn đang dùng bảng này)
      if (Array.isArray(body.items)) {
        await supabase.from('observation_item_scores').delete().eq('observation_id', id);
        if (body.items.length) {
          const payload = body.items.map(it => ({
            observation_id: id,
            item_key: it.item_key,
            selected_level: it.selected_level,
            score: it.score ?? null,
            comment: it.comment ?? null,
          }));
          const { error: insErr } = await supabase.from('observation_item_scores').insert(payload);
          if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
        }
      }

      if (kind === 'submitted') {
        const admin = createServiceClient();
        const { error: rerr } = await admin.rpc('compute_observation_clo_results', { p_observation_id: id });
        if (rerr) return NextResponse.json({ error: `RPC compute_observation_clo_results: ${rerr.message}` }, { status: 400 });
      }

      return NextResponse.json({ observation: upd });
    }

    // INSERT mới
    const { data: ins, error: insErr } = await supabase
      .from('observations')
      .insert({
        rubric_id,
        student_id,
        course_id: course_id ?? null,
        rater_id: user.id,
        kind,
        note,
        observed_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    if (Array.isArray(body.items) && body.items.length) {
      const payload = body.items.map(it => ({
        observation_id: ins.id,
        item_key: it.item_key,
        selected_level: it.selected_level,
        score: it.score ?? null,
        comment: it.comment ?? null,
      }));
      const { error: sErr } = await supabase.from('observation_item_scores').insert(payload);
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    }

    if (kind === 'submitted') {
      const admin = createServiceClient();
      const { error: rerr } = await admin.rpc('compute_observation_clo_results', { p_observation_id: ins.id });
      if (rerr) return NextResponse.json({ error: `RPC compute_observation_clo_results: ${rerr.message}` }, { status: 400 });
    }

    return NextResponse.json({ observation: ins });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = getSupabaseFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // xoá con trước (nếu FK chưa cascade)
    await supabase.from('observation_item_scores').delete().eq('observation_id', id);

    const { error } = await supabase.from('observations').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
