// app/api/academic-affairs/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // dùng service role để không bị RLS chặn
);

export async function GET(req: NextRequest) {
  try {
    // Dùng req.nextUrl để tránh lỗi "Dynamic server usage"
    const { searchParams } = req.nextUrl;
    const framework_id = searchParams.get('framework_id');
    const kind = searchParams.get('kind') || '';

    if (!framework_id) {
      return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });
    }

    // Helper: select theo framework + order theo nhiều cột
    const byFw = async (table: string, cols: string, orderCols: string[]) => {
      let q = supabase.from(table).select(cols).eq('framework_id', framework_id);
      for (const col of orderCols) q = q.order(col, { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    };

    let data: any[] = [];

    switch (kind) {
      case 'plo': {
        // plos(code, description, framework_id)
        data = await byFw('plos', 'code, description', ['code']);
        break;
      }
      case 'pi': {
        // pis(code, description, framework_id)
        data = await byFw('pis', 'code, description', ['code']);
        break;
      }
      case 'courses': {
        // courses(course_code, course_name, credits, framework_id)
        data = await byFw('courses', 'course_code, course_name, credits', ['course_code']);
        break;
      }
      case 'clos': {
        // clos(course_code, clo_code, clo_text, framework_id)
        data = await byFw('clos', 'course_code, clo_code, clo_text', ['course_code', 'clo_code']);
        break;
      }

      // (Tuỳ chọn) mở các case dưới nếu cần list bảng liên kết:
      // case 'plo_clo': {
      //   data = await byFw(
      //     'plo_clo_links',
      //     'plo_code, course_code, clo_code, level',
      //     ['plo_code', 'course_code', 'clo_code']
      //   );
      //   break;
      // }
      // case 'pi_clo': {
      //   data = await byFw(
      //     'pi_clo_links',
      //     'pi_code, course_code, clo_code, level',
      //     ['pi_code', 'course_code', 'clo_code']
      //   );
      //   break;
      // }
      // case 'plo_pi': {
      //   data = await byFw(
      //     'plo_pi_links',
      //     'plo_code, pi_code, level',
      //     ['plo_code', 'pi_code']
      //   );
      //   break;
      // }

      default:
        return NextResponse.json({ error: `Unknown kind=${kind}` }, { status: 400 });
    }

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('[LIST] error', e);
    return NextResponse.json(
      { error: e?.message || 'Server error' },
      { status: 500 }
    );
  }
}
