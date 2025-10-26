export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  const db = createServiceClient();
  const { data, error } = await db
    .from('curriculum_frameworks')
    .select('id, doi_tuong, chuyen_nganh, nien_khoa')
    .order('nien_khoa', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = (data ?? []).map((f: any) => ({
    id: f.id,
    doi_tuong: f.doi_tuong,
    chuyen_nganh: f.chuyen_nganh,
    nien_khoa: f.nien_khoa,
    label: `${f.doi_tuong} • ${f.chuyen_nganh} • ${f.nien_khoa}`,
  }));

  return NextResponse.json({ items });
}
