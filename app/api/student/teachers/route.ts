// app/api/student/teachers/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  // nếu bạn có mapping course_teachers -> lọc theo SV, tạm thời trả all teachers
  const { data, error } = await supabaseAdmin
    .from('teachers')
    .select('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const list = (data || []).map((t: any) => t.full_name).sort();
  return NextResponse.json({ data: list });
}
