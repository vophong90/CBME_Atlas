// components/framework/MatrixGraph.tsx
'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef } from 'react';

const CytoscapeComponent: any = dynamic(() => import('react-cytoscapejs'), { ssr: false });

export default function MatrixGraph({
  elements, nodeCount, edgeCount, onRefresh, refreshDisabled,
}: {
  elements: any[];
  nodeCount: number;
  edgeCount: number;
  onRefresh: () => void;
  refreshDisabled?: boolean;
}) {
  const cyRef = useRef<any>(null);

  const stylesheet = useMemo(() => ([
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': 12,
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.95,
        'text-background-padding': 4,
        'border-width': 2,
        'border-color': '#111827',
        shape: 'round-rectangle',
      },
    },
    { selector: 'node.type-plo',    style: { 'background-color': '#1b9e77', shape: 'round-rectangle' } },
    { selector: 'node.type-pi',     style: { 'background-color': '#d95f02', shape: 'ellipse' } },
    { selector: 'node.type-course', style: { 'background-color': '#7570b3', shape: 'hexagon' } },
    { selector: 'node.type-clo',    style: { 'background-color': '#e7298a', shape: 'diamond' } },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        width: 2,
        'line-color': '#9ca3af',
        'target-arrow-color': '#9ca3af',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1,
        label: 'data(kind)',
        'font-size': 8,
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.9,
        'text-background-padding': 2,
        color: '#334155',
      },
    },
    { selector: ':selected', style: { 'border-color': '#10b981', 'border-width': 4, 'line-color': '#10b981', 'target-arrow-color': '#10b981' } },
    { selector: '.faded',   style: { opacity: 0.15 } },
  ]), []);

  const handleFit = () => { if (!cyRef.current) return; cyRef.current.elements().removeClass('faded'); cyRef.current.fit(undefined, 30); };

  return (
    <section className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Ma trận kết nối</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Nodes: {nodeCount} · Edges: {edgeCount}</span>
          <button
            onClick={onRefresh}
            disabled={!!refreshDisabled}
            className={refreshDisabled
              ? 'px-3 py-1.5 rounded bg-gray-300 text-white cursor-not-allowed'
              : 'px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700'}
          >
            Làm mới
          </button>
          <button
            onClick={handleFit}
            className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Fit
          </button>
        </div>
      </div>

      <div className="mt-3 h-[520px] border rounded overflow-hidden">
        {elements.length ? (
          <CytoscapeComponent
            key={elements.length} // remount khi filter thay đổi
            elements={elements}
            style={{ width: '100%', height: '100%' }}
            layout={{ name: 'cose', nodeRepulsion: 5000, idealEdgeLength: 120, animate: true }}
            stylesheet={stylesheet}
            cy={(cy: any) => {
              cyRef.current = cy;
              cy.fit(undefined, 30);
              cy.on('tap', 'node', (evt: any) => {
                const n = evt.target;
                cy.elements().removeClass('faded');
                const neighborhood = n.closedNeighborhood();
                cy.elements().difference(neighborhood).addClass('faded');
              });
              cy.on('tap', (evt: any) => { if (evt.target === cy) cy.elements().removeClass('faded'); });
            }}
          />
        ) : (
          <div className="h-full grid place-items-center text-sm text-gray-500">Chọn khung để xem ma trận</div>
        )}
      </div>
    </section>
  );
}
