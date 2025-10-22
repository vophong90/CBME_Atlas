// ================================
// File 1/2: app/api/academic-affairs/upload/route.ts
// ================================
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { parse } from 'csv-parse/sync';

function parseCsv(text: string): string[][] {
  // Robust CSV: hỗ trợ BOM, dấu phẩy trong ô, xuống dòng trong ô, dấu ngoặc kép...
  const rows: string[][] = parse(text, {
    bom: true,
    columns: false,          // không dùng header
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
  });
  return rows.filter((r) => r && r.some((c) => (c ?? '').toString().trim() !== ''));
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const framework_id = (form.get('framework_id') || '').toString().trim();
    const kind = (form.get('kind') || '').toString().trim();
    const file = form.get('file');

    if (!framework_id) {
      return NextResponse.json({ error: 'Thiếu framework_id' }, { status: 400 });
    }
    if (!kind) {
      return NextResponse.json({ error: 'Thiếu kind' }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Thiếu file' }, { status: 400 });
    }

    const text = await (file as any).text();
    const rows = parseCsv(text);
    if (!rows.length) {
      return NextResponse.json({ error: 'CSV rỗng' }, { status: 400 });
    }

    const db = createServiceClient();

    if (kind === 'plo') {
      // 2 cột: code, description
      const payload = rows.map(([code, description]) => ({
        framework_id,
        code,
        description: description ?? null,
      }));
      const { error } = await db.from('plos').insert(payload);
      if (error) throw error;

    } else if (kind === 'pi') {
      // 2 cột: code, description
      const payload = rows.map(([code, description]) => ({
        framework_id,
        code,
        description: description ?? null,
      }));
      const { error } = await db.from('pis').insert(payload);
      if (error) throw error;

    } else if (kind === 'courses') {
      // 2-3 cột: course_code, course_name, [credits]
      const payload = rows.map(([course_code, course_name, credits]) => ({
        framework_id,
        course_code,
        course_name: course_name ?? null,
        credits: (credits !== undefined && credits !== null && String(credits).trim() !== '') ? Number(credits) : null,
      }));
      const { error } = await db.from('courses').insert(payload);
      if (error) throw error;

    } else if (kind === 'plo_pi') {
      // 2 cột: plo_code, pi_code
      const payload = rows.map(([plo_code, pi_code]) => ({
        framework_id,
        plo_code,
        pi_code,
      }));
      const { error } = await db.from('plo_pi_links').insert(payload);
      if (error) throw error;

    } else if (kind === 'plo_clo') {
      // 4 cột: plo_code, course_code, clo_code, level
      const payload = rows.map(([plo_code, course_code, clo_code, level]) => ({
        framework_id,
        plo_code,
        course_code,
        clo_code,
        level: level ?? null,
      }));
      const { error } = await db.from('plo_clo_links').insert(payload);
      if (error) throw error;

    } else if (kind === 'pi_clo') {
      // 4 cột: pi_code, course_code, clo_code, level
      const payload = rows.map(([pi_code, course_code, clo_code, level]) => ({
        framework_id,
        pi_code,
        course_code,
        clo_code,
        level: level ?? null,
      }));
      const { error } = await db.from('pi_clo_links').insert(payload);
      if (error) throw error;

    } else {
      return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload lỗi' }, { status: 400 });
  }
}

