// app/api/academic-affairs/students/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

// ===== Types =====
type CreateBody = {
  framework_id?: string;
  mssv?: string;
  full_name?: string;
  email?: string;
  password?: string;
};

type PatchBody = {
  student_id?: string;
  new_password?: string; // optional; if missing, server will generate one
};

type DeleteBody = {
  student_id?: string;
};

// ===== Helpers =====
function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function bad(error: string, code = 400) {
  return NextResponse.json({ error }, { status: code });
}
const trim = (s: any) => (typeof s === 'string' ? s.trim() : s ?? '');

function genStrongPassword(): string {
  // 12–14 chars mix (no external deps)
  const dict = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const len = 12 + Math.floor(Math.random() * 3);
  let out = '';
  for (let i = 0; i < len; i++) out += dict[Math.floor(Math.random() * dict.length)];
  return out;
}

// CSV simple parser (no header for POST CSV in this route)
function parseCSV(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, '') // strip BOM
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(',').map((c) => c.trim()));
}

// =======================================================
// GET /students?framework_id=...&q=...&page=1&limit=20
// =======================================================
export async function GET(req: Request) {
  try {
    const db = createServiceClient();
    const { searchParams } = new URL(req.url);
    const framework_id = String(searchParams.get('framework_id') || '');
    const q = trim(searchParams.get('q') || '');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (!framework_id) return bad('Missing framework_id', 400);

    let query = db
      .from('students')
      .select('id,user_id,student_code,full_name,mssv,framework_id', { count: 'exact' })
      .eq('framework_id', framework_id);

    if (q) {
      const safe = q.replace(/%/g, ''); // avoid wildcards injection
      query = query.or(`mssv.ilike.%${safe}%,full_name.ilike.%${safe}%`);
    }

    query = query.order('full_name', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) return bad(error.message, 400);

    return ok({ data: data ?? [], count: count ?? 0, page, limit });
  } catch (e: any) {
    return bad(e?.message ?? 'Server error', 500);
  }
}

// =======================================================
// PATCH /students  { student_id, new_password? }
// =======================================================
export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const student_id = String(body.student_id || '');
    const new_password = trim(body.new_password || '');

    if (!student_id) return bad('Missing student_id', 400);

    const db = createServiceClient();
    const { data: st, error: e1 } = await db
      .from('students')
      .select('id,user_id,mssv,full_name')
      .eq('id', student_id)
      .single();

    if (e1 || !st) return bad(e1?.message || 'Student not found', 404);
    if (!st.user_id) return bad('Student has no user_id', 400);

    const password = new_password || genStrongPassword();

    const { error: eUpd } = await db.auth.admin.updateUserById(st.user_id, {
      password,
    });
    if (eUpd) return bad(eUpd.message, 400);

    return ok({ ok: true, student_id, password });
  } catch (e: any) {
    return bad(e?.message ?? 'Server error', 500);
  }
}

// =======================================================
// DELETE /students  { student_id }
// =======================================================
export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as DeleteBody;
    const student_id = String(body.student_id || '');
    if (!student_id) return bad('Missing student_id', 400);

    const db = createServiceClient();
    // fetch to get user_id
    const { data: st, error: e1 } = await db
      .from('students')
      .select('id,user_id')
      .eq('id', student_id)
      .single();
    if (e1 || !st) return bad(e1?.message || 'Student not found', 404);

    // delete auth user (ignore if null)
    if (st.user_id) {
      const { error: eDelUser } = await db.auth.admin.deleteUser(st.user_id);
      if (eDelUser) return bad(eDelUser.message, 400);
    }

    // delete row
    const { error: eDelRow } = await db.from('students').delete().eq('id', student_id);
    if (eDelRow) return bad(eDelRow.message, 400);

    return ok({ ok: true, student_id });
  } catch (e: any) {
    return bad(e?.message ?? 'Server error', 500);
  }
}

// =======================================================
// POST /students - create one OR CSV (giữ như bạn đang có)
// - JSON: tạo 1 sinh viên
// - multipart/form-data: CSV (tối thiểu header: MSSV,Họ tên,Email,Mật khẩu)
// =======================================================
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
      return bad('Thiếu framework/file', 400);
    }

    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) return ok({ results: [] });

    const header = rows[0] || [];
    const dataRows = rows.slice(1);

    // kỳ vọng tối thiểu: MSSV,Họ tên,Email,Mật khẩu
    const idx = {
      mssv: header.findIndex((h) => h.toLowerCase().includes('mssv')),
      name: header.findIndex((h) => h.toLowerCase().includes('họ tên') || h.toLowerCase().includes('ho ten') || h.toLowerCase().includes('full')),
      email: header.findIndex((h) => h.toLowerCase().includes('email')),
      pass: header.findIndex((h) => h.toLowerCase().includes('mật khẩu') || h.toLowerCase().includes('mat khau') || h.toLowerCase().includes('password')),
    };

    if (Object.values(idx).some((i) => i < 0)) {
      return bad('Sai tiêu đề CSV. Cần tối thiểu: MSSV,Họ tên,Email,Mật khẩu', 400);
    }

    const results: any[] = [];
    for (const r of dataRows) {
      if (r.length < header.length) continue;
      const mssv = r[idx.mssv];
      const full_name = r[idx.name];
      const email = r[idx.email];
      const password = r[idx.pass] || 'Password123!';

      const res = await createOne({ framework_id, mssv, full_name, email, password });
      results.push(await res.json());
    }

    return ok({ results });
  } catch (e: any) {
    return bad(e?.message ?? 'Server error', 500);
  }
}

// ===== Create-one helper (giữ nguyên logic cũ) =====
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

  // 1) Tạo auth user
  const { data: auth, error: eAuth } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'student', mssv, full_name, framework_id },
  });
  if (eAuth) {
    return NextResponse.json({ error: eAuth.message }, { status: 400 });
  }

  // 2) Insert vào bảng students
  const student = {
    user_id: auth.user?.id ?? null,
    student_code: mssv,
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
