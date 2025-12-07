// app/api/department/rubrics/[id]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }   // 👈 đổi kiểu params
) {
  try {
    const { id } = await ctx.params;         // 👈 nhớ await

    const db = createServiceClient(); // service-role, bypass RLS

    const { data, error } = await db
      .from('rubrics')
      .select('id,framework_id,course_code,title,definition,threshold,created_at')
      .eq('id', id)
      .single();

    if (error) {
      // PostgREST not-found
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}
