// lib/supabaseServer.ts
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// SSR client: đọc/ghi cookie phiên người dùng (chuẩn, không cần tự parse tên cookie)
export function getSupabase() {
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) { return store.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) {
        try { store.set({ name, value, ...options }); } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { store.set({ name, value: '', ...options, expires: new Date(0) }); } catch {}
      },
    },
  });
}

// Service client (server-only): bypass RLS
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Giữ tương thích ngược: instance admin
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
