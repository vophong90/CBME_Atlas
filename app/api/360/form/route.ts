import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/** GET ?request_id= */
export async function GET(req: Request) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const request_id = Number(url.searchParams.get('request_id'));
  if (!request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 });

  // RLS đảm bảo chỉ người chấm nhìn thấy request của mình
  const { data: reqRow, error } = await supabase
    .from('evaluation_requests')
    .select(`
      id, status, group_code, observation_id,
      campaign:campaign_id ( id, name, rubric_id, start_at, end_at ),
      evaluatee:evaluatee_user_id ( id )
    `)
    .eq('id', request_id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (reqRow.status !== 'pending') return NextResponse.json({ error: 'Request not pending' }, { status: 400 });

  // lấy rubric
  const { data: rubric, error: rerr } = await supabase
    .from('rubrics')
    .select('id,name,definition')
    .eq('id', reqRow.campaign.rubric_id)
    .single();

  if (rerr) return NextResponse.json({ error: rerr.message }, { status: 400 });

  return NextResponse.json({
    request: { id: reqRow.id, group_code: reqRow.group_code, campaign_id: reqRow.campaign.id, evaluatee_id: reqRow.evaluatee.id },
    rubric
  });
}
