'use client'
<option value="active">active</option>
</select>
</div>
</div>
<div>
<label className="text-sm">Giới thiệu & hướng dẫn</label>
<textarea className="w-full border rounded p-2" rows={4} value={editing.intro ?? ''} onChange={(e)=>setEditing({...editing!, intro: e.target.value})} />
</div>
<div className="flex gap-2">
<button onClick={saveMeta} className="px-3 py-2 bg-black text-white rounded">Lưu thông tin</button>
</div>


<div className="pt-4 border-t">
<div className="flex items-center justify-between mb-2">
<div className="font-medium">Câu hỏi</div>
<div className="flex gap-2">
<button onClick={()=>addQ('single')} className="px-2 py-1 border rounded">+ Single</button>
<button onClick={()=>addQ('multi')} className="px-2 py-1 border rounded">+ Multi</button>
<button onClick={()=>addQ('text')} className="px-2 py-1 border rounded">+ Text</button>
<button onClick={saveQs} className="px-3 py-1 bg-black text-white rounded">Lưu câu hỏi</button>
</div>
</div>
<div className="space-y-3">
{questions.map((q, idx)=> (
<div key={q.id ?? `new-${idx}`} className="border rounded p-3">
<div className="grid md:grid-cols-6 gap-2 items-center">
<div className="col-span-1">
<label className="text-xs">Thứ tự</label>
<input type="number" className="w-full border rounded p-2" value={q.order_no} onChange={(e)=>{
const v = parseInt(e.target.value||'0',10); setQuestions(prev=>prev.map((x,i)=>i===idx?{...x, order_no:v}:x))
}} />
</div>
<div className="col-span-3">
<label className="text-xs">Nội dung</label>
<input className="w-full border rounded p-2" value={q.label} onChange={(e)=>setQuestions(prev=>prev.map((x,i)=>i===idx?{...x, label:e.target.value}:x))} />
</div>
<div>
<label className="text-xs">Loại</label>
<select className="w-full border rounded p-2" value={q.type} onChange={(e)=>setQuestions(prev=>prev.map((x,i)=>i===idx?{...x, type:e.target.value as any}:x))}>
<option value="single">single</option>
<option value="multi">multi</option>
<option value="text">text</option>
</select>
</div>
<div>
<label className="text-xs">Bắt buộc</label>
<input type="checkbox" className="ml-2" checked={!!q.required} onChange={(e)=>setQuestions(prev=>prev.map((x,i)=>i===idx?{...x, required:e.target.checked}:x))} />
</div>
</div>
{q.type !== 'text' && (
<div className="mt-2">
<label className="text-xs">Tuỳ chọn (mỗi dòng một giá trị|nhãn)</label>
<textarea className="w-full border rounded p-2" rows={3}
value={Array.isArray(q.options)? q.options.map((o:any)=>`${o.value}|${o.label}`).join('\n'):''}
onChange={(e)=>{
const opts = e.target.value.split('\n').filter(Boolean).map(line=>{
const [value,label] = line.split('|'); return { value: (value??'').trim(), label: (label??value??'').trim() }
})
setQuestions(prev=>prev.map((x,i)=>i===idx?{...x, options:opts}:x))
}} />
</div>
)}
</div>
))}
</div>
</div>
</div>
)}
</div>
)
}
