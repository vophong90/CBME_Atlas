// app/api/department/results/upload/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * CSV parser (RFC4180-lite)
 * - Hỗ trợ dấu phẩy trong "..."
 * - Hỗ trợ xuống dòng trong "..."
 * - Escape "" -> "
 * - KHÔNG tự động bỏ header: file PHẢI có header ở dòng 1
 */
function parseCSV(text: string): string[][] {
  const s = (text ?? '').replace(/^\uFEFF/, ''); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          cell += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\r') {
        // ignore CR
      } else if (ch === '\n') {
        row.push(cell.trim());
        cell = '';
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
  }
  // push last cell/row
  if (inQuotes) {
    row.push(cell.trim());
  } else if (cell !== '' || row.length) {
    row.push(cell.trim());
  }
  if (row.length && row.some((c) => c !== '')) rows.push(row);

  return rows;
}

function normalizeStr(x: string) {
  return (x || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeResult(input: string): 'achieved' | 'not_yet' {
  const s = normalizeStr(input);
  if (['achieved', 'dat', 'dat.', 'da dat', 'pass', 'passed', '1', 'true'].includes(s)) return 'achieved';
  if (['not_yet', 'khong dat', 'khong dat.', 'chua dat', 'fail', '0', 'false'].includes(s)) return 'not_yet';
  // cho phép tiếng Việt có dấu (đã bị remove ở normalizeStr)
  return s === 'dat' ? 'achieved' : 'not_yet';
}

/**
 * CSV yêu cầu có HEADER. Các cột được chấp nhận (không phân biệt hoa thường, có thể có dấu):
 * - MSSV
 * - Mã học phần | Course | CourseCode
 * - Mã CLO | CLO
 * - Kết quả | Result | Trạng thái | Status (Đạt|Không đạt|achieved|not_yet)
 */
export async function POST(req: Request) {
  const db = createServiceClient();

  try {
    const fd = await req.formData();
    const framework_id = String(fd.get('framework_id') || '');
    const file = fd.get('file') as File | null;

    if (!framework_id || !file) {
      return NextResponse.json({ error: 'Thiếu framework_id hoặc file' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      return NextResponse.json({ error: 'CSV rỗng' }, { status: 400 });
    }

    const headerRaw = rows[0];
    const header = headerRaw.map((h) => normalizeStr(h));

    const findIdx = (alts: string[]) =>
      header.findIndex((h) => alts.some((a) => h.includes(a)));

    const idx = {
      mssv: findIdx(['mssv', 'student', 'student_code']),
      course: findIdx(['ma hoc phan', 'coursecode', 'course']),
      clo: findIdx(['ma clo', 'clo_code', 'clo']),
      result: findIdx(['ket qua', 'result', 'trang thai', 'status']),
    };

    if ([idx.mssv, idx.course, idx.clo, idx.result].some((i) => i < 0)) {
      return NextResponse.json(
        { error: 'CSV thiếu cột bắt buộc: MSSV, Mã học phần, Mã CLO, Kết quả' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const data = rows.slice(1).map((r) => {
      const mssv = r[idx.mssv] ?? '';
      const course_code = r[idx.course] ?? '';
      const clo_code = r[idx.clo] ?? '';
      const resultCell = r[idx.result] ?? '';
      if (!mssv || !course_code || !clo_code) return null;

      return {
        mssv,
        framework_id,
        course_code,
        clo_code,
        status: normalizeResult(resultCell), // 'achieved' | 'not_yet'
        score: null as number | null,
        passed: null as boolean | null,
        updated_at: nowIso,
      };
    }).filter(Boolean) as Array<{
      mssv: string;
      framework_id: string;
      course_code: string;
      clo_code: string;
      status: 'achieved' | 'not_yet';
      score: number | null;
      passed: boolean | null;
      updated_at: string;
    }>;

    if (!data.length) {
      return NextResponse.json({ error: 'Không có dòng dữ liệu hợp lệ' }, { status: 400 });
    }

    const { error } = await db.from('student_clo_results_uploads').insert(data);
    if (error) {
      if ((error as any).code === '42P01') {
        return NextResponse.json(
          { error: 'Bảng student_clo_results_uploads chưa tồn tại trên DB' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: (error as any).message || 'Lỗi ghi DB' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, inserted: data.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload lỗi' }, { status: 500 });
  }
}
