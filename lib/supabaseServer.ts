// lib/supabaseServer.ts
import 'server-only';

import { cookies } from 'next/headers';
import { createClient as createSbClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/* ----------------------------- ENV helpers ------------------------------ */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/* ------------------- Service client (bypass RLS/policies) ------------------- */
/** Dùng cho tác vụ admin (server-only), bỏ qua RLS */
export function createServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createSbClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseAdmin: SupabaseClient | undefined = (() => {
  try {
    return createServiceClient();
  } catch {
    return undefined;
  }
})();

/* ----------------------- Server clients (RLS, có session) ------------------- */
/**
 * Client dùng cho Server Components / Route Handlers.
 * Đọc & ghi cookie bằng @supabase/ssr → server & client share cùng session.
 */
function _getServerSupabase(): SupabaseClient {
  const cookieStore = cookies();

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Trong Server Component có thể không cho set cookie, nên bọc try/catch
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // bỏ qua, vì phần refresh session có thể do proxy / middleware xử lý
          }
        },
      },
    }
  );
}

/** Dùng trong Route Handlers: app/api/... */
export function getSupabaseFromRequest(): SupabaseClient {
  return _getServerSupabase();
}

/** Dùng trong Server Components / Server Actions */
export function getSupabase(): SupabaseClient {
  return _getServerSupabase();
}

/** Alias tương thích code cũ */
export const createServerClient = _getServerSupabase;
