// components/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

/** ===== Types ===== */
export type BaseProfile = {
  user_id: string;
  email: string | null;
  name: string;

  /** Vai trò hiển thị trong app (quy ước UI) */
  role: 'admin' | 'qa' | 'staff' | 'student' | 'other';

  /** Danh sách role code từ bảng roles (vd: ['admin','qa','viewer']) */
  roles?: string[];

  /** Cờ phân quyền nhanh cho UI */
  is_admin?: boolean;
  is_qa?: boolean;

  /** Thông tin bộ môn (nếu là staff) */
  dept_id?: string | null;
  dept_name?: string | null;

  /** MSSV (nếu là student) */
  mssv?: string | null;
};

type Ctx = {
  user: any | null;
  profile: BaseProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthCtx);

/** ===== Helpers ===== */
type DeptObj = { id: string; name: string };
type DeptMaybeArray = DeptObj | DeptObj[] | null | undefined;

function pickDept(obj: DeptMaybeArray): DeptObj | null {
  if (!obj) return null;
  if (Array.isArray(obj)) return obj[0] ?? null;
  return obj;
}

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase() as any; // ép any để tránh chuỗi lỗi never
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<BaseProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string, u?: any) {
    try {
      // 1) Staff (join department)
      const stfRes = await supabase
        .from('staff')
        .select(
          `
          user_id,
          email,
          full_name,
          department_id,
          department:departments!staff_department_id_fkey ( id, name )
        `
        )
        .eq('user_id', uid)
        .maybeSingle();
      const stf = (stfRes.data as any) || null;

      // 2) Student
      const stdRes = await supabase
        .from('students')
        .select('user_id, full_name, mssv')
        .eq('user_id', uid)
        .maybeSingle();
      const std = (stdRes.data as any) || null;

      // 3) Roles từ user_roles → roles (code)
      const urRes = await supabase
        .from('user_roles')
        .select('role:roles!user_roles_role_id_fkey(code)')
        .eq('staff_user_id', uid);
      const ur = (urRes.data as any[]) || [];

      const roles = ur
        .map((r: any) => r?.role?.code)
        .filter(Boolean) as string[];

      // Email & tên hiển thị
      const email: string | null = u?.email ?? stf?.email ?? null;

      // Cờ theo roles + env
      const isAdminByRole = roles.includes('admin');
      const isQAByRole = roles.includes('qa');
      const isAdminByEmail = email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;
      const isAdmin = isAdminByRole || isAdminByEmail;
      const isQA = isQAByRole;

      // Tên hiển thị: ưu tiên staff → student → user_metadata → email
      const displayName =
        stf?.full_name ??
        std?.full_name ??
        u?.user_metadata?.name ??
        email ??
        'Người dùng';

      // Vai trò UI tổng hợp
      let finalRole: BaseProfile['role'] = 'other';
      if (isAdmin) finalRole = 'admin';
      else if (isQA) finalRole = 'qa';
      else if (stf) finalRole = 'staff';
      else if (std) finalRole = 'student';

      // Dept info nếu là staff
      let dept_id: string | null | undefined = undefined;
      let dept_name: string | null | undefined = undefined;
      if (stf) {
        const deptObj = pickDept(stf.department ?? null);
        dept_id = stf.department_id ?? deptObj?.id ?? null;
        dept_name = deptObj?.name ?? null;
      }

      // MSSV nếu là student
      const mssv: string | null | undefined = std ? std.mssv ?? null : undefined;

      // Set profile chuẩn
      setProfile({
        user_id: uid,
        email,
        name: displayName,
        role: finalRole,
        roles,
        is_admin: isAdmin,
        is_qa: isQA,
        dept_id,
        dept_name,
        mssv,
      });
    } catch (e) {
      // Nếu lỗi, vẫn set profile tối thiểu để tránh kẹt UI
      setProfile({
        user_id: uid,
        email: u?.email ?? null,
        name: u?.user_metadata?.name ?? u?.email ?? 'Người dùng',
        role: 'other',
        roles: [],
        is_admin: false,
        is_qa: false,
      });
    }
  }

  useEffect(() => {
    let unsub: any;
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;
      setUser(u);
      if (u) await loadProfile(u.id, u);
      setLoading(false);

      const sub = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
        const uu = session?.user ?? null;
        setUser(uu);
        if (uu) {
          await loadProfile(uu.id, uu);
        } else {
          setProfile(null);
        }
      });
      unsub = (sub as any)?.data?.subscription;
    })();

    return () => {
      try {
        unsub?.unsubscribe?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    router.push('/'); // hoặc '/login'
  };

  const value = useMemo(
    () => ({ user, profile, loading, signOut }),
    [user, profile, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
