export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const sb = createServiceClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();

  let qu = sb
    .from('students') // đổi thành 'student.students' nếu bảng ở schema student
    .select('id, user_id, mssv, full_name')
    .limit(50);

  // Sắp xếp chỉ khi không lọc để tránh tốn chỉ mục
  if (!q) {
    qu = qu.order('full_name', { ascending: true });
  } else {
    qu = qu.or(`mssv.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  const { data, error } = await qu;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    items: (data || []).map((s) => ({
      student_id: s.id,
      user_id: s.user_id,
      label: `${s.mssv || '---'} • ${s.full_name || ''}`.trim(),
      mssv: s.mssv,
      full_name: s.full_name,
    })),
  });
}
