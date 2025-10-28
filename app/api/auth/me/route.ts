export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseFromRequest } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const sb = getSupabaseFromRequest(req);
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null, roles: [], profile: null });
    }

    // Lấy hồ sơ để biết vai trò chính (role)
    const { data: prof } = await sb
      .from('profiles')
      .select('id, name, role, department_id')
      .eq('id', user.id)
      .maybeSingle();

    // Nếu bạn có bảng/logic roles khác, có thể append thêm vào mảng roles dưới đây
    const roles: string[] = [];
    if (prof?.role) roles.push(String(prof.role)); // ví dụ: 'admin' | 'qa' | 'academic_affairs' | 'secretary' | ...

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: prof?.name || user.user_metadata?.name || null,
      },
      roles,
      profile: { role: prof?.role || null },
    });
  } catch (e: any) {
    return NextResponse.json({ user: null, roles: [], profile: null, error: e?.message || 'error' }, { status: 200 });
  }
}
