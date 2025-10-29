import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { ensureQA } from '@/lib/perm360';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sb = createServiceClient();
  const { data: { user }, error: uerr } = await sb.auth.getUser();
  const guard = await ensureQA(user?.id);
  if (!guard.ok) return guard.resp;

  // ... trả về danh sách forms cho quản trị
  return NextResponse.json({ items: [] });
}
