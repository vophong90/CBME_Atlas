// app/api/360/form/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

// ===== Helpers =====
function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function isValidGroup(g: any) {
  return ['self', 'peer', 'faculty', 'supervisor', 'patient'].includes(String(g));
}
function isValidStatus(s: any) {
  return ['active', 'inactive'].includes(String(s));
}

/**
 * GET /api/360/form
 * Query:
 *  - scope=evaluate|manager (default: evaluate)
 *  - group_code=...
 *  - status=active|inactive|all (default: active)
 *
 * scope=evaluate: chỉ trả về form đang có campaign mở (start_at <= now < end_at),
 *                 khớp rubric_id và nếu campaign quy định framework_id/course_code thì form cũng phải khớp.
 * scope=manager : trả về danh sách form theo filter, không phụ thuộc campaign.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope  = url.searchParams.get('scope') || 'evaluate';
    const status = (url.searchParams.get('status') || 'active').toLowerCase();
    const group_code = url.searchParams.get('group_code') || undefined;
    const nowIso = new Date().toISOString();

    const supabase = createServiceClient();

    if (scope !== 'evaluate') {
      // ========== scope=manager ==========
      let q = supabase
        .from('eval360_forms')
        .select('id, title, group_code, rubric_id, framework_id, course_code, status, created_at');

      if (group_code) q = q.eq('group_code', group_code);
      if (status && status !== 'all') q = q.eq('status', status);

      const { data: forms, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return ok({ items: forms ?? [] });
    }

    // ========== scope=evaluate ==========
    // Lấy các campaign đang mở: start_at <= now < end_at
    const { data: openCamps, error: campErr } = await supabase
      .from('evaluation_campaigns')
      .select('id, rubric_id, framework_id, course_code, start_at, end_at')
      .lte('start_at', nowIso)
      .gt('end_at', nowIso);

    if (campErr) throw campErr;
    if (!openCamps?.length) return ok({ items: [] });

    // Gom theo rubric_id để lọc form
    const rubricSet = new Set<string>(
      openCamps.map((c) => String(c.rubric_id)).filter(Boolean)
    );
    if (rubricSet.size === 0) return ok({ items: [] });

    let q = supabase
      .from('eval360_forms')
      .select('id, title, group_code, rubric_id, framework_id, course_code, status, created_at')
      .in('rubric_id', Array.from(rubricSet));

    if (group_code) q = q.eq('group_code', group_code);
    if (status && status !== 'all') q = q.eq('status', status);

    const { data: forms, error: formErr } = await q.order('created_at', { ascending: false });
    if (formErr) throw formErr;

    // Giữ lại form có ÍT NHẤT 1 campaign mở khớp rubric_id và (fw/code nếu campaign có chỉ định)
    const items = (forms || []).filter((f) =>
      openCamps.some((c) => {
        if (String(c.rubric_id) !== String(f.rubric_id)) return false;
        if (c.framework_id && String(c.framework_id) !== String(f.framework_id || '')) return false;
        if (c.course_code && String(c.course_code) !== String(f.course_code || '')) return false;
        return true;
      })
    );

    return ok({ items });
  } catch (e: any) {
    return err(e?.message || 'Server error', 500);
  }
}

/**
 * POST /api/360/form
 * Body:
 * {
 *   id?: string,                 // nếu có → UPDATE form
 *   title: string,
 *   group_code: 'self'|'peer'|'faculty'|'supervisor'|'patient',
 *   status: 'active'|'inactive',
 *   rubric_id?: string,          // dùng rubric sẵn có
 *   new_rubric?: {               // hoặc tạo rubric mới (ưu tiên new_rubric nếu gửi lên)
 *     title: string,
 *     threshold?: number,
 *     framework_id?: string|null,
 *     course_code?: string|null,
 *     definition: { columns: {key:string,label:string}[], rows: {id:string,label:string}[] }
 *   }
 * }
 */
export async function POST(req: Request) {
  try {
    const supabase = createServiceClient();
    const payload = await req.json();

    const id        = payload?.id as string | undefined;
    const title     = String(payload?.title ?? '').trim();
    const groupCode = String(payload?.group_code ?? '');
    const status    = String(payload?.status ?? 'active');

    if (!title)          return err('Thiếu tiêu đề biểu mẫu.');
    if (!isValidGroup(groupCode))  return err('group_code không hợp lệ.');
    if (!isValidStatus(status))    return err('status không hợp lệ.');

    let rubricId: string | null = null;

    if (payload?.new_rubric) {
      // Tạo rubric mới
      const rb = payload.new_rubric;
      const rbTitle = String(rb?.title ?? '').trim();
      const def     = rb?.definition;
      const threshold = Number.isFinite(rb?.threshold) ? Number(rb.threshold) : null;
      const framework_id = rb?.framework_id ?? null;
      const course_code  = rb?.course_code ?? null;

      if (!rbTitle) return err('Thiếu tiêu đề rubric.');
      if (
        !def ||
        !Array.isArray(def.columns) || def.columns.length === 0 ||
        !Array.isArray(def.rows)    || def.rows.length === 0
      ) {
        return err('Rubric phải có ít nhất 1 cột & 1 tiêu chí.');
      }

      const { data: insRb, error: insRbErr } = await supabase
        .from('rubrics')
        .insert({
          title: rbTitle,
          threshold,
          framework_id,
          course_code,
          definition: def,
        })
        .select('id')
        .single();

      if (insRbErr) throw insRbErr;
      rubricId = String(insRb.id);
    } else {
      // Dùng rubric có sẵn
      rubricId = payload?.rubric_id ? String(payload.rubric_id) : null;
      if (!rubricId) return err('Chưa chọn rubric.');
    }

    // Lưu/Update form
    if (id) {
      // UPDATE
      const { data: updated, error: upErr } = await supabase
        .from('eval360_forms')
        .update({
          title,
          group_code: groupCode,
          status,
          rubric_id: rubricId,
        })
        .eq('id', id)
        .select('id, title, group_code, rubric_id, framework_id, course_code, status, updated_at')
        .single();

      if (upErr) throw upErr;
      return ok({ ok: true, id: updated?.id, item: updated });
    } else {
      // INSERT
      const { data: inserted, error: insErr } = await supabase
        .from('eval360_forms')
        .insert({
          title,
          group_code: groupCode,
          status,
          rubric_id: rubricId,
        })
        .select('id, title, group_code, rubric_id, framework_id, course_code, status, created_at')
        .single();

      if (insErr) throw insErr;
      return ok({ ok: true, id: inserted?.id, item: inserted }, 201);
    }
  } catch (e: any) {
    return err(e?.message || 'Server error', 500);
  }
}

/**
 * DELETE /api/360/form?id=...
 * Xoá form theo id
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return err('Thiếu id.');

    const supabase = createServiceClient();
    const { error: delErr } = await supabase.from('eval360_forms').delete().eq('id', id);
    if (delErr) throw delErr;

    return ok({ ok: true });
  } catch (e: any) {
    return err(e?.message || 'Server error', 500);
  }
}
