// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

type RoleCode =
  | 'admin'
  | 'edu_manager'
  | 'dept_lead'
  | 'dept_secretary'
  | 'qa'
  | 'lecturer'
  | 'student'
  | string;

const ACCESS: Array<{ prefix: string; allowed: RoleCode[] | 'any-auth' }> = [
  { prefix: '/admin',             allowed: ['admin'] },
  { prefix: '/academic-affairs',  allowed: ['admin', 'edu_manager', 'dept_lead'] },
  { prefix: '/quality-assurance', allowed: ['admin', 'qa', 'dept_lead'] },
  { prefix: '/department',        allowed: ['admin', 'dept_secretary', 'dept_lead'] },
  { prefix: '/teacher',           allowed: ['admin', 'lecturer'] },
  { prefix: '/student',           allowed: ['admin', 'student'] },
  // /360-eval: mở hoàn toàn (không đưa vào ACCESS)
];

const PUBLIC_PATHS = new Set<string>(['/', '/login', '/error', '/360-eval']);

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + '/');
}

async function getRoleCodes(supabase: ReturnType<typeof createMiddlewareClient>): Promise<string[]> {
  // ƯU TIÊN: gọi RPC nếu đã tạo public.fn_my_role_codes() (security definer)
  //   create or replace function public.fn_my_role_codes() returns text[] ...
  try {
    const { data, error } = await (supabase as any).rpc('fn_my_role_codes');
    if (!error && Array.isArray(data)) return data as string[];
  } catch { /* ignore and fallback */ }

  // FALLBACK: đọc trực tiếp user_roles -> roles (RLS phải cho user xem role của mình)
  try {
    const { data: rows, error } = await supabase
      .from('user_roles')
      .select('role_id, roles:roles ( code )');

    if (!error && rows?.length) {
      return rows
        .map((r: any) => r?.roles?.code as string)
        .filter(Boolean);
    }
  } catch { /* ignore */ }

  // FALLBACK 2: đọc role_id rồi query roles (ít khi cần, nhưng cho chắc)
  try {
    const { data: urs } = await supabase
      .from('user_roles')
      .select('role_id');

    const roleIds = (urs || []).map((u: any) => u.role_id).filter(Boolean);
    if (!roleIds.length) return [];

    const { data: roles } = await supabase
      .from('roles')
      .select('id, code')
      .in('id', roleIds);

    return (roles || []).map((r: any) => r.code as string).filter(Boolean);
  } catch { /* ignore */ }

  return [];
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Bỏ qua static & API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // /360-eval và các route con: mở hoàn toàn
  if (pathname === '/360-eval' || pathname.startsWith('/360-eval/')) {
    return NextResponse.next();
  }

  // Public khác
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Kiểm tra rule cho route
  const rule = ACCESS.find((r) => matches(pathname, r.prefix));
  if (!rule) return NextResponse.next();

  // Chuẩn bị Supabase client (để refresh cookie nếu cần)
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Đòi hỏi đăng nhập cho các route trong ACCESS
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(login);
  }

  if (rule.allowed === 'any-auth') {
    return res;
  }

  // Lấy role-codes của user
  const codes = await getRoleCodes(supabase);

  // admin qua tất cả
  if (codes.includes('admin')) {
    return res;
  }

  // Kiểm tra quyền
  const allowed = codes.some((c) => (rule.allowed as RoleCode[]).includes(c));
  if (!allowed) {
    const home = new URL('/', req.url);
    home.searchParams.set('denied', '1');
    return NextResponse.redirect(home);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next|assets|api|favicon.ico).*)'],
};
