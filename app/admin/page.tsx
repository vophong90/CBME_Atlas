'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
export default function AdminIndex() {
  const r = useRouter(); const p = usePathname();
  useEffect(() => { if (p === '/admin') r.replace('/admin/users'); }, [p, r]);
  return null;
}
