// app/api/360/submit/route.ts
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

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();

    // Yêu cầu đăng nhập
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Body
    const body = (await req.json().catch(() => ({}))) as {
      request_id?: number;
      overall_comment?: string | null;
      items?: Item[];
    };

    const request_id = Number(body.request_id);
    const items = Array.isArray(body.items) ? body.items : [];
    const overall_comment = body.overall_comment ?? null;

    if (!request_id || !Number.isFinite(request_id) || !Array.isArray(items)) {
      return NextResponse.json({ error: 'request_id & items[] required' }, { status: 400 });
    }

    // 1) Lấy request của người chấm (RLS đảm bảo chỉ thấy request hợp lệ)
    const { data: reqRow, error: reqErr } = await supabase
      .from('evaluation_requests')
      .select('id,status,group_code,campaign_id,evaluatee_user_id')
      .eq('id', request_id)
      .single();
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 400 });
    if (!reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: 'Already submitted or invalid' }, { status: 400 });
    }

    // 2) Lấy campaign để biết rubric_id
    const { data: camp, error: campErr } = await supabase
      .from('evaluation_campaigns')
      .select('id,rubric_id')
      .eq('id', reqRow.campaign_id)
      .single();
    if (campErr) return NextResponse.json({ error: campErr.message }, { status: 400 });
    if (!camp?.rubric_id) return NextResponse.json({ error: 'rubric_id missing' }, { status: 400 });

    // 3) Tạo observation (kind = eval360)
    const { data: obs, error: oerr } = await supabase
      .from('observations')
      .insert({
        rubric_id: camp.rubric_id, // UUID
        student_user_id: reqRow.evaluatee_user_id,
        teacher_user_id: user.id, // người chấm
        status: 'submitted',
        overall_comment,
        submitted_at: new Date().toISOString(),
        kind: 'eval360',
      })
      .select('*')
      .single();
    if (oerr) return NextResponse.json({ error: oerr.message }, { status: 400 });
    if (!obs) return NextResponse.json({ error: 'Create observation failed' }, { status: 500 });

    // 4) Insert item scores
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

    // 5) Đánh dấu request submitted + gắn observation_id
    const { error: uerr } = await supabase
      .from('evaluation_requests')
      .update({ status: 'submitted', observation_id: obs.id })
      .eq('id', request_id);
    if (uerr) return NextResponse.json({ error: uerr.message }, { status: 400 });

    // 6) Cập nhật CLO qua RPC (service role)
    const admin = createServiceClient(); // chắc chắn SupabaseClient (nếu thiếu ENV sẽ throw)
    const { error: rerr } = await admin.rpc('compute_observation_clo_results', {
      p_observation_id: obs.id,
    });
    if (rerr) {
      return NextResponse.json(
        { error: `compute_observation_clo_results: ${rerr.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, observation_id: obs.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
