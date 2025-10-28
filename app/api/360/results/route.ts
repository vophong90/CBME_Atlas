export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const sb = createServiceClient();
  const url = new URL(req.url);
  const mssv = (url.searchParams.get('mssv') || '').trim();
  if (!mssv) return NextResponse.json({ items: [] });

  const { data: st, error: stErr } = await sb
    .from('students')
    .select('id, user_id, mssv, full_name')
    .eq('mssv', mssv)
    .maybeSingle();
  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 400 });
  if (!st) return NextResponse.json({ items: [] });

  // lấy tất cả observations eval360 của SV này
  const { data: obs, error: obErr } = await sb
    .from('observations')
    .select('id, rubric_id, rater_id, observed_at, note, request_id')
    .eq('student_id', st.id)
    .eq('kind', 'eval360')
    .order('observed_at', { ascending: false });
  if (obErr) return NextResponse.json({ error: obErr.message }, { status: 400 });

  const requestIds = Array.from(new Set((obs || []).map(o => o.request_id).filter(Boolean)));
  const rubricIds  = Array.from(new Set((obs || []).map(o => o.rubric_id).filter(Boolean)));
  const raterIds   = Array.from(new Set((obs || []).map(o => o.rater_id).filter(Boolean)));

  const [{ data: reqs }, { data: rubs }, { data: raters }] = await Promise.all([
    requestIds.length ? sb.from('evaluation_requests').select('id, group_code, evaluator_user_id').in('id', requestIds) : Promise.resolve({ data: [] as any[] }),
    rubricIds.length  ? sb.from('rubrics').select('id, title').in('id', rubricIds)                                   : Promise.resolve({ data: [] as any[] }),
    raterIds.length   ? sb.from('staff').select('user_id, full_name').in('user_id', raterIds)                         : Promise.resolve({ data: [] as any[] }),
  ]);

  const reqMap  = new Map((reqs || []).map(r => [r.id, r]));
  const rubMap  = new Map((rubs || []).map(r => [r.id, r]));
  const rtrMap  = new Map((raters || []).map(r => [r.user_id, r.full_name]));

  const items = (obs || []).map(o => {
    const rq = o.request_id ? reqMap.get(o.request_id) : null;
    const rb = rubMap.get(o.rubric_id);
    return {
      observation_id: o.id,
      observed_at: o.observed_at,
      rubric_title: rb?.title || null,
      group_code: rq?.group_code || 'unknown',
      rater_name: rtrMap.get(o.rater_id) || null,
      note: o.note || null,
    };
  });

  return NextResponse.json({ student: { mssv: st.mssv, full_name: st.full_name }, items });
}
