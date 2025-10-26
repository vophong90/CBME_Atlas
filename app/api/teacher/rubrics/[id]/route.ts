// app/api/teacher/rubrics/[id]/route.ts
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/getSupabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // id là UUID -> KHÔNG ép Number
  const { data, error } = await supabase
    .from('rubrics')
    .select('id,title,framework_id,course_code,definition,threshold')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Map title -> name để khớp UI
  const item = data ? {
    id: data.id,
    name: data.title,
    framework_id: data.framework_id,
    course_code: data.course_code,
    definition: data.definition,
    threshold: data.threshold ?? 70,
  } : null;

  return NextResponse.json({ item });
}
