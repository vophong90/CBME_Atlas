// app/api/department/metrics/heatmap/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

type ColKey = { course_code: string; clo_code: string };

export async function POST(req: Request) {
  const db = createServiceClient();
  try {
    const body = await req.json().catch(() => ({}));
    const framework_id: string = body.framework_id || '';
    const course_codes: string[] = Array.isArray(body.course_codes) ? body.course_codes : [];
    const columns: ColKey[] = Array.isArray(body.columns) ? body.columns : [];

    if (!framework_id) return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });

    // Lấy uploads theo framework và (nếu có) danh sách course
    let q = db
      .from('student_clo_results_uploads')
      .select('mssv, course_code, clo_code, status, updated_at')
      .eq('framework_id', framework_id);

    if (course_codes.length) q = q.in('course_code', course_codes);

    const { data: uploads, error } = await q;
    if (error) throw error;

    // Giới hạn theo columns nếu client truyền (nhiều CLO của nhiều học phần)
    const wanted = new Set(columns.map(c => `${c.course_code}|${c.clo_code}`));
    const filtered = columns.length
      ? (uploads || []).filter(r => wanted.has(`${r.course_code}|${r.clo_code}`))
      : (uploads || []);

    // Tập cột (nếu client không truyền, tự suy ra từ data)
    const cols: ColKey[] = columns.length
      ? columns
      : Array.from(new Set(filtered.map(r => `${r.course_code}|${r.clo_code}`)))
          .sort()
          .map(k => ({ course_code: k.split('|')[0]!, clo_code: k.split('|')[1]! }));

    // Tập MSSV
    const mssvSet = Array.from(new Set(filtered.map(r => r.mssv))).sort();

    // Lấy tên SV + tên HP
    const [stuRes, courseRes] = await Promise.all([
      db.from('students').select('mssv, full_name').eq('framework_id', framework_id),
      db.from('courses').select('course_code, course_name').eq('framework_id', framework_id),
    ]);
    const nameByMssv = new Map<string, string>();
    (stuRes.data || []).forEach(s => { if (s.mssv) nameByMssv.set(s.mssv, s.full_name || ''); });
    const courseNameByCode = new Map<string, string>();
    (courseRes.data || []).forEach(c => courseNameByCode.set(c.course_code, c.course_name || ''));

    // Chọn bản ghi mới nhất cho mỗi (mssv, course, clo)
    type Cell = { status: 'achieved'|'not_yet'; updated_at?: string|null };
    const latest = new Map<string, Cell>(); // key: mssv|course|clo
    filtered.forEach(r => {
      const key = `${r.mssv}|${r.course_code}|${r.clo_code}`;
      const cur = latest.get(key);
      if (!cur || (r.updated_at && (!cur.updated_at || r.updated_at > cur.updated_at))) {
        latest.set(key, { status: r.status as any, updated_at: r.updated_at });
      }
    });

    // Matrix value: 1=Đạt, 0=Không đạt, null=chưa có
    const values: Record<string, Record<string, 1|0|null>> = {};
    mssvSet.forEach(ms => {
      values[ms] = {};
      cols.forEach(c => {
        const key = `${ms}|${c.course_code}|${c.clo_code}`;
        const cell = latest.get(key);
        values[ms][`${c.course_code}|${c.clo_code}`] = cell ? (cell.status === 'achieved' ? 1 : 0) : null;
      });
    });

    const rows = mssvSet.map(ms => ({ mssv: ms, full_name: nameByMssv.get(ms) || '' }));
    const outCols = cols.map(c => ({
      key: `${c.course_code}|${c.clo_code}`,
      course_code: c.course_code,
      clo_code: c.clo_code,
      course_name: courseNameByCode.get(c.course_code) || '',
    }));

    return NextResponse.json({
      data: {
        rows,
        cols: outCols,
        values,
        legend: { achieved: 1, not_yet: 0, none: null },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
