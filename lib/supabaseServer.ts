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
 * Route Handler (app/api/...)
 * Ở phiên bản mới: KHÔNG còn createRouteHandlerClient
 * → phải tự tạo client + set cookie thủ công
 */
export function getSupabaseFromRequest(): SupabaseClient {
  const cookieStore = cookies();

  const client = createSbClient(
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
          // Supabase sẽ đọc access_token từ cookie (đã được middleware set)
          Authorization: `Bearer ${cookieStore.get('sb-access-token')?.value ?? ''}`,
        },
      },
    }
  );

  return client;
}

/**
 * Server Components hoặc Server Actions
 * → dùng createServerComponentClient
 */
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export function getSupabase(): SupabaseClient {
  const cookieStore = cookies();
  return createServerComponentClient({
    cookies: () => cookieStore,
  }) as unknown as SupabaseClient;
}

export const createServerClient = getSupabase;
