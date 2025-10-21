import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const { userId, newPassword } = await req.json();
  if (!userId || !newPassword) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  // TODO: kiểm tra quyền caller là admin (ví dụ đọc session rồi verify trong DB)
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, user: data.user });
}
