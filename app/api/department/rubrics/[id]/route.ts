// app/api/department/rubrics/[id]/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const { data, error } = await supabaseAdmin
    .from('rubrics')
    .select('id,framework_id,course_code,title,definition,threshold,created_at')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
