export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest, createServiceClient } from '@/lib/supabaseServer';

/**
 * Body mẫu:
 * {
 *   request_id: string,
 *   rubric_id: string,
 *   overall_comment?: string,
 *   items: Array<{ item_key: string; selected_level: string; score?: number; comment?: string }>
 * }
 */
type SubmitBody = {
  request_id?: string;
  rubric_id?: string;
  overall_comment?: string | null;
  items?: Array<{
    item_key: string;
    selected_level: string;
    score?: number | null;
    comment?: string | null;
  }>;
};

async function getStudentIdByUserId(sb: any, user_id: string) {
  const { data, error } = await sb
    .from('students')
    .select('id')
    .eq('user_id', user_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const sb = getSupabaseFromRequest(req);
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as SubmitBody;
    const request_id = String(body.request_id || '');
    const rubric_id  = String(body.rubric_id  || '');
    if (!request_id || !rubric_id) {
      return NextResponse.json({ error: 'Thiếu request_id hoặc rubric_id' }, { status: 400 });
    }

    // Lấy evaluation_request
    const { data: reqRow, error: reqErr } = await sb
      .from('evaluation_requests')
      .select('id, status, evaluator_user_id, evaluatee_user_id, campaign_id, rubric_id')
      .eq('id', request_id)
      .maybeSingle();
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 400 });
    if (!reqRow) return NextResponse.json({ error: 'Request không tồn tại' }, { status: 404 });
    if (reqRow.evaluator_user_id !== user.id) {
      return NextResponse.json({ error: 'Bạn không phải người được phân công' }, { status: 403 });
    }
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: `Trạng thái hiện tại: ${reqRow.status}` }, { status: 400 });
    }

    // Map evaluatee_user_id -> students.id (FK bắt buộc)
    const student_id = await getStudentIdByUserId(sb, reqRow.evaluatee_user_id);
    if (!student_id) {
      return NextResponse.json({
        error: 'Không tìm thấy bản ghi trong bảng students cho evaluatee_user_id. Hãy đảm bảo sinh viên đã có dòng trong public.students (mapping user_id → students.id).'
      }, { status: 400 });
    }

    // Tạo observation mới: kind = 'eval360' (đúng CHECK), course_id để null nếu campaign không ràng buộc học phần
    const { data: obs, error: insErr } = await sb
      .from('observations')
      .insert({
        rubric_id,
        student_id,
        course_id: null,           // có thể set từ campaign nếu bạn muốn map sang courses
        rater_id: user.id,
        kind: 'eval360',
        note: body.overall_comment ?? null,
        observed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    // Lưu các item score "mềm" (item_key/selected_level/score/comment).
    // Giữ nguyên cột cũ để tương thích RPC cũ nếu cần.
    if (Array.isArray(body.items) && body.items.length) {
      const payload = body.items.map((it) => ({
        observation_id: obs.id,
        item_key: it.item_key,
        selected_level: it.selected_level,
        score: it.score ?? null,
        comment: it.comment ?? null,
        -- level_rank/level_label nếu cần bạn có thể map thêm từ rubrics.definition
      }));
      const { error: sErr } = await sb.from('observation_item_scores').insert(payload);
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    }

    // Đánh dấu yêu cầu đã nộp
    const { error: upErr } = await sb
      .from('evaluation_requests')
      .update({ status: 'submitted' })
      .eq('id', request_id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    // (Tuỳ chọn) gọi RPC tính kết quả CLO nếu bạn đã sẵn sàng dùng rubric mapping
    // const admin = createServiceClient();
    // const { error: rerr } = await admin.rpc('compute_observation_clo_results', { p_observation_id: obs.id });
    // if (rerr) return NextResponse.json({ error: `RPC: ${rerr.message}` }, { status: 400 });

    return NextResponse.json({ ok: true, observation_id: obs.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
