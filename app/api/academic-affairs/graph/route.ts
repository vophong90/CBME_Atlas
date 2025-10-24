// app/api/academic-affairs/graph/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id');
    if (!framework_id) {
      return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });
    }

    // Load danh mục nền
    const [plosRes, pisRes, coursesRes, closRes] = await Promise.all([
      supabase.from('plos').select('code, description').eq('framework_id', framework_id),
      supabase.from('pis').select('code, description').eq('framework_id', framework_id),
      supabase.from('courses').select('course_code, course_name, credits').eq('framework_id', framework_id),
      supabase.from('clos').select('course_code, clo_code, clo_text').eq('framework_id', framework_id),
    ]);

    for (const r of [plosRes, pisRes, coursesRes, closRes]) {
      if (r.error) throw r.error;
    }

    const plos    = plosRes.data   ?? [];
    const pis     = pisRes.data    ?? [];
    const courses = coursesRes.data ?? [];
    const clos    = closRes.data   ?? [];

    // Build nodes
    const nodes: any[] = [
      ...plos.map((p: any) => ({
        data: {
          id: `PLO:${p.code}`,
          label: p.description ? `PLO ${p.code}\n${p.description}` : `PLO ${p.code}`,
        },
        classes: 'type-plo',
      })),
      ...pis.map((p: any) => ({
        data: {
          id: `PI:${p.code}`,
          label: p.description ? `PI ${p.code}\n${p.description}` : `PI ${p.code}`,
        },
        classes: 'type-pi',
      })),
      ...courses.map((c: any) => ({
        data: {
          id: `COURSE:${c.course_code}`,
          label: c.course_name ? `${c.course_code}\n${c.course_name}` : `${c.course_code}`,
        },
        classes: 'type-course',
      })),
      ...clos.map((c: any) => ({
        data: {
          id: `CLO:${c.course_code}:${c.clo_code}`,
          label: c.clo_text ? `${c.clo_code}\n${c.clo_text}` : `${c.clo_code}`,
        },
        classes: 'type-clo',
      })),
    ];

    // Load link tables
    const [ppRes, pcRes, icRes] = await Promise.all([
      supabase.from('plo_pi_links').select('plo_code, pi_code').eq('framework_id', framework_id),
      supabase.from('plo_clo_links').select('plo_code, course_code, clo_code, level').eq('framework_id', framework_id),
      supabase.from('pi_clo_links').select('pi_code, course_code, clo_code, level').eq('framework_id', framework_id),
    ]);

    for (const r of [ppRes, pcRes, icRes]) {
      if (r.error) throw r.error;
    }

    const pp = ppRes.data ?? [];
    const pc = pcRes.data ?? [];
    const ic = icRes.data ?? [];

    // Build edges (ID duy nhất để Cytoscape ổn định)
    const edges: any[] = [
      ...pp.map((e: any) => ({
        data: {
          id: `E:PLOPI:${e.plo_code}->${e.pi_code}`,
          source: `PLO:${e.plo_code}`,
          target: `PI:${e.pi_code}`,
          kind: 'PLO–PI',
        },
      })),
      ...pc.map((e: any) => ({
        data: {
          id: `E:PLOCLO:${e.plo_code}->${e.course_code}:${e.clo_code}`,
          source: `PLO:${e.plo_code}`,
          target: `CLO:${e.course_code}:${e.clo_code}`,
          kind: e.level ? `PLO–CLO (${e.level})` : 'PLO–CLO',
        },
      })),
      ...ic.map((e: any) => ({
        data: {
          id: `E:PICLO:${e.pi_code}->${e.course_code}:${e.clo_code}`,
          source: `PI:${e.pi_code}`,
          target: `CLO:${e.course_code}:${e.clo_code}`,
          kind: e.level ? `PI–CLO (${e.level})` : 'PI–CLO',
        },
      })),
    ];

    return NextResponse.json({ nodes, edges, elements: { nodes, edges } });
  } catch (e: any) {
    console.error('[GRAPH] error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
