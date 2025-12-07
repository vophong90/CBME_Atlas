// app/api/teacher/rubrics/[id]/route.ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }   // 👈 params là Promise
) {
  const { id } = await ctx.params;           // 👈 lấy id

  // DEV: bypass auth
  const db = createServiceClient();

  const { data, error } = await db
    .from('rubrics')
    .select('id,title,framework_id,course_code,definition,threshold')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const item = data
    ? {
        id: data.id,
        name: data.title,
        definition: data.definition,
        framework_id: data.framework_id,
        course_code: data.course_code,
        threshold: data.threshold,
      }
    : null;

  return NextResponse.json({ item });
}
