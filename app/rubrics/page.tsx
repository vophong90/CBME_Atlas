export default function Rubrics() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Rubric</h1>
      <p className="text-slate-600 mt-2">Tạo và quản lý rubric đa-CLO. (Sẽ kết nối Supabase ở bước sau)</p>
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="card">
          <div className="font-semibold">Rubric A – IMMU101</div>
          <div className="text-sm text-slate-500">Item 1–3 → CLO1; 4–6 → CLO2.</div>
          <button className="mt-4 px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white">Chỉnh sửa</button>
        </div>
        <div className="card">
          <div className="font-semibold">Thêm rubric mới</div>
          <p className="text-sm text-slate-500">Nhập tên rubric, thêm item, ánh xạ item → CLO.</p>
          <button className="mt-4 px-4 py-2 rounded-lg border">Tạo</button>
        </div>
      </div>
    </div>
  )
}