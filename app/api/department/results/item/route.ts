// app/api/department/results/item/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

function normalizeResult(input: string): 'achieved' | 'not_yet' {
  const s = (input || '').toLowerCase().trim();
  if (['achieved', 'đạt', 'dat', 'pass', 'passed', '1', 'true'].includes(s)) return 'achieved';
  return 'not_yet';
}

export async function PATCH(req: NextRequest) {
  const db = createServiceClient();
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '');
    const result = normalizeResult(String(body.result || body.status || ''));

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await db
      .from('student_clo_results_uploads')
      .update({ status: result, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Update error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const db = createServiceClient();
  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id') || '';

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await db.from('student_clo_results_uploads').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete error' }, { status: 500 });
  }
}
