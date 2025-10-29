// app/api/360/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const sb = createServiceClient();
    const { form_id, evaluatee_user_id } = await req.json();

    if (!form_id || !evaluatee_user_id) {
      return NextResponse.json({ error: 'Thiếu form_id / evaluatee_user_id' }, { status: 400 });
    }

    // 1) Kiểm tra form còn hoạt động
    const { data: form, error: ferr } = await sb
      .from('eval360_forms')
      .select('id, rubric_id, status')
      .eq('id', form_id)
      .single();
    if (ferr || !form) return NextResponse.json({ error: 'Form không tồn tại' }, { status: 400 });
    if (form.status !== 'active') {
      return NextResponse.json({ error: 'Form không ở trạng thái active' }, { status: 400 });
    }

    // 2) Tìm campaign đang mở cho form
    let campaignId: string | null = null;

    // 2a) Thử qua bảng nối evaluation_campaign_forms (nếu có)
    try {
      const { data: pivots } = await sb
        .from('evaluation_campaign_forms')
        .select('campaign_id')
        .eq('form_id', form_id);

      const ids = (pivots || []).map((x: any) => x.campaign_id).filter(Boolean);
      if (ids.length) {
        const { data: camps } = await sb
          .from('evaluation_campaigns')
          .select('id, created_at, status')
          .in('id', ids)
          .in('status', ['open', 'active'])
          .order('created_at', { ascending: false })
          .limit(1);
        if (camps && camps[0]) campaignId = camps[0].id;
      }
    } catch {
      // bảng nối có thể không tồn tại → bỏ qua
    }

    // 2b) Nếu chưa có, thử bảng campaigns có cột form_id
    if (!campaignId) {
      const { data: camps2 } = await sb
        .from('evaluation_campaigns')
        .select('id, created_at, status')
        .eq('form_id', form_id)
        .in('status', ['open', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (camps2 && camps2[0]) campaignId = camps2[0].id;
    }

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Chưa cấu hình campaign đang mở cho form này. Hãy tạo campaign và gắn với form.' },
        { status: 400 }
      );
    }

    // 3) Tạo request (KHÔNG chèn rubric_id nếu bảng không có cột này)
    const { data: reqRow, error: ierr } = await sb
      .from('evaluation_requests')
      .insert({
        form_id: form_id,
        campaign_id: campaignId,
        evaluatee_user_id: evaluatee_user_id,
      })
      .select('id')
      .single();
    if (ierr) return NextResponse.json({ error: ierr.message }, { status: 400 });

    return NextResponse.json({ request_id: reqRow.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
