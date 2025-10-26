// app/api/frameworks/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('curriculum_frameworks')
      .select('id, doi_tuong, chuyen_nganh, nien_khoa')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const items = (data || []).map((r) => ({
      id: r.id,
      label: `${r.doi_tuong} – ${r.chuyen_nganh} – ${r.nien_khoa}`,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
