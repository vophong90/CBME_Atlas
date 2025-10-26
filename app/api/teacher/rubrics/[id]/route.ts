// app/api/teacher/rubrics/[id]/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabaseFromRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('rubrics')
    .select('id,title,framework_id,course_code,definition,threshold')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const item = data ? {
    id: data.id,
    name: data.title,
    definition: data.definition,
    framework_id: data.framework_id,
    course_code: data.course_code,
    threshold: data.threshold,
  } : null;

  return NextResponse.json({ item });
}
