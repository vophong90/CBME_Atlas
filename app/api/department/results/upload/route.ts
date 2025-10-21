// app/api/department/results/upload/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

function parseCsv(text: string): string[][] {
  // Loại BOM, bỏ dòng trống, tách theo dấu phẩy đơn giản
  return text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(',').map((c) => c.trim()))
    .filter((cols) => cols.some((c) => c !== ''));
}

/**
 * CSV expected columns (không phân biệt hoa thường, chấp nhận nhiều cách đặt tên):
 * - MSSV
 * - Mã học phần | Course | CourseCode
 * - Mã CLO | CLO
 * - Trạng thái | Status  (achieved|not_yet)
 * - (Tuỳ chọn) Mã PLO | PLO
 * - (Tuỳ chọn) Level
 */
export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const framework_id = String(fd.get('framework_id') || '');
    const file = fd.get('file') as File | null;

    if (!framework_id || !file) {
      return NextResponse.json({ error: 'Thiếu framework_id hoặc file' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      return NextResponse.json({ error: 'CSV rỗng' }, { status: 400 });
    }

    const header = rows[0].map((h) => h.toLowerCase());
    const find = (alts: string[]) => header.findIndex((h) => alts.some((a) => h.includes(a)));

    const idx = {
      mssv: find(['mssv', 'student']),
      course: find(['mã học phần', 'course', 'coursecode']),
      clo: find(['mã clo', 'clo']),
      status: find(['trạng thái', 'status']),
      // optional
      plo: find(['mã plo', 'plo']),
      level: find(['level', 'mức độ']),
    };

    if ([idx.mssv, idx.course, idx.clo, idx.status].some((i) => i < 0)) {
      return NextResponse.json(
        { error: 'CSV thiếu cột bắt buộc: MSSV, Mã học phần, Mã CLO, Trạng thái' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const data = rows
      .slice(1)
      .filter((r) => r.length >= header.length)
      .map((r) => ({
        mssv: r[idx.mssv],
        framework_id,
        course_code: r[idx.course],
        clo_code: r[idx.clo],
        status: (r[idx.status] || '').toLowerCase() === 'achieved' ? 'achieved' : 'not_yet',
        score: null,
        passed: null,
        updated_at: nowIso,
        // CSV có thể có PLO/LEVEL nhưng bảng uploads hiện không có cột -> bỏ qua
      }));

    if (!data.length) {
      return NextResponse.json({ error: 'Không có dòng dữ liệu hợp lệ' }, { status: 400 });
    }

    const db = createServiceClient(); // service-role, bypass RLS

    const { error } = await db.from('student_clo_results_uploads').insert(data);
    if (error) {
      // Nếu bảng chưa tồn tại
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Bảng student_clo_results_uploads chưa tồn tại trên DB' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, inserted: data.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload lỗi' }, { status: 500 });
  }
}
