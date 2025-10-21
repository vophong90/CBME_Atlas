'use client';
import { useEffect, useState } from 'react';
type Dept = { id: string; code: string; name: string; };
type Staff = { user_id: string; full_name: string; email: string; };
export default function AdminOrgPage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    // TODO: fetch depts & staff thật
    setDepts([{ id: 'd1', code: 'YHCT', name: 'Bộ môn Y học cổ truyền' }]);
    setStaff([{ user_id: 'u1', full_name: 'GV Một', email: 'gv1@uni.edu' }]);
  }, []);

  return (
    <div className="space-y-4">
      <header>
        <div className="text-xl font-semibold">Tổ chức nhân sự</div>
        <div className="text-slate-600 text-sm">Tạo bộ môn và gán giảng viên vào bộ môn.</div>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b p-3">
            <div className="font-medium">Bộ môn</div>
            <button className="rounded-xl bg-slate-900 px-3 py-1.5 text-white">+ Thêm</button>
          </div>
          <ul className="divide-y">
            {depts.map(d => (
              <li key={d.id} className={['px-3 py-2 cursor-pointer hover:bg-slate-50', selected===d.id ? 'bg-slate-50' : ''].join(' ')} onClick={() => setSelected(d.id)}>
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-slate-500">{d.code}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b p-3">
            <div className="font-medium">Gán giảng viên vào bộ môn</div>
            <button className="rounded-xl border px-3 py-1.5">Lưu</button>
          </div>
          <div className="p-3">
            {!selected ? (
              <div className="text-slate-500 text-sm">Chọn một Bộ môn ở cột trái.</div>
            ) : (
              <div className="space-y-2">
                {staff.map(s => (
                  <label key={s.user_id} className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" />
                    <span>{s.full_name} <span className="text-slate-500 text-xs">({s.email})</span></span>
                    <span className="ml-auto text-xs text-slate-500">Trưởng BM?</span>
                    <input type="checkbox" className="h-4 w-4" />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
