import { NextResponse } from 'next/server';
import { getSupabase, supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/** GET ?active=1&course_code=TM101 : liệt kê campaign */
export async function GET(req: Request) {
  const supabase = getSupabase();
  const url = new URL(req.url);
  const active = url.searchParams.get('active');
  const course_code = url.searchParams.get('course_code') || undefined;

  let q = supabase.from('evaluation_campaigns')
    .select('id,name,framework_id,course_code,rubric_id,start_at,end_at,weights,min_responses,anonymity,created_by,created_at')
    .order('start_at', { ascending: false });

  if (course_code) q = q.eq('course_code', course_code);
  if (active === '1') {
    const now = new Date().toISOString();
    q = q.lte('start_at', now).gte('end_at', now);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

/** POST (service role): tạo/sửa campaign */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    id, name, framework_id, course_code, rubric_id, start_at, end_at,
    weights, min_responses, anonymity, created_by
  } = body;

  const db = supabaseAdmin; // dùng service role

  if (!name || !rubric_id || !start_at || !end_at || !created_by) {
    return NextResponse.json({ error: 'name, rubric_id, start_at, end_at, created_by required' }, { status: 400 });
  }

  const payload = {
    name, framework_id: framework_id ?? null, course_code: course_code ?? null, rubric_id,
    start_at, end_at,
    weights: weights ?? { self: 0.2, peer: 0.3, faculty: 0.5 },
    min_responses: min_responses ?? { peer: 3, faculty: 1 },
    anonymity: anonymity ?? { peer: true, faculty: false },
    created_by
  };

  const query = id
    ? db.from('evaluation_campaigns').update(payload).eq('id', id).select().single()
    : db.from('evaluation_campaigns').insert(payload).select().single();

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
