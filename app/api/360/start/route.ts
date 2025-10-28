export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { evaluatee_user_id, rubric_id, group_code } = body || {};
  if (!evaluatee_user_id || !rubric_id || !group_code) {
    return NextResponse.json({ error: 'Thiếu evaluatee_user_id/rubric_id/group_code' }, { status: 400 });
  }

  // tạo evaluation_requests "ad-hoc"
  const { data, error } = await sb.from('evaluation_requests').insert({
    campaign_id: null,                 // đánh giá tự phát, không theo campaign
    evaluatee_user_id,
    evaluator_user_id: user.id,
    group_code,                        // 'self'|'peer'|'faculty'|'supervisor'|'patient'
    status: 'pending',
    expires_at: null
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ request_id: data.id });
}
