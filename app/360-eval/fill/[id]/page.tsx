'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Rubric = { id: number; name: string; definition: any };
type ItemRow = { id: string; label: string; clo_ids?: string[] };
type Column = { key: string; label: string; score?: number };

export default function Fill360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [request, setRequest] = useState<{ id: number; group_code: string } | null>(null);

  const [items, setItems] = useState<Record<string, { selected_level: string; score?: number; comment?: string }>>({});
  const [overall, setOverall] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/360/form?request_id=${id}`);
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Không lấy được form'); router.push('/360-eval'); return; }
      setRubric(d.rubric);
      setRequest(d.request);
      setLoading(false);
    })();
  }, [id, router]);

  const rows: ItemRow[] = useMemo(() => rubric?.definition?.rows || [], [rubric]);
  const cols: Column[]   = useMemo(() => rubric?.definition?.columns || [], [rubric]);

  function setLevel(rowId: string, key: string) {
    setItems(s => ({ ...s, [rowId]: { ...(s[rowId]||{}), selected_level: key } }));
  }
  function setComment(rowId: string, v: string) {
    setItems(s => ({ ...s, [rowId]: { ...(s[rowId]||{}), comment: v } }));
  }

  async function submit() {
    const payload = {
      request_id: Number(id),
      overall_comment: overall || null,
      items: Object.entries(items).map(([item_key, v]) => ({
        item_key,
        selected_level: v.selected_level,
        score: typeof v.score === 'number' ? v.score : null,
        comment: v.comment || null
      }))
    };
    const r = await fetch('/api/360/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'Gửi thất bại'); return; }
    alert('Đã gửi đánh giá. Cảm ơn bạn!');
    router.push('/360-eval');
  }

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-sm text-gray-500">Đang tải…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Phiếu đánh giá 360°</h1>
      <div className="text-sm text-gray-600">
        {rubric?.name} {request ? `• Nhóm: ${request.group_code}` : ''}
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="border rounded-xl p-3">
            <div className="font-medium">{row.label}</div>
            <div className="mt-2 flex flex-wrap gap-3">
              {cols.map(c => (
                <label key={c.key} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`row_${row.id}`}
                    checked={items[row.id]?.selected_level === c.key}
                    onChange={()=>setLevel(row.id, c.key)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
            <textarea
              placeholder="Nhận xét (lịch sự, xây dựng — bình luận không phù hợp sẽ bị chặn)"
              className="mt-2 w-full border rounded-lg p-2 text-sm"
              value={items[row.id]?.comment || ''}
              onChange={e=>setComment(row.id, e.target.value)}
            />
            {row.clo_ids?.length ? (
              <div className="mt-2 text-xs text-gray-500">Liên quan CLO: {row.clo_ids.join(', ')}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div>
        <textarea
          className="w-full border rounded-lg p-2"
          placeholder="Nhận xét tổng quan (khuyến khích góp ý cụ thể, tích cực)"
          value={overall}
          onChange={e=>setOverall(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button className="px-4 py-2 rounded-lg border bg-gray-100" onClick={submit}>Gửi</button>
      </div>
    </div>
  );
}
