'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Ctx = {
  studentId: string;
  fullName?: string;
  mssv?: string;
  loading: boolean;
  error?: string;
};

const StudentCtx = createContext<Ctx | null>(null);

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [st, setSt] = useState<Ctx>({
    studentId: '',
    fullName: undefined,
    mssv: undefined,
    loading: true,
    error: undefined,
  });

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const r = await fetch('/api/student/self', { cache: 'no-store' });
        const js = await r.json();
        if (!r.ok || !js?.data?.id) {
          if (!canceled) setSt((s) => ({ ...s, loading: false, error: js?.error || 'Không tìm thấy thông tin sinh viên' }));
          return;
        }
        const d = js.data as { id: string; full_name?: string; mssv?: string };
        if (!canceled) {
          setSt({
            studentId: d.id,
            fullName: d.full_name || '',
            mssv: d.mssv || '',
            loading: false,
            error: undefined,
          });
        }
      } catch (e: any) {
        if (!canceled) setSt((s) => ({ ...s, loading: false, error: e?.message || 'Lỗi kết nối' }));
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  return <StudentCtx.Provider value={st}>{children}</StudentCtx.Provider>;
}

export function useStudentCtx() {
  const v = useContext(StudentCtx);
  if (!v) throw new Error('useStudentCtx must be used within <StudentProvider>');
  return v;
}
