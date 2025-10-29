// app/api/rubrics/get/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const sb = createServiceClient();
    const { data, error } = await sb
      .from('rubrics')
      .select('id, title, definition')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // definition có thể là text hoặc jsonb
    const def = typeof (data as any).definition === 'string'
      ? JSON.parse((data as any).definition)
      : (data as any).definition;

    return NextResponse.json({
      item: { id: data.id, title: data.title, definition: def },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
