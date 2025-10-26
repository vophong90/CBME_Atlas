// app/api/teacher/student-lookup/route.ts
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/getSupabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const raw = (url.searchParams.get('mssv') || '').trim();
  if (!raw) return NextResponse.json({ error: 'mssv is required' }, { status: 400 });

  // Hỗ trợ tìm partial: nếu người dùng không tự thêm %, ta tự wrap.
  const pattern = raw.includes('%') ? raw : `%${raw}%`;

  const { data, error } = await supabase
    .from('students')
    .select('mssv,user_id,full_name,framework_id')
    .ilike('mssv', pattern)
    .order('mssv', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  // Map thêm 2 field tuỳ chọn (schema hiện không có) để UI không vỡ
  const student = {
    mssv: data.mssv,
    user_id: data.user_id,
    full_name: data.full_name,
    framework_id: data.framework_id,
    cohort: null as string | null,
    class_name: null as string | null,
  };

  return NextResponse.json({ student });
}
