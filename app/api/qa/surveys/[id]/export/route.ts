import { NextResponse } from 'next/server'
import XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabaseServer'


export async function GET(_req: Request, { params }: { params: { id: string } }) {
const sb = createServerClient()
const [{ data: survey }, { data: questions }, { data: resps }, { data: answers }] = await Promise.all([
sb.from('surveys').select('*').eq('id', params.id).single(),
sb.from('survey_questions').select('*').eq('survey_id', params.id).order('order_no'),
sb.from('survey_responses').select('*').eq('survey_id', params.id),
sb.from('survey_answers').select('*').in('response_id', (await sb.from('survey_responses').select('id').eq('survey_id', params.id)).data?.map((x:any)=>x.id) || [])
])
if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 })


const wb = XLSX.utils.book_new()
const qOrder = (questions ?? []).map((q:any)=>q.id)
const qLabel = new Map((questions ?? []).map((q:any)=>[q.id, q.label]))
const rows: any[] = []
for (const r of (resps ?? [])) {
const row: any = { response_id: r.id, user_id: r.user_id, submitted_at: r.submitted_at }
const ans = (answers ?? []).filter((a:any)=>a.response_id === r.id)
for (const qid of qOrder) {
const q = (questions ?? []).find((qq:any)=>qq.id===qid)
if (q?.type === 'text') {
row[qLabel.get(qid)!] = ans.find((a:any)=>a.question_id===qid)?.text_answer ?? ''
} else {
const choices = ans.filter((a:any)=>a.question_id===qid).map((a:any)=>a.choice_value).join('; ')
row[qLabel.get(qid)!] = choices
}
}
rows.push(row)
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Responses')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((questions ?? []).map((q:any)=>({ order_no: q.order_no, label: q.label, type: q.type, options: JSON.stringify(q.options || []) }))), 'Questions')
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
return new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="survey_${params.id}.xlsx"` } })
}
