'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-browser';

type SurveyRow = {
  id: string;
  title: string;
  intro: string | null;
  guide: string | null;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS: SurveyRow['status'][] = ['draft', 'active', 'inactive', 'archived'];
const STATUS_LABELS: Record<SurveyRow['status'], string> = {
  draft: 'Nháp',
  active: 'Đang hoạt động',
  inactive: 'Tạm dừng',
  archived: 'Lưu trữ',
};

export default function SurveysPage() {
  const supabase = getSupabase();

  const [list, setList] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [guide, setGuide] = useState('');
  const [status, setStatus] = useState<SurveyRow['status']>('draft');

  async function load() {
    setLoading(true);
    setToast(null);
    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setList((data ?? []) as SurveyRow[]);
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Không tải được danh sách' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createSurvey() {
    if (!title.trim()) {
      setToast({ type: 'error', text: 'Thiếu tiêu đề khảo sát' });
      return;
    }
    setLoading(true);
    setToast(null);
    try {
      const { error } = await supabase.from('surveys').insert([
        {
          title: title.trim(),
          intro: intro || null,
          guide: guide || null,
          status,
          // created_by DEFAULT auth.uid() trong DDL
        },
      ]);
      if (error) throw error;
      setTitle('');
      setIntro('');
      setGuide('');
      setStatus('draft');
      await load();
      setToast({ type: 'success', text: 'Đã tạo khảo sát' });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Tạo khảo sát thất bại' });
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, st: SurveyRow['status']) {
    setLoading(true);
    setToast(null);
    try {
      const { error } = await supabase.from('surveys').update({ status: st }).eq('id', id);
      if (error) throw error;
      await load();
      setToast({ type: 'success', text: 'Đã cập nhật trạng thái' });
    } catch (e: any) {
      setToast({ type: 'error', text: e.message ?? 'Cập nhật thất bại' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Khảo sát</h1>
        <p className="text-sm text-gray-600">Tạo khảo sát mới và quản lý trạng thái.</p>
      </div>

      {/* Form tạo mới */}
      <div className="border rounded-lg p-4 space-y-3 bg-white">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Tiêu đề *</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Khảo sát chất lượng môn học"
            />
          </div>
          <div>
            <label className="text-sm">Trạng thái</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as SurveyRow['status'])}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {STATUS_LABELS[o]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm">Giới thiệu</label>
          <textarea
            className="w-full border rounded p-2"
            rows={3}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm">Hướng dẫn</label>
          <textarea
            className="w-full border rounded p-2"
            rows={4}
            value={guide}
            onChange={(e) => setGuide(e.target.value)}
          />
        </div>
        <button
          onClick={createSurvey}
          disabled={loading}
          className={`px-3 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-black'}`}
        >
          {loading ? 'Đang lưu…' : 'Tạo khảo sát'}
        </button>
        {toast && (
          <div className={`mt-2 text-sm ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {toast.text}
          </div>
        )}
      </div>

      {/* Danh sách */}
      <div className="border rounded-lg p-4 bg-white">
        <div className="font-medium mb-2">Danh sách khảo sát</div>
        <div className="overflow-auto">
          <table className="min-w-[880px] w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">Tiêu đề</th>
                <th className="py-2 pr-3 w-40">Trạng thái</th>
                <th className="py-2 pr-3 w-[360px]">Thao tác</th>
                <th className="py-2 pr-3 w-40">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{s.title}</div>
                    {s.intro ? <div className="text-xs text-gray-500 line-clamp-1">{s.intro}</div> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs border">
                      {STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((o) => (
                        <button
                          key={o}
                          className={`px-2 py-1 rounded border text-sm ${
                            o === s.status ? 'bg-gray-200' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => updateStatus(s.id, o)}
                          disabled={loading || o === s.status}
                          title={`Đổi sang ${STATUS_LABELS[o]}`}
                        >
                          {STATUS_LABELS[o]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/quality-assurance/surveys/${s.id}/builder`}
                        className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                        title="Chỉnh sửa bảng câu hỏi"
                      >
                        Chỉnh sửa câu hỏi
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-sm text-gray-500" colSpan={4}>
                    Chưa có khảo sát nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
