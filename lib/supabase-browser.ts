'use client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// import type { Database } from '@/types/supabase'; // nếu bạn có types

let _client: ReturnType<typeof createClientComponentClient> | null = null;

/** Supabase client CHẠY TRÊN BROWSER, đồng bộ cookie cho SSR/middleware */
export function getSupabase() {
  if (_client) return _client;
  _client = createClientComponentClient(/*<Database>*/);
  return _client;
}

/** Alias tương thích tên cũ (nếu có nơi gọi supabaseBrowser) */
export const supabaseBrowser = getSupabase;
