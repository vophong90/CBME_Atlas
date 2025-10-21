// app/api/academic-affairs/students/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

type CreateBody = {
  framework_id?: string;
  mssv?: string;
  full_name?: string;
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const ctype = req.headers.get('content-type') || '';

    if (ctype.includes('application/json')) {
      const body = (await req.json().catch(() => ({}))) as CreateBody;
      return await createOne(body);
    }

    // multipart/form-data (CSV upload)
    const fd = await req.formData();
    const framework_id = String(fd.get('framework_id') || '');
    const file = fd.get('file') as File | null;

    if (!framework_id || !file) {
      return NextResponse.json({ error: 'Thiếu framework/file' }, { status: 400 });
    }

    const text = await file.text();
    // CSV đơn giản: mỗi dòng là 1 bản ghi, phân tách dấu phẩy
    const rows = text
      .replace(/^\uFEFF/, '') // strip BOM nếu có
      .trim()
      .split(/\r?\n/)
      .map((l) => l.split(',').map((c) => c.trim()));

    const header = rows[0] || [];
    // kỳ vọng tối thiểu: MSSV,Họ tên,Email,Mật khẩu (DOB nếu có bạn tự thêm)
    const idx = {
      mssv: header.findIndex((h) => h.toLowerCase().includes('mssv')),
      name: header.findIndex((h) => h.toLowerCase().includes('họ tên') || h.toLowerCase().includes('ho ten') || h.toLowerCase().includes('full')),
      email: header.findIndex((h) => h.toLowerCase().includes('email')),
      pass: header.findIndex((h) => h.toLowerCase().includes('mật khẩu') || h.toLowerCase().includes('mat khau') || h.toLowerCase().includes('password')),
    };

    if (Object.values(idx).some((i) => i < 0)) {
      return NextResponse.json(
        { error: 'Sai tiêu đề CSV. Cần tối thiểu: MSSV,Họ tên,Email,Mật khẩu' },
        { status: 400 }
      );
    }

    const dataRows = rows.slice(1).filter((r) => r.length >= header.length);
    const results: any[] = [];

    for (const r of dataRows) {
      const mssv = r[idx.mssv];
      const full_name = r[idx.name];
      const email = r[idx.email];
      const password = r[idx.pass] || 'Password123!';

      const res = await createOne({ framework_id, mssv, full_name, email, password });
      results.push(await res.json());
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

async function createOne(body: CreateBody) {
  const db = createServiceClient(); // service-role, bypass RLS

  const framework_id = String(body.framework_id || '');
  const mssv = String(body.mssv || '');
  const full_name = String(body.full_name || '');
  const email = String(body.email || '');
  const password = String(body.password || 'Password123!');

  if (!framework_id || !mssv || !full_name || !email) {
    return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
  }

  // 1) Tạo auth user (admin API)
  const { data: auth, error: eAuth } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'student', mssv, full_name, framework_id },
  });
  if (eAuth) {
    return NextResponse.json({ error: eAuth.message }, { status: 400 });
  }

  // 2) Insert vào bảng students (bypass RLS bằng service role)
  const student = {
    user_id: auth.user?.id ?? null,
    student_code: mssv, // chuẩn hoá dùng mssv
    full_name,
    mssv,
    framework_id,
  } as Record<string, any>;

  const { data, error } = await db
    .from('students')
    .insert(student)
    .select('id, user_id, student_code, full_name, mssv, framework_id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, student: data });
}
