// app/api/department/courses/[code]/detail/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

// helper: chuẩn hoá level text → '1'|'2'|'3'|'4'
function normLevel(t?: string | null): '1' | '2' | '3' | '4' {
  const m = String(t || '').match(/[1-4]/);
  return ((m?.[0] as any) || '1') as '1' | '2' | '3' | '4';
}

export async function GET(req: Request, ctx: { params: { code: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id') || '';
    const course_code = decodeURIComponent(ctx.params.code || '');

    if (!framework_id || !course_code) {
      return NextResponse.json({ error: 'Thiếu framework_id hoặc course_code' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role, bypass RLS

    const [closRes, piLinks, ploLinks] = await Promise.all([
      db
        .from('clos')
        .select('code,description,course_code,framework_id')
        .eq('framework_id', framework_id)
        .eq('course_code', course_code),
      db
        .from('pi_clo_links')
        .select('pi_code,course_code,clo_code,level')
        .eq('framework_id', framework_id)
        .eq('course_code', course_code),
      db
        .from('plo_clo_links')
        .select('plo_code,course_code,clo_code,level')
        .eq('framework_id', framework_id)
        .eq('course_code', course_code),
    ]);

    if (closRes.error) return NextResponse.json({ error: closRes.error.message }, { status: 400 });
    if (piLinks.error) return NextResponse.json({ error: piLinks.error.message }, { status: 400 });
    if (ploLinks.error) return NextResponse.json({ error: ploLinks.error.message }, { status: 400 });

    const clos = (closRes.data || []).map((c: any) => ({
      clo_code: c.code as string,
      title: (c.description as string) ?? '',
      pis: [] as { pi_code: string; level: '1' | '2' | '3' | '4' }[],
      plos: [] as { plo_code: string; level: '1' | '2' | '3' | '4' }[],
    }));

    const byCLO = new Map<string, (typeof clos)[number]>(clos.map((c) => [c.clo_code, c]));

    (piLinks.data || []).forEach((l: any) => {
      const item = byCLO.get(l.clo_code as string);
      if (item) item.pis.push({ pi_code: l.pi_code as string, level: normLevel(l.level) });
    });

    (ploLinks.data || []).forEach((l: any) => {
      const item = byCLO.get(l.clo_code as string);
      if (item) item.plos.push({ plo_code: (l.plo_code as string), level: normLevel(l.level) });
    });

    const detail = {
      course: { code: course_code },
      clos: Array.from(byCLO.values()),
    };

    return NextResponse.json({ data: detail });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
