// app/api/academic-affairs/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const framework_id = searchParams.get('framework_id');
    const kind = searchParams.get('kind') || '';

    if (!framework_id) {
      return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });
    }

    // Helper an toàn: select * from bảng và ép framework_id
    const fetchBy = async (table: string, cols = '*') => {
      const { data, error } = await supabase
        .from(table)
        .select(cols)
        .eq('framework_id', framework_id)
        .order('created_at', { ascending: true }); // nếu có created_at
      if (error) throw error;
      return data ?? [];
    };

    let data: any[] = [];

    switch (kind) {
      case 'plo': {
        // public.plos(code, description, framework_id)
        data = await fetchBy('plos', 'code, description');
        break;
      }
      case 'pi': {
        // public.pis(code, description, framework_id)
        data = await fetchBy('pis', 'code, description');
        break;
      }
      case 'courses': {
        // public.courses(framework_id, course_code, course_name, credits)
        data = await fetchBy('courses', 'course_code, course_name, credits');
        break;
      }
      case 'clos': {
        // public.clos(framework_id, course_code, clo_code, clo_text)
        // Nếu bạn dùng tên bảng khác (vd course_clos), đổi ở đây
        data = await fetchBy('clos', 'course_code, clo_code, clo_text');
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown kind=${kind}` }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error('[LIST] error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
