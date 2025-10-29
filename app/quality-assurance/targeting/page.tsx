'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

type RolePick = 'lecturer' | 'student';
type Person = {
  user_id: string;
  name: string | null;
  email: string | null;
  role: RolePick;
  department_id?: string | null;
  framework_id?: string | null;
  unit_id?: string | null;
};

type SurveyRow = {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  created_at: string;
};

const STATUS_LABELS: Record<SurveyRow['status'], string> = {
  draft: 'Nháp',
  active: 'Đang hoạt động',
  inactive: 'Tạm dừng',
  archived: 'Lưu trữ',
};

export default function TargetingPage() {
  const supabase = getSupabase();
  const searchParams = useSearchParams();
  const preSurveyId = searchParams.get('surveyId') || '';

  const [audience, setAudience] = useState<RolePick>('lecturer');
  const [people, setPeople] = useState<Person[]>([]);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [surveyId, setSurveyId] = useState<string>(preSurveyId);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success'|'error'; text: string } | null>(null);

  // Load surveys list (ưu tiên 'active' lên đầu)
  async function loadSurveys() {
    const { data, error } = await supabase
      .from('surveys')
      .select('id,title,status,created_at')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    setSurveys((data ?? []) as SurveyRow[]);
    if (!preSurveyId && data && data.length) {
      // chọn mặc định survey active đầu tiên nếu có
      const firstActive = (data as SurveyRow[]).find(s => s.status === 'active');
      if (firstActive) setSurveyId(firstActive.id);
    }
  }

  // Load participants từ view qa_participants_view theo audience
  async function loadPeople(role: RolePick) {
    setLoading(true);
    setToast(null);
    try {
      const { data, error } = await supabase
        .from('qa_participants_view')
        .select('user_id,email,name,role,department_id,framework_id,unit_id')
        .eq('role', role)
        .order('name', { ascending: true });
      if (error) throw error;

      const rows = (data ?? []).map((r: any) => ({
        user_id: r.user_id as string,
        name: r.name as string | null,
        email: r.email as string | null,
        role: r.role as RolePick,
        department_id: r.department_id,
        framework_id: r.framework_id,
        unit_id: r.unit_id,
      })) as Person[];

      setPeople(rows);
      // reset chọn
      setSelected({});
      setSelectAll(false);
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không tải được danh sách đối tượng' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSurveys().catch(e => setToast({ type: 'error', text: String(e?.message || e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPeople(audience);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  const filtered = useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return people;
    return people.filter(p =>
      (p.name || '').toLowerCase().includes(v) ||
      (p.email || '').toLowerCase().includes(v)
    );
  }, [people, q]);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  function toggleAll(checked: boolean) {
    setSelectAll(checked);
    if (checked) {
      const next: Record<string, boolean> = {};
      filtered.forEach(p => { next[p.user_id] = true; });
      setSelected(next);
    } else {
      setSelected({});
    }
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected(prev => ({ ...prev, [id]: checked }));
  }

  async function invite() {
    if (!surveyId) {
      setToast({ type: 'error', text: 'Vui lòng chọn Bảng khảo sát' });
      return;
    }
    const ids = Object.entries(selected).filter(([,v]) => v).map(([k]) => k);
    if (ids.length === 0) {
      setToast({ type: 'error', text: 'Chưa chọn người nhận khảo sát' });
      return;
    }

    setInviting(true);
    setToast(null);
    try {
      // Lấy các assignment đã tồn tại để tránh trùng
      const { data: existed, error: e1 } = await supabase
        .from('survey_assignments')
        .select('user_id')
        .eq('survey_id', surveyId);
      if (e1) throw e1;

      const existedSet = new Set<string>((existed ?? []).map((r: any) => r.user_id as string));
      const toAdd = ids.filter(uid => !existedSet.has(uid));

      if (toAdd.length === 0) {
        setToast({ type: 'success', text: 'Tất cả đối tượng đã được mời trước đó' });
        return;
      }

      // Chuẩn bị rows; nếu bảng của bạn yêu cầu cột khác, có thể thêm tại đây (vd status: 'invited')
      const rows = toAdd.map(uid => ({
        survey_id: surveyId,
        user_id: uid,
        role: audience,         // nếu cột role là NOT NULL
        status: 'invited' as any, // nếu bảng có cột status
        invited_by: null as any,  // để DB default auth.uid() (nếu có)
      }));

      // Thử insert “mềm” – chỉ những cột phổ biến. Nếu RLS/NOT NULL khác nhau, bạn có thể gỡ các field dư ra.
      const { error: e2 } = await supabase.from('survey_assignments').insert(rows);
      if (e2) throw e2;

      setToast({ type: 'success', text: `Đã mời ${toAdd.length}/${ids.length} đối tượng` });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Mời khảo sát thất bại' });
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mời tham gia khảo sát</h1>
      </div>

      {/* Bộ lọc */}
      <div className="border rounded-xl p-4 bg-white space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <label className="text-sm">Đối tượng</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={audience}
              onChange={(e) => setAudience(e.target.value as RolePick)}
            >
              <option value="lecturer">Giảng viên</option>
              <option value="student">Sinh viên</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm">Bảng khảo sát</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={surveyId}
              onChange={(e) => setSurveyId(e.target.value)}
            >
              <option value="" disabled>— Chọn —</option>
              {surveys.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} ({STATUS_LABELS[s.status]})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-sm">Tìm theo tên/email</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="gõ để lọc nhanh…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {loading ? 'Đang tải danh sách…' : `Có ${filtered.length} bản ghi`}
            {selectedCount > 0 ? ` • Đã chọn ${selectedCount}` : ''}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              Chọn tất cả (theo danh sách đang lọc)
            </label>
            <button
              onClick={invite}
              disabled={inviting || !surveyId}
              className={`px-3 py-2 rounded text-white ${inviting || !surveyId ? 'bg-gray-400' : 'bg-black'}`}
            >
              {inviting ? 'Đang mời…' : 'Mời khảo sát'}
            </button>
          </div>
        </div>
      </div>

      {/* Bảng đối tượng */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="overflow-auto">
          <table className="min-w-[760px] w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3 w-12">Chọn</th>
                <th className="py-2 pr-3">Họ tên</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3 w-32">Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const checked = !!selected[p.user_id];
                return (
                  <tr key={p.user_id} className="border-b">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleOne(p.user_id, e.target.checked)}
                      />
                    </td>
                    <td className="py-2 pr-3">{p.name || '—'}</td>
                    <td className="py-2 pr-3">{p.email || '—'}</td>
                    <td className="py-2 pr-3">{p.role === 'lecturer' ? 'Giảng viên' : 'Sinh viên'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-sm text-gray-500" colSpan={4}>
                    {loading ? 'Đang tải…' : 'Không có dữ liệu'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div
          className={`p-3 rounded-md ${toast.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
