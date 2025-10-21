'use client';

import { getSupabase } from '@/lib/supabase-browser';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function UpdatePasswordPage() {
  const supabase = getSupabase();
  const router = useRouter();
  const q = useSearchParams();

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const e = q.get('error_description');
    if (e) setErr(e);
  }, [q]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);

    if (pw1.length < 8) return setErr('Mật khẩu mới phải ≥ 8 ký tự.');
    if (pw1 !== pw2) return setErr('Mật khẩu nhập lại không khớp.');

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setMsg('Đã cập nhật mật khẩu. Bạn sẽ được chuyển về trang đăng nhập.');
      setTimeout(() => router.replace('/login'), 1200);
    } catch (e: any) {
      setErr(e?.message ?? 'Không thể cập nhật mật khẩu. Hãy mở lại liên kết trong email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Nếu đã set nền chung trong app/(auth)/layout.tsx, đổi wrapper dưới thành: className="grid place-items-center p-4" */}
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-50 to-white p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Đặt lại mật khẩu</h1>
          <p className="text-sm text-slate-600">Nhập mật khẩu mới cho tài khoản của bạn.</p>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium">Mật khẩu mới</label>
              <input
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nhập lại mật khẩu</label>
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                placeholder="••••••••"
                required
              />
            </div>

            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
            )}
            {msg && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">{msg}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 px-3 py-2 text-white hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/login" className="text-xs text-brand-700 hover:text-brand-800 underline">← Quay lại đăng nhập</a>
          </div>
        </div>
      </div>
    </>
  );
}
