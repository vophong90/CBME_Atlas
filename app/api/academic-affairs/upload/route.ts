// app/api/academic-affairs/upload/route.ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

type Kind = 'plo' | 'pi' | 'plo_pi' | 'plo_clo' | 'pi_clo';

function parseCSV(text: string): string[][] {
  // Parser đơn giản: tách dòng & comma; nếu bạn cần robust, chuyển sang 'csv-parse/sync'
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(',').map((c) => c.trim()));
}

export async function POST(req: Request) {
  const sb = createServiceClient();
  const form = await req.formData();
  const framework_id = String(form.get('framework_id') || '');
  const kind = String(form.get('kind') || '') as Kind;
  const file = form.get('file') as File | null;

  if (!framework_id || !kind || !file) {
    return NextResponse.json({ error: 'Thiếu framework_id/kind/file' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (!rows.length) return NextResponse.json({ error: 'CSV rỗng' }, { status: 400 });

  // Bỏ header nếu có
  const header = rows[0].map((h) => h.toLowerCase());
  let dataRows = rows;
  const likelyHasHeader = header.join(' ').includes('mã') || header.join(' ').includes('code') || header.join(' ').includes('nội dung') || header.join(' ').includes('content');
  if (likelyHasHeader) dataRows = rows.slice(1);

  try {
    if (kind === 'plo') {
      // CSV: Mã PLO, Nội dung PLO
      const payload = dataRows.map(([code, content]) => ({
        framework_id, code, content,
      }));
      const { error } = await sb.from('plos').insert(payload);
      if (error) throw error;
    } else if (kind === 'pi') {
      // CSV: Mã PI, Nội dung PI
      const payload = dataRows.map(([code, content]) => ({
        framework_id, code, content,
      }));
      const { error } = await sb.from('pis').insert(payload);
      if (error) throw error;
    } else if (kind === 'plo_pi') {
      // CSV: Mã PLO, Mã PI
      const payload = dataRows.map(([plo_code, pi_code]) => ({
        framework_id, plo_code, pi_code,
      }));
      const { error } = await sb.from('plo_pi_links').insert(payload);
      if (error) throw error;
    } else if (kind === 'plo_clo') {
      // CSV: Mã PLO, Mã học phần, Mã CLO, Mức độ liên kết PLO-PLO
      const payload = dataRows.map(([plo_code, course_code, clo_code, level]) => ({
        framework_id, plo_code, course_code, clo_code, level,
      }));
      const { error } = await sb.from('plo_clo_links').insert(payload);
      if (error) throw error;
    } else if (kind === 'pi_clo') {
      // CSV: Mã PI, Mã học phần, Mã CLO, Mức độ liên kết PI-CLO
      const payload = dataRows.map(([pi_code, course_code, clo_code, level]) => ({
        framework_id, pi_code, course_code, clo_code, level,
      }));
      const { error } = await sb.from('pi_clo_links').insert(payload);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
