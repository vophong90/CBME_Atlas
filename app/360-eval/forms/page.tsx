// app/360-eval/forms/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

type FormRow = {
  id: string;
  title: string;
  group_code: 'self' | 'peer' | 'faculty' | 'supervisor' | 'patient';
  rubric_id: string;
  framework_id?: string | null;
  course_code?: string | null;
  status: 'active' | 'inactive';
  // server GET có trả updated_at -> để sort nếu có
  updated_at?: string | null;
};

type RubricOpt = { id: string; title: string };

function truthy(x: any) {
  return x === true || x === 'true' || x === 1 || x === '1';
}
function canSeeQA(profile: any): boolean {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'qa') return true;
  const arr = Array.isArray(profile.roles) ? profile.roles : [];
  if (arr.includes('admin') || arr.includes('qa')) return true;
  if (truthy(profile.is_admin) || truthy(profile.is_qa)) return true;
  if (truthy((profile as any).admin) || truthy((profile as any).qa)) return true;
  return false;
}

export default function Eval360FormsPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  const allowed = useMemo(() => canSeeQA(profile), [profile]);

  // List
  const [items, setItems] = useState<FormRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [groupFilter, setGroupFilter] = useState<'all' | FormRow['group_code']>('all');

  // Create/Edit
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState<FormRow['group_code']>('peer');
  const [rubricId, setRubricId] = useState('');
  const [status, setStatus] = useState<FormRow['status']>('active');
  const [rubrics, setRubrics] = useState<RubricOpt[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Redirect nếu không có quyền
  useEffect(() => {
    if (loading) return;
    if (!allowed) router.replace('/360-eval/evaluate');
  }, [loading, allowed, router]);

  // Nạp rubrics cho combobox
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/rubrics/list');
        const d = await r.json();
        setRubrics((d.items || []).map((x: any) => ({ id: x.id, title: String(x.title) })));
      } catch {
        setRubrics([]);
      }
    })();
  }, []);

  async function load() {
    if (!allowed) return;
    setLoadingList(true);
    setErrorMsg('');
    try {
      // helper build params
      const makeParams = (st: 'active' | 'inactive') => {
        const qs = new URLSearchParams();
        qs.set('status', st);
        if (groupFilter !== 'all') qs.set('group_code', groupFilter);
        return qs.toString();
      };

      if (statusFilter === 'all') {
        // gọi cả active + inactive rồi gộp
        const [ra, ri] = await Promise.all([
          fetch(`/api/360/forms?${makeParams('active')}`),
          fetch(`/api/360/forms?${makeParams('inactive')}`),
        ]);
        const [da, di] = await Promise.all([ra.json(), ri.json()]);
        if (!ra.ok) throw new Error(da?.error || 'Không tải được danh sách (active)');
        if (!ri.ok) throw new Error(di?.error || 'Không tải được danh sách (inactive)');

        const merged: FormRow[] = [...(da.items || []), ...(di.items || [])];

        // sort theo updated_at mới nhất nếu có, fallback theo title
        merged.sort((a, b) => {
          const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
          const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
          if (tb !== ta) return tb - ta;
          return String(a.title).localeCompare(String(b.title), 'vi');
        });

        setItems(merged);
      } else {
        const qs = makeParams(statusFilter);
        const r = await fetch(`/api/360/forms?${qs}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Không tải được danh sách biểu mẫu');

        const rows: FormRow[] = d.items || [];
        rows.sort((a, b) => {
          const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
          const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
          if (tb !== ta) return tb - ta;
          return String(a.title).localeCompare(String(b.title), 'vi');
        });
        setItems(rows);
      }
    } catch (e: any) {
      setItems([]);
      setErrorMsg(e?.message || 'Lỗi tải danh sách');
    } finally {
      setLoadingList(false);
    }
  }

  // Lần đầu & khi đổi filter
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, statusFilter, groupFilter]);

  function resetForm() {
    setEditingId(undefined);
    setTitle('');
    setGroup('peer');
    setRubricId('');
    setStatus('active');
    setErrorMsg('');
  }

  async function save() {
    try {
      if (!title.trim() || !rubricId) {
        return setErrorMsg('Thiếu tiêu đề hoặc chưa chọn rubric.');
      }
      setSaving(true);
      setErrorMsg('');

      const r = await fetch('/api/360/forms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          title: title.trim(),
          group_code: group,
          rubric_id: rubricId,
          status,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Lỗi lưu biểu mẫu');

      resetForm();
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Lỗi lưu');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Xoá biểu mẫu này?')) return;
    setErrorMsg('');
    try {
      const r = await fetch(`/api/360/forms?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Lỗi xoá biểu mẫu');
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Lỗi xoá');
    }
  }

  function edit(it: FormRow) {
    setEditingId(it.id);
    setTitle(it.title);
    setGroup(it.group_code);
    setRubricId(it.rubric_id);
    setStatus(it.status);
    setErrorMsg('');
  }

  if (loading) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Đang tải quyền truy cập…</div>;
  }
  if (!allowed) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Bạn không có quyền truy cập.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Create / Edit */}
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 font-semibold">{editingId ? 'Sửa biểu mẫu' : 'Tạo biểu mẫu'}</div>

        {errorMsg && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề biểu mẫu"
            className="rounded-lg border px-3 py-2 text-sm"
          />

          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as FormRow['group_code'])}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="faculty">Giảng viên</option>
            <option value="peer">Sinh viên đánh giá nhau</option>
            <option value="self">Sinh viên tự đánh giá</option>
            <option value="supervisor">Người hướng dẫn</option>
            <option value="patient">Bệnh nhân</option>
          </select>

          <select
            value={rubricId}
            onChange={(e) => setRubricId(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">— Chọn rubric —</option>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FormRow['status'])}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="active">Kích hoạt</option>
            <option value="inactive">Ngừng</option>
          </select>

          <div className="md:col-span-3 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-60"
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="rounded-lg border px-4 py-2">
                Huỷ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List + Filters */}
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <div className="text-sm font-semibold">Danh sách biểu mẫu</div>
            <div className="text-xs text-slate-500">Lọc theo trạng thái và nhóm</div>
          </div>

          <div className="ml-auto grid grid-cols-2 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-lg border px-3 py-2 text-sm"
              title="Trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng</option>
            </select>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-sm"
              title="Nhóm"
            >
              <option value="all">Tất cả nhóm</option>
              <option value="faculty">Giảng viên</option>
              <option value="peer">Sinh viên đánh giá nhau</option>
              <option value="self">Sinh viên tự đánh giá</option>
              <option value="supervisor">Người hướng dẫn</option>
              <option value="patient">Bệnh nhân</option>
            </select>
          </div>
        </div>

        {loadingList ? (
          <div className="text-sm text-slate-500">Đang tải…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-3 py-2 text-left">Tiêu đề</th>
                  <th className="border px-3 py-2">Nhóm</th>
                  <th className="border px-3 py-2">Trạng thái</th>
                  <th className="w-40 border px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="border px-3 py-2">{it.title}</td>
                    <td className="border px-3 py-2 text-center">{it.group_code}</td>
                    <td className="border px-3 py-2 text-center">{it.status}</td>
                    <td className="border px-3 py-2 text-right">
                      <button
                        onClick={() => edit(it)}
                        className="mr-2 rounded border px-2 py-1 hover:bg-slate-50"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => remove(it.id)}
                        className="rounded border px-2 py-1 text-red-600 hover:bg-red-50"
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td className="border px-3 py-4 text-center text-slate-500" colSpan={4}>
                      Chưa có biểu mẫu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
