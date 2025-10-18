'use client'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN || 'students.local'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'student'|'email'>('student')
  const [mssv, setMssv] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string|undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => { if (data.user) router.replace('/') })
  }, [router])

  async function login() {
    setLoading(true); setErr(undefined)
    const loginEmail = mode === 'student' ? `${mssv}@${STUDENT_DOMAIN}`.toLowerCase() : email
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: pass })
    setLoading(false)
    if (error) return setErr(error.message)
    const mustChange = (data?.user?.user_metadata?.must_change_password ?? false) as boolean
    if (mustChange) router.replace('/auth/update-password')
    else router.replace('/')
  }

  async function forgot() {
    const target = mode === 'student' ? `${mssv}@${STUDENT_DOMAIN}`.toLowerCase() : email
    if (!target) return setErr('Vui lòng nhập thông tin trước.')
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${location.origin}/auth/update-password`
    })
    if (error) setErr(error.message); else alert('Đã gửi email đặt lại mật khẩu.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Đăng nhập</h1>

      <div className="mt-4 flex gap-2">
        <button className={`px-3 py-1.5 rounded-lg border ${mode==='student'?'bg-slate-100':''}`} onClick={()=>setMode('student')}>Sinh viên</button>
        <button className={`px-3 py-1.5 rounded-lg border ${mode==='email'?'bg-slate-100':''}`} onClick={()=>setMode('email')}>Email</button>
      </div>

      <div className="card mt-4 space-y-3">
        {mode==='student' ? (
          <>
            <input className="border rounded-lg px-3 py-2 w-full" placeholder="Mã số sinh viên (VD: SV001)" value={mssv} onChange={e=>setMssv(e.target.value)} />
            <input className="border rounded-lg px-3 py-2 w-full" type="password" placeholder="Mật khẩu" value={pass} onChange={e=>setPass(e.target.value)} />
            <div className="text-xs text-slate-500">Email nội bộ tương đương: <code>{mssv ? `${mssv}@${STUDENT_DOMAIN}` : `<MSSV>@${STUDENT_DOMAIN}`}</code></div>
          </>
        ) : (
          <>
            <input className="border rounded-lg px-3 py-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="border rounded-lg px-3 py-2 w-full" type="password" placeholder="Mật khẩu" value={pass} onChange={e=>setPass(e.target.value)} />
          </>
        )}

        <button disabled={loading} onClick={login} className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white w-full">
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <button onClick={forgot} className="text-sm text-slate-600 underline">Quên mật khẩu?</button>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </div>
  )
}
