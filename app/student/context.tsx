'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Ctx = { studentId: string; setStudentId: (v: string) => void };
const StudentCtx = createContext<Ctx | null>(null);

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [studentId, setStudentId] = useState('');
  useEffect(() => {
    try { const s = localStorage.getItem('studentId'); if (s) setStudentId(s); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('studentId', studentId); } catch {}
  }, [studentId]);
  return <StudentCtx.Provider value={{ studentId, setStudentId }}>{children}</StudentCtx.Provider>;
}

export function useStudentCtx() {
  const v = useContext(StudentCtx);
  if (!v) throw new Error('useStudentCtx must be used within <StudentProvider>');
  return v;
}
