export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { ensureQA } from '@/lib/perm360';

/** Helpers */
function parseTime(s?: string | null) {
  if (!s) return null;
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * GET ?form_id=...
 * - Nếu có form_id: trả về các campaign khớp rubric_id + (framework_id/course_code) của form đó.
 * - Nếu không: trả về toàn bộ campaign (QA/Admin).
 */
export async function GET(req: Request) {
  const sb = createServiceClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const guard = await ensureQA(user?.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const formId = url.searchParams.get('form_id');

  let q = sb
    .from('evaluation_campaigns')
    .select('id,name,start_at,end_at,framework_id,course_code,rubric_id,created_by,created_at,updated_at')
    .order('start_at', { ascending: false });

  if (formId) {
    // Lấy form để biết rubric/framework/course
    const fr = await sb
      .from('eval360_forms')
      .select('id,rubric_id,framework_id,course_code')
      .eq('id', formId)
      .maybeSingle();

    if (fr.error) return bad(fr.error.message, 400);
    if (!fr.data) return bad('Form không tồn tại', 404);

    q = q.eq('rubric_id', fr.data.rubric_id);
    if (fr.data.framework_id) q = q.eq('framework_id', fr.data.framework_id);
    else q = q.is('framework_id', null);
    if (fr.data.course_code) q = q.eq('course_code', fr.data.course_code);
    else q = q.is('course_code', null);
  }

  const { data, error } = await q;
  if (error) return bad(error.message, 400);

  return NextResponse.json({ items: data || [] });
}

/**
 * POST
 * Body: { form_id: string, name: string, start_at: string|Date, end_at: string|Date }
 * - Suy ra rubric_id, framework_id, course_code từ form_id
 * - Gắn created_by từ user hiện tại
 */
export async function POST(req: Request) {
  const sb = createServiceClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const guard = await ensureQA(user?.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const form_id = body?.form_id as string | undefined;
  const name = (body?.name as string | undefined)?.trim();
  const start_at = parseTime(body?.start_at);
  const end_at = parseTime(body?.end_at);

  if (!form_id || !name || !start_at || !end_at) {
    return bad('Thiếu trường bắt buộc: form_id, name, start_at, end_at');
  }
  if (start_at >= end_at) return bad('start_at phải < end_at');

  // Lấy form để suy ra rubric/framework/course
  const fr = await sb
    .from('eval360_forms')
    .select('id,rubric_id,framework_id,course_code')
    .eq('id', form_id)
    .maybeSingle();

  if (fr.error) return bad(fr.error.message, 400);
  if (!fr.data) return bad('Form không tồn tại', 404);

  // (Tuỳ chọn) chặn overlap cho cùng "cặp" rubric+fw+course
  const ov = await sb
    .from('evaluation_campaigns')
    .select('id,start_at,end_at')
    .eq('rubric_id', fr.data.rubric_id)
    .eq('framework_id', fr.data.framework_id ?? null)
    .eq('course_code', fr.data.course_code ?? null)
    .lte('start_at', end_at)
    .gte('end_at', start_at);

  if (!ov.error && ov.data && ov.data.length) {
    return bad('Khoảng thời gian bị trùng với một campaign hiện có cho rubric/khung/học phần này');
  }

  const ins = await sb
    .from('evaluation_campaigns')
    .insert({
      name,
      rubric_id: fr.data.rubric_id,
      framework_id: fr.data.framework_id ?? null,
      course_code: fr.data.course_code ?? null,
      start_at,
      end_at,
      created_by: user!.id, // dùng user đăng nhập
    })
    .select('*')
    .maybeSingle();

  if (ins.error) return bad(ins.error.message, 400);

  return NextResponse.json({ ok: true, item: ins.data });
}

/**
 * PATCH ?id=…   body: { action: 'close_now' }
 * - Đóng ngay campaign: set end_at = now nếu end_at > now
 */
export async function PATCH(req: Request) {
  const sb = createServiceClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const guard = await ensureQA(user?.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id') || 0);
  if (!id) return bad('Thiếu id');

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  if (action === 'close_now') {
    const nowIso = new Date().toISOString();

    // chỉ update nếu đang mở
    const upd = await sb
      .from('evaluation_campaigns')
      .update({ end_at: nowIso })
      .eq('id', id)
      .gt('end_at', nowIso)
      .select('*')
      .maybeSingle();

    if (upd.error) return bad(upd.error.message, 400);
    if (!upd.data) return bad('Campaign đã đóng hoặc không tồn tại', 404);

    return NextResponse.json({ ok: true, item: upd.data });
  }

  return bad('Hành động không hợp lệ', 400);
}
