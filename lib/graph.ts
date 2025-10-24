// lib/graph.ts
import type { GraphData } from './framework-types';

export function normalizeGraph(rawResp: any): GraphData {
  const raw = rawResp?.elements ?? rawResp?.data ?? rawResp ?? {};
  let nodes: any[] = [];
  let edges: any[] = [];

  if (Array.isArray(raw)) {
    for (const el of raw) {
      if (el?.data?.source && el?.data?.target) edges.push(el);
      else nodes.push(el);
    }
  } else {
    nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
    edges = Array.isArray(raw?.edges) ? raw.edges : [];
  }

  nodes = nodes
    .filter((n) => n?.data?.id)
    .map((n) => ({ ...n, data: { ...n.data, label: n.data.label ?? n.data.id } }));
  edges = edges
    .filter((e) => e?.data?.source && e?.data?.target)
    .map((e) => ({ ...e, data: { ...e.data, kind: e.data.kind ?? '' } }));

  return { nodes, edges };
}

export function nodeTypeAndKey(id: string) {
  if (!id) return { type: 'other', key: '' };
  if (id.startsWith('PLO:'))    return { type: 'plo',    key: id.slice(4) };
  if (id.startsWith('PI:'))     return { type: 'pi',     key: id.slice(3) };
  if (id.startsWith('COURSE:')) return { type: 'course', key: id.slice('COURSE:'.length) };
  if (id.startsWith('CLO:'))    return { type: 'clo',    key: id.slice(4) }; // course:clo
  return { type: 'other', key: id };
}
