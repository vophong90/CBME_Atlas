import { NextResponse } from 'next/server';
import { getSupabase, supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type Item = { item_key: string; selected_level: string; score?: number | null; comment?: string | null };

export async function POST(req: Request) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { request_id, overall_comment, items } = body as { request_id: number; overall_comment?: string | null; items: Item[] };
  if (!request_id || !Array.isArray(items)) {
    return NextResponse.json({ error: 'request_id & items[] required' }, { status: 400 });
  }

  // 1) Lấy request của người chấm
  const { data: reqRow, error: reqErr } = await supabase
    .from('evaluation_requests')
    .select('id,status,group_code,campaign_id,evaluatee_user_id')
    .eq('id', request_id)
    .single();
  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 400 });
  if (reqRow.status !== 'pending') return NextResponse.json({ error: 'Already submitted or invalid' }, { status: 400 });

  // 2) Lấy campaign để biết rubric_id
  const { data: camp, error: campErr } = await supabase
    .from('evaluation_campaigns')
    .select('id,rubric_id')
    .eq('id', reqRow.campaign_id)
    .single();
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 400 });

  // 3) Tạo observation (kind = eval360)
  const { data: obs, error: oerr } = await supabase
    .from('observations')
    .insert({
      rubric_id: camp.rubric_id,                // UUID
      student_user_id: reqRow.evaluatee_user_id,
      teacher_user_id: user.id,                 // người chấm
      status: 'submitted',
      overall_comment: overall_comment ?? null,
      submitted_at: new Date().toISOString(),
      kind: 'eval360',
    })
    .select()
    .single();
  if (oerr) return NextResponse.json({ error: oerr.message }, { status: 400 });

  // 4) Insert item scores
  if (items.length) {
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
  const { error: rerr } = await supabaseAdmin.rpc('compute_observation_clo_results', { p_observation_id: obs.id });
  if (rerr) return NextResponse.json({ error: `compute_observation_clo_results: ${rerr.message}` }, { status: 400 });

  return NextResponse.json({ ok: true, observation_id: obs.id });
}
