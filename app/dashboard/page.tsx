export default function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Dashboard sinh viên</h1>
      <p className="text-slate-600 mt-2">Tổng quan PLO / PI — Total / Đạt / Chưa đạt / N/A + Attainment + Coverage.</p>
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="card">
          <div className="font-semibold">PLO1 – Thực hành lâm sàng</div>
          <div className="text-sm text-slate-500 mt-1">Total: 8 • Đạt: 5 • Chưa đạt: 1 • N/A: 2</div>
          <div className="mt-4">
            <div className="text-xs text-slate-500">Attainment</div>
            <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{width:'83%'}} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-slate-500">Coverage</div>
            <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
              <div className="h-full bg-amber-500" style={{width:'75%'}} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="font-semibold">PLO2 – Giao tiếp chuyên nghiệp</div>
          <div className="text-sm text-slate-500 mt-1">Total: 6 • Đạt: 4 • Chưa đạt: 2 • N/A: 0</div>
          <div className="mt-4">
            <div className="text-xs text-slate-500">Attainment</div>
            <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{width:'66%'}} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-slate-500">Coverage</div>
            <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
              <div className="h-full bg-amber-500" style={{width:'100%'}} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="font-semibold">PI1 – Kỹ năng thao tác mẫu</div>
          <div className="text-sm text-slate-500 mt-1">Total: 5 • Đạt: 4 • Chưa đạt: 1 • N/A: 0</div>
          <div className="mt-4">
            <div className="text-xs text-slate-500">Attainment</div>
            <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{width:'80%'}} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-slate-500">Coverage</div>
            <div className="w-full h-2 rounded bg-slate-100 mt-1 overflow-hidden">
              <div className="h-full bg-amber-500" style={{width:'100%'}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}