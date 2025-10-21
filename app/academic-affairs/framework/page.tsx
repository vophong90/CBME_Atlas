'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), { ssr: false });

type Framework = {
  id: string;
  doi_tuong: string;
  chuyen_nganh: string;
  nien_khoa: string;
  created_at: string;
};

type UploadKind = 'plo' | 'pi' | 'plo_pi' | 'plo_clo' | 'pi_clo';
const KIND_META: Record<UploadKind, { title: string; helper: string }> = {
  plo:    { title: 'Tải PLO (CSV)',         helper: '2 cột (không header): code,description' },
  pi:     { title: 'Tải PI (CSV)',          helper: '2 cột (không header): code,description' },
  plo_pi: { title: 'Liên kết PLO–PI (CSV)', helper: '2 cột (không header): plo_code,pi_code' },
  plo_clo:{ title: 'Liên kết PLO–CLO (CSV)',helper: '4 cột (không header): plo_code,course_code,clo_code,level' },
  pi_clo: { title: 'Liên kết PI–CLO (CSV)', helper: '4 cột (không header): pi_code,course_code,clo_code,level' },
};

export default function FrameworkPage() {
  const [loading, setLoading] = useState(false);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });

  const [pickedFiles, setPickedFiles] = useState<Partial<Record<UploadKind, File>>>({});
  const [viewData, setViewData] = useState<{ kind: UploadKind; rows: any[]; count: number } | null>(null);
  const [graph, setGraph] = useState<any | null>(null);

  async function fetchFrameworks() {
    const res = await fetch('/api/academic-affairs/framework');
    const js = await res.json();
    setFrameworks(js.data || []);
    if (!selectedId && js.data?.length) setSelectedId(js.data[0].id);
  }
  useEffect(() => { fetchFrameworks(); /* eslint-disable-next-line */ }, []);

  async function createFramework() {
    setLoading(true);
    try {
      const res = await fetch('/api/academic-affairs/framework', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi tạo khung');
      setForm({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });
      await fetchFrameworks();
    } catch (e: any) {
      alert(e?.message || 'Lỗi tạo khung');
    } finally { setLoading(false); }
  }

  async function deleteFramework() {
    if (!selectedId) return;
    if (!confirm('Xoá khung này? PLO/PI/Liên kết/SV liên quan cũng sẽ xoá.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/academic-affairs/framework?id=${selectedId}`, { method: 'DELETE' });
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || 'Lỗi xoá khung');
      setSelectedId(''); setGraph(null); setViewData(null);
      await fetchFrameworks();
    } catch (e: any) { alert(e?.message || 'Lỗi xoá khung'); }
    finally { setLoading(false); }
  }

  function handlePickFile(kind: UploadKind, file: File | null) {
    if (!file) return;
    setPickedFiles((p) => ({ ...p, [kind]: file }));
  }

  async function doUpload(kind: UploadKind) {
    const file = pickedFiles[kind];
    if (!selectedId || !file) return;
    const fd = new FormData();
    fd.append('framework_id', selectedId);
    fd.append('kind', kind);
    fd.append('file', file);
    const res = await fetch('/api/academic-affairs/upload', { method: 'POST', body: fd });
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Upload lỗi'); }
    else {
      alert('Tải lên thành công!');
      if (kind === 'plo_pi' || kind === 'plo_clo' || kind === 'pi_clo') await loadGraph();
    }
  }

  async function fetchExisting(kind: UploadKind) {
    if (!selectedId) return;
    const res = await fetch(`/api/academic-affairs/list?framework_id=${selectedId}&kind=${kind}`);
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Lỗi tải dữ liệu'); return; }
    setViewData({ kind, rows: js.data || [], count: js.count || 0 });
  }

  async function loadGraph() {
    if (!selectedId) return;
    const res = await fetch(`/api/academic-affairs/graph?framework_id=${selectedId}`);
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Lỗi tải graph'); return; }
    setGraph(js.elements);
  }
  useEffect(() => { if (selectedId) loadGraph(); /* eslint-disable-next-line */ }, [selectedId]);

  const selected = useMemo(() =>
    frameworks.find((f) => f.id === selectedId), [frameworks, selectedId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Khung CTĐT & Ma trận</h1>

      <section className="rounded-xl border bg-white p-5 shadow space-y-6">
        {/* Chọn/Tạo/Xoá khung */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-1">Khung chương trình hiện hành</label>
            <select
              className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— Chưa chọn —</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.doi_tuong} • {f.chuyen_nganh} • {f.nien_khoa}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-slate-600 mt-1">Tạo lúc: {new Date(selected.created_at).toLocaleString()}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={deleteFramework}
              disabled={!selectedId || loading}
              className={
                !selectedId || loading
                  ? 'px-4 py-2 rounded-lg border text-gray-400 bg-gray-100 cursor-not-allowed'
                  : 'px-4 py-2 rounded-lg border border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
              }
            >
              Xoá khung
            </button>
          </div>
        </div>

        {/* Tạo khung */}
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="text-lg font-semibold">Tạo Khung chương trình đào tạo</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Đối tượng</label>
              <input
                className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                placeholder="Ví dụ: Đại học / Sau đại học"
                value={form.doi_tuong}
                onChange={(e) => setForm({ ...form, doi_tuong: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Chuyên ngành</label>
              <input
                className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                placeholder="Ví dụ: Bác sĩ Y học cổ truyền"
                value={form.chuyen_nganh}
                onChange={(e) => setForm({ ...form, chuyen_nganh: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Niên khoá</label>
              <input
                className="w-full border rounded-lg px-3 py-2 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300"
                placeholder="Ví dụ: 2025-2031"
                value={form.nien_khoa}
                onChange={(e) => setForm({ ...form, nien_khoa: e.target.value })}
              />
            </div>
          </div>
          <div>
            <button
              onClick={createFramework}
              disabled={loading || !form.doi_tuong || !form.chuyen_nganh || !form.nien_khoa}
              className={
                loading || !form.doi_tuong || !form.chuyen_nganh || !form.nien_khoa
                  ? 'px-4 py-2 rounded-lg font-semibold bg-gray-300 text-white cursor-not-allowed'
                  : 'px-4 py-2 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700'
              }
            >
              Tạo khung
            </button>
          </div>
        </div>

        {/* Upload CSV blocks */}
        <div className="grid lg:grid-cols-3 gap-6">
          {(Object.keys(KIND_META) as UploadKind[]).map((kind) => {
            const meta = KIND_META[kind];
            const chosen = (pickedFiles as any)[kind] as File | undefined;
            return (
              <div key={kind} className="rounded-lg border p-4">
                <h3 className="font-semibold">{meta.title}</h3>
                <p className="text-xs text-slate-600">{meta.helper}</p>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    className="block w-full"
                    onChange={(e) => handlePickFile(kind, e.target.files?.[0] || null)}
                    disabled={!selectedId}
                  />
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => doUpload(kind)}
                    disabled={!selectedId || !chosen}
                    className={
                      !selectedId || !chosen
                        ? 'px-3 py-1.5 rounded bg-gray-300 text-white text-sm cursor-not-allowed'
                        : 'px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700'
                    }
                  >
                    Tải lên
                  </button>

                  <button
                    onClick={() => fetchExisting(kind)}
                    className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
                    disabled={!selectedId}
                  >
                    Xem dữ liệu đã có
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dữ liệu đã có */}
        {viewData && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Dữ liệu: {viewData.kind.toUpperCase()} — {viewData.count} dòng
              </h3>
              <button onClick={() => setViewData(null)} className="text-sm text-slate-600 hover:underline">
                Đóng
              </button>
            </div>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(viewData.rows[0] || { col1: '', col2: '' }).map((k) => (
                      <th key={k} className="px-3 py-2 text-left border-b">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewData.rows.map((r, i) => (
                    <tr key={i} className="odd:bg-gray-50">
                      {Object.values(r).map((v: any, j: number) => (
                        <td key={j} className="px-3 py-1.5 border-b">{String(v ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ma trận (Cytoscape) */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ma trận kết nối (Cytoscape)</h2>
            <button
              onClick={loadGraph}
              className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700"
              disabled={!selectedId}
            >
              Làm mới
            </button>
          </div>
          <div className="mt-3 h-[520px] border rounded overflow-hidden">
            {graph ? (
              <CytoscapeComponent
                elements={[...(graph.nodes || []), ...(graph.edges || [])]}
                style={{ width: '100%', height: '100%' }}
                layout={{ name: 'cose', animate: false }}
                stylesheet={[
                  {
                    selector: 'node',
                    style: {
                      'background-color': '#0EA44B', // brand-600
                      label: 'data(label)',
                      color: '#fff',
                      'font-size': 10,
                      'text-valign': 'center',
                      'text-halign': 'center',
                    },
                  },
                  { selector: 'node[group="PLO"]',    style: { 'background-color': '#0EA44B' } }, // brand-600
                  { selector: 'node[group="PI"]',     style: { 'background-color': '#34C759' } }, // brand-500-ish
                  { selector: 'node[group="COURSE"]', style: { 'background-color': '#94a3b8' } }, // slate-400
                  { selector: 'node[group="CLO"]',    style: { 'background-color': '#64748b' } }, // slate-500
                  {
                    selector: 'edge',
                    style: {
                      width: 2,
                      'line-color': '#94a3b8',
                      'target-arrow-color': '#94a3b8',
                      'target-arrow-shape': 'triangle',
                      label: 'data(kind)',
                      'font-size': 8,
                      color: '#334155',
                      'curve-style': 'bezier',
                    },
                  },
                ]}
              />
            ) : (
              <div className="h-full grid place-items-center text-sm text-gray-500">Chọn khung để xem ma trận</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
