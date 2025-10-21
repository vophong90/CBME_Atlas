// app/api/department/rubrics/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * GET ?framework_id=&course_code=  → list
 * POST {framework_id, course_code, title, columns[], rows[], threshold} → create
 * PUT  {id, title?, columns?, rows?, threshold?} → update (by id)
 * DELETE ?id= → delete one
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id') || '';
    const course_code = searchParams.get('course_code') || '';

    const db = createServiceClient();

    let q = db
      .from('rubrics')
      .select('id,framework_id,course_code,title,definition,threshold,created_at')
      .order('created_at', { ascending: false });

    if (framework_id) q = q.eq('framework_id', framework_id);
    if (course_code) q = q.eq('course_code', course_code);

    const { data, error } = await q;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ data: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      framework_id?: string;
      course_code?: string;
      title?: string;
      columns?: any[];
      rows?: any[];
      threshold?: number;
    };

    const { framework_id, course_code, title, columns, rows, threshold } = body;

    if (!framework_id || !course_code || !title || !Array.isArray(columns) || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
    }

    const db = createServiceClient();

    const { data, error } = await db
      .from('rubrics')
      .insert({
        framework_id,
        course_code,
        title,
        definition: { columns, rows },
        threshold: Number(threshold ?? 70),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      title?: string;
      columns?: any[];
      rows?: any[];
      threshold?: number;
    };

    const { id, title, columns, rows, threshold } = body;
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

    const patch: Record<string, any> = {};
    if (title !== undefined) patch.title = title;

    // Nếu caller muốn sửa definition, yêu cầu columns/rows là mảng (nếu truyền)
    if (columns !== undefined || rows !== undefined) {
      if ((columns !== undefined && !Array.isArray(columns)) || (rows !== undefined && !Array.isArray(rows))) {
        return NextResponse.json({ error: 'columns/rows phải là mảng' }, { status: 400 });
      }
      patch.definition = { columns, rows };
    }

    if (threshold !== undefined) patch.threshold = Number(threshold);

    const db = createServiceClient();
    const { error } = await db.from('rubrics').update(patch).eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

    const db = createServiceClient();
    const { error } = await db.from('rubrics').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
