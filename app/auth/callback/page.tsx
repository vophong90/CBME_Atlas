'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase' // từ app/auth/callback/ đến lib/

export default function AuthCallback() {
  const router = useRouter()
  useEffect(() => {
    ;(async () => {
      // Đổi mã -> session (PKCE)
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
      if (error) {
        alert(error.message)
      }
      // quay về trang chủ (hoặc nhớ last URL)
      router.replace('/')
    })()
  }, [router])
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="text-xl font-semibold">Đang đăng nhập...</div>
      <div className="text-slate-500 mt-2">Vui lòng đợi 1–2 giây.</div>
    </div>
  )
}
