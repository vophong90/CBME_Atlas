export default function ClassAnalytics() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Báo cáo lớp / cohort</h1>
      <p className="text-slate-600 mt-2">Heatmap: Course × CLO × % sinh viên đạt (demo tĩnh).</p>
      <div className="grid grid-cols-4 gap-1 mt-6">
        {Array.from({length: 20}).map((_,i) => (
          <div key={i} className="h-12 rounded-lg" style={{backgroundColor: i%5===0 ? '#dcfce7' : i%3===0 ? '#fee2e2' : '#e0e7ff'}} />
        ))}
      </div>
    </div>
  )
}