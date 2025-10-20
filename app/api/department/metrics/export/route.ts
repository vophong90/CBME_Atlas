// app/api/department/metrics/export/route.ts
import { supabaseAdmin } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';

/**
 * POST { framework_id, course_code }
 * CSV: MSSV,CourseCode,CLO1,CLO2,... (giá trị: achieved|not_yet)
 */
export async function POST(req: Request) {
  const { framework_id, course_code } = await req.json().catch(() => ({}));
  if (!framework_id || !course_code) {
    return new Response(JSON.stringify({ error: 'Thiếu framework_id hoặc course_code' }), { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('student_clo_results_uploads')
    .select('mssv,course_code,clo_code,status')
    .eq('framework_id', framework_id)
    .eq('course_code', course_code)
    .order('mssv', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  const mssvSet = new Set<string>();
  const cloSet = new Set<string>();
  (data || []).forEach((r: any) => { mssvSet.add(r.mssv); cloSet.add(r.clo_code); });

  const cloList = Array.from(cloSet).sort();
  const header = ['MSSV', 'CourseCode', ...cloList];
  const byKey = new Map<string, string>();
  (data || []).forEach((r: any) => {
    byKey.set(`${r.mssv}::${r.clo_code}`, r.status);
  });

  const lines = [header.join(',')];
  Array.from(mssvSet).sort().forEach(mssv => {
    const row = [mssv, course_code, ...cloList.map(c => byKey.get(`${mssv}::${c}`) || 'not_yet')];
    lines.push(row.map(x => (x.includes(',') ? `"${x.replace(/"/g, '""')}"` : x)).join(','));
  });

  const csv = lines.join('\n');
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="results_${course_code}.csv"`
    }
  });
}
