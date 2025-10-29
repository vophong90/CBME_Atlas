export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { ensureQA } from '@/lib/perm360';

/** GET: danh sách forms (QA/Admin) */
export async function GET(req: Request) {
  const sb = createServiceClient();

  // Lấy user hiện tại
  const {
    data: { user },
  } = await sb.auth.getUser();

  // Chặn nếu không phải QA/Admin
  const guard = await ensureQA(user?.id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');      // 'active' | 'inactive' | null
  const group  = url.searchParams.get('group_code');  // 'self' | 'peer' | ...

  let q = sb
    .from('eval360_forms')
    .select('id,title,group_code,rubric_id,framework_id,course_code,status,updated_at')
    .order('updated_at', { ascending: false });

  if (status) q = q.eq('status', status);
  if (group)  q = q.eq('group_code', group);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: data || [] });
}

/** POST: tạo/cập nhật form (QA/Admin) */
export async function POST(req: Request) {
  const sb = createServiceClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const guard = await ensureQA(user?.id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({} as any));
  const {
    id,
    title,
    group_code,
    rubric_id,
    framework_id = null,
    course_code = null,
    status = 'active',
  } = body || {};

  if (!title || !group_code || !rubric_id) {
    return NextResponse.json(
      { error: 'Thiếu title/group_code/rubric_id' },
      { status: 400 }
    );
  }

  const ALLOW = ['self', 'peer', 'faculty', 'supervisor', 'patient'];
  if (!ALLOW.includes(group_code)) {
    return NextResponse.json({ error: 'group_code không hợp lệ' }, { status: 400 });
  }

  const mut =
    id
      ? sb
          .from('eval360_forms')
          .update({ title, group_code, rubric_id, framework_id, course_code, status })
          .eq('id', id)
          .select('*')
          .maybeSingle()
      : sb
          .from('eval360_forms')
          .insert({ title, group_code, rubric_id, framework_id, course_code, status })
          .select('*')
          .maybeSingle();

  const { data, error } = await mut;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, item: data });
}

/** DELETE: xoá form theo id (QA/Admin) */
export async function DELETE(req: Request) {
  const sb = createServiceClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const guard = await ensureQA(user?.id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const { error } = await sb.from('eval360_forms').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
