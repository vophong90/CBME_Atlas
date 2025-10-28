'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

/** ===== Types ===== */
type BaseProfile = {
  user_id: string;
  email: string | null;
  name: string;

  /** Vai trò hiển thị trong app */
  role: 'admin' | 'qa' | 'staff' | 'student' | 'other';

  /** Vai trò lưu trong bảng profiles (nếu có) */
  app_role?: string | null;

  /** Cờ admin theo env or profiles.role */
  is_admin?: boolean;

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
  const supabase = getSupabase();
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<BaseProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string, u?: any) {
    /** 1) Thử lấy staff (join department theo alias FK); fallback departments[] nếu lib trả mảng */
    const staffQ = supabase
      .from('staff')
      .select(
        `
        user_id,
        full_name,
        department_id,
        department:departments!staff_department_id_fkey ( id, name )
      `
      )
      .eq('user_id', uid)
      .maybeSingle();

    /** 2) Lấy student */
    const studentQ = supabase
      .from('students')
      .select('user_id, full_name, mssv')
      .eq('user_id', uid)
      .maybeSingle();

    /** 3) (Tuỳ chọn) Lấy profiles.role nếu bạn có bảng này */
    const profilesQ = supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('id', uid)
      .maybeSingle();

    // chạy song song; nếu bảng profiles không tồn tại, coi như bỏ qua
    const [{ data: stf, error: stfErr }, { data: std }, { data: prof, error: profErr }] =
      await Promise.allSettled([staffQ, studentQ, profilesQ]).then((arr) => {
        // map PromiseSettledResult -> tuple với shape {data, error}
        const norm = (r: any) =>
          r.status === 'fulfilled' ? { data: r.value.data, error: r.value.error } : { data: null, error: r.reason };
        return [norm(arr[0]), norm(arr[1]), norm(arr[2])] as const;
      });

    // Email & tên hiển thị
    const email = u?.email ?? (prof as any)?.email ?? null;
    const appRole = (prof as any)?.role ?? null;

    // Cờ admin theo env hoặc theo profiles.role
    const isAdminEmail = email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;
    const isAdminRole = appRole === 'admin';
    const isAdmin = isAdminEmail || isAdminRole;

    // Ưu tiên tên hiển thị: staff.full_name → student.full_name → profiles.name → user_metadata.name → email
    const displayName =
      (stf as any)?.full_name ||
      (std as any)?.full_name ||
      (prof as any)?.name ||
      u?.user_metadata?.name ||
      email ||
      'Người dùng';

    // ===== Ưu tiên quyết định role theo admin/qa trước, rồi staff, student, other
    let finalRole: BaseProfile['role'] = 'other';
    if (isAdmin) finalRole = 'admin';
    else if (appRole === 'qa') finalRole = 'qa';
    else if (stf) finalRole = 'staff';
    else if (std) finalRole = 'student';

    // Nếu là staff: chuẩn hoá dept
    let dept_id: string | null | undefined = undefined;
    let dept_name: string | null | undefined = undefined;
    if (stf) {
      const deptObj = pickDept((stf as any)?.department ?? (stf as any)?.departments ?? null);
      dept_id = (stf as any)?.department_id ?? deptObj?.id ?? null;
      dept_name = deptObj?.name ?? null;
    }

    // Nếu là student: lấy MSSV
    const mssv: string | null | undefined = std ? (std as any)?.mssv ?? null : undefined;

    // Set profile chuẩn
    setProfile({
      user_id: uid,
      email,
      name: displayName,
      role: finalRole,
      app_role: appRole,
      is_admin: isAdmin,
      dept_id,
      dept_name,
      mssv,
    });
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

      const sub = supabase.auth.onAuthStateChange(async (_event, session) => {
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
    router.push('/'); // hoặc '/login' tuỳ flow của bạn
  };

  const value = useMemo(() => ({ user, profile, loading, signOut }), [user, profile, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
