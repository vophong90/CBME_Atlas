'use client'
export default function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-xl font-semibold">Có lỗi khi tải trang xác thực</h1>
      <pre className="mt-4 p-3 bg-slate-50 rounded border text-sm whitespace-pre-wrap">{String(error?.message || error)}</pre>
      <button onClick={reset} className="mt-4 px-3 py-1.5 rounded bg-slate-800 text-white">Thử lại</button>
    </div>
  )
}
