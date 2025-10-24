// components/framework/DropdownMulti.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function DropdownMulti({
  label,
  options,
  selected,
  onChange,
  display = (s: string) => s,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  display?: (x: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  const all = selected.length === options.length && options.length > 0;

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return options;
    return options.filter((o) => o.toLowerCase().includes(k));
  }, [options, q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-slate-500">
          {selected.length}/{options.length}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full px-3 py-2 border rounded-lg bg-white text-left hover:bg-gray-50"
        title={selected.join(', ')}
      >
        {selected.length ? selected.join(', ') : `Chọn ${label}`}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg p-2">
          <div className="flex gap-2 mb-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Tìm nhanh…"
            />
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
              onClick={() => onChange(all ? [] : [...options])}
            >
              {all ? 'Bỏ hết' : 'Chọn hết'}
            </button>
          </div>
          <div className="max-h-56 overflow-auto space-y-1 pr-1">
            {filtered.map((opt) => {
              const active = selected.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-gray-50">
                  <input type="checkbox" checked={active} onChange={() => toggle(opt)} className="accent-gray-700" />
                  <span className="truncate" title={display(opt)}>{display(opt)}</span>
                </label>
              );
            })}
            {!filtered.length && <div className="text-xs text-slate-500 px-1 py-1">Không có kết quả</div>}
          </div>
        </div>
      )}
    </div>
  );
}
