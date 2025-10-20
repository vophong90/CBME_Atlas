// app/api/student/surveys/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('surveys')
    .select('id, title, issuer, open_at, close_at, link')
    .eq('audience', 'student')
    .order('open_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
