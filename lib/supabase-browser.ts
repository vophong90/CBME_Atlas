'use client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase'; // nếu có types đã tạo

let _client: ReturnType<typeof createClientComponentClient<Database>> | null = null;

export function getSupabase() {
  if (_client) return _client;
  _client = createClientComponentClient<Database>();
  return _client;
}
export const supabaseBrowser = getSupabase; // alias nếu có code cũ dùng
