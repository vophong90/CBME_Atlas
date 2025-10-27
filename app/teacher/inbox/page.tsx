'use client';

import React, { useEffect, useMemo, useState } from 'react';

type InboxItem = {
  id: number;
  created_at: string;
  status: 'unread' | 'read' | 'archived';
  course_code: string | null;
  clo_ids: string[] | null;
  message: string;
  tags: string[] | null;
  is_flagged: boolean;
};

export default function TeacherInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'unread' | 'read' | 'archived' | ''>('unread');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<InboxItem | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    p.set('limit', '100');
    return p.toString();
  }, [status, q]);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/inbox?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Fetch error');
      setItems(data.items || []);
      setSelected(data.items?.[0] ?? null);
    } catch (e) {
      console.error(e);
      setItems([]); setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchItems(); /* eslint-disable-next-line */ }, [params]);

  async function updateItem(id: number, patch: Partial<Pick<InboxItem,'status'|'tags'|'is_flagged'>>) {
    const res = await fetch(`/api/teacher/inbox/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Update error');
    await fetchItems();
    return data.item as InboxItem;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Hộp thư góp ý (ẩn danh)</h2>
            <div className="text-sm text-slate-500">Các góp ý đã được ẩn danh từ sinh viên</div>
          </div>
          <button onClick={fetchItems} className="rounded-xl px-4 py-2 border border-slate-200 shadow-sm hover:bg-slate-50 font-medium">
            Làm mới
          </button>
        </div>

        {/* Filters (đã bỏ lọc học phần) */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className="rounded-xl border border-slate-300 px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="">Tất cả trạng thái</option>
            <option value="unread">Chưa đọc</option>
            <option value="read">Đã đọc</option>
            <option value="archived">Lưu trữ</option>
          </select>
          <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Tìm kiếm nội dung" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="hidden md:block" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* List */}
        <div className="md:col-span-1 rounded-3xl border border-slate-200 bg-white p-2 max-h-[70vh] overflow-auto shadow-sm">
          {loading && (
            <div className="space-y-2">
              {Array.from({length:6}).map((_,i)=>(
                <div key={i} className="p-3 rounded-xl border border-slate-200 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-20 bg-slate-200 rounded" />
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                  </div>
                  <div className="mt-2 h-4 w-full bg-slate-200 rounded" />
                  <div className="mt-2 h-4 w-1/2 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          )}

          {!loading && items.length === 0 && <div className="p-4 text-sm text-slate-500">Không có góp ý</div>}

          {!loading && !!items.length && (
            <ul className="space-y-2">
              {items.map(it => (
                <li
                  key={it.id}
                  onClick={() => setSelected(it)}
                  className={['p-3 rounded-xl cursor-pointer border border-slate-200 hover:bg-slate-50',
                              selected?.id===it.id?'ring-2 ring-slate-300':''].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border">
                      {it.status}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(it.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-sm line-clamp-2">{it.message}</div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {/* vẫn hiển thị nếu có, nhưng không còn filter theo học phần */}
                    {it.course_code && <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full border">{it.course_code}</span>}
                    {it.clo_ids?.length ? <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full border">CLOs({it.clo_ids.length})</span> : null}
                    {it.is_flagged && <span className="text-xs bg-red-100 px-2 py-0.5 rounded-full border border-red-300">Flagged</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-white p-4 min-h-[40vh] shadow-sm">
          {!selected ? (
            <div className="text-sm text-slate-500">Chọn một góp ý để xem chi tiết</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">{new Date(selected.created_at).toLocaleString()}</div>
                  <h2 className="text-lg font-semibold mt-1">Nội dung góp ý</h2>
                </div>
                <div className="flex gap-2">
                  {selected.status !== 'read' && (
                    <button className="px-3 py-1 rounded-xl border border-slate-200 hover:bg-slate-50" onClick={() => updateItem(selected.id, { status: 'read' })}>
                      Đánh dấu đã đọc
                    </button>
                  )}
                  {selected.status !== 'archived' && (
                    <button className="px-3 py-1 rounded-xl border border-slate-200 hover:bg-slate-50" onClick={() => updateItem(selected.id, { status: 'archived' })}>
                      Lưu trữ
                    </button>
                  )}
                  <button
                    className={['px-3 py-1 rounded-xl border hover:bg-slate-50',
                                selected.is_flagged?'bg-red-50 border-red-300':'' ].join(' ')}
                    onClick={() => updateItem(selected.id, { is_flagged: !selected.is_flagged })}
                  >
                    {selected.is_flagged ? 'Bỏ flag' : 'Gắn flag'}
                  </button>
                </div>
              </div>

              <div className="mt-4 whitespace-pre-wrap leading-relaxed">{selected.message}</div>

              <div className="mt-4 flex gap-2 items-center">
                {selected.course_code && <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full border">{selected.course_code}</span>}
                {selected.clo_ids?.map((c) => (
                  <span key={c} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full border">{c}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
