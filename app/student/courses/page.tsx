// app/student/courses/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { useStudentCtx } from '../context';

type StudentRow = {
  id: string;
  framework_id: string | null;
  full_name: string | null;
  mssv: string | null;
  student_code: string;
  user_id: string | null;
};

type Course = {
  course_code: string;
  course_name: string | null;
  credits: number | null;
};

type CLO = {
  clo_code: string;
  clo_text: string | null;
};

type FrameworkRow = {
  doi_tuong: string | null;
  chuyen_nganh: string | null;
  nien_khoa: string | null;
};

export default function StudentCoursesPage() {
  const supabase = getSupabase();
  const { mssv } = useStudentCtx(); // dùng MSSV nếu user_id chưa map
  const [loading, setLoading] = useState(true);

  const [frameworkId, setFrameworkId] = useState<string | null>(null);
  const [frameworkLabel, setFrameworkLabel] = useState<string>(''); // tên khung hiển thị

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [clos, setClos] = useState<CLO[]>([]);

  const [err, setErr] = useState<string | null>(null);

  // Helper: lấy tên khung từ curriculum_frameworks
  const fetchFrameworkLabel = async (fwId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('curriculum_frameworks')
        .select('doi_tuong, chuyen_nganh, nien_khoa')
        .eq('id', fwId)
        .maybeSingle();

      if (error) throw error;

      if (!data) return '';

      const row = data as FrameworkRow;
      const label = [row.doi_tuong, row.chuyen_nganh, row.nien_khoa]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join(' • ');

      return label;
    } catch {
      return '';
    }
  };

  // 1) Xác định framework của sinh viên
  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id || null;

        let stu: StudentRow | null = null;

        if (uid) {
          const { data, error } = await (supabase as any)
            .from('students')
            .select('id, framework_id, full_name, mssv, student_code, user_id')
            .eq('user_id', uid)
            .maybeSingle();
          if (error) throw error;
          stu = (data ?? null) as StudentRow | null;
        }

        // fallback theo MSSV nếu chưa map user_id
        if (!stu && mssv) {
          const { data, error } = await (supabase as any)
            .from('students')
            .select('id, framework_id, full_name, mssv, student_code, user_id')
            .eq('mssv', mssv)
            .maybeSingle();
          if (error) throw error;
          stu = (data ?? null) as StudentRow | null;
        }

        if (!stu || !stu.framework_id) {
          setFrameworkId(null);
          setFrameworkLabel('');
          setCourses([]);
          setSelectedCourse('');
          setClos([]);
          setErr('Không tìm thấy khung CTĐT của sinh viên. Vui lòng liên hệ bộ phận quản trị.');
        } else {
          setFrameworkId(stu.framework_id);
        }
      } catch (e: any) {
        setErr(e?.message ?? 'Lỗi xác định khung CTĐT.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, mssv]);

  // 1b) Khi có frameworkId => lấy tên khung để hiển thị
  useEffect(() => {
    if (!frameworkId) return;
    (async () => {
      const label = await fetchFrameworkLabel(frameworkId);
      setFrameworkLabel(label || `#${frameworkId.slice(0, 8)}`); // fallback rút gọn id nếu không tìm thấy
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkId]);

  // 2) Tải danh sách học phần theo framework
  useEffect(() => {
    if (!frameworkId) return;
    (async () => {
      setErr(null);
      try {
        const { data, error } = await (supabase as any)
          .from('courses')
          .select('course_code, course_name, credits')
          .eq('framework_id', frameworkId)
          .order('course_code', { ascending: true });

        if (error) throw error;
        setCourses((data ?? []) as Course[]);
      } catch (e: any) {
        setErr(e?.message ?? 'Lỗi tải danh sách học phần.');
      }
    })();
  }, [supabase, frameworkId]);

  // 3) Khi chọn học phần → tải CLO
  useEffect(() => {
    if (!frameworkId || !selectedCourse) {
      setClos([]);
      return;
    }
    (async () => {
      setErr(null);
      try {
        const { data, error } = await (supabase as any)
          .from('clos')
          .select('clo_code, clo_text')
          .eq('framework_id', frameworkId)
          .eq('course_code', selectedCourse)
          .order('clo_code', { ascending: true });

        if (error) throw error;
        setClos((data ?? []) as CLO[]);
      } catch (e: any) {
        setErr(e?.message ?? 'Lỗi tải CLO của học phần.');
      }
    })();
  }, [supabase, frameworkId, selectedCourse]);

  const selectedCourseObj = useMemo(
    () => courses.find((c) => c.course_code === selectedCourse) || null,
    [courses, selectedCourse]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Học phần</h2>
            <p className="text-sm text-slate-600">
              Xem các học phần thuộc khung CTĐT của bạn và toàn bộ CLO của từng học phần.
            </p>
          </div>
          {frameworkId ? (
            <div className="text-xs text-slate-600">
              <span className="mr-1 text-slate-500">Khung CTĐT:</span>
              <span className="font-medium">{frameworkLabel || 'Đang tải...'}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Chọn học phần</label>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              disabled={loading || !frameworkId || courses.length === 0}
            >
              <option value="">{loading ? 'Đang tải...' : '— Chọn học phần —'}</option>
              {courses.map((c) => (
                <option key={c.course_code} value={c.course_code}>
                  {c.course_code} — {c.course_name || 'Không tên'}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Có {courses.length} học phần trong khung.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-700">Thông tin học phần</div>
            {selectedCourseObj ? (
              <div className="mt-2 space-y-1 text-sm">
                <div>
                  <span className="text-slate-500">Mã:</span> {selectedCourseObj.course_code}
                </div>
                <div>
                  <span className="text-slate-500">Tên:</span> {selectedCourseObj.course_name || '—'}
                </div>
                <div>
                  <span className="text-slate-500">Số tín chỉ:</span> {selectedCourseObj.credits ?? '—'}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-500">Chưa chọn học phần.</div>
            )}
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
        ) : null}
      </div>

      {/* CLO list */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Chuẩn đầu ra học phần (CLO)</h3>
        </div>

        {selectedCourse ? (
          clos.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-28 border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                      CLO
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                      Mô tả
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clos.map((r) => (
                    <tr key={r.clo_code} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-800">
                        {r.clo_code}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                        {r.clo_text || <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Chưa có CLO cho học phần này.
            </div>
          )
        ) : (
          <div className="mt-4 text-sm text-slate-600">Vui lòng chọn học phần ở menu phía trên.</div>
        )}
      </div>
    </div>
  );
}
