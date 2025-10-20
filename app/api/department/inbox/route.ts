// app/api/department/inbox/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';

/**
 * GET ?course_code=CS101 (có thể nhiều mã, phân tách ',')
 * Trả góp ý từ bảng feedbacks với kind='course' và target in (mã học phần)
 * Optional: ?from=2025-01-01&to=2025-01-31
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cc = (searchParams.get('course_code') || '').trim();
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  if (!cc) return NextResponse.json({ error: 'Thiếu course_code' }, { status: 400 });
  const codes = cc.split(',').map(s => s.trim()).filter(Boolean);

  let q = supabaseAdmin
    .from('feedbacks')
    .select('id,created_at,student_id,target,text')
    .eq('kind', 'course')
    .in('target', codes)
    .order('created_at', { ascending: false });

  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data });
}
