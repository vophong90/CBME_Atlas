export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('staff')
      .select(`
        user_id,
        full_name,
        is_active,
        department_id,
        departments:department_id ( id, name )
      `)
      .eq('is_active', true)
      .order('full_name');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      department_id: r.department_id ?? null,
      department_name: r.departments?.name ?? null,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
