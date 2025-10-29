export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

/** QA/Admin guard (không phụ thuộc helper ngoài) */
async function requireQA(sb: any) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, resp: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };

  const { data, error } = await sb
    .from('user_roles')
    .select('roles:roles(code)')
    .eq('staff_user_id', user.id);

  if (error) return { ok: false as const, resp: NextResponse.json({ error: error.message }, { status: 403 }) };
  const codes = (data || []).map((r: any) => r.roles?.code).filter(Boolean);
  if (!codes.includes('admin') && !codes.includes('qa')) {
    return { ok: false as const, resp: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

export async function GET(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const guard = await requireQA(sb);
  if (!guard.ok) return guard.resp;

  const url = new URL(req.url);
  const group_code = url.searchParams.get('group_code') || '';
  const status = url.searchParams.get('status') || '';

  let q = sb.from('eval360_forms')
    .select('id, title, group_code, rubric_id, framework_id, course_code, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (status)     q = q.eq('status', status);
  if (group_code) q = q.eq('group_code', group_code);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const guard = await requireQA(sb);
  if (!guard.ok) return guard.resp;

  const body = await req.json().catch(() => ({}));
  const { id, title, group_code, status, rubric_id, new_rubric } = body || {};

  if (!title || !group_code) {
    return NextResponse.json({ error: 'Thiếu title/group_code' }, { status: 400 });
  }

  // Nếu có new_rubric -> tạo rubric trước
  let finalRubricId: string | null = rubric_id ?? null;

  if (!finalRubricId && new_rubric) {
    const { title: rtitle, threshold, framework_id, course_code, definition } = new_rubric || {};
    if (!rtitle || !framework_id || !course_code || !definition) {
      return NextResponse.json({ error: 'new_rubric thiếu title/framework_id/course_code/definition' }, { status: 400 });
    }
    const ins = await sb.from('rubrics')
      .insert({
        framework_id,
        course_code,
        title: rtitle,
        definition,
        threshold: typeof threshold === 'number' ? threshold : 70,
      })
      .select('id')
      .single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });
    finalRubricId = ins.data.id;
  }

  if (!finalRubricId) {
    return NextResponse.json({ error: 'Thiếu rubric_id hoặc new_rubric' }, { status: 400 });
  }

  if (id) {
    const { data, error } = await sb.from('eval360_forms')
      .update({
        title,
        group_code,
        rubric_id: finalRubricId,
        status: status ?? 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } else {
    const { data, error } = await sb.from('eval360_forms')
      .insert({
        title,
        group_code,
        rubric_id: finalRubricId,
        status: status ?? 'active',
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  }
}

export async function DELETE(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const guard = await requireQA(sb);
  if (!guard.ok) return guard.resp;

  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const { error } = await sb.from('eval360_forms').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
