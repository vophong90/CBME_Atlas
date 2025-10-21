'use client';

import { useMemo, useState } from 'react';
import { useStudentCtx } from '../context';
import { useCachedJson } from '@/lib/useCachedJson';
import { ProgressRow, DetailModal, CourseCLO, Achieve, PI } from '../_shared';

type PIProgressItem = { pi: PI; items: Array<CourseCLO & { status: Achieve }> };

export default function StudentPIPage() {
  const { studentId } = useStudentCtx();
  const url = `/api/student/pi-progress${studentId ? `?student_id=${studentId}` : ''}`;
  const { data, loading, error } = useCachedJson<PIProgressItem[]>(url, 60_000);

  const [piFilter, setPiFilter] = useState<'all'|'achieved'|'not_yet'|'not_learned'>('all');
  const [active, setActive] = useState<PIProgressItem | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const ratioFrom = (items: any[]) => {
      const w=(l:number)=>({1:1,2:2,3:3,4:4}[l]||1);
      const total = items.reduce((s,it)=>s+w(Number(it.level)),0);
      const got = items.filter(it=>it.status==='achieved').reduce((s,it)=>s+w(Number(it.level)),0);
      const pct = total>0? Math.round((got/total)*100):0;
      return { total, got, pct };
    };
    return data.filter(row=>{
      const stat = ratioFrom(row.items);
      if (piFilter==='achieved') return stat.pct===100;
      if (piFilter==='not_yet') return stat.pct>0 && stat.pct<100;
      if (piFilter==='not_learned') return stat.pct===0 && row.items.length>0;
      return true;
    });
  }, [data, piFilter]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Theo dõi tiến độ PI</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm">Lọc:</span>
          <select value={piFilter} onChange={e=>setPiFilter(e.target.value as any)} className="border rounded-md px-2 py-1 text-sm">
            <option value="all">Tất cả</option>
            <option value="achieved">PI đã đạt</option>
            <option value="not_yet">Đang học (chưa đạt 100%)</option>
            <option value="not_learned">Chưa học</option>
          </select>
        </div>
      </div>

      {/* content */}
      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({length:6}).map((_,i)=>(
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
              <div className="flex items-center justify-between"><div className="h-4 w-24 bg-slate-200 rounded" /><div className="h-4 w-16 bg-slate-200 rounded" /></div>
              <div className="mt-2 h-3 w-2/3 bg-slate-200 rounded" />
              <div className="mt-3 h-2.5 bg-slate-200 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <div className="text-sm text-red-600">Lỗi tải dữ liệu: {error}</div>}

      {!loading && !error && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(row=>(
            <ProgressRow key={row.pi.code} code={row.pi.code} title={row.pi.description} items={row.items} onClick={()=>setActive(row)} />
          ))}
          {filtered.length===0 && <div className="text-sm text-slate-500">Không có dữ liệu.</div>}
        </div>
      )}

      <DetailModal kind="PI" open={!!active} onClose={()=>setActive(null)}
                   title={active?.pi.code || ''} desc={active?.pi.description || ''} items={active?.items || []}/>
    </section>
  );
}
