'use client'
</div>
)}
{role==='support' && (
<div>
<label className="text-sm">Đơn vị</label>
<select className="w-full border rounded p-2" value={unitId} onChange={(e)=>setUnitId(e.target.value)}>
<option value="">—</option>
{units.map((u)=> <option key={u.id} value={u.id}>{u.name}</option>)}
</select>
</div>
)}
<div>
<label className="text-sm">Khảo sát</label>
<select className="w-full border rounded p-2" value={surveyId} onChange={(e)=>setSurveyId(e.target.value)}>
<option value="">—</option>
{surveys.map((s)=> <option key={s.id} value={s.id}>{s.title} ({s.status})</option>)}
</select>
</div>
<div>
<button onClick={load} className="mt-6 px-3 py-2 border rounded">Tải danh sách</button>
</div>
</div>


<div className="flex items-center gap-3">
<button className="px-3 py-2 border rounded" onClick={()=>toggleAll(true)}>Chọn tất cả</button>
<button className="px-3 py-2 border rounded" onClick={()=>toggleAll(false)}>Bỏ chọn</button>
<button className="px-3 py-2 bg-black text-white rounded" onClick={assign}>Gán vào khảo sát</button>
</div>


<div className="overflow-auto border rounded-lg">
<table className="min-w-[800px] text-sm">
<thead>
<tr>
<th className="px-3 py-2 border-b"><input type="checkbox" onChange={(e)=>toggleAll(e.target.checked)} /></th>
<th className="px-3 py-2 border-b text-left">Họ tên</th>
<th className="px-3 py-2 border-b text-left">Email</th>
<th className="px-3 py-2 border-b text-left">Vai trò</th>
<th className="px-3 py-2 border-b text-left">Đơn vị/Bộ môn</th>
<th className="px-3 py-2 border-b text-left">Khung CT</th>
</tr>
</thead>
<tbody>
{participants.map((p)=> (
<tr key={p.user_id} className="odd:bg-white even:bg-gray-50">
<td className="px-3 py-2 border-b"><input type="checkbox" checked={!!checked[p.user_id]} onChange={(e)=>setChecked(prev=>({ ...prev, [p.user_id]: e.target.checked }))} /></td>
<td className="px-3 py-2 border-b">{p.user_name}</td>
<td className="px-3 py-2 border-b">{p.user_email}</td>
<td className="px-3 py-2 border-b">{p.role}</td>
<td className="px-3 py-2 border-b">{p.department_name || p.unit_name || '—'}</td>
<td className="px-3 py-2 border-b">{p.framework_code || '—'}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
)
}
