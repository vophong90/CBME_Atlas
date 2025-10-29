// app/api/360/form/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * Query: ?group_code=self|peer|faculty|supervisor|patient&status=active
 * Trả về các form (eval360_forms) chỉ khi đang có campaign mở (evaluation_campaigns)
 * Campaign mở = start_at <= now < end_at
 * Khớp theo rubric_id; nếu campaign có framework_id/course_code thì phải khớp với form.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const group_code = url.searchParams.get('group_code') || undefined;
    const status = url.searchParams.get('status') || 'active';
    const nowIso = new Date().toISOString();

    const supabase = createServiceClient();

    // 1) Lấy các campaign đang mở
    //   start_at <= now < end_at
    const { data: openCamps, error: campErr } = await supabase
      .from('evaluation_campaigns')
      .select('id, rubric_id, framework_id, course_code, start_at, end_at')
      .lte('start_at', nowIso)
      .gt('end_at', nowIso);

    if (campErr) throw campErr;

    if (!openCamps?.length) {
      return NextResponse.json({ items: [] });
    }

    // Gom theo rubric_id để lọc forms nhanh
    const rubricSet = new Set<string>(
      openCamps
        .map((c) => String(c.rubric_id))
        .filter((x) => !!x)
    );

    if (rubricSet.size === 0) {
      return NextResponse.json({ items: [] });
    }

    // 2) Lấy forms theo group_code/status, lọc theo rubric_id ∈ open-campaigns
    let q = supabase
      .from('eval360_forms')
      .select('id, title, group_code, rubric_id, framework_id, course_code, status')
      .in('rubric_id', Array.from(rubricSet));

    if (group_code) q = q.eq('group_code', group_code);
    if (status)     q = q.eq('status', status);

    const { data: forms, error: formErr } = await q.order('created_at', { ascending: false });
    if (formErr) throw formErr;

    if (!forms?.length) {
      return NextResponse.json({ items: [] });
    }

    // 3) Giữ lại form có ÍT NHẤT 1 campaign mở khớp (rubric_id + (fw/code nếu campaign có chỉ định))
    const items = forms.filter((f) =>
      openCamps.some((c) => {
        if (String(c.rubric_id) !== String(f.rubric_id)) return false;
        if (c.framework_id && String(c.framework_id) !== String(f.framework_id || '')) return false;
        if (c.course_code && String(c.course_code) !== String(f.course_code || '')) return false;
        return true;
      })
    );

    return NextResponse.json({
      items: items.map((f) => ({
        id: f.id,
        title: f.title,
        rubric_id: f.rubric_id,
        group_code: f.group_code,
        framework_id: f.framework_id,
        course_code: f.course_code,
        status: f.status,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
