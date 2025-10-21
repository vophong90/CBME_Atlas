// lib/supabaseServer.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// -------- ENV helpers -------------------------------------------------------
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// -------- Read access token from cookies (for RLS-aware server client) ------
function readAccessTokenFromCookies(): string | null {
  const store = cookies();

  // 1) Supabase v2 cookie
  const sb = store.get('sb-access-token')?.value;
  if (sb) return sb;

  // 2) Auth Helpers cookie: 'supabase-auth-token' = JSON ["access","refresh"]
  const helpers = store.get('supabase-auth-token')?.value;
  if (helpers) {
    try {
      const arr = JSON.parse(helpers);
      if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0];
    } catch {}
  }

  // 3) Legacy cookie: 'sb:token' = { access_token, refresh_token }
  const legacy = store.get('sb:token')?.value;
  if (legacy) {
    try {
      const obj = JSON.parse(legacy);
      if (obj && typeof obj.access_token === 'string') return obj.access_token;
    } catch {}
  }

  return null;
}

// -------- Admin client (service role) — bypass RLS --------------------------
export function createServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Optional singleton admin client.
 * Có thể là `undefined` ở build-time nếu thiếu ENV; code gọi cần kiểm tra tồn tại.
 */
export const supabaseAdmin: SupabaseClient | undefined = (() => {
  try {
    return createServiceClient();
  } catch {
    return undefined;
  }
})();

// -------- Server client theo user hiện tại (RLS bật) ------------------------
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

// Alias để tương thích code cũ
export const createServerClient = getSupabase;
