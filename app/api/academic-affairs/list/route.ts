// app/api/academic-affairs/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // dùng service role để không bị RLS chặn
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id');
    const kind = searchParams.get('kind') || '';
    if (!framework_id) return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });

    const byFw = async (table: string, cols: string, orderCols: string[]) => {
      let q = supabase.from(table).select(cols).eq('framework_id', framework_id);
      for (const col of orderCols) q = q.order(col, { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    };

    let data: any[] = [];
    switch (kind) {
      case 'plo':     data = await byFw('plos',    'code, description',                ['code']); break;
      case 'pi':      data = await byFw('pis',     'code, description',                ['code']); break;
      case 'courses': data = await byFw('courses', 'course_code, course_name, credits',['course_code']); break;
      case 'clos':    data = await byFw('clos',    'course_code, clo_code, clo_text',  ['course_code','clo_code']); break;
      default: return NextResponse.json({ error: `Unknown kind=${kind}` }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error('[LIST] error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
