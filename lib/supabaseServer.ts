// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ENV bắt buộc
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Admin client (service-role) — bypass RLS.
 * Chỉ dùng ở server cho tác vụ đặc quyền (RPC tổng hợp, import...).
 */
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

/** Giữ tương thích API cũ */
export function createServiceClient() {
  return supabaseAdmin;
}

/**
 * getSupabase() — Server client theo người dùng hiện tại (RLS bật).
 * Lấy access token từ cookie và gắn vào Authorization header cho mọi request.
 * Không cần cài @supabase/auth-helpers-nextjs.
 */
export function getSupabase() {
  const cookieStore = cookies();

  // Supabase v2 mặc định dùng các cookie này khi đăng nhập trên client
  // (tuỳ dự án, tên cookie có thể khác; thêm nhiều phương án để an toàn)
  const token =
    cookieStore.get('sb-access-token')?.value ??
    cookieStore.get('sb:token')?.value ??         // phòng khi triển khai cũ
    cookieStore.get('supabase-auth-token')?.value // một số cấu hình cũ

  // Tạo client server-side với Bearer token (nếu có) để RLS nhận diện user
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}
