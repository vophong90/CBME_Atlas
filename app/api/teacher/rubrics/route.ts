// app/api/teacher/rubrics/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

// chuẩn hoá definition từ nhiều dạng (editor bộ môn) về định dạng GV cần
function normalizeDefinition(def: any) {
  const rawCols = def?.columns ?? [];
  const columns =
    Array.isArray(rawCols) && rawCols.length && typeof rawCols[0] === 'string'
      ? rawCols.map((label: string, i: number) => ({ key: `L${i + 1}`, label }))
      : rawCols; // đã là {key,label}

  const rawRows = def?.rows ?? [];
  const rows = rawRows.map((r: any) => ({
    id: r.id ?? crypto.randomUUID(),
    label: r.label ?? r.criterion ?? '',
    clo_ids: r.clo_ids ?? (r.clo_code ? [r.clo_code] : []),
  }));

  return { columns, rows };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const framework_id = url.searchParams.get('framework_id') || undefined;
    const course_code = url.searchParams.get('course_code') || undefined;

    const db = createServiceClient();

    let q = db
      .from('rubrics')
      .select('id,framework_id,course_code,title,definition,threshold')
      .order('created_at', { ascending: false });

    if (framework_id) q = q.eq('framework_id', framework_id);
    if (course_code)  q = q.eq('course_code', course_code);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data ?? []).map((r: any) => ({
      id: r.id as string,
      name: r.title as string,                       // map title -> name cho UI hiện tại
      framework_id: r.framework_id as string,
      course_code: r.course_code as string,
      definition: normalizeDefinition(r.definition),
      threshold: r.threshold ?? null,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
