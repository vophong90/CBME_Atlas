'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

type Dept = { id: string; name: string | null };
type FW   = { id: string; doi_tuong: string | null; chuyen_nganh: string | null; nien_khoa: string | null };

const STATUS_LABELS: Record<SurveyRow['status'], string> = {
  draft: 'Nháp',
  active: 'Đang hoạt động',
  inactive: 'Tạm dừng',
  archived: 'Lưu trữ',
};

const ALL = '';
const NULL_SENTINEL = '__NULL__';

function shortId(id?: string | null) {
  if (!id) return '';
  return id.slice(0, 4);
}
function fwLabel(fw?: Partial<FW> | null, id?: string | null) {
  if (!fw) return `#${shortId(id)}`;
  const parts = [fw.doi_tuong, fw.chuyen_nganh, fw.nien_khoa].filter(Boolean);
  return parts.length ? parts.join(' – ') : `#${shortId(id)}`;
}

export default function TargetingClient({ preSurveyId }: { preSurveyId?: string }) {
  const [audience, setAudience] = useState<RolePick>('lecturer');

  const [people, setPeople] = useState<Person[]>([]);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [surveyId, setSurveyId] = useState<string>(preSurveyId || '');

  const [departments, setDepartments] = useState<Dept[]>([]);
  const [frameworks, setFrameworks] = useState<FW[]>([]);
  const [depMap, setDepMap] = useState<Record<string, string>>({});
  const [fwMap, setFwMap] = useState<Record<string, string>>({});

  // chỉ 1 bộ lọc hoạt động tùy theo audience
  const [selectedDept, setSelectedDept] = useState<string>(ALL);
  const [selectedFW, setSelectedFW]     = useState<string>(ALL);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success'|'error'; text: string } | null>(null);

  const isLecturer = audience === 'lecturer';
  const isStudent  = audience === 'student';

  // ===== Surveys =====
  async function loadSurveys() {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('surveys')
        .select('id,title,status,created_at')
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as SurveyRow[];
      setSurveys(rows);
      if (!preSurveyId && rows.length) {
        const firstActive = rows.find(s => s.status === 'active');
        if (firstActive) setSurveyId(firstActive.id);
      }
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không tải được danh sách Bảng khảo sát' });
    }
  }

  // ===== People =====
  async function loadPeople(role: RolePick) {
    setLoading(true);
    setToast(null);
    try {
      const supabase = getSupabase();
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
      setSelected({});
      setSelectAll(false);
      // reset đúng bộ lọc hoạt động
      setSelectedDept(ALL);
      setSelectedFW(ALL);
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không tải được danh sách đối tượng' });
    } finally {
      setLoading(false);
    }
  }

  // ===== Labels (Departments/Frameworks) =====
  async function loadDepartments() {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('departments')
        .select('id,name')
        .order('name', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Dept[];
      setDepartments(rows);
      const m: Record<string, string> = {};
      rows.forEach(d => { m[d.id] = d.name || `Bộ môn #${shortId(d.id)}`; });
      setDepMap(m);
    } catch {
      setDepartments([]);
      setDepMap({});
    }
  }
  async function loadFrameworks() {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('curriculum_frameworks')
        .select('id,doi_tuong,chuyen_nganh,nien_khoa')
        .order('nien_khoa', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as FW[];
      setFrameworks(rows);
      const m: Record<string, string> = {};
      rows.forEach(f => { m[f.id] = fwLabel(f, f.id); });
      setFwMap(m);
    } catch {
      setFrameworks([]);
      setFwMap({});
    }
  }

  useEffect(() => {
    loadSurveys();
    loadDepartments();
    loadFrameworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadPeople(audience);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  // ===== Options present in people list (để chỉ show những giá trị đang có) =====
  const deptIdsInPeople = useMemo(() => {
    const s = new Set<string | null>();
    people.forEach(p => s.add(p.department_id ?? null));
    return s;
  }, [people]);
  const fwIdsInPeople = useMemo(() => {
    const s = new Set<string | null>();
    people.forEach(p => s.add(p.framework_id ?? null));
    return s;
  }, [people]);

  const deptOptions = useMemo(() => {
    const ids: (string | null)[] = Array.from(deptIdsInPeople.values());
    const onlyIds = ids.filter((x): x is string => !!x);
    const unique = Array.from(new Set(onlyIds));
    return unique.map(id => ({ id, label: depMap[id] || `Bộ môn #${shortId(id)}` }));
  }, [deptIdsInPeople, depMap]);

  const fwOptions = useMemo(() => {
    const ids: (string | null)[] = Array.from(fwIdsInPeople.values());
    const onlyIds = ids.filter((x): x is string => !!x);
    const unique = Array.from(new Set(onlyIds));
    return unique.map(id => {
      const found = frameworks.find(f => f.id === id);
      return { id, label: found ? fwLabel(found, id) : `Khung #${shortId(id)}` };
    });
  }, [fwIdsInPeople, frameworks]);

  // ===== Filtered list (chỉ áp bộ lọc phù hợp audience) =====
  const filtered = useMemo(() => {
    const v = q.trim().toLowerCase();
    return people.filter(p => {
      if (v) {
        const okText =
          (p.name || '').toLowerCase().includes(v) ||
          (p.email || '').toLowerCase().includes(v);
        if (!okText) return false;
      }
      if (isLecturer) {
        if (selectedDept === NULL_SENTINEL) {
          if (p.department_id !== null && p.department_id !== undefined) return false;
        } else if (selectedDept !== ALL) {
          if (p.department_id !== selectedDept) return false;
        }
      }
      if (isStudent) {
        if (selectedFW === NULL_SENTINEL) {
          if (p.framework_id !== null && p.framework_id !== undefined) return false;
        } else if (selectedFW !== ALL) {
          if (p.framework_id !== selectedFW) return false;
        }
      }
      return true;
    });
  }, [people, q, selectedDept, selectedFW, isLecturer, isStudent]);

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

  // ===== Invite =====
  async function invite() {
    if (!surveyId) {
      setToast({ type: 'error', text: 'Vui lòng chọn Bảng khảo sát' });
      return;
    }
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) {
      setToast({ type: 'error', text: 'Chưa chọn người nhận khảo sát' });
      return;
    }
    setInviting(true);
    setToast(null);
    try {
      const supabase = getSupabase();

      // tránh trùng theo unique (survey_id, assigned_to)
      const { data: existed, error: e1 } = await supabase
        .from('survey_assignments')
        .select('assigned_to')
        .eq('survey_id', surveyId);
      if (e1) throw e1;

      const existing = new Set<string>((existed ?? []).map((r: any) => r.assigned_to as string));
      const toAdd = ids.filter(uid => !existing.has(uid));
      if (toAdd.length === 0) {
        setToast({ type: 'success', text: 'Tất cả đối tượng đã được mời trước đó' });
        return;
      }

      const nowIso = new Date().toISOString();
      const rows = toAdd.map(uid => {
        const p = people.find(x => x.user_id === uid);
        if (isLecturer) {
          return {
            survey_id: surveyId,
            assigned_to: uid,
            role: 'lecturer' as const,
            department: p?.department_id || null, // text: lưu id
            cohort: null as any,
            unit: p?.unit_id || null,
            invited_at: nowIso,
          };
        } else {
          return {
            survey_id: surveyId,
            assigned_to: uid,
            role: 'student' as const,
            department: null as any,
            cohort: p?.framework_id || null,      // text: lưu framework_id
            unit: null as any,
            invited_at: nowIso,
          };
        }
      });

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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mời tham gia khảo sát</h1>
      </div>

      {/* HÀNG 1: chỉ chọn Bảng khảo sát */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
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
        </div>
      </div>

      {/* HÀNG 2: Đối tượng + bộ lọc theo đối tượng + tìm kiếm + chọn tất cả + mời */}
      <div className="border rounded-xl p-4 bg-white space-y-3">
        <div className="grid md:grid-cols-6 gap-3">
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

          {isLecturer && (
            <div className="md:col-span-2">
              <label className="text-sm">Bộ môn</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value={ALL}>— Tất cả —</option>
                {deptIdsInPeople.has(null) && <option value={NULL_SENTINEL}>(Chưa gán)</option>}
                {deptOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {isStudent && (
            <div className="md:col-span-2">
              <label className="text-sm">Khung đào tạo</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedFW}
                onChange={(e) => setSelectedFW(e.target.value)}
              >
                <option value={ALL}>— Tất cả —</option>
                {fwIdsInPeople.has(null) && <option value={NULL_SENTINEL}>(Chưa gán)</option>}
                {fwOptions.map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2">
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

      {/* Table */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3 w-12">Chọn</th>
                <th className="py-2 pr-3">Họ tên</th>
                <th className="py-2 pr-3">Email</th>
                {isLecturer && <th className="py-2 pr-3">Bộ môn</th>}
                {isStudent  && <th className="py-2 pr-3">Khung</th>}
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

                    {isLecturer && (
                      <td className="py-2 pr-3">
                        {p.department_id
                          ? (depMap[p.department_id] || `#${shortId(p.department_id)}`)
                          : <span className="text-gray-500">(Chưa gán)</span>}
                      </td>
                    )}

                    {isStudent && (
                      <td className="py-2 pr-3">
                        {p.framework_id
                          ? (() => {
                              const f = frameworks.find(x => x.id === p.framework_id);
                              return fwLabel(f, p.framework_id);
                            })()
                          : <span className="text-gray-500">(Chưa gán)</span>}
                      </td>
                    )}

                    <td className="py-2 pr-3">{p.role === 'lecturer' ? 'Giảng viên' : 'Sinh viên'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-sm text-gray-500" colSpan={isLecturer ? 6 : 6}>
                    {loading ? 'Đang tải…' : 'Không có dữ liệu'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className={`p-3 rounded-md ${toast.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
