// lib/supabaseServer.ts
import 'server-only';

import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSbClient } from '@supabase/supabase-js';
import {
  createRouteHandlerClient,
  createServerComponentClient,
} from '@supabase/auth-helpers-nextjs';

/* ----------------------------- ENV helpers ------------------------------ */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/* ------------------- Service client (bypass RLS/policies) ------------------- */
/** Dùng cho tác vụ admin (server-only), bỏ qua RLS. */
export function createServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createSbClient(url, serviceKey, {
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

/* ----------------------- Server clients (RLS, có session) ------------------- */
/**
 * Dùng trong Route Handlers (/app/api/**/route.ts).
 * Đọc session đúng chuẩn từ cookie (đã được refresh bởi middleware).
 */
export function getSupabaseFromRequest(): SupabaseClient {
  const cookieStore = cookies();
  // Helpers tự lấy URL/KEY từ ENV: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createRouteHandlerClient({ cookies: () => cookieStore }) as unknown as SupabaseClient;
}

/**
 * Dùng trong Server Components/Server Actions nếu cần.
 * Cũng đọc session từ cookie như trên.
 */
export function getSupabase(): SupabaseClient {
  const cookieStore = cookies();
  return createServerComponentClient({ cookies: () => cookieStore }) as unknown as SupabaseClient;
}

/** Alias tương thích code cũ (nếu có import createServerClient) */
export const createServerClient = getSupabase;
