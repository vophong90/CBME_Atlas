'use client';
import { useEffect, useMemo, useState } from 'react';

type Dept = { id: string; code: string; name: string; is_active: boolean };
type Staff = {
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
};

const BTN_BRAND =
  'px-3 py-1.5 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed';
const BTN_BRAND_OUTLINE =
  'px-3 py-1.5 rounded-lg font-semibold border border-brand-300 text-brand-700 hover:bg-brand-50 disabled:opacity-60';
const BTN_NEUTRAL_OUTLINE =
  'px-3 py-1.5 rounded-lg font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60';
const BTN_DANGER_OUTLINE =
  'px-3 py-1.5 rounded-lg font-semibold border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60';

const INPUT =
  'w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300';
const INPUT_SM =
  'w-full border rounded-lg px-2 py-1 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300';

export default function AdminOrgPage() {
  // ---- data ----
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptQ, setDeptQ] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffQ, setStaffQ] = useState('');
  const [staffSort, setStaffSort] = useState<'full_name.asc' | 'full_name.desc'>('full_name.asc');

  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // ---- dept modal ----
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Dept | null>(null);
  const [deptForm, setDeptForm] = useState<{ code: string; name: string; is_active: boolean }>({
    code: '',
    name: '',
    is_active: true,
  });

  function openCreateDept() {
    setEditingDept(null);
    setDeptForm({ code: '', name: '', is_active: true });
    setShowDeptModal(true);
  }
  function openEditDept(d: Dept) {
    setEditingDept(d);
    setDeptForm({ code: d.code, name: d.name, is_active: d.is_active });
    setShowDeptModal(true);
  }

  async function loadDepts() {
    const url = '/api/admin/org/departments' + (deptQ ? `?q=${encodeURIComponent(deptQ)}` : '');
    const res = await fetch(url, { cache: 'no-store' });
    const js = await res.json();
    if (!res.ok) throw new Error(js?.error || 'Load departments failed');
    setDepts(js.rows || []);
    if (!selectedDeptId && js.rows?.length) setSelectedDeptId(js.rows[0].id);
  }
  async function loadStaff() {
    const params = new URLSearchParams();
    if (staffQ) params.set('q', staffQ);
    if (staffSort) params.set('sort', staffSort);
    const res = await fetch('/api/admin/org/staff?' + params.toString(), { cache: 'no-store' });
    const js = await res.json();
    if (!res.ok) throw new Error(js?.error || 'Load staff failed');
    setStaff(js.rows || []);
  }
  async function refetchAll() {
    try {
      setLoading(true);
      setErr('');
      await Promise.all([loadDepts(), loadStaff()]);
    } catch (e: any) {
      setErr(e?.message || 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refetchAll(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadDepts().catch(err=>setErr(String(err))); /* eslint-disable-next-line */ }, [deptQ]);
  useEffect(() => { loadStaff().catch(err=>setErr(String(err))); /* eslint-disable-next-line */ }, [staffQ, staffSort]);

  // ---- computed ----
  const deptMap = useMemo(() => {
    const m = new Map<string, Dept>();
    depts.forEach(d => m.set(d.id, d));
    return m;
  }, [depts]);

  const selectedDept = selectedDeptId ? deptMap.get(selectedDeptId) || null : null;

  const staffInSelected = useMemo(() => {
    if (!selectedDeptId) return [];
    return staff.filter(s => s.department_id === selectedDeptId);
  }, [staff, selectedDeptId]);

  const staffFiltered = useMemo(() => {
    // bảng toàn bộ nhân sự, vẫn lọc theo staffQ ở API; ở đây chỉ sort lại nếu cần
    const arr = [...staff];
    arr.sort((a,b) => {
      const cmp = a.full_name.localeCompare(b.full_name, 'vi', { sensitivity: 'base' });
      return staffSort === 'full_name.asc' ? cmp : -cmp;
    });
    return arr;
  }, [staff, staffSort]);

  // ---- actions ----
  function toggleSelect(uid: string) {
    setSelectedUserIds(prev => ({ ...prev, [uid]: !prev[uid] }));
  }
  function clearSelection() {
    setSelectedUserIds({});
  }

  async function saveDept() {
    const payload = { ...deptForm };
    const method = editingDept ? 'PUT' : 'POST';
    const body = editingDept ? { id: editingDept.id, ...payload } : payload;
    const res = await fetch('/api/admin/org/departments', { method, body: JSON.stringify(body) });
    const js = await res.json();
    if (!res.ok || !js?.ok) { alert(js?.error || 'Lỗi lưu bộ môn'); return; }
    setShowDeptModal(false);
    await loadDepts();
  }
  async function deleteDept(id: string) {
    if (!confirm('Xoá bộ môn/đơn vị này? Nhân sự sẽ được gỡ khỏi bộ môn.')) return;
    const res = await fetch(`/api/admin/org/departments?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const js = await res.json();
    if (!res.ok || !js?.ok) { alert(js?.error || 'Xoá thất bại'); return; }
    if (selectedDeptId === id) setSelectedDeptId(null);
    await refetchAll();
  }

  async function assignSelected() {
    if (!selectedDeptId) { alert('Chưa chọn Bộ môn/Đơn vị'); return; }
    const user_ids = Object.entries(selectedUserIds).filter(([,v]) => v).map(([k]) => k);
    if (!user_ids.length) { alert('Chưa chọn nhân sự'); return; }
    const res = await fetch('/api/admin/org/assign', {
      method: 'POST',
      body: JSON.stringify({ department_id: selectedDeptId, user_ids })
    });
    const js = await res.json();
    if (!res.ok || !js?.ok) { alert(js?.error || 'Gán thất bại'); return; }
    clearSelection();
    await loadStaff();
  }

  async function unassignUser(uid: string) {
    if (!confirm('Gỡ nhân sự khỏi bộ môn?')) return;
    const res = await fetch('/api/admin/org/unassign', { method: 'POST', body: JSON.stringify({ user_id: uid }) });
    const js = await res.json();
    if (!res.ok || !js?.ok) { alert(js?.error || 'Gỡ thất bại'); return; }
    await loadStaff();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tổ chức nhân sự</h1>
      {!!err && <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 p-3 text-sm">{err}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ==== Cột trái: Bộ môn/Đơn vị ==== */}
        <section className="lg:col-span-1 rounded-xl border bg-white shadow">
          <div className="flex items-center justify-between border-b p-3">
            <div className="font-semibold">Bộ môn / Đơn vị</div>
            <div className="flex gap-2">
              <button onClick={()=>loadDepts()} className={BTN_BRAND_OUTLINE}>Làm mới</button>
              <button onClick={openCreateDept} className={BTN_BRAND}>+ Thêm</button>
            </div>
          </div>
          <div className="p-3">
            <input value={deptQ} onChange={e=>setDeptQ(e.target.value)} placeholder="Tìm mã/tên bộ môn..." className={INPUT} />
          </div>
          <ul className="divide-y">
            {loading ? (
              <li className="px-3 py-3 text-slate-500 text-sm">Đang tải...</li>
            ) : depts.length ? (
              depts.map(d => (
                <li key={d.id} className={`px-3 py-2 ${selectedDeptId===d.id?'bg-slate-50':''}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 cursor-pointer" onClick={()=>setSelectedDeptId(d.id)}>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-slate-500">{d.code} {d.is_active ? '' : '• (ngưng dùng)'}</div>
                    </div>
                    <button className={BTN_NEUTRAL_OUTLINE + ' text-xs'} onClick={()=>openEditDept(d)}>Sửa</button>
                    <button className={BTN_DANGER_OUTLINE + ' text-xs'} onClick={()=>deleteDept(d.id)}>Xoá</button>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-slate-500 text-sm">Chưa có bộ môn</li>
            )}
          </ul>
        </section>

        {/* ==== Cột phải: Gán & Danh sách ==== */}
        <section className="lg:col-span-2 space-y-4">
          {/* Gán nhân sự vào bộ môn */}
          <div className="rounded-xl border bg-white shadow">
            <div className="flex items-center justify-between border-b p-3">
              <div className="font-semibold">
                Gán nhân sự {selectedDept ? `vào: ${selectedDept.name} (${selectedDept.code})` : '(chọn bộ môn ở cột trái)'}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={staffQ}
                  onChange={(e)=>setStaffQ(e.target.value)}
                  placeholder="Tìm theo tên/email..."
                  className={INPUT}
                />
                <select value={staffSort} onChange={e=>setStaffSort(e.target.value as any)}
                        className={INPUT_SM}>
                  <option value="full_name.asc">Tên (A→Z)</option>
                  <option value="full_name.desc">Tên (Z→A)</option>
                </select>
                <button onClick={assignSelected} disabled={!selectedDeptId} className={BTN_BRAND}>
                  Gán vào bộ môn
                </button>
                <button onClick={clearSelection} className={BTN_NEUTRAL_OUTLINE}>Bỏ chọn</button>
              </div>
            </div>

            <div className="p-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2"><input type="checkbox"
                      checked={Object.values(selectedUserIds).length>0 && staffFiltered.every(s=>selectedUserIds[s.user_id])}
                      onChange={e=>{
                        const checked=e.target.checked; const next: Record<string,boolean>={}
                        staffFiltered.forEach(s=>next[s.user_id]=checked);
                        setSelectedUserIds(next);
                      }}/></th>
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Bộ môn hiện tại</th>
                  </tr>
                </thead>
                <tbody>
                  {staffFiltered.map(s=>(
                    <tr key={s.user_id} className="border-t">
                      <td className="px-3 py-2"><input type="checkbox" checked={!!selectedUserIds[s.user_id]} onChange={()=>toggleSelect(s.user_id)} /></td>
                      <td className="px-3 py-2">{s.full_name}</td>
                      <td className="px-3 py-2">{s.email}</td>
                      <td className="px-3 py-2">{s.department_code ? `${s.department_code} – ${s.department_name}` : <span className="text-slate-400">—</span>}</td>
                    </tr>
                  ))}
                  {!staffFiltered.length && (
                    <tr><td className="px-3 py-4 text-slate-500 text-sm" colSpan={4}>Không có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Danh sách thành viên của bộ môn đã chọn */}
          <div className="rounded-xl border bg-white shadow">
            <div className="flex items-center justify-between border-b p-3">
              <div className="font-semibold">
                Thành viên của: {selectedDept ? `${selectedDept.name} (${selectedDept.code})` : '—'}
              </div>
            </div>
            <div className="p-3">
              {!selectedDept ? (
                <div className="text-slate-500 text-sm">Chọn một Bộ môn ở cột trái.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2">Họ tên</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffInSelected.map(s=>(
                        <tr key={s.user_id} className="border-t">
                          <td className="px-3 py-2">{s.full_name}</td>
                          <td className="px-3 py-2">{s.email}</td>
                          <td className="px-3 py-2 text-right">
                            <button className={BTN_DANGER_OUTLINE} onClick={()=>unassignUser(s.user_id)}>Gỡ khỏi bộ môn</button>
                          </td>
                        </tr>
                      ))}
                      {!staffInSelected.length && (
                        <tr><td className="px-3 py-4 text-slate-500 text-sm" colSpan={3}>Chưa có thành viên</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Dept Create/Edit modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-4 shadow space-y-3">
            <div className="text-lg font-semibold">{editingDept ? 'Sửa Bộ môn/Đơn vị' : 'Thêm Bộ môn/Đơn vị'}</div>
            <div>
              <label className="block text-sm font-semibold mb-1">Mã</label>
              <input value={deptForm.code} onChange={e=>setDeptForm(s=>({...s,code:e.target.value}))} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Tên</label>
              <input value={deptForm.name} onChange={e=>setDeptForm(s=>({...s,name:e.target.value}))} className={INPUT} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deptForm.is_active} onChange={e=>setDeptForm(s=>({...s,is_active:e.target.checked}))}/>
              <span>Kích hoạt</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowDeptModal(false)} className={BTN_NEUTRAL_OUTLINE}>Huỷ</button>
              <button onClick={saveDept} className={BTN_BRAND}>{editingDept?'Lưu':'Tạo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
