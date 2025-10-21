'use client'


return (
<div className="max-w-6xl mx-auto p-6 space-y-6">
<h1 className="text-2xl font-semibold">QA · Tiến độ khảo sát</h1>


<div className="flex gap-3 items-end">
<div className="w-96">
<label className="text-sm">Khảo sát</label>
<select className="w-full border rounded p-2" value={surveyId} onChange={(e)=>setSurveyId(e.target.value)}>
<option value="">—</option>
{surveys.map((s)=> <option key={s.id} value={s.id}>{s.title}</option>)}
</select>
</div>
<button onClick={load} className="px-3 py-2 border rounded">Tải tiến độ</button>
{stats && <div className="text-sm text-gray-700">Tổng {stats.total} · Đã nộp {stats.submitted} · Chưa nộp {stats.pending}</div>}
</div>


<div className="grid md:grid-cols-2 gap-4">
<div className="border rounded-lg p-4 space-y-3">
<div className="font-medium">Danh sách người được phân công</div>
<div className="flex gap-2 text-sm">
<button className="px-2 py-1 border rounded" onClick={selectNotSubmitted}>Chọn tất cả (chưa nộp)</button>
<button className="px-2 py-1 border rounded" onClick={()=>setChecked({})}>Bỏ chọn</button>
</div>
<div className="h-96 overflow-auto border rounded">
<table className="min-w-full text-sm">
<thead>
<tr>
<th className="px-2 py-1 border-b"></th>
<th className="px-2 py-1 border-b text-left">Họ tên</th>
<th className="px-2 py-1 border-b text-left">Email</th>
<th className="px-2 py-1 border-b text-left">Trạng thái</th>
</tr>
</thead>
<tbody>
{assignments.map((a)=> (
<tr key={a.id} className="odd:bg-white even:bg-gray-50">
<td className="px-2 py-1 border-b"><input type="checkbox" checked={!!checked[a.id]} onChange={(e)=>setChecked(prev=>({ ...prev, [a.id]: e.target.checked }))} /></td>
<td className="px-2 py-1 border-b">{a.user_name}</td>
<td className="px-2 py-1 border-b">{a.user_email}</td>
<td className="px-2 py-1 border-b">{a.submitted_at? 'Đã nộp' : 'Chưa nộp'}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
<div className="border rounded-lg p-4 space-y-3">
<div className="font-medium">Soạn email mời/nhắc</div>
<textarea className="w-full border rounded p-2" rows={8} value={message} onChange={(e)=>setMessage(e.target.value)} />
<button onClick={send} className="px-3 py-2 bg-black text-white rounded">Gửi email cho mục đã chọn</button>
<div className="text-xs text-gray-500">Email sẽ gửi qua Resend/SMTP theo cấu hình env.</div>
</div>
</div>
</div>
)
}
