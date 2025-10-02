'use client'
import { useState } from 'react'

export default function Observations() {
  const [values, setValues] = useState({ i1: 0, i2: 1, i3: 2, i4: 1, i5: 1, i6: 0 })
  const levels = ['Không đạt','Đạt','Khá']

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Chấm & Minh chứng</h1>
      <p className="text-slate-600 mt-2">Form demo rubric nhiều item. Nộp xong sẽ tính CLO theo rule.</p>

      <div className="card mt-6">
        <div className="grid md:grid-cols-2 gap-6">
          {Object.keys(values).map(code => (
            <div key={code} className="flex items-center justify-between border rounded-xl px-3 py-2">
              <div>Item {code.toUpperCase()}</div>
              <select className="border rounded-lg px-2 py-1"
                value={values[code as keyof typeof values]}
                onChange={e => setValues(v => ({...v, [code]: parseInt(e.target.value)}))}>
                {levels.map((l,idx) => <option key={l} value={idx}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <button className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white">Lưu & xuất PDF</button>
          <button className="px-4 py-2 rounded-lg border">Nhập CSV</button>
        </div>
      </div>
    </div>
  )
}