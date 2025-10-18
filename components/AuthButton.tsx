'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthButton() {
  const [user, setUser] = useState<any>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let sub: any
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user ?? null)
      const s = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
      sub = s.data?.subscription
    })()
    return () => sub?.unsubscribe?.()
  }, [])

  if (!user) {
    return <Link href="/login" className="px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-sm">Đăng nhập</Link>
  }

  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email
  return (
    <div className="relative">
      <button onClick={() => setOpen(v=>!v)} className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50">
        {name}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow p-2 z-50">
          <Link href="/profile" className="block px-3 py-2 rounded-lg hover:bg-slate-50">Hồ sơ</Link>
          <button
            onClick={async ()=>{ await supabase.auth.signOut(); setOpen(false) }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
