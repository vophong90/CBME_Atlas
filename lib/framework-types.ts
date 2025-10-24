// lib/framework-types.ts
export type Framework = {
  id: string;
  doi_tuong: string;
  chuyen_nganh: string;
  nien_khoa: string;
  created_at: string;
};

export type UploadKind = 'plo' | 'pi' | 'courses' | 'plo_pi' | 'plo_clo' | 'pi_clo';

export const KIND_META: Record<UploadKind, { title: string; helper: string }> = {
  plo:     { title: 'Tải PLO (CSV)',          helper: '2 cột (không header): code,description' },
  pi:      { title: 'Tải PI (CSV)',           helper: '2 cột (không header): code,description' },
  courses: { title: 'Tải Học phần (CSV)',     helper: '2-3 cột (không header): course_code,course_name,[credits]' },
  plo_pi:  { title: 'Liên kết PLO–PI (CSV)',  helper: '2 cột (không header): plo_code,pi_code' },
  plo_clo: { title: 'Liên kết PLO–CLO (CSV)', helper: '4 cột (không header): plo_code,course_code,clo_code,level' },
  pi_clo:  { title: 'Liên kết PI–CLO (CSV)',  helper: '4 cột (không header): pi_code,course_code,clo_code,level' },
};

export type PLO    = { code: string; description?: string | null };
export type PI     = { code: string; description?: string | null };
export type Course = { course_code: string; course_name?: string | null; credits?: number | null };
export type CLO    = { course_code: string; clo_code: string; clo_text?: string | null };

export type GraphData = { nodes: any[]; edges: any[] };
