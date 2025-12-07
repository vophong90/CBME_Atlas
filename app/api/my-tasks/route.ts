import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  // ⭐ MUST await — vì getSupabase() trả về Promise
  const supabase = await getSupabase();

  const {
    data: { user },
    error: userErr
  } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('evaluation_requests')
    .select(`
      id, status, group_code, expires_at, created_at,
      campaign:campaign_id (
        id, name, course_code, start_at, end_at, rubric_id
      ),
      evaluatee:evaluatee_user_id ( id )
    `)
    .eq('evaluator_user_id', user.id)
    .eq('status', 'pending');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const items = (data || []).filter(
    (r: any) =>
      r.campaign &&
      r.campaign.start_at <= now &&
      r.campaign.end_at >= now
  );

  return NextResponse.json({ items }, { status: 200 });
}
