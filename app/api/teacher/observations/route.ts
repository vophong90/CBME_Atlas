export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest, createServiceClient } from '@/lib/supabaseServer';

type Item = { item_key: string; selected_level: string; score?: number | null; comment?: string | null; };

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseFromRequest(req);
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user)   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const framework_id = url.searchParams.get('framework_id') || undefined;
    const course_code  = url.searchParams.get('course_code')  || undefined;
    const q            = url.searchParams.get('q')            || undefined;
    const mssv         = url.searchParams.get('mssv')         || undefined;

    let base = supabase
      .from('observations')
      .select('id,rubric_id,student_user_id,status,total_score,course_code,framework_id,created_at,submitted_at')
      .eq('teacher_user_id', user.id)
      .order('created_at', { ascending: false });

    if (framework_id) base = base.eq('framework_id', framework_id);
    if (course_code)  base = base.eq('course_code',  course_code);

    const { data: obs, error: obsErr } = await base;
    if (obsErr) return NextResponse.json({ error: obsErr.message }, { status: 400 });
    if (!obs?.length) return NextResponse.json({ items: [] });

    const studentIds = Array.from(new Set(obs.map(o => o.student_user_id).filter(Boolean))) as string[];
    const rubricIds  = Array.from(new Set(obs.map(o => o.rubric_id).filter(Boolean))) as string[];

    const { data: students } = await supabase.from('students').select('user_id,mssv,full_name').in('user_id', studentIds.length ? studentIds : ['___empty___']);
    const { data: rubrics  } = await supabase.from('rubrics').select('id,title').in('id', rubricIds.length ? rubricIds : ['00000000-0000-0000-0000-000000000000']);

    const stuMap = new Map((students||[]).map(s => [s.user_id, s]));
    const rubMap = new Map((rubrics||[]).map(r => [r.id, r]));

    let items = obs.map(o => ({
      id: o.id,
      created_at: o.created_at,
      submitted_at: o.submitted_at,
      status: o.status as 'draft'|'submitted',
      total_score: o.total_score ?? null,
      course_code: o.course_code ?? null,
      framework_id: o.framework_id ?? null,
      student_user_id: o.student_user_id,
      student_mssv: stuMap.get(o.student_user_id)?.mssv ?? null,
      student_full_name: stuMap.get(o.student_user_id)?.full_name ?? null,
      rubric_id: o.rubric_id,
      rubric_title: rubMap.get(o.rubric_id)?.title ?? '',
    }));

    if (mssv) {
      const mm = mssv.toLowerCase();
      items = items.filter(x => (x.student_mssv || '').toLowerCase().includes(mm));
    }
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
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user)   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      rubric_id?: string;
      student_user_id?: string;
      framework_id?: string | null;
      course_code?: string | null;
      status?: 'draft' | 'submitted';
      overall_comment?: string | null;
      items?: Item[];
    };

    const id              = body.id || undefined;
    const rubric_id       = String(body.rubric_id ?? '');
    const student_user_id = String(body.student_user_id ?? '');
    const framework_id    = body.framework_id ?? null;
    const course_code     = body.course_code ?? null;
    const status          = (body.status ?? 'draft') as 'draft' | 'submitted';
    const overall_comment = body.overall_comment ?? null;
    const items           = Array.isArray(body.items) ? (body.items as Item[]) : [];

    if (!rubric_id || !student_user_id || !Array.isArray(items)) {
      return NextResponse.json({ error: 'rubric_id, student_user_id, items are required' }, { status: 400 });
    }

    // UPDATE if id present
    if (id) {
      const { data: obs0, error: chkErr } = await supabase.from('observations').select('id,teacher_user_id').eq('id', id).maybeSingle();
      if (chkErr) return NextResponse.json({ error: chkErr.message }, { status: 400 });
      if (!obs0 || obs0.teacher_user_id !== user.id) return NextResponse.json({ error: 'Không có quyền cập nhật' }, { status: 403 });

      const { data: obsUpd, error: updErr } = await supabase
        .from('observations')
        .update({
          rubric_id, student_user_id, framework_id, course_code, status, overall_comment,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

      await supabase.from('observation_item_scores').delete().eq('observation_id', id);
      if (items.length) {
        const payload = items.map(it => ({ observation_id: obsUpd.id, item_key: it.item_key, selected_level: it.selected_level, score: it.score ?? null, comment: it.comment ?? null }));
        const { error: serr } = await supabase.from('observation_item_scores').insert(payload);
        if (serr) return NextResponse.json({ error: serr.message }, { status: 400 });
      }

      if (status === 'submitted') {
        const admin = createServiceClient();
        const { error: rerr } = await admin.rpc('compute_observation_clo_results', { p_observation_id: obsUpd.id });
        if (rerr) return NextResponse.json({ error: `compute_observation_clo_results: ${rerr.message}` }, { status: 400 });
      }

      return NextResponse.json({ observation: obsUpd });
    }

    // INSERT
    const { data: obs, error: oerr } = await supabase
      .from('observations')
      .insert({
        rubric_id, student_user_id, teacher_user_id: user.id,
        framework_id, course_code, status, overall_comment,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (oerr) return NextResponse.json({ error: oerr.message }, { status: 400 });

    if (items.length) {
      const payload = items.map(it => ({ observation_id: obs.id, item_key: it.item_key, selected_level: it.selected_level, score: it.score ?? null, comment: it.comment ?? null }));
      const { error: serr } = await supabase.from('observation_item_scores').insert(payload);
      if (serr) return NextResponse.json({ error: serr.message }, { status: 400 });
    }

    if (status === 'submitted') {
      const admin = createServiceClient();
      const { error: rerr } = await admin.rpc('compute_observation_clo_results', { p_observation_id: obs.id });
      if (rerr) return NextResponse.json({ error: `compute_observation_clo_results: ${rerr.message}` }, { status: 400 });
    }

    return NextResponse.json({ observation: obs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = getSupabaseFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // chỉ cho xoá bản của chính GV
    const { data: obs, error: oerr } = await supabase.from('observations').select('id').eq('id', id).eq('teacher_user_id', user.id).maybeSingle();
    if (oerr) return NextResponse.json({ error: oerr.message }, { status: 400 });
    if (!obs) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await supabase.from('observation_item_scores').delete().eq('observation_id', id);
    const { error: derr } = await supabase.from('observations').delete().eq('id', id);
    if (derr) return NextResponse.json({ error: derr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
