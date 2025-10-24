// components/framework/SimpleTable.tsx
'use client';

import { ReactNode } from 'react';

export default function SimpleTable<T extends object>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[];
  columns: { key: keyof T; label: string; render?: (v: any, r: T) => ReactNode }[];
}) {
  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="font-medium mb-2">{title} ({rows.length})</div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              {columns.map((c) => (
                <th key={String(c.key)} className="px-3 py-2 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2 align-top">
                    {c.render ? c.render((r as any)[c.key], r) : String((r as any)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
