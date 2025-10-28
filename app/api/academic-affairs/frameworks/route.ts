export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('curriculum_frameworks')
      .select('id, doi_tuong, chuyen_nganh, nien_khoa, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r: any) => ({
      id: r.id,
      label: [r.doi_tuong, r.chuyen_nganh, `NK ${r.nien_khoa}`].filter(Boolean).join(' – '),
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
