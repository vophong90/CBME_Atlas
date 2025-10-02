export default function Portfolio() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">e-Portfolio</h1>
      <p className="text-slate-600 mt-2">Nơi SV quản lý minh chứng (PDF/video) và xuất portfolio.</p>
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="card"><div className="font-semibold">OSCE – Trạm 3</div><div className="text-sm text-slate-500 mt-1">PDF minh chứng • 12/04/2025</div></div>
        <div className="card"><div className="font-semibold">Báo cáo ca bệnh</div><div className="text-sm text-slate-500 mt-1">PDF • 22/04/2025</div></div>
        <div className="card"><div className="font-semibold">Mini-CEX</div><div className="text-sm text-slate-500 mt-1">PDF • 05/05/2025</div></div>
      </div>
    </div>
  )
}