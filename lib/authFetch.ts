// lib/authFetch.ts
'use client';
import { supabaseBrowser } from './supabase-browser';

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const sb = supabaseBrowser();
  const { data: { session } } = await sb.auth.getSession();

  const headers = new Headers(init.headers || {});
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);

  // luôn gửi cookie (nếu có)
  return fetch(input, { ...init, headers, credentials: 'include' });
}
