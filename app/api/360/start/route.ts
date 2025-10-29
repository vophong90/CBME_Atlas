// app/api/360/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * Body:
 * {
 *   form_id: string,
 *   evaluatee_user_id: string,
 *   // optional nếu bạn muốn ghi nhận: evaluator_user_id?: string, group_code?: GroupCode
 * }
 *
 * Tạo evaluation_requests với campaign_id (từ evaluation_campaigns đang mở)
 * Chọn campaign theo: rubric_id của form + (fw/code khớp nếu campaign có chỉ định) + thời gian hợp lệ
 * Ưu tiên campaign có start_at mới nhất.
 */
export async function POST(req: Request) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const form_id = String(body?.form_id || '');
    const evaluatee_user_id = String(body?.evaluatee_user_id || '');

    if (!form_id || !evaluatee_user_id) {
      return NextResponse.json({ error: 'Thiếu form_id hoặc evaluatee_user_id' }, { status: 400 });
    }

    // 1) Lấy form để biết rubric_id (+ fw/code nếu có)
    const { data: form, error: formErr } = await supabase
      .from('eval360_forms')
      .select('id, title, group_code, rubric_id, framework_id, course_code, status')
      .eq('id', form_id)
      .maybeSingle();

    if (formErr) throw formErr;
    if (!form) return NextResponse.json({ error: 'Form không tồn tại' }, { status: 404 });
    if (form.status !== 'active') {
      return NextResponse.json({ error: 'Form đang ngừng hoạt động' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // 2) Tìm campaign đang mở phù hợp theo rubric_id (+ khớp fw/code nếu campaign có chỉ định)
    let { data: camps, error: campErr } = await supabase
      .from('evaluation_campaigns')
      .select('id, rubric_id, framework_id, course_code, start_at, end_at, name')
      .eq('rubric_id', form.rubric_id)
      .lte('start_at', nowIso)
      .gt('end_at', nowIso)
      .order('start_at', { ascending: false });

    if (campErr) throw campErr;

    // Lọc lại bởi fw/code nếu campaign có set cụ thể (campaign null → coi như không ràng buộc)
    camps = (camps || []).filter((c) => {
      if (c.framework_id && String(c.framework_id) !== String(form.framework_id || '')) return false;
      if (c.course_code && String(c.course_code) !== String(form.course_code || '')) return false;
      return true;
    });

    const camp = camps?.[0];
    if (!camp) {
      return NextResponse.json(
        { error: 'Chưa cấu hình campaign đang mở cho form này. Hãy tạo campaign phù hợp (rubric/time) và gắn khung/học phần nếu cần.' },
        { status: 400 }
      );
    }

    // 3) Insert evaluation_requests (yêu cầu: bảng phải có campaign_id BIGINT NOT NULL FK → evaluation_campaigns.id)
    //    Ghi nhận group_code theo form (ổn hơn là để client gửi).
    const insertPayload: any = {
      campaign_id: camp.id,            // BIGINT -> từ evaluation_campaigns
      form_id: form.id,                // để truy vết
      evaluatee_user_id,               // người được đánh giá
      group_code: form.group_code,     // nhóm đánh giá của form
      status: 'pending',
    };

    // Nếu muốn lưu evaluator_user_id khi có đăng nhập (hoặc nhận từ body)
    if (body?.evaluator_user_id) {
      insertPayload.evaluator_user_id = String(body.evaluator_user_id);
    }

    const { data: ins, error: insErr } = await supabase
      .from('evaluation_requests')
      .insert(insertPayload)
      .select('id')
      .maybeSingle();

    if (insErr) throw insErr;

    return NextResponse.json({ request_id: ins?.id, campaign_id: camp.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
