// lib/supabaseServer.ts
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/* ----------------------------- ENV helpers ------------------------------ */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/* ---------------------- Supabase cookie name helper --------------------- */
/** Lấy project ref từ NEXT_PUBLIC_SUPABASE_URL để suy ra cookie sb-<ref>-auth-token */
function getProjectRefFromUrl(url: string): string | null {
  try {
    const ref = new URL(url).hostname.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

/* ----------------------- Read access token (cookie) --------------------- */
/**
 * Cố gắng đọc access token từ nhiều định dạng cookie khác nhau:
 * - sb-<ref>-auth-token (Auth Helpers v2): JSON ["access","refresh"]
 * - supabase-auth-token (Helpers cũ): JSON ["access","refresh"]
 * - sb:token (rất cũ): JSON { access_token, refresh_token }
 * - sb-access-token (legacy thô)
 */
function readAccessTokenFromCookies(): string | null {
  const jar = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const ref = getProjectRefFromUrl(supabaseUrl);

  // 1) sb-<ref>-auth-token
  if (ref) {
    const std = jar.get(`sb-${ref}-auth-token`)?.value;
    if (std) {
      try {
        const arr = JSON.parse(std);
        if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0];
      } catch {}
    }
  }

  // 2) supabase-auth-token
  const helpers = jar.get('supabase-auth-token')?.value;
  if (helpers) {
    try {
      const arr = JSON.parse(helpers);
      if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0];
    } catch {}
  }

  // 3) sb:token
  const legacy = jar.get('sb:token')?.value;
  if (legacy) {
    try {
      const obj = JSON.parse(legacy);
      if (obj && typeof obj.access_token === 'string') return obj.access_token;
    } catch {}
  }

  // 4) sb-access-token
  const veryOld = jar.get('sb-access-token')?.value;
  if (veryOld) return veryOld;

  return null;
}

/* ------------------- Service client (bypass RLS/policies) ------------------- */
export function createServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Tuỳ chọn: singleton admin (nếu thiếu ENV thì undefined) */
export const supabaseAdmin: SupabaseClient | undefined = (() => {
  try {
    return createServiceClient();
  } catch {
    return undefined;
  }
})();

/* ------------------ Server client (RLS) lấy token từ cookie ----------------- */
/** Dùng khi route không tiện truyền `req`; sẽ đọc token từ cookie (App Router). */
export function getSupabase(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const cookieToken = readAccessTokenFromCookies();

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: cookieToken ? { Authorization: `Bearer ${cookieToken}` } : {},
    },
  });
}

/* ------------- Server client (RLS) ưu tiên Bearer từ request header ---------- */
/**
 * Khuyến nghị dùng trong mọi Route Handler cần xác thực.
 *  - Ưu tiên header Authorization: Bearer <token> (từ authFetch ở client)
 *  - Fallback sang cookie như trên để tương thích.
 */
export function getSupabaseFromRequest(req: Request): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const rawAuth =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    '';

  const useHeader =
    typeof rawAuth === 'string' && /^Bearer\s+\S+$/i.test(rawAuth) ? rawAuth : null;

  const cookieToken = useHeader ? null : readAccessTokenFromCookies();

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: useHeader
        ? { Authorization: useHeader } // đã bao gồm 'Bearer '
        : cookieToken
        ? { Authorization: `Bearer ${cookieToken}` }
        : {},
    },
  });
}

/** Alias tương thích code cũ */
export const createServerClient = getSupabase;
