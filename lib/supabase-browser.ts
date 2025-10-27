'use client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase'; // mục 2 bên dưới

let _client: ReturnType<typeof createClientComponentClient<Database>> | null = null;

/** Supabase client CHẠY TRÊN BROWSER, đồng bộ cookie cho SSR/middleware */
export function getSupabase() {
  if (_client) return _client;
  _client = createClientComponentClient<Database>();
  return _client;
}

/** Back-compat alias (nếu bạn đang import supabaseBrowser ở đâu đó) */
export const supabaseBrowser = getSupabase;
