'use client'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '../../../lib/supabase-browser'   // ⬅️ đổi import

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN || 'students.local'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'student'|'email'>('student')
  const [mssv, setMssv] = useState(''); const [email, setEmail] = useState(''); const [pass, setPass] = useState('')
  const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(false)

  async function login() {
    try {
      setLoading(true); setMsg('')
      const supabase = getSupabase()
      const loginEmail = mode === 'student' ? `${mssv}@${STUDENT_DOMAIN}`.toLowerCase() : email
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: pass })
      if (error) { setMsg('Lỗi: ' + error.message); return }
      const must = !!data?.user?.user_metadata?.must_change_password
      router.replace(must ? '/auth/update-password' : '/')
    } catch (e:any) {
      setMsg('Exception: ' + String(e?.message || e))
      console.error(e)
    } finally {
      setLoading(false)
    }
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
            <div className="text-xs text-slate-500">Email tương đương: <code>{mssv ? `${mssv}@${STUDENT_DOMAIN}` : `<MSSV>@${STUDENT_DOMAIN}`}</code></div>
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
        {!!msg && <div className="text-sm mt-2 p-2 bg-slate-50 rounded border">{msg}</div>}
      </div>
    </div>
  )
}
