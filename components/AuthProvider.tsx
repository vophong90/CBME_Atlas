'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

type Profile =
  | {
      role: 'staff';
      name: string;
      dept_id: string | null;
      dept_name: string | null;
      mssv?: null;
    }
  | {
      role: 'student';
      name: string;
      mssv: string | null;
      dept_id?: null;
      dept_name?: null;
    }
  | {
      role: 'other';
      name: string;
      mssv?: null;
      dept_id?: null;
      dept_name?: null;
    };

type Ctx = {
  user: any | null;
  profile: Profile | null;
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

// Cho phép cả object lẫn array cho department
type DeptObj = { id: string; name: string };
type DeptMaybeArray = DeptObj | DeptObj[] | null | undefined;

type StaffRow = {
  user_id: string;
  full_name?: string | null;
  department_id?: string | null;
  department?: DeptMaybeArray;   // alias theo FK: departments!staff_department_id_fkey
  departments?: DeptMaybeArray;  // fallback nếu supabase trả "departments"
};

type StudentRow = {
  user_id: string;
  full_name?: string | null;
  mssv?: string | null;
};

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  function pickDept(obj: DeptMaybeArray): DeptObj | null {
    if (!obj) return null;
    if (Array.isArray(obj)) return obj[0] ?? null;
    return obj;
  }

  async function loadProfile(uid: string, u?: any) {
    // Lấy staff kèm alias department theo tên FK
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

    const studentQ = supabase
      .from('students')
      .select('user_id, full_name, mssv')
      .eq('user_id', uid)
      .maybeSingle();

    const [{ data: stf }, { data: std }] = await Promise.all([staffQ, studentQ]);

    if (stf) {
      const s = stf as StaffRow;

      // Chuẩn hoá department (ưu tiên alias "department", fallback "departments")
      const deptObj = pickDept(s.department ?? s.departments ?? null);

      const displayName =
        s.full_name || u?.user_metadata?.name || u?.email || 'Người dùng';

      setProfile({
        role: 'staff',
        name: displayName,
        // Ưu tiên cột department_id trong staff; nếu null thì lấy id từ deptObj
        dept_id: s.department_id ?? (deptObj?.id ?? null),
        dept_name: deptObj?.name ?? null,
      });
      return;
    }

    if (std) {
      const d = std as StudentRow;
      const displayName =
        d.full_name || u?.user_metadata?.name || u?.email || 'Sinh viên';

      setProfile({
        role: 'student',
        name: displayName,
        mssv: d.mssv ?? null,
      });
      return;
    }

    // Không khớp staff/student
    setProfile({
      role: 'other',
      name: u?.user_metadata?.name || u?.email || 'Tài khoản',
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
      unsub = sub?.data?.subscription;
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
    router.push('/');
  };

  const value = useMemo(() => ({ user, profile, loading, signOut }), [user, profile, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
