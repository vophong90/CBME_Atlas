'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type SUser = { email?: string; user_metadata?: { full_name?: string; name?: string } }

export default function AuthButton() {
  const [user, setUser] = useState<SUser | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let unsub: any
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user as any ?? null)
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        setUser((session?.user as any) ?? null)
      })
      unsub = sub.subscription
    })()
    return () => { unsub?.unsubscribe?.() }
  }, [])

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` }
    })
  }

  async function loginEmail() {
    const email = prompt('Nhập email trường để nhận link đăng nhập:')
    if (!email) return
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })
    if (error) alert(error.message)
    else alert('Đã gửi link đăng nhập. Kiểm tra email của bạn.')
  }

  async function logout() {
    await supabase.auth.signOut()
    setOpen(false)
  }

  if (!user) {
    // Chưa đăng nhập
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-sm hover:opacity-90"
        >
          Đăng nhập
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white border rounded-xl shadow-soft p-2 z-50">
            <button onClick={loginGoogle} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
              Đăng nhập bằng Google
            </button>
            <button onClick={loginEmail} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
              Đăng nhập bằng Email (magic link)
            </button>
          </div>
        )}
      </div>
    )
  }

  // Đã đăng nhập
  const display =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    'Bạn'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50"
        title={user.email}
      >
        {display}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-soft p-2 z-50">
          <a href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-slate-50">Dashboard</a>
          <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
