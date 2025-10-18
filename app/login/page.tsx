'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN || 'students.local'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [tab, setTab] = useState<'student'|'staff'>(params.get('mode') === 'staff' ? 'staff' : 'student')

  // form states
  const [studentCode, setStudentCode] = useState('')
  const [studentPass, setStudentPass] = useState('')

  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string|undefined>()

  useEffect(() => {
    // nếu đã đăng nhập thì đưa về trang chủ
    supabase.auth.getUser().then(({data}) => {
      if (data.user) router.replace('/')
    })
  }, [router])

  async function loginStudent() {
    setLoading(true); setErr(undefined)
    const loginEmail = `${studentCode}@${STUDENT_DOMAIN}`.toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: studentPass
    })
    setLoading(false)
    if (error) return setErr(error.message)
    router.replace('/')
  }

  async function loginStaff() {
    setLoading(true); setErr(undefined)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    })
    setLoading(false)
    if (error) return setErr(error.message)
    router.replace('/')
  }

  async function resetPassword() {
    const target = tab === 'student'
      ? `${studentCode}@${STUDENT_DOMAIN}`.toLowerCase()
      : email
    if (!target) return setErr('Vui lòng nhập email/MSSV trước.')
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${location.origin}/auth/update-password`
    })
    if (error) setErr(error.message)
    else alert('Đã gửi email đặt lại mật khẩu.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Đăng nhập</h1>

      <div className="mt-4 flex gap-2">
        <button
          className={`px-3 py-1.5 rounded-lg border ${tab==='student'?'bg-slate-100':''}`}
          onClick={() => setTab('student')}>Sinh viên</button>
        <button
          className={`px-3 py-1.5 rounded-lg border ${tab==='staff'?'bg-slate-100':''}`}
          onClick={() => setTab('staff')}>Giảng viên/Quản trị</button>
      </div>

      <div className="card mt-4 space-y-3">
        {tab==='student' ? (
          <>
            <div className="text-sm text-slate-600">Đăng nhập bằng <b>Mã số sinh viên</b> + <b>Mật khẩu</b></div>
            <input className="border rounded-lg px-3 py-2 w-full" placeholder="Mã số sinh viên (VD: SV001)" value={studentCode} onChange={e=>setStudentCode(e.target.value)} />
            <input className="border rounded-lg px-3 py-2 w-full" type="password" placeholder="Mật khẩu" value={studentPass} onChange={e=>setStudentPass(e.target.value)} />
            <button disabled={loading} onClick={loginStudent} className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white w-full">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
            <button onClick={resetPassword} className="text-sm text-slate-600 underline">Quên mật khẩu?</button>
            <div className="text-xs text-slate-500">
              Email đăng nhập nội bộ: <code>{studentCode ? `${studentCode}@${STUDENT_DOMAIN}` : `&lt;MSSV&gt;@${STUDENT_DOMAIN}`}</code>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-slate-600">Đăng nhập bằng <b>Email</b> + <b>Mật khẩu</b></div>
            <input className="border rounded-lg px-3 py-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="border rounded-lg px-3 py-2 w-full" type="password" placeholder="Mật khẩu" value={pass} onChange={e=>setPass(e.target.value)} />
            <button disabled={loading} onClick={loginStaff} className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white w-full">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
            <button onClick={resetPassword} className="text-sm text-slate-600 underline">Quên mật khẩu?</button>
          </>
        )}

        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </div>
  )
}
