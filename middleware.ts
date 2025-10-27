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

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function readRolesFromSessionMeta(session: any): string[] {
  const codes: string[] = [];
  const user = session?.user;
  const um = user?.user_metadata ?? {};
  const am = user?.app_metadata ?? {};
  // chấp nhận cả string lẫn array
  const pushMaybe = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) codes.push(...(v as any[]).map(String));
    else codes.push(String(v));
  };
  pushMaybe(um.role);
  pushMaybe(um.roles);
  pushMaybe(am.role);
  pushMaybe(am.roles);
  return unique(codes).filter(Boolean);
}

async function getRoleCodes(
  supabase: ReturnType<typeof createMiddlewareClient>,
  session: any
): Promise<string[]> {
  // 0) Fallback siêu nhanh từ session metadata (nếu có)
  const metaCodes = readRolesFromSessionMeta(session);
  if (metaCodes.length) return metaCodes;

  // 1) Thử RPC: public.fn_my_role_codes() → text[]
  try {
    const { data, error } = await (supabase as any).rpc('fn_my_role_codes');
    if (!error && Array.isArray(data)) return data as string[];
  } catch {
    // ignore & fallback
  }

  // 2) Fallback chắc chắn chạy: lấy role_id từ user_roles → tra roles.id → code
  try {
    const { data: urs, error: e1 } = await supabase
      .from('user_roles')
      .select('role_id');
    if (e1 || !urs?.length) return metaCodes; // vẫn trả về meta nếu có

    const roleIds = urs.map((u: any) => u.role_id).filter(Boolean);
    if (!roleIds.length) return metaCodes;

    const { data: roles, error: e2 } = await supabase
      .from('roles')
      .select('id, code')
      .in('id', roleIds);
    if (e2 || !roles?.length) return metaCodes;

    const dbCodes = roles.map((r: any) => r.code as string).filter(Boolean);
    return unique([...(metaCodes ?? []), ...dbCodes]);
  } catch {
    return metaCodes ?? [];
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

  // Tạo response "gốc" để Supabase có thể refresh cookie
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Bắt buộc phải đăng nhập
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname + (search || ''));

    // chuyển tiếp Set-Cookie từ `res` của Supabase
    const redirect = NextResponse.redirect(loginUrl);
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) redirect.headers.set('set-cookie', setCookie);
    return redirect;
  }

  // Lấy các role code của user hiện tại (meta → RPC → DB)
  const codes = await getRoleCodes(supabase, session);

  // admin → qua tất cả
  if (codes.includes('admin')) return res;

  // Kiểm tra quyền theo rule
  const allowed = codes.some((c) => rule.allowed.includes(c as RoleCode));
  if (!allowed) {
    const home = new URL('/', req.url);
    home.searchParams.set('denied', '1');
    home.searchParams.set('reason', codes.length ? 'not-allowed' : 'no-roles');

    // chuyển tiếp Set-Cookie từ Supabase
    const redirect = NextResponse.redirect(home);
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) redirect.headers.set('set-cookie', setCookie);
    return redirect;
  }

  // Hợp lệ → cho qua và giữ cookie state
  return res;
}

export const config = {
  matcher: ['/((?!_next|assets|api|favicon.ico).*)'],
};
