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

/** Helper: chuẩn hóa về khóa chính students.id */
async function resolveStudentPK(
  supabase: any,
  opts: { student_id?: string | null; student_user_id?: string | null; student_mssv?: string | null }
): Promise<string | null> {
  const { student_id, student_user_id, student_mssv } = opts || {};
  if (student_id) return student_id;

  if (student_user_id) {
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', student_user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return data.id;
  }

  if (student_mssv) {
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('mssv', student_mssv)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return data.id;
  }

  return null;
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
      if (!course_id) return NextResponse.json({ items: [] });
    }

    // Lấy danh sách observation của GV hiện tại (RLS nên lọc theo rater_id)
    let obsQ = supabase
      .from('observations')
      .select('id, rubric_id, student_id, course_id, observed_at, note, kind')
      .order('observed_at', { ascending: false });

    if (course_id) obsQ = obsQ.eq('course_id', course_id);

    const { data: obs, error: obsErr } = await obsQ;
    if (obsErr) return NextResponse.json({ error: obsErr.message }, { status: 400 });
    if (!obs || obs.length === 0) return NextResponse.json({ items: [] });

    // join thêm thông tin SV + rubric + course
    const studentIds = Array.from(new Set(obs.map(o => o.student_id).filter(Boolean)));
    const rubricIds  = Array.from(new Set(obs.map(o => o.rubric_id).filter(Boolean)));
    const courseIds  = Array.from(new Set(obs.map(o => o.course_id).filter(Boolean)));

    const [
      { data: students, error: stuErr },
      { data: rubrics,  error: rubErr },
      { data: courses,  error: crsErr },
    ] = await Promise.all([
      // >>> FIX: join theo students.id (không phải user_id)
      supabase.from('students').select('id, user_id, mssv, full_name').in('id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('rubrics').select('id, title').in('id', rubricIds.length ? rubricIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('courses').select('id, course_code').in('id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000']),
    ]);
    if (stuErr) return NextResponse.json({ error: stuErr.message }, { status: 400 });
    if (rubErr) return NextResponse.json({ error: rubErr.message }, { status: 400 });
    if (crsErr) return NextResponse.json({ error: crsErr.message }, { status: 400 });

    const stuMap = new Map((students || []).map(s => [s.id, s]));  // <<< key = students.id
    const rubMap = new Map((rubrics  || []).map(r => [r.id, r]));
    const crsMap = new Map((courses  || []).map(c => [c.id, c]));

    let items = (obs || []).map(o => {
      const st = stuMap.get(o.student_id);
      const rb = rubMap.get(o.rubric_id);
      const cs = crsMap.get(o.course_id);
      return {
        id: o.id as string,
        created_at: o.observed_at ?? null,
        submitted_at: null,
        status: (o.kind === 'submitted' ? 'submitted' : 'draft') as 'draft'|'submitted',
        course_code: cs?.course_code ?? null,
        framework_id: framework_id ?? null,
        student_user_id: st?.user_id ?? null,
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
      id?: string;                      // nếu update
      rubric_id?: string;
      // các biến đầu vào tiềm năng từ UI:
      student_id?: string | null;       // KHÓA CHÍNH của students (ưu tiên dùng)
      student_user_id?: string | null;  // auth.users.id (nếu gửi cái này thì sẽ resolve)
      student_mssv?: string | null;     // mssv (nếu gửi cái này cũng resolve)
      framework_id?: string | null;     // để resolve course_id
      course_code?: string | null;      // để resolve course_id
      status?: 'draft' | 'submitted';
      overall_comment?: string | null;
      items?: Item[];
    };

    const id = body.id || undefined;
    const rubric_id = String(body.rubric_id || '');

    // >>> FIX: chuẩn hóa về students.id
    const student_pk = await resolveStudentPK(supabase, {
      student_id: body.student_id ?? null,
      student_user_id: body.student_user_id ?? null,
      student_mssv: body.student_mssv ?? null,
    });
    if (!student_pk) {
      return NextResponse.json({ error: 'Không tìm thấy sinh viên (students.id)' }, { status: 400 });
    }

    const kind = (body.status === 'submitted' ? 'submitted' : 'draft') as 'submitted' | 'draft';
    const note = body.overall_comment ?? null;

    if (!rubric_id) return NextResponse.json({ error: 'rubric_id là bắt buộc' }, { status: 400 });

    // resolve course_id nếu có filter khung + mã học phần
    let course_id: string | null = null;
    if (body.framework_id && body.course_code) {
      course_id = await resolveCourseId(supabase, body.framework_id, body.course_code);
      if (!course_id) return NextResponse.json({ error: 'Không tìm thấy học phần' }, { status: 400 });
    }

    // UPDATE
    if (id) {
      const { data: own, error: chkErr } = await supabase.from('observations').select('id').eq('id', id).maybeSingle();
      if (chkErr) return NextResponse.json({ error: chkErr.message }, { status: 400 });
      if (!own)   return NextResponse.json({ error: 'Không có quyền cập nhật' }, { status: 403 });

      const { data: upd, error: updErr } = await supabase
        .from('observations')
        .update({
          rubric_id,
          student_id: student_pk,       // <<< dùng PK hợp lệ
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

      // Item scores (nếu dùng bảng riêng; nếu schema bạn khác, có thể bỏ)
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
        student_id: student_pk,          // <<< dùng PK hợp lệ
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

    await supabase.from('observation_item_scores').delete().eq('observation_id', id);
    const { error } = await supabase.from('observations').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
