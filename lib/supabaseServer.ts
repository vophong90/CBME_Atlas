// lib/supabaseServer.ts
import 'server-only';

import { cookies } from 'next/headers';
import { createClient as createSbClient, type SupabaseClient } from '@supabase/supabase-js';

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
 * Route Handler client (app/api/...)
 * & Server Components / Actions
 * → Đều đọc access_token từ cookie 'sb-access-token'
 */
async function createRlsClientFromCookies(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // Next 15: cookies() là async
  const accessToken = cookieStore.get('sb-access-token')?.value ?? '';

  return createSbClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

/** Dùng trong Route Handlers (app/api/...) */
export async function getSupabaseFromRequest(): Promise<SupabaseClient> {
  return createRlsClientFromCookies();
}

/** Dùng trong Server Components / Server Actions */
export async function getSupabase(): Promise<SupabaseClient> {
  return createRlsClientFromCookies();
}

/** Alias tương thích code cũ */
export const createServerClient = getSupabase;
