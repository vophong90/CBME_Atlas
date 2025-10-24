// components/framework/UploadCsvPanel.tsx
'use client';

import { KIND_META, UploadKind } from '@/lib/framework-types';

export default function UploadCsvPanel({
  selectedId,
  pickedFiles,
  onPick,
  onUpload,
}: {
  selectedId: string;
  pickedFiles: Partial<Record<UploadKind, File>>;
  onPick: (kind: UploadKind, file: File | null) => void;
  onUpload: (kind: UploadKind) => void;
}) {
  return (
    <section className="bg-white rounded-xl border p-4">
      <h2 className="font-semibold mb-3">Tải dữ liệu (CSV)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  onChange={(e) => onPick(kind, e.target.files?.[0] || null)}
                  disabled={!selectedId}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpload(kind)}
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
                  <span className="text-xs text-slate-500 truncate" title={chosen.name}>
                    {chosen.name}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
