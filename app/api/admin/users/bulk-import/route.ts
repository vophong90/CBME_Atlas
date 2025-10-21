import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Row = {
  email: string;
  full_name: string;
  department_code?: string | null;
  roles?: string | null; // ví dụ: "lecturer;qa"
  password?: string | null; // nếu không cung cấp => random
};

function randomPass(len = 12) {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$_-';
  return Array.from({ length: len }, () => s[Math.floor(Math.random() * s.length)]).join('');
}

export async function POST(req: Request) {
  const rows: Row[] = await req.json();
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const results: any[] = [];

  for (const row of rows) {
    const pass = row.password || randomPass();

    // 1) tạo account auth (nếu chưa tồn tại)
    const { data: createRes, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: row.email,
      password: pass,
      email_confirm: true,
    });
    if (createErr && !createErr.message?.includes('already registered')) {
      results.push({ email: row.email, ok: false, error: createErr.message });
      continue;
    }
    const userId = createRes?.user?.id ?? (async () => {
      // user đã tồn tại -> lấy id
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1, email: row.email });
      return list?.users?.[0]?.id;
    })();

    const uid = await userId;
    if (!uid) {
      results.push({ email: row.email, ok: false, error: 'Cannot resolve user id' });
      continue;
    }

    // 2) upsert staff profile
    await supabaseAdmin.from('staff').upsert({
      user_id: uid,
      email: row.email,
      full_name: row.full_name,
      is_active: true,
    });

    // 3) department nếu có
    let depId: string | null = null;
    if (row.department_code) {
      const { data: dep } = await supabaseAdmin
        .from('departments')
        .select('id')
        .eq('code', row.department_code)
        .maybeSingle();
      if (dep) {
        depId = dep.id;
        await supabaseAdmin
          .from('staff_departments')
          .upsert({ staff_user_id: uid, department_id: depId, is_head: false });
      }
    }

    // 4) gán roles
    if (row.roles) {
      const codes = row.roles.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      if (codes.length) {
        const { data: roleRows } = await supabaseAdmin
          .from('roles')
          .select('id, code')
          .in('code', codes);

        for (const r of roleRows || []) {
          await supabaseAdmin
            .from('user_roles')
            .upsert({ staff_user_id: uid, role_id: r.id, department_id: depId });
        }
      }
    }

    results.push({ email: row.email, ok: true });
  }

  return NextResponse.json({ results });
}
