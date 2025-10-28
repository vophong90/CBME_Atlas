// app/api/teacher/feedback/moderate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RAW_PROXY_URL = process.env.PROXY_URL || 'https://gpt-api-19xu.onrender.com';
const TIMEOUT_MS = 15000;

/** Build moderation prompt (giữ nguyên để bạn tái dùng nếu cần chat), 
 *  nhưng với Moderation API ta sẽ gửi thẳng message, không cần prompt. */
function buildPrompt(message: string) {
  return `
Bạn là bộ lọc kiểm duyệt góp ý sinh viên (tiếng Việt) gửi cho giảng viên.
Chỉ chấp nhận nội dung mang tính xây dựng:
- Không tục tĩu, xúc phạm, bôi nhọ, lăng mạ, phân biệt đối xử, đe doạ.
- Không kích động tự hại hay bạo lực.
- Không đưa thông tin nhận diện cá nhân (số điện thoại, email, link, địa chỉ...).
- Khuyến khích góp ý lịch sự, tôn trọng, có gợi ý cải thiện cụ thể.

CHỈ TRẢ LỜI BẰNG JSON HỢP LỆ:
{"ok": true|false, "reason": "Giải thích ngắn gọn bằng tiếng Việt"}

Nội dung cần xét:
"""${message}"""
`.trim();
}

/** Đảm bảo path trỏ đúng file PHP trên proxy */
function getProxyModerationURL(): string {
  try {
    const u = new URL(RAW_PROXY_URL);
    if (u.pathname === '' || u.pathname === '/') {
      u.pathname = '/gpt.php';
    }
    return u.toString();
  } catch {
    // RAW_PROXY_URL không phải URL đầy đủ → cố gắng ghép /gpt.php
    return RAW_PROXY_URL.endsWith('.php')
      ? RAW_PROXY_URL
      : RAW_PROXY_URL.replace(/\/+$/, '') + '/gpt.php';
  }
}

/** Chuyển categories bị flag thành chuỗi lý do ngắn */
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

/** Gọi proxy PHP với action=moderate (ưu tiên) */
async function callProxyModeration(message: string, signal: AbortSignal) {
  const url = getProxyModerationURL();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    // Proxy theo khuyến nghị: dùng Moderations API nếu action='moderate'
    body: JSON.stringify({ action: 'moderate', prompt: message }),
    signal,
  });

  // Nếu proxy trả lỗi HTTP → ném để fallback
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`proxy ${res.status} ${text?.slice(0, 120)}`);
  }

  // Proxy có thể forward JSON của OpenAI Moderations
  const data = await res.json().catch(() => null) as any;

  // CASE A: Forward từ /v1/moderations
  // { results: [{ flagged: boolean, categories: {...} }] }
  const mod = data?.results?.[0];
  if (mod && typeof mod.flagged === 'boolean') {
    return {
      ok: !mod.flagged,
      reason: mod.flagged ? reasonFromCategories(mod.categories) : 'OK',
    };
  }

  // CASE B: Forward từ Chat/Responses: content là JSON string
  const content: string | undefined =
    data?.choices?.[0]?.message?.content ?? data?.content ?? data?.text;
  if (typeof content === 'string' && content.trim()) {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.ok === 'boolean') {
        return {
          ok: !!parsed.ok,
          reason: typeof parsed.reason === 'string'
            ? parsed.reason
            : (parsed.ok ? 'OK' : 'Nội dung chưa phù hợp'),
        };
      }
    } catch {
      // Cố tìm khối {...}
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          if (parsed && typeof parsed.ok === 'boolean') {
            return {
              ok: !!parsed.ok,
              reason: typeof parsed.reason === 'string'
                ? parsed.reason
                : (parsed.ok ? 'OK' : 'Nội dung chưa phù hợp'),
            };
          }
        } catch { /* ignore */ }
      }
    }
  }

  // Không nhận dạng được → coi như invalid, UI sẽ hiển thị reason
  throw new Error('proxy invalid payload');
}

/** Fallback: gọi trực tiếp OpenAI Moderations nếu proxy 404/timeout… */
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

  const data = (await res.json().catch(() => null)) as any;
  const mod = data?.results?.[0];
  if (!mod || typeof mod.flagged !== 'boolean') {
    throw new Error('openai invalid payload');
  }

  return {
    ok: !mod.flagged,
    reason: mod.flagged ? reasonFromCategories(mod.categories) : 'OK',
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { message?: string };
    const message = String(body?.message ?? '').trim();
    if (!message) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // 1) Thử proxy trước (đã ép path /gpt.php + action='moderate')
      const viaProxy = await callProxyModeration(message, controller.signal);
      clearTimeout(timer);
      return NextResponse.json(viaProxy, { status: 200 });
    } catch (eProxy: any) {
      // 2) Fallback: gọi thẳng OpenAI nếu proxy lỗi (404/timeout/invalid)
      try {
        const viaOpenAI = await callOpenAIModeration(message, controller.signal);
        clearTimeout(timer);
        return NextResponse.json(viaOpenAI, { status: 200 });
      } catch (eOpenAI: any) {
        clearTimeout(timer);
        // Giữ nguyên triết lý: luôn trả 200 + ok=false để UI không bật nút Gửi
        return NextResponse.json(
          { ok: false, reason: eOpenAI?.message || eProxy?.message || 'Server error' },
          { status: 200 },
        );
      }
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e?.message ?? 'Server error' }, { status: 200 });
  }
}
