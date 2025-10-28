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
      dept_id?: null;
      dept_name?: null;
      mssv: string | null;
    }
  | {
      role: 'other';
      name: string;
      dept_id?: null;
      dept_name?: null;
      mssv?: null;
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

type StaffRow = {
  user_id: string;
  full_name?: string | null;
  department_id?: string | null;
  // Có thể nhận về 1 trong 2 dạng dưới đây:
  department?: { id: string; name: string } | null; // khi dùng alias/định danh FK
  departments?: { id: string; name: string }[] | { id: string; name: string } | null; // fallback
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

  async function loadProfile(uid: string) {
    // Join rõ bằng tên FK để nhận về object "department"
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

      // Fallback: nếu vì lý do nào đó vẫn trả "departments"
      const deptRaw = s.department ?? s.departments ?? null;
      const deptObj = Array.isArray(deptRaw) ? deptRaw[0] : (deptRaw as any) ?? null;

      const displayName =
        s.full_name || user?.user_metadata?.name || user?.email || 'Người dùng';

      setProfile({
        role: 'staff',
        name: displayName,
        // Ưu tiên department_id từ staff; nếu null thì lấy từ deptObj.id
        dept_id: s.department_id ?? (deptObj?.id ?? null),
        dept_name: deptObj?.name ?? null,
      });
      return;
    }

    if (std) {
      const d = std as StudentRow;
      const displayName =
        d.full_name || user?.user_metadata?.name || user?.email || 'Sinh viên';

      setProfile({
        role: 'student',
        name: displayName,
        mssv: d.mssv ?? null,
      });
      return;
    }

    // Không phải staff/student
    setProfile({
      role: 'other',
      name: user?.user_metadata?.name || user?.email || 'Tài khoản',
    });
  }

  useEffect(() => {
    let unsub: any;
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;
      setUser(u);
      if (u) await loadProfile(u.id);
      setLoading(false);

      const sub = supabase.auth.onAuthStateChange(async (_event, session) => {
        const uu = session?.user ?? null;
        setUser(uu);
        if (uu) {
          await loadProfile(uu.id);
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
