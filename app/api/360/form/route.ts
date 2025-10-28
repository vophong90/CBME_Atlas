export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const url = new URL(req.url);
  const group_code = url.searchParams.get('group_code') || '';
  const status = url.searchParams.get('status') || 'active';

  let q = sb.from('eval360_forms')
    .select('id, title, group_code, rubric_id, framework_id, course_code, status')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (group_code) q = q.eq('group_code', group_code);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { id, title, group_code, rubric_id, framework_id, course_code, status } = body || {};

  if (!title || !group_code || !rubric_id) {
    return NextResponse.json({ error: 'Thiếu title/group_code/rubric_id' }, { status: 400 });
  }

  if (id) {
    const { data, error } = await sb.from('eval360_forms')
      .update({
        title,
        group_code,
        rubric_id,
        framework_id: framework_id ?? null,
        course_code: course_code ?? null,
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
        rubric_id,
        framework_id: framework_id ?? null,
        course_code: course_code ?? null,
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
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const { error } = await sb.from('eval360_forms').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
