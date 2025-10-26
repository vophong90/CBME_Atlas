// lib/authFetch.ts
'use client';
import { getSupabase } from '@/lib/supabase-browser';

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(init.headers || {});
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  // giữ cookie để server có thể đọc thêm nếu cần
  return fetch(input, { ...init, headers, credentials: 'include' });
}
