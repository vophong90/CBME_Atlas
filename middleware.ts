// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/* ================== Kiểu role & cấu hình route ================== */

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

/* ================== Helper chung ================== */

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

async function getRoleCodes(supabase: any, session: any): Promise<string[]> {
  const metaCodes = readRolesFromSessionMeta(session);
  if (metaCodes.length) return metaCodes;

  // 1) Thử RPC: public.fn_my_role_codes() → text[]
  try {
    const { data, error } = await supabase.rpc('fn_my_role_codes');
    if (!error && Array.isArray(data)) return data as string[];
  } catch {
    // ignore
  }

  // 2) Fallback: user_roles → roles
  try {
    const { data: urs, error: e1 } = await supabase
      .from('user_roles')
      .select('role_id');
    if (e1 || !urs?.length) return metaCodes;

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

/* ================== Tạo Supabase client cho middleware ================== */

function createMiddlewareSupabase(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Lấy cookie
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        // Ghi / cập nhật cookie
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        // Xoá cookie
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
}

/* ================== Middleware chính ================== */

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

  // /360-eval (và route con) là public
  if (pathname === '/360-eval' || pathname.startsWith('/360-eval/')) {
    return NextResponse.next();
  }

  // Trang public khác
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Xem route này có rule không
  const rule = ACCESS.find((r) => matches(pathname, r.prefix));
  if (!rule) return NextResponse.next();

  // Response gốc để Supabase có thể ghi cookie
  const res = NextResponse.next();
  const supabase = createMiddlewareSupabase(req, res);

  // Bắt buộc phải đăng nhập
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(loginUrl);
  }

  // Lấy các role code của user
  const codes = await getRoleCodes(supabase, session);

  // admin → pass hết
  if (codes.includes('admin')) {
    return res;
  }

  // Kiểm tra quyền theo rule
  const allowed = codes.some((c) => rule.allowed.includes(c as RoleCode));
  if (!allowed) {
    const home = new URL('/', req.url);
    home.searchParams.set('denied', '1');
    home.searchParams.set('reason', codes.length ? 'not-allowed' : 'no-roles');
    return NextResponse.redirect(home);
  }

  // OK → cho qua
  return res;
}

export const config = {
  matcher: ['/((?!_next|assets|api|favicon.ico).*)'],
};
