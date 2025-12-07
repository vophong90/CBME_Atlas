// app/api/teacher/students/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = getSupabaseFromRequest();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const framework_id = url.searchParams.get('framework_id') || '';
  const q = (url.searchParams.get('q') || '').trim();

  if (!framework_id) {
    return NextResponse.json({ error: 'framework_id is required' }, { status: 400 });
  }

  let query = supabase
    .from('students')
    .select('id, user_id, mssv, student_code, full_name')
    .eq('framework_id', framework_id)
    .not('user_id', 'is', null)   // chỉ SV đã liên kết user
    .limit(30)
    .order('mssv', { ascending: true });

  if (q) {
    const like = `%${q}%`;
    // tìm trên mssv / student_code / full_name
    query = query.or(`mssv.ilike.${like},student_code.ilike.${like},full_name.ilike.${like}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = (data || []).map((s) => ({
    // Trường MỚI (không phá vỡ tương thích)
    id: s.id,
    student_code: s.student_code,

    // Trường CŨ (giữ nguyên để các trang khác khỏi lỗi)
    user_id: s.user_id,
    mssv: s.mssv,
    full_name: s.full_name,
    label: `${s.mssv ?? s.student_code ?? '—'} — ${s.full_name ?? '—'}`,
  }));

  return NextResponse.json({ items });
}
