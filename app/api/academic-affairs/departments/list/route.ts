export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('departments')
      .select('id, code, name, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
