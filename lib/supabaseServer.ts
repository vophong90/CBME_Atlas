// lib/supabaseServer.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getProjectRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const parts = host.split('.');
    return parts.length ? parts[0] : null;
  } catch { return null; }
}

function readAccessTokenFromCookies(): string | null {
  const store = cookies();
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const ref = getProjectRefFromUrl(supabaseUrl);

  if (ref) {
    const stdName = `sb-${ref}-auth-token`;
    const v = store.get(stdName)?.value;
    if (v) {
      try { const arr = JSON.parse(v); if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0]; } catch {}
    }
  }
  const helpers = store.get('supabase-auth-token')?.value;
  if (helpers) { try { const arr = JSON.parse(helpers); if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0]; } catch {} }

  const legacy = store.get('sb:token')?.value;
  if (legacy) { try { const obj = JSON.parse(legacy); if (obj && typeof obj.access_token === 'string') return obj.access_token; } catch {} }

  const veryOld = store.get('sb-access-token')?.value;
  if (veryOld) return veryOld;

  return null;
}

// Service role (bỏ RLS)
export function createServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
export const supabaseAdmin: SupabaseClient | undefined = (() => {
  try { return createServiceClient(); } catch { return undefined; }
})();

// Server client: lấy từ COOKIE (cũ)
export function getSupabase(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const accessToken = readAccessTokenFromCookies();

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
  });
}

// ✅ NEW: Server client lấy token từ HEADER nếu có; fallback cookie
export function getSupabaseFromRequest(req: Request): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const headerAuth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const tokenFromHeader = headerAuth?.startsWith('Bearer ') ? headerAuth : null;
  const tokenFromCookie = readAccessTokenFromCookies();

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: tokenFromHeader
        ? { Authorization: tokenFromHeader }
        : (tokenFromCookie ? { Authorization: `Bearer ${tokenFromCookie}` } : {}),
    },
  });
}

// Alias cũ
export const createServerClient = getSupabase;
