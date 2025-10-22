// app/api/admin/users/delete/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    // TODO: kiểm tra quyền caller là admin (đọc session rồi verify DB)

    // 1) Xoá bản ghi staff (FK user_roles, user_permissions CASCADE)
    const { error: staffErr } = await supabaseAdmin.from('staff').delete().eq('user_id', userId);
    if (staffErr) {
      return NextResponse.json({ error: staffErr.message }, { status: 400 });
    }

    // 2) Xoá user trong Supabase Auth (nếu còn)
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    // Nếu user không tồn tại trong auth thì bỏ qua lỗi soft
    if (authErr && !/not found/i.test(authErr.message)) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
  }
}
