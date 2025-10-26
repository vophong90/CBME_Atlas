'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/** Supabase client chạy ở BROWSER (giữ phiên đăng nhập) */
export function supabaseBrowser(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Thiếu biến môi trường Supabase (URL/ANON_KEY). Kiểm tra ENV.');
  }

  _client = createClient(url, key, {
    auth: {
      persistSession: true,    // giữ phiên trong localStorage
      autoRefreshToken: true,  // tự làm mới token
      detectSessionInUrl: true
    },
  });

  return _client;
}

/** Back-compat cho code cũ: getSupabase() */
export const getSupabase = supabaseBrowser;
