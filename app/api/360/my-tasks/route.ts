// app/api/360/my-tasks/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

/**
 * Trả về danh sách "yêu cầu đánh giá" (evaluation_requests)
 * của người dùng hiện tại (evaluator_user_id = user.id)
 * kèm thông tin campaign + evaluatee.
 */
export async function GET(req: NextRequest) {
  try {
    // ⭐ MUST await vì getSupabaseFromRequest() trả về Promise<SupabaseClient>
    const supabase = await getSupabaseFromRequest();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || ''; // 'pending' | 'submitted' | ''
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    // Lấy requests của chính người dùng
    let qReq = supabase
      .from('evaluation_requests')
      .select(
        `
        id,
        status,
        group_code,
        created_at,
        campaign_id,
        rubric_id,
        evaluatee_user_id,
        evaluator_user_id,
        campaigns:evaluation_campaigns (
          id, name, course_code, framework_id, start_at, end_at
        ),
        evaluatee:students!evaluation_requests_evaluatee_user_id_fkey (
          user_id, mssv, full_name
        )
      `
      )
      .eq('evaluator_user_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      qReq = qReq.eq('status', status);
    }

    const { data, error } = await qReq;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let items = (data || []).map((r: any) => ({
      id: r.id,
      status: r.status, // 'pending' | 'submitted' | ...
      group_code: r.group_code, // 'self' | 'peer' | 'faculty' | 'supervisor' | 'patient'
      campaign: {
        id: r.campaigns?.id ?? r.campaign_id,
        name: r.campaigns?.name ?? null,
        course_code: r.campaigns?.course_code ?? null,
        framework_id: r.campaigns?.framework_id ?? null,
        start_at: r.campaigns?.start_at ?? null,
        end_at: r.campaigns?.end_at ?? null,
      },
      rubric_id: r.rubric_id,
      evaluatee: {
        user_id: r.evaluatee_user_id,
        mssv: r.evaluatee?.mssv ?? null,
        full_name: r.evaluatee?.full_name ?? null,
      },
    }));

    if (q) {
      items = items.filter(
        (it) =>
          (it.evaluatee?.mssv || '').toLowerCase().includes(q) ||
          (it.evaluatee?.full_name || '').toLowerCase().includes(q) ||
          (it.campaign?.name || '').toLowerCase().includes(q) ||
          (it.campaign?.course_code || '').toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Server error' },
      { status: 500 }
    );
  }
}
