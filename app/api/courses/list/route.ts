export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const sb = getSupabaseFromRequest(req);
  const url = new URL(req.url);
  const framework_id = url.searchParams.get('framework_id') || '';
  if (!framework_id) return NextResponse.json({ items: [] });

  const { data, error } = await sb
    .from('courses')
    .select('course_code, course_name')
    .eq('framework_id', framework_id)
    .order('course_code', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data || [] });
}
