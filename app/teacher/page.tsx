'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function TeacherIndex() {
  const r = useRouter(); const p = usePathname();
  useEffect(()=>{ if (p==='/teacher') r.replace('/teacher/evaluate'); },[p,r]);
  return null;
}
