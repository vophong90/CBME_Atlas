// lib/supabaseServer.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ---- ENV (đọc mỗi lần dùng để tránh lỗi khi build) -------------------------
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Không throw khi import; chỉ throw khi thực sự cần dùng
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

// ---- Helpers đọc access token từ cookie (để áp RLS) ------------------------
function readAccessTokenFromCookies(): string | null {
  const store = cookies();

  // 1) Cookie chuẩn của Supabase v2
  const sbAccess = store.get('sb-access-token')?.value;
  if (sbAccess) return sbAccess;

  // 2) Auth Helpers: "supabase-auth-token" chứa JSON ["access_token","refresh_token"]
  const pairJson = store.get('supabase-auth-token')?.value;
  if (pairJson) {
    try {
      const arr = JSON.parse(pairJson);
      if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0];
    } catch { /* ignore */ }
  }

  // 3) Một số cấu hình cũ (legacy): "sb:token" là JSON có access_token
  const legacy = store.get('sb:token')?.value;
  if (legacy) {
    try {
      const obj = JSON.parse(legacy);
      if (obj && typeof obj.access_token === 'string') return obj.access_token;
    } catch { /* ignore */ }
  }

  return null;
}

// ---- Admin client (service-role) — bypass RLS ------------------------------
export function createServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// Giữ sẵn 1 singleton admin nếu bạn thích dùng trực tiếp
export const supabaseAdmin: SupabaseClient = (() => {
  try {
    return createServiceClient();
  } catch {
    // Tránh throw khi import ở môi trường chưa có ENV (ví dụ build time).
    // Khi gọi thực tế mà thiếu ENV, createServiceClient() phía trên sẽ throw rõ ràng.
    // @ts-ignore
    return undefined;
  }
})();

// ---- Server client theo user hiện tại (áp RLS) -----------------------------
export function getSupabase(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const accessToken = readAccessTokenFromCookies();

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

// Alias để tương thích code cũ: nhiều nơi import createServerClient
export function createServerClient(): SupabaseClient {
  return getSupabase();
}
