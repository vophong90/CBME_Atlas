export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const sb = createServiceClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();

  let qu = sb.from('students')
    .select('id, user_id, mssv, full_name')
    .order('full_name', { ascending: true })
    .limit(50);

  if (q) {
    qu = qu.or(`mssv.ilike.%${q}%,full_name.ilike.%${q}%`);
  }
  const { data, error } = await qu;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    items: (data || []).map(s => ({
      student_id: s.id,
      user_id: s.user_id,           // để tạo evaluation_request
      label: `${s.mssv || '---'} • ${s.full_name || ''}`.trim(),
      mssv: s.mssv,
      full_name: s.full_name,
    }))
  });
}
