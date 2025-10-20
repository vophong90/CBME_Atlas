// app/api/department/courses/[code]/detail/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';

// helper: chuẩn hoá level text → '1'|'2'|'3'|'4'
function normLevel(t?: string | null): '1'|'2'|'3'|'4' {
  const m = String(t || '').match(/[1-4]/);
  return (m?.[0] as any) || '1';
}

export async function GET(req: Request, ctx: { params: { code: string } }) {
  const { searchParams } = new URL(req.url);
  const framework_id = searchParams.get('framework_id') || '';
  const course_code = decodeURIComponent(ctx.params.code || '');

  if (!framework_id || !course_code) {
    return NextResponse.json({ error: 'Thiếu framework_id hoặc course_code' }, { status: 400 });
  }

  const [closRes, piLinks, ploLinks] = await Promise.all([
    supabaseAdmin.from('clos').select('code,description,course_code,framework_id')
      .eq('framework_id', framework_id).eq('course_code', course_code),
    supabaseAdmin.from('pi_clo_links').select('pi_code,course_code,clo_code,level').eq('framework_id', framework_id).eq('course_code', course_code),
    supabaseAdmin.from('plo_clo_links').select('plo_code,course_code,clo_code,level').eq('framework_id', framework_id).eq('course_code', course_code),
  ]);

  if (closRes.error) return NextResponse.json({ error: closRes.error.message }, { status: 400 });
  if (piLinks.error) return NextResponse.json({ error: piLinks.error.message }, { status: 400 });
  if (ploLinks.error) return NextResponse.json({ error: ploLinks.error.message }, { status: 400 });

  const clos = (closRes.data || []).map((c: any) => ({
    clo_code: c.code,
    title: c.description,
    pis: [] as { pi_code: string; level: '1'|'2'|'3'|'4' }[],
    plos: [] as { plo_code: string; level: '1'|'2'|'3'|'4' }[],
  }));

  const byCLO = new Map(clos.map(c => [c.clo_code, c]));
  (piLinks.data || []).forEach((l: any) => {
    const item = byCLO.get(l.clo_code);
    if (item) item.pis.push({ pi_code: l.pi_code, level: normLevel(l.level) });
  });
  (ploLinks.data || []).forEach((l: any) => {
    const item = byCLO.get(l.clo_code);
    if (item) item.plos.push({ plo_code: l.plo_code, level: normLevel(l.level) });
  });

  const detail = {
    course: { code: course_code },
    clos: Array.from(byCLO.values())
  };
  return NextResponse.json({ data: detail });
}
