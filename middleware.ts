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

// Route → role được phép
const ACCESS: Array<{ prefix: string; allowed: RoleCode[] }> = [
  { prefix: '/admin',             allowed: ['admin'] },
  { prefix: '/academic-affairs',  allowed: ['admin', 'edu_manager', 'dept_lead'] },
  { prefix: '/quality-assurance', allowed: ['admin', 'qa', 'dept_lead'] },
  { prefix: '/department',        allowed: ['admin', 'dept_secretary', 'dept_lead'] },
  { prefix: '/teacher',           allowed: ['admin', 'lecturer'] },
  { prefix: '/student',           allowed: ['admin', 'student'] },
  // /360-eval mở hoàn toàn → không đưa vào ACCESS
];

// Các đường dẫn public (không yêu cầu đăng nhập)
const PUBLIC_PATHS = new Set<string>(['/', '/login', '/error', '/360-eval']);

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + '/');
}

async function getRoleCodes(
  supabase: ReturnType<typeof createMiddlewareClient>
): Promise<string[]> {
  // 1) Thử RPC nếu có: public.fn_my_role_codes() → text[]
  try {
    // @ts-expect-error rpc có sẵn trên client
    const { data, error } = await supabase.rpc('fn_my_role_codes');
    if (!error && Array.isArray(data)) return data as string[];
  } catch {
    // ignore & fallback
  }

  // 2) Fallback chắc chắn chạy: lấy role_id từ user_roles → tra roles.id → code
  try {
    const { data: urs, error: e1 } = await supabase
      .from('user_roles')
      .select('role_id');
    if (e1 || !urs?.length) return [];

    const roleIds = urs.map((u: any) => u.role_id).filter(Boolean);
    if (!roleIds.length) return [];

    const { data: roles, error: e2 } = await supabase
      .from('roles')
      .select('id, code')
      .in('id', roleIds);
    if (e2 || !roles?.length) return [];

    return roles.map((r: any) => r.code as string).filter(Boolean);
  } catch {
    return [];
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Bỏ qua static & API (API bảo vệ bằng RLS/handler)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // /360-eval (và route con) là public hoàn toàn
  if (pathname === '/360-eval' || pathname.startsWith('/360-eval/')) {
    return NextResponse.next();
  }

  // Trang public khác
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Có rule bảo vệ cho route này không?
  const rule = ACCESS.find((r) => matches(pathname, r.prefix));
  if (!rule) return NextResponse.next();

  // Dùng supabase middleware client để giữ phiên & cookies
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Bắt buộc phải đăng nhập
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(login);
  }

  // Lấy các role code của user hiện tại
  const codes = await getRoleCodes(supabase);

  // admin → qua tất cả
  if (codes.includes('admin')) {
    return res;
  }

  // Kiểm tra quyền theo rule
  const allowed = codes.some((c) => rule.allowed.includes(c as RoleCode));
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
