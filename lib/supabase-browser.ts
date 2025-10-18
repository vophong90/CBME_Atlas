'use client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // Hiện rõ lỗi trên client thay vì 500 trắng
    throw new Error('Thiếu biến môi trường Supabase (URL/ANON_KEY). Kiểm tra ENV Production trên Vercel.')
  }
  _client = createClient(url, key)
  return _client
}
