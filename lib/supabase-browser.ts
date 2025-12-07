// lib/supabase-browser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

// Singleton cho client phía browser
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabase() {
  if (_client) return _client;

  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return _client;
}

// Alias để code cũ vẫn chạy được
export const supabaseBrowser = getSupabase;

// Nếu muốn dùng tên `supabase` cho tiện:
export const supabase = getSupabase();
