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
 *  → Next.js 14+ : cookies() TRẢ VỀ PROMISE
 *  → Không còn createRouteHandlerClient
 */
export async function getSupabaseFromRequest(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // ⭐ MUST await in Next.js 14+

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

/* ----------------------- Server Components / Actions ----------------------- */
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function getSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerComponentClient({
    cookies: () => cookieStore,
  }) as unknown as SupabaseClient;
}

export const createServerClient = getSupabase;
