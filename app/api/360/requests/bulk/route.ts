import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * POST body:
 * {
 *   campaign_id: number,
 *   evaluatee_user_id: string,
 *   evaluator_user_ids: string[],   // user_id của người chấm
 *   group_code: 'peer'|'faculty'|'supervisor'|'self',
 *   expires_at?: string
 * }
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { campaign_id, evaluatee_user_id, evaluator_user_ids, group_code, expires_at } = body;

  if (!campaign_id || !evaluatee_user_id || !Array.isArray(evaluator_user_ids) || !group_code) {
    return NextResponse.json({ error: 'campaign_id, evaluatee_user_id, evaluator_user_ids[], group_code required' }, { status: 400 });
  }

  const rows = evaluator_user_ids.map((uid: string) => ({
    campaign_id,
    evaluatee_user_id,
    evaluator_user_id: uid,
    group_code,
    status: 'pending',
    expires_at: expires_at ?? null
  }));

  const { data, error } = await supabaseAdmin.from('evaluation_requests').insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}
