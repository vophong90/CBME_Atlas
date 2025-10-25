// app/api/academic-affairs/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service Role để ghi DB (server-only)
);

// =======================
// CSV parser (RFC4180-lite)
// - Không cần header
// - Hỗ trợ dấu phẩy trong "..." và xuống dòng trong "..."
//
// Ví dụ ô có dấu phẩy hoặc xuống dòng:
//   HP101,CLO1,"Mô tả có, dấu phẩy
//   và xuống dòng"
// =======================
function parseCSV(text: string): string[][] {
  const s = (text ?? '').replace(/^\uFEFF/, ''); // strip BOM nếu có
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          // escape: "" -> "
          cell += '"';
          i++;
        } else {
          // đóng quote
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
        // bỏ qua CR (CRLF)
      } else if (ch === '\n') {
        row.push(cell.trim());
        cell = '';
        // bỏ dòng rỗng hoàn toàn
        if (row.some((c) => c !== '')) out.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
  }

  // đẩy ô cuối & dòng cuối
  if (inQuotes) {
    // nếu kết thúc khi còn mở quote, vẫn push nốt
    row.push(cell.trim());
  } else if (cell !== '' || row.length) {
    row.push(cell.trim());
  }
  if (row.length && row.some((c) => c !== '')) out.push(row);

  return out;
}

const trim = (s: any) => (typeof s === 'string' ? s.trim() : s ?? '');
const toNumber = (x: any) => {
  if (x == null || x === '') return null;
  const n = Number(String(x).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const framework_id = String(form.get('framework_id') || '');
    const kind = String(form.get('kind') || '');
    const file = form.get('file') as File | null;

    if (!framework_id)
      return NextResponse.json({ error: 'Missing framework_id' }, { status: 400 });
    if (!file)
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    if (!kind)
      return NextResponse.json({ error: 'Missing kind' }, { status: 400 });

    // CSV KHÔNG HEADER
    const rows = parseCSV(await file.text());

    switch (kind) {
      case 'plo': {
        // 2 cột: code, description
        const payload = rows.map((r, i) => {
          const code = trim(r[0]);
          if (!code) throw new Error(`PLO: thiếu code ở dòng ${i + 1}`);
          const description = r[1] ?? null;
          return { framework_id, code, description };
        });

        const { error } = await supabase
          .from('plos')
          .upsert(payload, { onConflict: 'framework_id,code' });
        if (error) throw error;
        return NextResponse.json({ ok: true, inserted: payload.length });
      }

      case 'pi': {
        // 2 cột: code, description
        const payload = rows.map((r, i) => {
          const code = trim(r[0]);
          if (!code) throw new Error(`PI: thiếu code ở dòng ${i + 1}`);
          const description = r[1] ?? null;
          return { framework_id, code, description };
        });

        const { error } = await supabase
          .from('pis')
          .upsert(payload, { onConflict: 'framework_id,code' });
        if (error) throw error;
        return NextResponse.json({ ok: true, inserted: payload.length });
      }

      case 'courses': {
        // 2–3 cột: course_code, course_name, [credits]
        const payload = rows.map((r, i) => {
          const course_code = trim(r[0]);
          if (!course_code)
            throw new Error(`Course: thiếu course_code ở dòng ${i + 1}`);
          const course_name = r[1] ?? null;
          const credits = toNumber(r[2]);
          return { framework_id, course_code, course_name, credits };
        });

        const { error } = await supabase
          .from('courses')
          .upsert(payload, { onConflict: 'framework_id,course_code' });
        if (error) throw error;
        return NextResponse.json({ ok: true, inserted: payload.length });
      }

      case 'clos': {
        // 3 cột: course_code, clo_code, clo_text  (mô tả có thể chứa dấu phẩy/xuống dòng)
        const payload = rows.map((r, i) => {
          const course_code = trim(r[0]);
          const clo_code = trim(r[1]);
          const clo_text = r[2] ?? null;
          if (!course_code || !clo_code)
            throw new Error(`CLO: thiếu dữ liệu ở dòng ${i + 1}`);
          return { framework_id, course_code, clo_code, clo_text };
        });

        const { error } = await supabase
          .from('clos')
          .upsert(payload, { onConflict: 'framework_id,course_code,clo_code' });
        if (error) throw error;
        return NextResponse.json({ ok: true, inserted: payload.length });
      }

      case 'plo_pi': {
        // 2 cột: plo_code, pi_code
        const payload = rows.map((r, i) => {
          const plo_code = trim(r[0]);
          const pi_code = trim(r[1]);
          if (!plo_code || !pi_code)
            throw new Error(`PLO–PI: thiếu dữ liệu ở dòng ${i + 1}`);
          return { framework_id, plo_code, pi_code };
        });

        // Nếu đã có unique constraint, bạn có thể đổi sang upsert:
        // .upsert(payload, { onConflict: 'framework_id,plo_code,pi_code' })
        const { error } = await supabase.from('plo_pi_links').insert(payload);
        if (error) throw error;
        return NextResponse.json({ ok: true, inserted: payload.length });
      }

      case 'plo_clo': {
        // 4 cột: plo_code, course_code, clo_code, level
        const payload = rows.map((r, i) => {
          const plo_code = trim(r[0]);
          const course_code = trim(r[1]);
          const clo_code = trim(r[2]);
          const level = r[3] ?? null;
          if (!plo_code || !course_code || !clo_code)
            throw new Error(`PLO–CLO: thiếu dữ liệu ở dòng ${i + 1}`);
          return { framework_id, plo_code, course_code, clo_code, level };
        });

        // Nếu đã có unique constraint, bạn có thể đổi sang upsert:
        // .upsert(payload, { onConflict: 'framework_id,plo_code,course_code,clo_code' })
        const { error } = await supabase.from('plo_clo_links').insert(payload);
        if (error) throw error;
        return NextResponse.json({ ok: true, inserted: payload.length });
      }

      case 'pi_clo': {
        // 4 cột: pi_code, course_code, clo_code, level
        const payload = rows.map((r, i) => {
          const pi_code = trim(r[0]);
          const course_code = trim(r[1]);
          const clo_code = trim(r[2]);
          const level = r[3] ?? null;
          if (!pi_code || !course_code || !clo_code)
            throw new Error(`PI–CLO: thiếu dữ liệu ở dòng ${i + 1}`);
          return { framework_id, pi_code, course_code, clo_code, level };
        });

        // Nếu đã có unique constraint, bạn có thể đổi sang upsert:
        // .upsert(payload, { onConflict: 'framework_id,pi_code,course_code,clo_code' })
        const { error } = await supabase.from('pi_clo_links').insert(payload);
        if (error) throw error;
        return NextResponse.json({ ok: true, inserted: payload.length });
      }

      default:
        return NextResponse.json(
          { error: `Unsupported kind=${kind}` },
          { status: 400 }
        );
    }
  } catch (e: any) {
    console.error('[UPLOAD] error', e);
    return NextResponse.json(
      { error: e?.message || 'Server error' },
      { status: 500 }
    );
  }
}
