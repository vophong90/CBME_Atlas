// app/api/360/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer'; // SERVICE ROLE!

export async function POST(req: Request) {
  try {
    const sb = createServiceClient(); // bypass RLS
    const { form_id, evaluatee_user_id } = await req.json();

    if (!form_id || !evaluatee_user_id) {
      return NextResponse.json({ error: 'Thiếu form_id/evaluatee_user_id' }, { status: 400 });
    }

    // Xác thực form còn active + lấy rubric_id
    const { data: form, error: ferr } = await sb
      .from('eval360_forms')
      .select('id, rubric_id, status')
      .eq('id', form_id)
      .eq('status', 'active')
      .single();
    if (ferr || !form) return NextResponse.json({ error: 'Form không tồn tại/không hoạt động' }, { status: 400 });

    // Tạo evaluation_request (KHÔNG chèn rubric_id nếu schema không có cột này)
    const insertPayload: any = {
      form_id,
      evaluatee_user_id,   // SV được đánh giá
      // rater_user_id: null // nếu muốn lưu người chấm đã đăng nhập thì set = auth user id
    };

    const { data: reqRow, error: ierr } = await sb
      .from('evaluation_requests')
      .insert(insertPayload)
      .select('id')
      .single();
    if (ierr) return NextResponse.json({ error: ierr.message }, { status: 400 });

    return NextResponse.json({ request_id: reqRow.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
