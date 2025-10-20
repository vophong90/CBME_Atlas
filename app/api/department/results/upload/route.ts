// app/api/department/results/upload/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { parseCsvText } from '@/lib/csv';

export async function POST(req: Request) {
  const fd = await req.formData();
  const framework_id = String(fd.get('framework_id') || '');
  const file = fd.get('file') as File | null;
  if (!framework_id || !file) return NextResponse.json({ error: 'Thiếu framework/file' }, { status: 400 });

  const text = await file.text();
  const rows = parseCsvText(text); // trả về string[][] đã trim
  const header = rows[0] || [];
  // map cột
  const idx = {
    mssv: header.findIndex(h => /mssv/i.test(h)),
    course: header.findIndex(h => /course|mã học phần/i.test(h)),
    clo: header.findIndex(h => /clo/i.test(h)),
    level: header.findIndex(h => /level/i.test(h)),
    status: header.findIndex(h => /status|trạng thái/i.test(h)),
    plo: header.findIndex(h => /plo/i.test(h)), // optional
  };
  if ([idx.mssv, idx.course, idx.clo, idx.level, idx.status].some(i => i < 0)) {
    return NextResponse.json({ error: 'Thiếu cột bắt buộc trong CSV' }, { status: 400 });
  }

  const data = rows.slice(1).filter(r => r.length >= header.length).map(r => ({
    mssv: r[idx.mssv],
    framework_id,
    course_code: r[idx.course],
    clo_code: r[idx.clo],
    status: (r[idx.status] || '').toLowerCase() === 'achieved' ? 'achieved' : 'not_yet',
    score: null,
    passed: null,
    // nếu muốn lưu level số:
    // nb: backend của bạn có cột `level` trong links, còn uploads thì tuỳ — nếu cần, thêm cột level vào uploads.
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from('student_clo_results_uploads').insert(data);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, inserted: data.length });
}
