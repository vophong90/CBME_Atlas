'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
export default function StudentIndex() {
  const r = useRouter(); const p = usePathname();
  useEffect(()=>{ if (p==='/student') r.replace('/student/pi'); },[p,r]);
  return null;
}
