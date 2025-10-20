import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/** GET ?request_id= */
export async function GET(req: Request) {
  const supabase = getSupabase();
  const url = new URL(req.url);
  const request_id = Number(url.searchParams.get('request_id'));
  if (!request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 });

  // 1) Lấy request (RLS: chỉ người chấm thấy request của mình)
  const { data: reqRow, error: reqErr } = await supabase
    .from('evaluation_requests')
    .select('id,status,group_code,observation_id,campaign_id,evaluatee_user_id')
    .eq('id', request_id)
    .single();

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 400 });
  if (reqRow.status !== 'pending') {
    return NextResponse.json({ error: 'Request not pending' }, { status: 400 });
  }

  // 2) Lấy campaign để biết rubric_id
  const { data: camp, error: campErr } = await supabase
    .from('evaluation_campaigns')
    .select('id,name,rubric_id,start_at,end_at')
    .eq('id', reqRow.campaign_id)
    .single();

  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 400 });

  // 3) Lấy rubric
  const { data: rubric, error: rerr } = await supabase
    .from('rubrics')
    .select('id,name,definition')
    .eq('id', camp.rubric_id) // rubric_id là UUID (string)
    .single();

  if (rerr) return NextResponse.json({ error: rerr.message }, { status: 400 });

  return NextResponse.json({
    request: {
      id: reqRow.id,
      group_code: reqRow.group_code,
      campaign_id: camp.id,
      campaign_name: camp.name,
      evaluatee_id: reqRow.evaluatee_user_id,
    },
    rubric,
  });
}
