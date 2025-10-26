// lib/supabaseServer.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ===== ENV helpers =====
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Lấy projectRef từ NEXT_PUBLIC_SUPABASE_URL (vd: https://abcd1234.supabase.co → abcd1234)
function getProjectRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname; // abcd1234.supabase.co
    const parts = host.split('.');
    return parts.length ? parts[0] : null;
  } catch {
    return null;
  }
}

// Đọc access token từ cookie Supabase (đúng tên cookie)
function readAccessTokenFromCookies(): string | null {
  const store = cookies();
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const ref = getProjectRefFromUrl(supabaseUrl);

  // 1) Tên cookie CHUẨN: sb-<projectRef>-auth-token  (value là JSON ["access","refresh"])
  if (ref) {
    const stdName = `sb-${ref}-auth-token`;
    const v = store.get(stdName)?.value;
    if (v) {
      try {
        const arr = JSON.parse(v);
        if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0];
      } catch {}
    }
  }

  // 2) Giữ tương thích vài biến thể cũ:
  const helpers = store.get('supabase-auth-token')?.value; // JSON ["access","refresh"]
  if (helpers) {
    try {
      const arr = JSON.parse(helpers);
      if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0];
    } catch {}
  }

  const legacy = store.get('sb:token')?.value; // JSON { access_token, refresh_token }
  if (legacy) {
    try {
      const obj = JSON.parse(legacy);
      if (obj && typeof obj.access_token === 'string') return obj.access_token;
    } catch {}
  }

  const veryOld = store.get('sb-access-token')?.value; // rất cũ
  if (veryOld) return veryOld;

  return null;
}

// ===== Service role (bypass RLS) =====
export function createServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Singleton admin (tuỳ chọn)
export const supabaseAdmin: SupabaseClient | undefined = (() => {
  try { return createServiceClient(); } catch { return undefined; }
})();

// ===== Server client theo user hiện tại (RLS bật) =====
export function getSupabase(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const accessToken = readAccessTokenFromCookies();

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
  });
}

// Alias để tương thích code cũ (nếu có nơi import createServerClient)
export const createServerClient = getSupabase;
