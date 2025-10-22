// app/api/admin/org/staff/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET ?q=...&sort=full_name.asc|full_name.desc
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const sort = searchParams.get('sort') || 'full_name.asc';

  try {
    let qStaff = supabaseAdmin
      .from('staff')
      .select('user_id,email,full_name,is_active,department_id')
      .order(sort.replace('.asc', '').replace('.desc', ''), {
        ascending: !sort.endsWith('.desc'),
      });

    if (q) {
      qStaff = qStaff.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data: staffRows, error: sErr } = await qStaff;
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

    const depIds = Array.from(
      new Set((staffRows || []).map((s) => s.department_id).filter(Boolean) as string[]),
    );

    let depMap = new Map<string, { code: string; name: string }>();
    if (depIds.length) {
      const { data: deps, error: dErr } = await supabaseAdmin
        .from('departments')
        .select('id,code,name')
        .in('id', depIds);
      if (dErr) return NextResponse.json({ error: dErr.message }, { status: 400 });
      (deps || []).forEach((d: any) => depMap.set(d.id, { code: d.code, name: d.name }));
    }

    const rows = (staffRows || []).map((s: any) => ({
      ...s,
      department_code: s.department_id ? depMap.get(s.department_id!)?.code ?? null : null,
      department_name: s.department_id ? depMap.get(s.department_id!)?.name ?? null : null,
    }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
