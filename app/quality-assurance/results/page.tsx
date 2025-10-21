'use client'
import('@/lib/supabaseClient').then(async ({ supabase })=>{
const { data } = await supabase.from('surveys').select('id, title').order('created_at', { ascending:false })
setSurveys(data ?? [])
})
}, [])


const load = async () => {
if (!surveyId) return
const res = await fetch(`/api/qa/surveys/${surveyId}/results`)
const j = await res.json(); setData(j)
}


const exportXlsx = () => {
if (!surveyId) return
window.location.href = `/api/qa/surveys/${surveyId}/export`
}


return (
<div className="max-w-6xl mx-auto p-6 space-y-6">
<h1 className="text-2xl font-semibold">QA · Kết quả khảo sát</h1>
<div className="flex items-end gap-3">
<div className="w-96">
<label className="text-sm">Khảo sát</label>
<select className="w-full border rounded p-2" value={surveyId} onChange={(e)=>setSurveyId(e.target.value)}>
<option value="">—</option>
{surveys.map((s)=> <option key={s.id} value={s.id}>{s.title}</option>)}
</select>
</div>
<button onClick={load} className="px-3 py-2 border rounded">Tải kết quả</button>
<button onClick={exportXlsx} className="px-3 py-2 bg-black text-white rounded">Xuất Excel</button>
</div>


{!data ? (
<div className="text-gray-500">Chọn khảo sát và bấm “Tải kết quả”.</div>
) : (
<div className="space-y-4">
<div className="text-lg font-semibold">{data.survey?.title}</div>
{data.questions?.map((q:any)=> (
<div key={q.question_id} className="border rounded-lg p-4">
<div className="font-medium">{q.order_no ? q.order_no + '. ' : ''}{q.label}</div>
{q.type === 'text' ? (
<ul className="mt-2 list-disc pl-5 text-sm space-y-1">
{q.texts?.length ? q.texts.map((t:string,i:number)=>(<li key={i}>{t}</li>)) : <li className="text-gray-500">— Không có trả lời —</li>}
</ul>
) : (
<div className="mt-2 overflow-auto">
<table className="min-w-[500px] text-sm">
<thead>
<tr>
<th className="px-2 py-1 border-b text-left">Phương án</th>
<th className="px-2 py-1 border-b text-right">Tần số</th>
<th className="px-2 py-1 border-b text-right">%</th>
</tr>
</thead>
<tbody>
{q.choices?.map((c:any,i:number)=> (
<tr key={i} className="odd:bg-white even:bg-gray-50">
<td className="px-2 py-1 border-b">{c.value}</td>
<td className="px-2 py-1 border-b text-right">{c.count}</td>
<td className="px-2 py-1 border-b text-right">{c.percent}</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
))}
</div>
)}
</div>
)
}
