'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function UpdatePassword() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string|undefined>()

  async function onSubmit() {
    setLoading(true); setErr(undefined)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setLoading(false)
    if (error) setErr(error.message)
    else {
      alert('Đổi mật khẩu thành công.')
      router.replace('/login')
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Cập nhật mật khẩu</h1>
      <div className="card mt-4 space-y-3">
        <input className="border rounded-lg px-3 py-2 w-full" type="password" placeholder="Mật khẩu mới" value={pw} onChange={e=>setPw(e.target.value)} />
        <button onClick={onSubmit} disabled={loading} className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white w-full">
          {loading ? 'Đang cập nhật...' : 'Cập nhật'}
        </button>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </div>
  )
}
