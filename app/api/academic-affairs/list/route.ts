// app/api/academic-affairs/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id') || '';
    const kind = (searchParams.get('kind') || '').trim();

    if (!framework_id) {
      return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 });
    }

    const cfg: Record<
      string,
      { table: string; select: string }
    > = {
      plo: { table: 'plos', select: 'id, framework_id, code, description, created_at' },
      pi: { table: 'pis', select: 'id, framework_id, code, description, created_at' },
      plo_pi: { table: 'plo_pi_links', select: 'id, framework_id, plo_code, pi_code, created_at' },
      plo_clo: {
        table: 'plo_clo_links',
        select: 'id, framework_id, plo_code, course_code, clo_code, level, created_at',
      },
      pi_clo: {
        table: 'pi_clo_links',
        select: 'id, framework_id, pi_code, course_code, clo_code, level, created_at',
      },
    };

    const c = cfg[kind];
    if (!c) {
      return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role, bypass RLS

    const { data, count, error } = await db
      .from(c.table)
      .select(c.select, { count: 'exact' })
      .eq('framework_id', framework_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data ?? [], count: count ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
