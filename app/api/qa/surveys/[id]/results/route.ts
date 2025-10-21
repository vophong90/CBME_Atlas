import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'


export async function GET(_req: Request, { params }: { params: { id: string } }) {
const sb = createServerClient()
const [{ data: survey }, { data: questions }, { data: answers }] = await Promise.all([
sb.from('surveys').select('id, title').eq('id', params.id).single(),
sb.from('survey_questions').select('id, label, type, options, order_no').eq('survey_id', params.id).order('order_no'),
sb.from('survey_answers').select('question_id, choice_value, text_answer')
.in('question_id', (await sb.from('survey_questions').select('id').eq('survey_id', params.id)).data?.map((x:any)=>x.id) || [])
])
if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 })


const agg: any = {}
for (const q of (questions ?? [])) {
agg[q.id] = { type: q.type, label: q.label, order_no: q.order_no, total: 0, choices: new Map<string, number>(), texts: [] as string[] }
const opts = Array.isArray(q.options) ? q.options : (q.options?.options || [])
for (const o of opts ?? []) agg[q.id].choices.set(o.value ?? String(o), 0)
}
for (const a of (answers ?? [])) {
const q = agg[a.question_id]; if (!q) continue
q.total++
if (q.type === 'text') {
if (a.text_answer) q.texts.push(a.text_answer)
} else {
const key = a.choice_value ?? ''
q.choices.set(key, (q.choices.get(key) ?? 0) + 1)
}
}
const out = (questions ?? []).map((q:any) => {
const item = agg[q.id]
if (!item) return { question_id: q.id, label: q.label, type: q.type, total: 0, choices: [], texts: [] }
const total = Math.max(item.total, 1)
const choices = Array.from(item.choices.entries()).map(([value, count]) => ({ value, count, percent: +(100*count/total).toFixed(1) }))
return { question_id: q.id, label: q.label, type: q.type, order_no: q.order_no, total, choices, texts: item.texts }
})
return NextResponse.json({ survey, questions: out })
}
