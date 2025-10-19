// app/api/academic-affairs/students/route.ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

function parseCSV(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(',').map((c) => c.trim()));
}

async function createOneStudent(sb: any, payload: {
  framework_id: string;
  mssv: string;
  full_name: string;
  dob?: string;       // YYYY-MM-DD
  email: string;
  password: string;   // default
}) {
  // 1) Tạo user Auth (admin)
  const { data: userRes, error: authErr } = await sb.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      mssv: payload.mssv,
      full_name: payload.full_name,
      framework_id: payload.framework_id,
      role: 'student',
    },
  });
  if (authErr) throw authErr;

  const user_id = userRes.user?.id || null;

  // 2) Ghi vào bảng students
  const { error: insertErr } = await sb.from('students').insert({
    framework_id: payload.framework_id,
    user_id,
    mssv: payload.mssv,
    full_name: payload.full_name,
    dob: payload.dob || null,
    email: payload.email,
  });
  if (insertErr) throw insertErr;

  return user_id;
}

export async function POST(req: Request) {
  const sb = createServiceClient();
  const contentType = req.headers.get('content-type') || '';

  // JSON => tạo đơn lẻ
  if (contentType.includes('application/json')) {
    const body = await req.json();
    const { framework_id, mssv, full_name, dob, email, password } = body || {};
    if (!framework_id || !mssv || !full_name || !email || !password) {
      return NextResponse.json({ error: 'Thiếu trường bắt buộc' }, { status: 400 });
    }
    try {
      const user_id = await createOneStudent(sb, { framework_id, mssv, full_name, dob, email, password });
      return NextResponse.json({ ok: true, user_id }, { status: 201 });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
  }

  // multipart/form-data => CSV batch
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const framework_id = String(form.get('framework_id') || '');
    const file = form.get('file') as File | null;
    if (!framework_id || !file) {
      return NextResponse.json({ error: 'Thiếu framework_id/file' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) return NextResponse.json({ error: 'CSV rỗng' }, { status: 400 });

    // Header MSSV,Họ tên,Ngày sinh(YYYY-MM-DD),Email,Mật khẩu
    const header = rows[0].map((h) => h.toLowerCase());
    const likelyHasHeader = header.join(' ').includes('mssv') || header.join(' ').includes('email');
    const dataRows = likelyHasHeader ? rows.slice(1) : rows;

    const results: { row: number; ok: boolean; error?: string }[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const [mssv, full_name, dob, email, password] = dataRows[i];
      try {
        await createOneStudent(sb, { framework_id, mssv, full_name, dob, email, password: password || 'Password123!' });
        results.push({ row: i + 1, ok: true });
      } catch (e: any) {
        results.push({ row: i + 1, ok: false, error: String(e?.message || e) });
      }
    }
    return NextResponse.json({ ok: true, results });
  }

  return NextResponse.json({ error: 'Content-Type không hỗ trợ' }, { status: 415 });
}
