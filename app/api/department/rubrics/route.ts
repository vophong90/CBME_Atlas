// app/api/department/rubrics/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';

/**
 * GET ?framework_id=&course_code=  → list
 * POST {framework_id, course_code, title, columns[], rows[], threshold} → create
 * PUT  {id, title?, columns?, rows?, threshold?} → update (by id)
 * DELETE ?id= → delete one
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const framework_id = searchParams.get('framework_id') || '';
  const course_code = searchParams.get('course_code') || '';

  let q = supabaseAdmin.from('rubrics').select('id,framework_id,course_code,title,definition,threshold,created_at');
  if (framework_id) q = q.eq('framework_id', framework_id);
  if (course_code) q = q.eq('course_code', course_code);

  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { framework_id, course_code, title, columns, rows, threshold } = body;

  if (!framework_id || !course_code || !title || !Array.isArray(columns) || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rubrics')
    .insert({
      framework_id,
      course_code,
      title,
      definition: { columns, rows },
      threshold: Number(threshold ?? 70)
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, title, columns, rows, threshold } = body;
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const patch: any = {};
  if (title !== undefined) patch.title = title;
  if (columns !== undefined || rows !== undefined) {
    patch.definition = { columns, rows };
  }
  if (threshold !== undefined) patch.threshold = Number(threshold);

  const { error } = await supabaseAdmin.from('rubrics').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const { error } = await supabaseAdmin.from('rubrics').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
