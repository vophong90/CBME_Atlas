'use client';
import { useEffect, useRef, useState } from 'react';

type State<T> = { data: T | null; loading: boolean; error: string | null };

const mem = new Map<string, { ts: number; data: any }>();
const KEY = 'student_area_cache_v1';

function loadSS() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveSS(obj: any) {
  try { sessionStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
}

/** useCachedJson: cache memory + sessionStorage với TTL (mặc định 60s) */
export function useCachedJson<T = any>(url: string | null, ttlMs = 60_000) {
  const [st, setSt] = useState<State<T>>({ data: null, loading: !!url, error: null });
  const keyRef = useRef(url || '');
  useEffect(() => { keyRef.current = url || ''; }, [url]);

  useEffect(() => {
    let canceled = false;
    async function run() {
      if (!url) return;
      const now = Date.now();

      // 1) cache memory
      const m = mem.get(url);
      if (m && now - m.ts < ttlMs) { setSt({ data: m.data, loading: false, error: null }); return; }

      // 2) cache sessionStorage
      const ss = loadSS();
      const srec = ss[url];
      if (srec && now - srec.ts < ttlMs) {
        setSt({ data: srec.data, loading: false, error: null });
        mem.set(url, srec);
        return;
      }

      // 3) fetch
      setSt(s => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(url);
        const js = await res.json();
        if (!res.ok) throw new Error(js?.error || 'Fetch error');
        const data = js?.data ?? js;
        if (canceled) return;
        setSt({ data, loading: false, error: null });
        const rec = { ts: now, data };
        mem.set(url, rec); ss[url] = rec; saveSS(ss);
      } catch (e: any) {
        if (canceled) return;
        setSt({ data: null, loading: false, error: e?.message || 'Fetch error' });
      }
    }
    run();
    return () => { canceled = true; };
  }, [url, ttlMs]);

  return st;
}
