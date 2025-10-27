// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

type Role =
  | 'admin'
  | 'edu_manager'
  | 'dept_lead'
  | 'dept_secretary'
  | 'qa'
  | 'lecturer'
  | 'student'
  | 'external_expert'
  | 'support'
  | 'viewer'
  | string;

const ACCESS_MAP: Array<{ prefix: string; roles: 'any-auth' | Role[] }> = [
  { prefix: '/admin',              roles: ['admin'] },
  { prefix: '/academic-affairs',   roles: ['admin', 'edu_manager', 'dept_lead'] },
  { prefix: '/teacher',            roles: ['admin', 'lecturer'] }, // yêu cầu đăng nhập
  { prefix: '/department',         roles: ['admin', 'dept_secretary', 'dept_lead'] },
  { prefix: '/quality-assurance',  roles: ['admin', 'qa', 'dept_lead'] },
  { prefix: '/student',            roles: ['admin', 'student'] },  // yêu cầu đăng nhập
  // /360-eval bỏ khỏi map để mở hoàn toàn
];

const PUBLIC_PATHS = new Set<string>([
  '/', '/login', '/error',
  '/360-eval',               // mở hoàn toàn
]);

function matchPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + '/');
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  if (
    path.startsWith('/_next') ||
    path.startsWith('/assets') ||
    path.startsWith('/favicon') ||
    path.startsWith('/api')      // API bảo vệ bằng RLS/handler
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(path) || path.startsWith('/360-eval')) {
    // mọi route con của /360-eval cũng public
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const rule = ACCESS_MAP.find(r => matchPrefix(path, r.prefix));
  if (!rule) return res;

  if (!session) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', path + (url.search || ''));
    return NextResponse.redirect(login);
  }

  if (rule.roles === 'any-auth') return res;

  const uid = session.user.id;
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).single();
  const role: Role = (prof?.role as Role) ?? 'viewer';

  if (role === 'admin') return res;

  const allowed = (rule.roles as Role[]).includes(role);
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
