// lib/supabaseServer.ts
import 'server-only';

import { cookies } from 'next/headers';
import {
  createClient as createSbClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';

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

/** Singleton optional cho các tác vụ admin */
export const supabaseAdmin: SupabaseClient | undefined = (() => {
  try {
    return createServiceClient();
  } catch {
    return undefined;
  }
})();

/* ----------------------- Server clients (RLS, có session) ------------------- */
/**
 * Tạo Supabase client dùng session hiện có (đọc từ cookie).
 * Dùng được cho cả Route Handlers (app/api/...) và Server Components / Actions.
 */
async function createRlsClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // Next 15: cookies() trả Promise

  return createSupabaseServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Trong app này mình không set/xóa cookie từ server code,
        // nên để no-op cho đủ interface.
        set() {
          /* no-op */
        },
        remove() {
          /* no-op */
        },
      },
    }
  ) as unknown as SupabaseClient;
}

/**
 * Route Handler client (app/api/...)
 *  → dùng session từ cookies, RLS có hiệu lực
 */
export async function getSupabaseFromRequest(): Promise<SupabaseClient> {
  return createRlsClient();
}

/**
 * Server Components / Server Actions
 *  → cũng dùng session từ cookies
 */
export async function getSupabase(): Promise<SupabaseClient> {
  return createRlsClient();
}

/** Alias tương thích code cũ (một số chỗ import createServerClient) */
export const createServerClient = getSupabase;
