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
  { prefix: '/teacher',           allowed: ['admin', 'lecturer'] }, // cần đăng nhập
  { prefix: '/student',           allowed: ['admin', 'student'] },  // cần đăng nhập
  // /360-eval mở hoàn toàn -> KHÔNG đưa vào ACCESS
];

const PUBLIC_PATHS = new Set<string>(['/', '/login', '/error', '/360-eval']);

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + '/');
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Static/API bypass
  if (pathname.startsWith('/_next') || pathname.startsWith('/assets') || pathname.startsWith('/favicon') || pathname.startsWith('/api'))
    return NextResponse.next();

  // /360-eval (và mọi route con) là public
  if (pathname === '/360-eval' || pathname.startsWith('/360-eval/')) {
    return NextResponse.next();
  }

  // Trang public khác
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Route có bảo vệ?
  const rule = ACCESS.find(r => matches(pathname, r.prefix));
  if (!rule) return NextResponse.next();

  // Lấy session
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(login);
  }

  if (rule.allowed === 'any-auth') return res;

  // Lấy role codes của user từ user_roles -> roles
  const { data: rows, error } = await supabase
    .from('user_roles')
    .select('roles:role_id ( code )'); // join FK role_id -> roles.id

  // Trong RLS, user chỉ thấy role của chính mình; admin có thể thấy tất
  const codes = (rows || [])
    .map((r: any) => r.roles?.code as string)
    .filter(Boolean);

  // admin => qua hết
  if (codes.includes('admin')) return res;

  // Kiểm tra quyền
  const allowed = codes.some(c => (rule.allowed as RoleCode[]).includes(c));
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
