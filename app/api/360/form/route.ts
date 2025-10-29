export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';
import { ensureQA } from '@/lib/perm360';

const ALLOW = ['self', 'peer', 'faculty', 'supervisor', 'patient'] as const;
type GroupCode = typeof ALLOW[number];

/** GET: public (đăng nhập thường) chỉ thấy status=active; QA/Admin có thể query status khác */
export async function GET(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const url = new URL(req.url);
  const group_code = url.searchParams.get('group_code') || '';
  const wantStatus = url.searchParams.get('status') || undefined;

  const { data: { user } } = await sb.auth.getUser();
  const guard = await ensureQA(user?.id);

  // Non-QA: ép status=active; QA/Admin: cho phép truyền status (mặc định active nếu không truyền)
  const status = guard.ok ? (wantStatus ?? 'active') : 'active';

  let q = sb
    .from('eval360_forms')
    .select('id,title,group_code,rubric_id,framework_id,course_code,status,updated_at')
    .eq('status', status)
    .order('updated_at', { ascending: false });

  if (group_code) q = q.eq('group_code', group_code);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: data || [] });
}

/** POST: chỉ QA/Admin */
export async function POST(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const { data: { user } } = await sb.auth.getUser();
  const guard = await ensureQA(user?.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({} as any));
  const { id, title, group_code, rubric_id, framework_id, course_code, status } = body || {};

  if (!title || !group_code || !rubric_id) {
    return NextResponse.json({ error: 'Thiếu title/group_code/rubric_id' }, { status: 400 });
  }
  if (!ALLOW.includes(group_code as GroupCode)) {
    return NextResponse.json({ error: 'group_code không hợp lệ' }, { status: 400 });
  }

  const payload = {
    title,
    group_code,
    rubric_id,
    framework_id: framework_id ?? null,
    course_code: course_code ?? null,
    status: (status ?? 'active') as 'active' | 'inactive',
    updated_at: new Date().toISOString(),
  };

  const mut = id
    ? sb.from('eval360_forms').update(payload).eq('id', id).select('*').maybeSingle()
    : sb.from('eval360_forms').insert(payload).select('*').maybeSingle();

  const { data, error } = await mut;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, item: data });
}

/** DELETE: chỉ QA/Admin */
export async function DELETE(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const { data: { user } } = await sb.auth.getUser();
  const guard = await ensureQA(user?.id);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const { error } = await sb.from('eval360_forms').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
