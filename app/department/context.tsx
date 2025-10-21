'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Framework = { id: string; doi_tuong?: string; chuyen_nganh?: string; nien_khoa?: string; created_at?: string };
export type Course = { code: string; name?: string };

type Ctx = {
  frameworks: Framework[];
  frameworkId: string;
  setFrameworkId: (v: string) => void;

  courses: Course[];
  courseCode: string;
  setCourseCode: (v: string) => void;

  reloadFrameworks: () => Promise<void>;
  reloadCourses: () => Promise<void>;
  formatFw: (f?: Framework) => string;
};

const DepartmentContext = createContext<Ctx | null>(null);

export function useDepartmentCtx() {
  const ctx = useContext(DepartmentContext);
  if (!ctx) throw new Error('useDepartmentCtx must be used inside <DepartmentProvider>');
  return ctx;
}

export function DepartmentProvider({ children }: { children: React.ReactNode }) {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [frameworkId, setFrameworkId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCode, setCourseCode] = useState('');

  const formatFw = (f?: Framework) =>
    f ? [f.doi_tuong, f.chuyen_nganh, f.nien_khoa].filter(Boolean).join(' • ') : '';

  const reloadFrameworks = async () => {
    try {
      const res = await fetch('/api/academic-affairs/framework');
      const js = await res.json();
      setFrameworks(js.data || []);
      if (!frameworkId && js.data?.length) setFrameworkId(js.data[0].id);
    } catch {}
  };

  const reloadCourses = async () => {
    if (!frameworkId) { setCourses([]); setCourseCode(''); return; }
    const res = await fetch(`/api/department/courses?framework_id=${frameworkId}`);
    const js = await res.json();
    if (res.ok) {
      setCourses(js.data || []);
      // nếu courseCode hiện tại không còn trong danh sách mới → reset
      if (!js.data?.some((c: Course) => c.code === courseCode)) {
        setCourseCode(js.data?.[0]?.code || '');
      }
    } else {
      setCourses([]);
    }
  };

  useEffect(() => { reloadFrameworks(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { reloadCourses(); /* eslint-disable-next-line */ }, [frameworkId]);

  const value = useMemo<Ctx>(() => ({
    frameworks, frameworkId, setFrameworkId,
    courses, courseCode, setCourseCode,
    reloadFrameworks, reloadCourses, formatFw
  }), [frameworks, frameworkId, courses, courseCode]);

  return <DepartmentContext.Provider value={value}>{children}</DepartmentContext.Provider>;
}
