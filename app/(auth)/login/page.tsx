'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

/* Inline icons (no deps) */
const Eye = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 104.24 4.24" />
    <path d="M9.88 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a17.22 17.22 0 01-3.84 4.66M6.11 6.11A17.86 17.86 0 001 12s4 8 11 8a10.94 10.94 0 005.06-1.22" />
  </svg>
);
const Mail = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M4 4h16v16H4z" />
    <path d="M22 6l-10 7L2 6" />
  </svg>
);

export default function LoginPage() {
  const supabase = getSupabase();
  const router = useRouter();
  const search = useSearchParams();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Trang đích sau đăng nhập (mặc định '/')
  const nextUrl = search?.get('next') || '/';

  // Nếu đã có session, tự chuyển đến nextUrl để tránh mắc kẹt ở /login
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session) router.replace(nextUrl);
    });
    return () => { mounted = false; };
  }, [router, supabase, nextUrl]);

  // QUAN TRỌNG: lắng nghe thay đổi auth để SSR/middleware “nhìn thấy” cookie mới
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.refresh(); // kích hoạt refresh tree -> cookie sync cho server/middleware
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setLoading(true);
    try {
      // Supabase-js v2 tự persist session; "remember" bạn có thể dùng để set flag riêng nếu muốn
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;

      // Đăng nhập xong quay về trang ban đầu muốn vào
      router.replace(nextUrl);
    } catch (e: any) {
      setErr(e?.message ?? 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    setErr(null);
    setNotice(null);
    if (!email) { setErr('Nhập email để nhận liên kết đặt lại mật khẩu.'); return; }
    try {
      setLoading(true);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTo = `${origin}/auth/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setNotice('Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư của bạn.');
    } catch (e: any) {
      setErr(e?.message ?? 'Không thể gửi email đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gradient-to-br from-brand-50 to-white">
      {/* Left visual */}
      <div className="hidden md:flex items-center justify-center p-10 bg-gradient-to-br from-brand-700 to-brand-600 text-white">
        <div className="max-w-md">
          <div className="text-3xl font-semibold">Chào mừng đến CBME Atlas</div>
          <p className="mt-3 text-white/80">
            Đăng nhập để quản lý chương trình, khảo sát chất lượng, và theo dõi kết quả theo thời gian thực.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/80">
            <li>• Single workspace cho giảng viên &amp; QA</li>
            <li>• Báo cáo trực quan &amp; xuất dữ liệu</li>
            <li>• Bảo mật theo vai trò (RBAC)</li>
          </ul>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="h-12 w-12 grid place-items-center rounded-2xl bg-brand-600 text-white">AT</div>
            <h1 className="mt-4 text-2xl font-semibold">Đăng nhập</h1>
            <p className="text-sm text-slate-600">Sử dụng tài khoản được cấp bởi Quản trị hệ thống.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <div className="mt-1 relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                  placeholder="you@university.edu"
                  autoComplete="username"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Mật khẩu</label>
              <div className="mt-1 relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-brand-50"
                  aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Ghi nhớ đăng nhập
              </label>
              <button type="button" onClick={onForgot} className="text-sm text-brand-700 hover:text-brand-800 underline">
                Quên mật khẩu?
              </button>
            </div>

            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}
            {notice && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 px-3 py-2 text-white hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 text-xs text-slate-500">
            Cần tài khoản? Liên hệ Quản trị viên để được cấp quyền.
          </div>

          <div className="mt-6 text-center">
            <Link className="text-xs text-slate-500 underline" href="/">
              ← Về Trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
