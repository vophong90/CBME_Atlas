// app/api/teacher/rubrics/[id]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

function normalizeDefinition(def: any) {
  const rawCols = def?.columns ?? [];
  const columns =
    Array.isArray(rawCols) && rawCols.length && typeof rawCols[0] === 'string'
      ? rawCols.map((label: string, i: number) => ({ key: `L${i + 1}`, label }))
      : rawCols;

  const rawRows = def?.rows ?? [];
  const rows = rawRows.map((r: any) => ({
    id: r.id ?? crypto.randomUUID(),
    label: r.label ?? r.criterion ?? '',
    clo_ids: r.clo_ids ?? (r.clo_code ? [r.clo_code] : []),
  }));

  return { columns, rows };
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id;            // UUID – KHÔNG ép Number!

    const db = createServiceClient();
    const { data, error } = await db
      .from('rubrics')
      .select('id,framework_id,course_code,title,definition,threshold')
      .eq('id', id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const item = {
      id: data.id as string,
      name: data.title as string,        // map title -> name
      framework_id: data.framework_id as string,
      course_code: data.course_code as string,
      definition: normalizeDefinition(data.definition),
      threshold: data.threshold ?? null,
    };

    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
