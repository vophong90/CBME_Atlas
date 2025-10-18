'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    })()
  }, [])

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="text-xl font-semibold">Bạn chưa đăng nhập</div>
        <div className="text-slate-500 mt-2">Vui lòng bấm “Đăng nhập” ở góc phải.</div>
      </div>
    )
  }

  const meta = user.user_metadata || {}
  const avatar = meta.avatar_url || meta.picture

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Hồ sơ</h1>
      <div className="card mt-6 flex items-center gap-4">
        {avatar
          ? <img src={avatar} className="w-16 h-16 rounded-full object-cover" alt="avatar" />
          : <div className="w-16 h-16 rounded-full bg-[var(--brand-primary)] text-white grid place-items-center font-semibold">U</div>
        }
        <div>
          <div className="font-semibold">{meta.full_name || meta.name || user.email}</div>
          <div className="text-slate-500 text-sm">{user.email}</div>
          <div className="text-slate-500 text-sm">User ID: {user.id}</div>
        </div>
      </div>
    </div>
  )
}
