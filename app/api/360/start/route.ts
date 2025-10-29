// app/api/360/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { form_id, evaluatee_user_id } = body || {};

  if (!form_id || !evaluatee_user_id) {
    return NextResponse.json({ error: 'Thiếu form_id / evaluatee_user_id' }, { status: 400 });
  }

  // Lấy form để kiểm tra active và lấy rubric_id, group_code dùng về sau
  const { data: form, error: fErr } = await sb
    .from('eval360_forms')
    .select('id, rubric_id, group_code, status')
    .eq('id', form_id)
    .single();

  if (fErr || !form) {
    return NextResponse.json({ error: 'Form không tồn tại' }, { status: 404 });
  }
  if (form.status !== 'active') {
    return NextResponse.json({ error: 'Form không còn hoạt động' }, { status: 400 });
  }

  // Insert request: chỉ cần form_id để qua RLS; các cột khác tuỳ schema của bạn
  const insertObj: any = {
    form_id,
    evaluatee_user_id,
    // nếu bảng bạn có group_code / rubric_id thì có thể set thêm, bằng dữ liệu từ form:
    // group_code: form.group_code,
    // rubric_id: form.rubric_id,
  };

  const { data: ins, error: iErr } = await sb
    .from('evaluation_requests')
    .insert(insertObj)
    .select('id')
    .single();

  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 400 });
  }

  return NextResponse.json({ request_id: ins.id });
}
