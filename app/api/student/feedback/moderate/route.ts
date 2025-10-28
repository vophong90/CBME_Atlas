// app/api/student/feedback/moderate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RAW_PROXY_URL = process.env.PROXY_URL || 'https://gpt-api-19xu.onrender.com';
const TIMEOUT_MS = 15000;

type ModerationPayload = {
  allowed?: boolean;      // phòng khi proxy trả JSON chat {allowed, reason}
  reason?: string;
  results?: Array<{       // schema của /v1/moderations
    flagged: boolean;
    categories?: Record<string, boolean>;
  }>;
};

function getProxyModerationURL(): string {
  try {
    const u = new URL(RAW_PROXY_URL);
    if (u.pathname === '' || u.pathname === '/') u.pathname = '/gpt.php';
    return u.toString();
  } catch {
    return RAW_PROXY_URL.endsWith('.php')
      ? RAW_PROXY_URL
      : RAW_PROXY_URL.replace(/\/+$/, '') + '/gpt.php';
  }
}

function reasonFromCategories(categories: Record<string, boolean> | undefined) {
  if (!categories) return 'Nội dung chưa phù hợp';
  const flagged = Object.entries(categories)
    .filter(([, v]) => v)
    .map(([k]) =>
      k
        .replaceAll('_', ' ')
        .replace('self harm', 'tự hại')
        .replace('harassment', 'quấy rối/xúc phạm')
        .replace('hate', 'thù ghét/phân biệt')
        .replace('violence', 'bạo lực')
        .replace('sexual', 'tình dục')
        .replace('copyright', 'bản quyền'),
    );
  return flagged.length ? `Phát hiện: ${flagged.join(', ')}` : 'Nội dung chưa phù hợp';
}

async function callProxyModeration(message: string, signal: AbortSignal) {
  const url = getProxyModerationURL();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action: 'moderate', prompt: message }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`proxy ${res.status} ${text?.slice(0, 120)}`);
  }

  const data = (await res.json().catch(() => null)) as ModerationPayload & any;

  // Case A: Proxy forward /v1/moderations
  const mod = data?.results?.[0];
  if (mod && typeof mod.flagged === 'boolean') {
    return {
      ok: !mod.flagged,
      reason: mod.flagged ? reasonFromCategories(mod.categories) : 'OK',
    };
  }

  // Case B: Proxy dùng chat/response, content là JSON string {allowed, reason}
  const content: string | undefined =
    data?.choices?.[0]?.message?.content ?? data?.content ?? data?.text;

  if (typeof content === 'string' && content.trim()) {
    try {
      const parsed = JSON.parse(content) as { allowed?: boolean; reason?: string };
      if (typeof parsed.allowed === 'boolean') {
        return {
          ok: !!parsed.allowed,
          reason: typeof parsed.reason === 'string'
            ? parsed.reason
            : (parsed.allowed ? 'OK' : 'Nội dung chưa phù hợp'),
        };
      }
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]) as { allowed?: boolean; reason?: string };
          if (typeof parsed.allowed === 'boolean') {
            return {
              ok: !!parsed.allowed,
              reason: typeof parsed.reason === 'string'
                ? parsed.reason
                : (parsed.allowed ? 'OK' : 'Nội dung chưa phù hợp'),
            };
          }
        } catch {/* ignore */}
      }
    }
  }

  throw new Error('proxy invalid payload');
}

async function callOpenAIModeration(message: string, signal: AbortSignal) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('missing OPENAI_API_KEY');

  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: message,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`openai ${res.status} ${text?.slice(0, 120)}`);
  }

  const data = (await res.json().catch(() => null)) as ModerationPayload;
  const mod = data?.results?.[0];
  if (!mod || typeof mod.flagged !== 'boolean') throw new Error('openai invalid payload');

  return {
    ok: !mod.flagged,
    reason: mod.flagged ? reasonFromCategories(mod.categories) : 'OK',
  };
}

export async function POST(req: Request) {
  try {
    // Giữ API hiện tại của trang Sinh viên:
    // body { text?: string; kind?: string; target?: string }
    const body = (await req.json().catch(() => ({}))) as {
      text?: string;
      kind?: string;
      target?: string;
    };

    const text = String(body?.text ?? '').trim();
    if (!text) return NextResponse.json({ ok: false, reason: 'Thiếu nội dung' }, { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // 1) Ưu tiên gọi qua proxy PHP (action='moderate')
      const viaProxy = await callProxyModeration(text, controller.signal);
      clearTimeout(timer);
      return NextResponse.json(viaProxy, { status: 200 });
    } catch (eProxy: any) {
      // 2) Fallback sang OpenAI Moderations
      try {
        const viaOpenAI = await callOpenAIModeration(text, controller.signal);
        clearTimeout(timer);
        return NextResponse.json(viaOpenAI, { status: 200 });
      } catch (eOpenAI: any) {
        clearTimeout(timer);
        // Luôn trả 200 + ok=false để UI không bật nút Gửi
        return NextResponse.json(
          { ok: false, reason: eOpenAI?.message || eProxy?.message || 'Server error' },
          { status: 200 },
        );
      }
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, reason: e?.name === 'AbortError' ? 'Quá thời gian chờ GPT' : (e?.message || 'Server error') },
      { status: 200 },
    );
  }
}
