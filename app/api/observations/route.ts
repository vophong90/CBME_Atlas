import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { student_code, course_code, rubric_name, items } = body

    // lookups
    const { data: stu } = await supabase.from('students').select('*').eq('student_code', student_code).single()
    const { data: course } = await supabase.from('courses').select('*').eq('code', course_code).single()
    const { data: rubric } = await supabase.from('rubrics').select('*').eq('name', rubric_name).single()
    if (!stu || !course || !rubric) return NextResponse.json({ ok:false, message: 'Lookup failed' }, { status: 400 })

    // create observation
    const { data: obs, error: e1 } = await supabase.from('observations')
      .insert({ student_id: stu.id, course_id: course.id, rubric_id: rubric.id, consent: false })
      .select()
      .single()
    if (e1) throw e1

    // fetch rubric items
    const { data: ritems } = await supabase.from('rubric_items').select('id, code').eq('rubric_id', rubric.id)
    const code2id = new Map((ritems||[]).map(r => [r.code, r.id]))

    const scoresPayload = (items as Array<{code:string, level_rank:number}>).map(it => ({
      observation_id: obs.id,
      rubric_item_id: code2id.get(it.code)!,
      level_rank: it.level_rank,
      level_label: it.level_rank===2?'Khá': it.level_rank===1?'Đạt':'Không đạt'
    }))

    const { error: e2 } = await supabase.from('observation_item_scores').insert(scoresPayload)
    if (e2) throw e2

    // RPC compute CLO results
    const { error: e3 } = await supabase.rpc('compute_observation_clo_results', { p_observation_id: obs.id })
    if (e3) throw e3

    return NextResponse.json({ ok:true, id: obs.id })
  } catch (err:any) {
    return NextResponse.json({ ok:false, error: String(err?.message || err) }, { status: 500 })
  }
}
