// app/api/department/metrics/export/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const db = createServiceClient();
  try {
    const body = await req.json().catch(() => ({}));
    const framework_id = String(body.framework_id || '');
    const course_code  = body.course_code ? String(body.course_code) : '';

    if (!framework_id) {
      return new NextResponse('Missing framework_id', { status: 400 });
    }

    // Lấy uploads
    let q = db
      .from('student_clo_results_uploads')
      .select('mssv, course_code, clo_code, status, updated_at')
      .eq('framework_id', framework_id);
    if (course_code) q = q.eq('course_code', course_code);

    const { data: uploads, error } = await q;
    if (error) throw error;

    // Map tên SV & tên học phần (join mềm)
    const [studentsRes, coursesRes] = await Promise.all([
      db.from('students').select('mssv, full_name').eq('framework_id', framework_id),
      db.from('courses').select('course_code, course_name').eq('framework_id', framework_id),
    ]);

    const nameByMssv = new Map<string, string>();
    (studentsRes.data || []).forEach(s => { if (s.mssv) nameByMssv.set(s.mssv, s.full_name || ''); });

    const courseNameByCode = new Map<string, string>();
    (coursesRes.data || []).forEach(c => courseNameByCode.set(c.course_code, c.course_name || ''));

    const header = ['MSSV', 'Họ tên', 'Mã học phần', 'Tên học phần', 'Mã CLO', 'Kết quả', 'Cập nhật'];
    const lines = [header.join(',')];

    (uploads || []).forEach(r => {
      const row = [
        r.mssv,
        (nameByMssv.get(r.mssv) || '').replace(/,/g, ' '),
        r.course_code,
        (courseNameByCode.get(r.course_code) || '').replace(/,/g, ' '),
        r.clo_code,
        r.status,
        r.updated_at ? new Date(r.updated_at).toISOString() : '',
      ];
      lines.push(row.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));
    });

    const csv = lines.join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="results_${course_code || 'all'}.csv"`,
      },
    });
  } catch (e: any) {
    return new NextResponse(e?.message || 'Export error', { status: 500 });
  }
}
