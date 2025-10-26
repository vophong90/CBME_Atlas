export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const framework_id = (searchParams.get('framework_id') || '').trim();
  if (!framework_id) return NextResponse.json({ error: 'framework_id is required' }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from('courses')
    .select('course_code, course_name')
    .eq('framework_id', framework_id)
    .order('course_code', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}
