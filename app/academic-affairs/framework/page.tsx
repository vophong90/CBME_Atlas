// File 2/2: app/academic-affairs/framework/page.tsx
// (Đã thêm UploadKind 'courses' + KIND_META cho Học phần)
// ================================
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

type UploadKind = 'plo' | 'pi' | 'courses' | 'plo_pi' | 'plo_clo' | 'pi_clo';
const KIND_META: Record<UploadKind, { title: string; helper: string }> = {
  plo:    { title: 'Tải PLO (CSV)',         helper: '2 cột (không header): code,description' },
  pi:     { title: 'Tải PI (CSV)',          helper: '2 cột (không header): code,description' },
  courses: { title: 'Tải Học phần (CSV)', helper: '2-3 cột (không header): course_code,course_name,[credits]' },
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

  const [graph, setGraph] = useState<any | null>(null);

  async function loadFrameworks() {
    setLoading(true);
    const res = await fetch('/api/academic-affairs/framework');
    const js = await res.json();
    setLoading(false);
    if (!res.ok) { alert(js.error || 'Lỗi tải danh sách'); return; }
    setFrameworks(js.data || []);
    if (!selectedId && js.data?.[0]?.id) setSelectedId(js.data[0].id);
  }

  useEffect(() => { loadFrameworks(); /* eslint-disable-next-line */ }, []);

  async function createFramework() {
    setLoading(true);
    const res = await fetch('/api/academic-affairs/framework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const js = await res.json();
    setLoading(false);
    if (!res.ok) { alert(js.error || 'Tạo khung lỗi'); return; }
    setForm({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });
    loadFrameworks();
  }

  async function deleteFramework() {
    if (!selectedId) return;
    setLoading(true);
    const res = await fetch(`/api/academic-affairs/framework?id=${selectedId}`, { method: 'DELETE' });
    const js = await res.json();
    setLoading(false);
    if (!res.ok) { alert(js.error || 'Xoá lỗi'); return; }
    setSelectedId('');
    loadFrameworks();
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

  function handlePickFile(kind: UploadKind, file: File | null) {
    setPickedFiles((s) => ({ ...s, [kind]: file || undefined }));
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
    if (!res.ok) { alert(js.error || 'Upload lỗi'); return; }
    // refresh sơ bộ
    loadGraph();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Khung CTĐT & Ma trận</h1>

      {/* Chọn khung & thao tác */}
      <section className="bg-white rounded-xl border p-4 space-y-4">
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
              placeholder="Ví dụ: YHCT / Dược cổ truyền"
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

        <div className="flex items-end gap-2">
          <button
            onClick={createFramework}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700"
            disabled={loading}
          >Tạo khung</button>

          <div className="ml-auto">
            <label className="block text-sm font-semibold mb-1">Chọn khung</label>
            <select
              className="border rounded-lg px-3 py-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">-- Chọn --</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.doi_tuong} · {f.chuyen_nganh} · {f.nien_khoa}
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
                  : 'px-4 py-2 rounded-lg border border-red-600 text-red-600 hover:bg-red-50'
              }
            >Xoá khung</button>
            <button
              onClick={loadGraph}
              className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700"
              disabled={!selectedId}
            >
              Làm mới
            </button>
          </div>
        </div>
      </section>

      {/* Upload CSV (PLO/PI/Học phần/Links) */}
      <section className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Tải dữ liệu (CSV)</h2>
        <div className="grid md:grid-cols-5 gap-4">
          {(Object.keys(KIND_META) as UploadKind[]).map((kind) => {
            const chosen = pickedFiles[kind];
            const meta = KIND_META[kind];
            return (
              <div key={kind} className="border rounded-lg p-3 space-y-2">
                <div className="font-medium text-sm">{meta.title}</div>
                <div className="text-xs text-slate-600">{meta.helper}</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    className="block w-full"
                    onChange={(e) => handlePickFile(kind, e.target.files?.[0] || null)}
                    disabled={!selectedId}
                  />
                </div>
                <div className="flex gap-2">
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
                  {chosen && (
                    <span className="text-xs text-slate-500 truncate" title={chosen.name}>{chosen.name}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ma trận Cytoscape */}
      <section className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Ma trận kết nối</div>
        </div>
        <div className="mt-3 h-[520px] border rounded overflow-hidden">
          {graph ? (
            <CytoscapeComponent
              elements={[...(graph.nodes || []), ...(graph.edges || [])]}
              style={{ width: '100%', height: '100%' }}
              layout={{ name: 'cose', nodeRepulsion: 5000, idealEdgeLength: 120, animate: true }}
              stylesheet={[
                { selector: 'node', style: { 'label': 'data(label)', 'text-valign': 'center', 'text-halign': 'center', 'font-size': 12, 'text-background-color': '#ffffff', 'text-background-opacity': 0.95, 'text-background-padding': 4, 'border-width': 2, 'border-color': '#111827', 'shape': 'round-rectangle' }},
                { selector: 'node[type = "PLO"]',    style: { 'background-color': '#1b9e77', 'shape': 'round-rectangle' } },
                { selector: 'node[type = "PI"]',     style: { 'background-color': '#d95f02', 'shape': 'ellipse' } },
                { selector: 'node[type = "COURSE"]', style: { 'background-color': '#7570b3', 'shape': 'hexagon' } },
                { selector: 'node[type = "CLO"]',    style: { 'background-color': '#e7298a', 'shape': 'diamond' } },
                { selector: 'edge', style: { 'curve-style': 'bezier', 'width': 2, 'line-color': '#9ca3af', 'target-arrow-color': '#9ca3af', 'target-arrow-shape': 'triangle', 'arrow-scale': 1, 'label': 'data(kind)', 'font-size': 8, 'text-background-color': '#ffffff', 'text-background-opacity': 0.9, 'text-background-padding': 2, 'color': '#334155' } },
                { selector: ':selected', style: { 'border-color': '#10b981', 'border-width': 4, 'line-color': '#10b981', 'target-arrow-color': '#10b981' } },
                { selector: '.faded',   style: { 'opacity': 0.15 } },
              ]}
            />
          ) : (
            <div className="h-full grid place-items-center text-sm text-gray-500">Chọn khung để xem ma trận</div>
          )}
        </div>
      </section>
    </div>
  );
}
