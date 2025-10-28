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

const AuthCtx = createContext<Ctx>({ user: null, profile: null, loading: true, signOut: async () => {} });
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    // Ưu tiên staff, nếu không có thì tìm student
    const [{ data: stf }, { data: std }] = await Promise.all([
      supabase
        .from('staff')
        .select('user_id, full_name, department_id, departments ( id, name )')
        .eq('user_id', uid)
        .maybeSingle(),
      supabase.from('students').select('user_id, full_name, mssv').eq('user_id', uid).maybeSingle(),
    ]);

    if (stf) {
      setProfile({
        role: 'staff',
        name: stf.full_name || user?.user_metadata?.name || user?.email || 'Người dùng',
        dept_id: stf.department_id ?? null,
        dept_name: stf.departments?.name ?? null,
      });
      return;
    }
    if (std) {
      setProfile({
        role: 'student',
        name: std.full_name || user?.user_metadata?.name || user?.email || 'Sinh viên',
        mssv: std.mssv ?? null,
      });
      return;
    }
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
    router.push('/'); // tuỳ bạn muốn về trang nào
  };

  const value = useMemo(() => ({ user, profile, loading, signOut }), [user, profile, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
