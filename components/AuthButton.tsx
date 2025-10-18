'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type SUser = {
  email?: string
  user_metadata?: {
    avatar_url?: string
    picture?: string
    full_name?: string
    name?: string
  }
}

function InitialsAvatar({ name, email }:{ name?:string; email?:string }) {
  const text = (name || email || 'U').trim()
  const initials = useMemo(() => {
    const parts = text.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return text.slice(0,2).toUpperCase()
  }, [text])
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-white grid place-items-center text-xs font-semibold">
      {initials}
    </div>
  )
}

export default function AuthButton() {
  const [user, setUser] = useState<SUser | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let unsub: any
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      setUser((data.user as any) ?? null)
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
    const email = prompt('Nhập email để nhận magic link:')
    if (!email) return
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })
    if (error) alert(error.message)
    else alert('Đã gửi link đăng nhập. Kiểm tra email.')
  }
  async function logout() {
    await supabase.auth.signOut()
    setOpen(false)
  }

  // Chưa đăng nhập → hiện nút "Đăng nhập"
  if (!user) {
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

  // Đã đăng nhập → hiện avatar + tên và menu
  const name = user.user_metadata?.full_name || user.user_metadata?.name
  const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg border text-sm hover:bg-slate-50"
        title={user.email}
      >
        {avatar
          ? <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
          : <InitialsAvatar name={name||undefined} email={user.email} />
        }
        <span className="hidden sm:block max-w-[160px] truncate">
          {name || user.email || 'Bạn'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded-xl shadow-soft p-2 z-50">
          <a href="/profile" className="block px-3 py-2 rounded-lg hover:bg-slate-50">Hồ sơ</a>
          <a href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-slate-50">Dashboard</a>
          <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
