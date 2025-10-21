// app/api/academic-affairs/upload/route.ts
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

export async function POST(req: Request) {
  try {
    const db = createServiceClient(); // service-role, bypass RLS

    const fd = await req.formData();
    const framework_id = String(fd.get('framework_id') || '');
    const kind = String(fd.get('kind') || '').trim();
    const file = fd.get('file') as File | null;

    if (!framework_id || !file) {
      return NextResponse.json({ error: 'Thiếu framework_id hoặc file' }, { status: 400 });
    }

    const rows = parseCsv(await file.text());
    if (!rows.length) {
      return NextResponse.json({ error: 'CSV rỗng' }, { status: 400 });
    }

    // Tuỳ loại dữ liệu, map cột -> payload và insert
    if (kind === 'plo') {
      const payload = rows.map(([code, description]) => ({
        framework_id,
        code,
        description: description ?? null,
      }));
      const { error } = await db.from('plos').insert(payload);
      if (error) throw error;

    } else if (kind === 'pi') {
      const payload = rows.map(([code, description]) => ({
        framework_id,
        code,
        description: description ?? null,
      }));
      const { error } = await db.from('pis').insert(payload);
      if (error) throw error;

    } else if (kind === 'plo_pi') {
      const payload = rows.map(([plo_code, pi_code]) => ({
        framework_id,
        plo_code,
        pi_code,
      }));
      const { error } = await db.from('plo_pi_links').insert(payload);
      if (error) throw error;

    } else if (kind === 'plo_clo') {
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
