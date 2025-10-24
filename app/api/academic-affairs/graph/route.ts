// app/api/academic-affairs/graph/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const T = (s: any) => (typeof s === 'string' ? s.trim() : s ?? '');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id');
    if (!framework_id) return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });

    // Danh mục nền
    const [plosRes, pisRes, coursesRes, closRes] = await Promise.all([
      supabase.from('plos').select('code, description').eq('framework_id', framework_id).order('code'),
      supabase.from('pis').select('code, description').eq('framework_id', framework_id).order('code'),
      supabase.from('courses').select('course_code, course_name, credits').eq('framework_id', framework_id).order('course_code'),
      supabase.from('clos').select('course_code, clo_code, clo_text').eq('framework_id', framework_id).order('course_code').order('clo_code'),
    ]);
    for (const r of [plosRes, pisRes, coursesRes, closRes]) if (r.error) throw r.error;

    const plos    = (plosRes.data    ?? []).map((x) => ({ code: T(x.code), description: x.description }));
    const pis     = (pisRes.data     ?? []).map((x) => ({ code: T(x.code), description: x.description }));
    const courses = (coursesRes.data ?? []).map((x) => ({ course_code: T(x.course_code), course_name: x.course_name, credits: x.credits }));
    const clos    = (closRes.data    ?? []).map((x) => ({ course_code: T(x.course_code), clo_code: T(x.clo_code), clo_text: x.clo_text }));

    // Nodes (label = CODE)
    const nodes: any[] = [
      ...plos.map((p)    => ({ data: { id: `PLO:${p.code}`,    label: p.code },    classes: 'type-plo' })),
      ...pis.map((p)     => ({ data: { id: `PI:${p.code}`,     label: p.code },    classes: 'type-pi' })),
      ...courses.map((c) => ({ data: { id: `COURSE:${c.course_code}`, label: c.course_code }, classes: 'type-course' })),
      ...clos.map((c)    => ({ data: { id: `CLO:${c.course_code}:${c.clo_code}`, label: c.clo_code }, classes: 'type-clo' })),
    ];

    // Links
    const [ppRes, pcRes, icRes] = await Promise.all([
      supabase.from('plo_pi_links').select('plo_code, pi_code').eq('framework_id', framework_id),
      supabase.from('plo_clo_links').select('plo_code, course_code, clo_code, level').eq('framework_id', framework_id),
      supabase.from('pi_clo_links').select('pi_code, course_code, clo_code, level').eq('framework_id', framework_id),
    ]);
    for (const r of [ppRes, pcRes, icRes]) if (r.error) throw r.error;

    const pp = (ppRes.data ?? []).map((e) => ({ plo_code: T(e.plo_code), pi_code: T(e.pi_code) }));
    const pc = (pcRes.data ?? []).map((e) => ({ plo_code: T(e.plo_code), course_code: T(e.course_code), clo_code: T(e.clo_code), level: e.level }));
    const ic = (icRes.data ?? []).map((e) => ({ pi_code: T(e.pi_code),  course_code: T(e.course_code), clo_code: T(e.clo_code), level: e.level }));

    const edges: any[] = [
      ...pp.map((e) => ({
        data: { id: `E:PLOPI:${e.plo_code}->${e.pi_code}`, source: `PLO:${e.plo_code}`, target: `PI:${e.pi_code}`, kind: 'PLO–PI' },
      })),
      ...pc.map((e) => ({
        data: { id: `E:PLOCLO:${e.plo_code}->${e.course_code}:${e.clo_code}`, source: `PLO:${e.plo_code}`, target: `CLO:${e.course_code}:${e.clo_code}`, kind: e.level ? `PLO–CLO (${e.level})` : 'PLO–CLO' },
      })),
      ...ic.map((e) => ({
        data: { id: `E:PICLO:${e.pi_code}->${e.course_code}:${e.clo_code}`, source: `PI:${e.pi_code}`,  target: `CLO:${e.course_code}:${e.clo_code}`, kind: e.level ? `PI–CLO (${e.level})` : 'PI–CLO' },
      })),
    ];

    return NextResponse.json({ nodes, edges, elements: { nodes, edges } });
  } catch (e: any) {
    console.error('[GRAPH] error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
