'use client'
import { useEffect, useState } from 'react'

type Cell = { course_code: string; clo_code: string; pct_achieved: number }

export default function ClassAnalytics() {
  const [course, setCourse] = useState('IMMU101')
  const [items, setItems] = useState<Cell[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/class-heatmap?course_code=${encodeURIComponent(course)}`)
    const json = await res.json()
    if (res.ok) setItems(json.items)
    else alert(json.error || 'Không tải được heatmap')
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Báo cáo lớp / cohort</h1>

      <div className="mt-4 flex gap-2">
        <input className="border rounded-lg px-3 py-2" value={course} onChange={e=>setCourse(e.target.value)} placeholder="Mã học phần (VD: IMMU101)"/>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white" disabled={loading}>
          {loading ? 'Đang tải...' : 'Tải heatmap'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {items.map((it, idx) => {
          const pct = Math.round((it.pct_achieved || 0) * 100)
          const bg = pct >= 80 ? '#dcfce7' : pct >= 50 ? '#fef9c3' : pct>0 ? '#fee2e2' : '#e5e7eb'
          return (
            <div key={idx} className="rounded-lg p-3 text-center border" style={{ backgroundColor: bg }}>
              <div className="text-xs text-slate-500">{it.clo_code}</div>
              <div className="font-semibold">{pct}%</div>
            </div>
          )
        })}
        {!items.length && <div className="text-slate-500">Chưa có dữ liệu.</div>}
      </div>
    </div>
  )
}
