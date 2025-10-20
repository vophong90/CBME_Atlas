// app/api/academic-affairs/graph/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { searchParams } = new URL(req.url)
  const framework_id = searchParams.get('framework_id') || ''
  if (!framework_id) return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 })

  const [{ data: plos, error: e1 }, { data: pis, error: e2 }, { data: plo_pi, error: e3 },
         { data: plo_clo, error: e4 }, { data: pi_clo, error: e5 }] = await Promise.all([
    supabase.from('plos').select('id, code, description').eq('framework_id', framework_id),
    supabase.from('pis').select('id, code, description').eq('framework_id', framework_id),
    supabase.from('plo_pi_links').select('id, plo_code, pi_code').eq('framework_id', framework_id),
    supabase.from('plo_clo_links').select('id, plo_code, course_code, clo_code, level').eq('framework_id', framework_id),
    supabase.from('pi_clo_links').select('id, pi_code, course_code, clo_code, level').eq('framework_id', framework_id),
  ])
  if (e1 || e2 || e3 || e4 || e5) {
    const err = e1 || e2 || e3 || e4 || e5
    return NextResponse.json({ error: err!.message }, { status: 400 })
  }

  // build nodes/edges
  const nodes: any[] = []
  const edges: any[] = []

  // PLO nodes
  for (const p of plos || []) {
    nodes.push({
      data: {
        id: `PLO:${p.code}`,
        label: `${p.code}`,
        group: 'PLO',
        description: p.description ?? '',
      },
    })
  }

  // PI nodes
  for (const p of pis || []) {
    nodes.push({
      data: {
        id: `PI:${p.code}`,
        label: `${p.code}`,
        group: 'PI',
        description: p.description ?? '',
      },
    })
  }

  // COURSE & CLO nodes will be created on-the-fly from link tables
  const ensureNode = (id: string, group: string, label?: string) => {
    if (!nodes.find(n => n.data.id === id)) {
      nodes.push({ data: { id, group, label: label || id } })
    }
  }

  // PLO-PI edges
  for (const l of plo_pi || []) {
    ensureNode(`PLO:${l.plo_code}`, 'PLO', l.plo_code)
    ensureNode(`PI:${l.pi_code}`, 'PI', l.pi_code)
    edges.push({
      data: {
        id: `edge:plo-pi:${l.id}`,
        source: `PLO:${l.plo_code}`,
        target: `PI:${l.pi_code}`,
        kind: 'PLO–PI',
      },
    })
  }

  // PLO-CLO edges (+ create COURSE, CLO)
  for (const l of plo_clo || []) {
    ensureNode(`PLO:${l.plo_code}`, 'PLO', l.plo_code)
    ensureNode(`COURSE:${l.course_code}`, 'COURSE', l.course_code)
    ensureNode(`CLO:${l.course_code}:${l.clo_code}`, 'CLO', `${l.clo_code}`)
    edges.push({
      data: {
        id: `edge:plo-clo:${l.id}:1`,
        source: `COURSE:${l.course_code}`,
        target: `CLO:${l.course_code}:${l.clo_code}`,
        kind: `CLO of ${l.course_code}`,
      },
    })
    edges.push({
      data: {
        id: `edge:plo-clo:${l.id}:2`,
        source: `PLO:${l.plo_code}`,
        target: `CLO:${l.course_code}:${l.clo_code}`,
        kind: `PLO–CLO (${l.level})`,
      },
    })
  }

  // PI-CLO edges
  for (const l of pi_clo || []) {
    ensureNode(`PI:${l.pi_code}`, 'PI', l.pi_code)
    ensureNode(`COURSE:${l.course_code}`, 'COURSE', l.course_code)
    ensureNode(`CLO:${l.course_code}:${l.clo_code}`, 'CLO', `${l.clo_code}`)
    edges.push({
      data: {
        id: `edge:pi-clo:${l.id}:1`,
        source: `COURSE:${l.course_code}`,
        target: `CLO:${l.course_code}:${l.clo_code}`,
        kind: `CLO of ${l.course_code}`,
      },
    })
    edges.push({
      data: {
        id: `edge:pi-clo:${l.id}:2`,
        source: `PI:${l.pi_code}`,
        target: `CLO:${l.course_code}:${l.clo_code}`,
        kind: `PI–CLO (${l.level})`,
      },
    })
  }

  return NextResponse.json({ elements: { nodes, edges } })
}
