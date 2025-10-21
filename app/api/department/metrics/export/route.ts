// app/api/department/metrics/export/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServiceClient } from '@/lib/supabaseServer';

/**
 * POST { framework_id, course_code }
 * Trả CSV: MSSV,CourseCode,CLO1,CLO2,... (giá trị: achieved|not_yet)
 */
export async function POST(req: Request) {
  try {
    const { framework_id, course_code } = (await req.json().catch(() => ({}))) as {
      framework_id?: string;
      course_code?: string;
    };

    if (!framework_id || !course_code) {
      return new Response(JSON.stringify({ error: 'Thiếu framework_id hoặc course_code' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    const db = createServiceClient(); // service-role, bypass RLS

    const { data, error } = await db
      .from('student_clo_results_uploads')
      .select('mssv,course_code,clo_code,status')
      .eq('framework_id', framework_id)
      .eq('course_code', course_code)
      .order('mssv', { ascending: true });

    if (error) {
      // Bảng không tồn tại -> trả CSV rỗng với header tối thiểu
      if (error.code === '42P01') {
        const empty = 'MSSV,CourseCode\n';
        return new Response(empty, {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="results_${course_code}.csv"`,
          },
        });
      }
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    // Gom cột
    const rows = data ?? [];
    const mssvSet = new Set<string>();
    const cloSet = new Set<string>();
    for (const r of rows) {
      if (r?.mssv) mssvSet.add(String(r.mssv));
      if (r?.clo_code) cloSet.add(String(r.clo_code));
    }

    const cloList = Array.from(cloSet).sort();
    const header = ['MSSV', 'CourseCode', ...cloList];

    const byKey = new Map<string, string>();
    for (const r of rows) {
      const key = `${String(r.mssv)}::${String(r.clo_code)}`;
      byKey.set(key, String(r.status ?? 'not_yet'));
    }

    // CSV
    const lines: string[] = [];
    lines.push(header.join(','));

    const mssvList = Array.from(mssvSet).sort();
    for (const mssv of mssvList) {
      const rowVals = [
        mssv,
        String(course_code),
        ...cloList.map((c) => byKey.get(`${mssv}::${c}`) || 'not_yet'),
      ];
      // escape đơn giản với dấu ngoặc kép cho giá trị có dấu phẩy/ngoặc kép
      const safe = rowVals.map((x) =>
        x.includes(',') || x.includes('"') ? `"${x.replace(/"/g, '""')}"` : x
      );
      lines.push(safe.join(','));
    }

    // Nếu không có dòng dữ liệu, vẫn trả header
    if (mssvList.length === 0) {
      // thêm một dòng ví dụ? để trống theo yêu cầu
    }

    const csv = lines.join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="results_${course_code}.csv"`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
