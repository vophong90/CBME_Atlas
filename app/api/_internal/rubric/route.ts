export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb.from('rubrics').select('id, title, definition').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Không tìm thấy rubric' }, { status: 404 });

  return NextResponse.json({ rubric: data });
}
