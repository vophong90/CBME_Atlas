import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const dept = searchParams.get('department_id') || ''; // nếu cần lọc theo BM
  const sort = (searchParams.get('sort') || 'full_name.asc').toLowerCase(); // "full_name.asc" | "full_name.desc"
  try {
    let sel = supabaseAdmin.from('staff').select('user_id, email, full_name, is_active, department_id, is_head');

    if (dept) sel = sel.eq('department_id', dept);
    // sort
    if (sort === 'full_name.desc') sel = sel.order('full_name', { ascending: false });
    else sel = sel.order('full_name', { ascending: true });

    const { data, error } = await sel;
    if (error) throw error;
    let rows = data || [];
    if (q) {
      rows = rows.filter((s) => (s.full_name + ' ' + s.email).toLowerCase().includes(q));
    }
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 400 });
  }
}
