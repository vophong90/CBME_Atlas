// app/api/360/form/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const sb = createServiceClient();
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const group  = url.searchParams.get('group_code') || undefined;

  let q = sb.from('eval360_forms')
    .select('id,title,group_code,rubric_id,framework_id,course_code,status,created_at,updated_at')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') q = q.eq('status', status);
  if (group  && group  !== 'all') q = q.eq('group_code', group);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const sb = createServiceClient();
  const body = await req.json().catch(() => ({}));

  const {
    id,
    title,
    group_code,
    status,
    rubric_id,
    framework_id: bodyFrameworkId,
    course_code: bodyCourseCode,
    new_rubric, // { title, threshold, framework_id, course_code, definition }
  } = body || {};

  if (!title || !group_code) {
    return NextResponse.json({ error: 'Thiếu title/group_code' }, { status: 400 });
  }

  let finalRubricId: string | undefined = rubric_id;
  let formFrameworkId: string | null = bodyFrameworkId ?? null;
  let formCourseCode: string | null   = bodyCourseCode ?? null;

  // 1) Nếu FE gửi builder rubric mới → tạo rubric trước
  if (!finalRubricId && new_rubric) {
    const { title: rtitle, threshold, framework_id, course_code, definition } = new_rubric || {};
    if (!rtitle || !definition) {
      return NextResponse.json({ error: 'Thiếu rubric title/definition' }, { status: 400 });
    }

    const { data: rub, error: rerr } = await sb
      .from('rubrics')
      .insert({
        title: rtitle,
        threshold: threshold ?? null,
        framework_id: framework_id ?? null,    // nếu rubrics yêu cầu NOT NULL, FE đã bắt buộc chọn
        course_code: course_code ?? null,
        definition
      })
      .select('id, framework_id, course_code')
      .single();
    if (rerr) return NextResponse.json({ error: rerr.message }, { status: 400 });

    finalRubricId = rub.id;
    // nếu form chưa có framework/course → copy từ rubric mới
    formFrameworkId = formFrameworkId ?? rub.framework_id ?? null;
    formCourseCode  = formCourseCode  ?? rub.course_code  ?? null;
  }

  // 2) Nếu dùng rubric có sẵn mà form chưa có framework/course → lấy theo rubric
  if (!finalRubricId) {
    return NextResponse.json({ error: 'Thiếu rubric_id' }, { status: 400 });
  }
  if (!formFrameworkId || !formCourseCode) {
    const { data: rub } = await sb
      .from('rubrics')
      .select('id, framework_id, course_code')
      .eq('id', finalRubricId)
      .single();
    if (rub) {
      formFrameworkId = formFrameworkId ?? rub.framework_id ?? null;
      formCourseCode  = formCourseCode  ?? rub.course_code  ?? null;
    }
  }

  // 3) Ghi vào eval360_forms
  if (id) {
    const { data, error } = await sb
      .from('eval360_forms')
      .update({
        title,
        group_code,
        status: status ?? 'active',
        rubric_id: finalRubricId,
        framework_id: formFrameworkId, // có thể null theo schema của bạn
        course_code: formCourseCode,   // có thể null theo schema của bạn
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } else {
    const { data, error } = await sb
      .from('eval360_forms')
      .insert({
        title,
        group_code,
        status: status ?? 'active',
        rubric_id: finalRubricId,
        framework_id: formFrameworkId,
        course_code: formCourseCode,
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  }
}

export async function DELETE(req: Request) {
  const sb = createServiceClient();
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const { error } = await sb.from('eval360_forms').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
