// lib/useFrameworkData.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Framework, UploadKind, GraphData, PLO, PI, Course, CLO } from './framework-types';
import { normalizeGraph, nodeTypeAndKey } from './graph';

/**
 * Hook quản lý dữ liệu Khung + Lists + Graph + Upload.
 * LƯU Ý: Mặc định KHÔNG chọn gì hết (sel*=[]) để trang không bị rối.
 */
export function useFrameworkData() {
  // Frameworks
  const [loading, setLoading] = useState(false);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState({ doi_tuong: '', chuyen_nganh: '', nien_khoa: '' });

  // Upload
  const [pickedFiles, setPickedFiles] = useState<Partial<Record<UploadKind, File>>>({});

  // Graph
  const [graph, setGraph] = useState<GraphData | null>(null);

  // Lists
  const [ploList, setPloList] = useState<PLO[]>([]);
  const [piList, setPiList] = useState<PI[]>([]);
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [cloList, setCloList] = useState<CLO[]>([]);

  // Filters (MẶC ĐỊNH RỖNG)
  const [selPLO, setSelPLO] = useState<string[]>([]);
  const [selPI, setSelPI] = useState<string[]>([]);
  const [selCourse, setSelCourse] = useState<string[]>([]);
  const [selCLO, setSelCLO] = useState<string[]>([]);

  // ===== Framework CRUD =====
  const loadFrameworks = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/academic-affairs/framework');
    const js = await res.json();
    setLoading(false);
    if (!res.ok) { alert(js.error || 'Lỗi tải danh sách'); return; }
    setFrameworks(js.data || []);
    if (!selectedId && js.data?.[0]?.id) setSelectedId(js.data[0].id);
  }, [selectedId]);

  useEffect(() => { loadFrameworks(); }, [loadFrameworks]);

  const createFramework = useCallback(async () => {
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
  }, [form, loadFrameworks]);

  const deleteFramework = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    const res = await fetch(`/api/academic-affairs/framework?id=${selectedId}`, { method: 'DELETE' });
    const js = await res.json();
    setLoading(false);
    if (!res.ok) { alert(js.error || 'Xoá lỗi'); return; }
    setSelectedId('');
    loadFrameworks();
  }, [selectedId, loadFrameworks]);

  // ===== Graph + Lists =====
  const loadGraph = useCallback(async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/academic-affairs/graph?framework_id=${selectedId}`);
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Lỗi tải graph'); return; }
    setGraph(normalizeGraph(js));
  }, [selectedId]);

  const loadLists = useCallback(async () => {
    if (!selectedId) return;
    const q = (kind: string) =>
      fetch(`/api/academic-affairs/list?framework_id=${selectedId}&kind=${kind}`).then((r) => r.json());

    const [plo, pi, courses, clos] = await Promise.all([q('plo'), q('pi'), q('courses'), q('clos')]);

    if (plo?.data) setPloList(plo.data);
    if (pi?.data) setPiList(pi.data);
    if (courses?.data) setCourseList(courses.data);
    if (clos?.data) setCloList(clos.data);

    // MẶC ĐỊNH: không chọn gì cả để UI không rối
    setSelPLO([]);
    setSelPI([]);
    setSelCourse([]);
    setSelCLO([]);
  }, [selectedId]);

  useEffect(() => { if (selectedId) { loadGraph(); loadLists(); } }, [selectedId, loadGraph, loadLists]);

  // ===== Upload =====
  const handlePickFile = useCallback((kind: UploadKind, file: File | null) => {
    setPickedFiles((s) => ({ ...s, [kind]: file || undefined }));
  }, []);

  const doUpload = useCallback(async (kind: UploadKind) => {
    const file = pickedFiles[kind];
    if (!selectedId || !file) return;
    const fd = new FormData();
    fd.append('framework_id', selectedId);
    fd.append('kind', kind);
    fd.append('file', file);
    const res = await fetch('/api/academic-affairs/upload', { method: 'POST', body: fd });
    const js = await res.json();
    if (!res.ok) { alert(js.error || 'Upload lỗi'); return; }
    await Promise.all([loadGraph(), loadLists()]);
  }, [pickedFiles, selectedId, loadGraph, loadLists]);

  // ===== Filter graph (CHỈ hiển thị những gì ĐÃ CHỌN) =====
  const filteredElements = useMemo(() => {
    if (!graph) return [];

    const sP  = new Set(selPLO);
    const sI  = new Set(selPI);
    const sC  = new Set(selCourse);
    const sCL = new Set(selCLO);

    const nodes = (graph.nodes || [])
      .map((n: any) => {
        const id = n?.data?.id ?? '';
        const { type, key } = nodeTypeAndKey(id);

        const include =
          type === 'plo'    ? sP.has(key) :
          type === 'pi'     ? sI.has(key) :
          type === 'course' ? sC.has(key) :
          type === 'clo'    ? sCL.has(key) :
          false;

        if (!include) return null;

        const data = { ...n.data };
        if (type === 'clo') {
          const parts = key.split(':');        // course_code:clo_code
          data.label = parts[1] ?? key;        // chỉ hiển thị clo_code
        } else {
          data.label = key;                    // chỉ hiển thị code
        }
        return { ...n, data, classes: (n.classes ? n.classes + ' ' : '') + `type-${type}` };
      })
      .filter(Boolean);

    const nodeIds = new Set(nodes.map((n: any) => n.data.id));
    const edges = (graph.edges || []).filter(
      (e: any) => nodeIds.has(e.data.source) && nodeIds.has(e.data.target)
    );

    return [...nodes, ...edges];
  }, [graph, selPLO, selPI, selCourse, selCLO]);

  const nodeCount = useMemo(
    () => filteredElements.filter((e: any) => e.data && !('source' in e.data)).length,
    [filteredElements]
  );
  const edgeCount = useMemo(
    () => filteredElements.filter((e: any) => e.data && 'source' in e.data).length,
    [filteredElements]
  );

  const refreshMatrix = useCallback(async () => {
    await Promise.all([loadGraph(), loadLists()]);
  }, [loadGraph, loadLists]);

  return {
    // framework
    loading, frameworks, selectedId, setSelectedId, form, setForm,
    createFramework, deleteFramework,

    // upload
    pickedFiles, handlePickFile, doUpload,

    // lists + selections
    ploList, piList, courseList, cloList,
    selPLO, setSelPLO, selPI, setSelPI, selCourse, setSelCourse, selCLO, setSelCLO,

    // graph
    graph, filteredElements, nodeCount, edgeCount, refreshMatrix,
  };
}
