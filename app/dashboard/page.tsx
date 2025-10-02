'use client'
import { useEffect, useState } from 'react'

type Roll = { plo_id?: string; pi_id?: string; total_clo: number; achieved_clo: number; below_clo: number; na_clo: number; attainment: number|null; coverage: number|null }

export default function Dashboard() {
  const [studentCode, setStudentCode] = useState('SV001')
  const [plo, setPlo] = useState<Roll[]>([])
  const [pi, setPi] = useState<Roll[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/dashboard?student_code=${encodeURIComponent(studentCode)}`)
    const json = await res.json()
    if (res.ok) {
      setPlo(json.plo); setPi(json.pi)
    } else {
      alert(json.message || 'Không tìm thấy sinh viên')
      setPlo([]); setPi([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Dashboard sinh viên</h1>
      <div className="mt-4 flex gap-2">
        <input className="border rounded-lg px-3 py-2" value={studentCode} onChange={e=>setStudentCode(e.target.value)} placeholder="Mã SV (VD: SV001)" />
        <button onClick={load} className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white" disabled={loading}>
          {loading ? 'Đang tải...' : 'Tải dữ liệu'}
        </button>
      </div>

      <section className="mt-8">
        <h2 className="font-semibold">PLO</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-3">
          {plo.map((r,idx) => (
            <div key={idx} className="card">
              <div className="font-semibold">PLO {idx+1}</div>
              <div className="text-sm text-slate-500 mt-1">
                Total: {r.total_clo} • Đạt: {r.achieved_clo} • Chưa đạt: {r.below_clo} • N/A: {r.na_clo}
              </div>
              <div className="mt-4">
                <div className="text-xs text-slate-500">Attainment</div>
                <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{width: `${Math.round((r.attainment||0)*100)}%`}} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-500">Coverage</div>
                <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{width: `${Math.round((r.coverage||0)*100)}%`}} />
                </div>
              </div>
            </div>
          ))}
          {!plo.length && <div className="text-slate-500">Chưa có dữ liệu PLO.</div>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold">PI</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-3">
          {pi.map((r,idx) => (
            <div key={idx} className="card">
              <div className="font-semibold">PI {idx+1}</div>
              <div className="text-sm text-slate-500 mt-1">
                Total: {r.total_clo} • Đạt: {r.achieved_clo} • Chưa đạt: {r.below_clo} • N/A: {r.na_clo}
              </div>
              <div className="mt-4">
                <div className="text-xs text-slate-500">Attainment</div>
                <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{width: `${Math.round((r.attainment||0)*100)}%`}} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-500">Coverage</div>
                <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{width: `${Math.round((r.coverage||0)*100)}%`}} />
                </div>
              </div>
            </div>
          ))}
          {!pi.length && <div className="text-slate-500">Chưa có dữ liệu PI.</div>}
        </div>
      </section>
    </div>
  )
}
