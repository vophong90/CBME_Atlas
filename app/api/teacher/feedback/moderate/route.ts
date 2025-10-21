// app/api/student/moderate-message/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const PROXY_URL = process.env.PROXY_URL || 'https://gpt-api-19xu.onrender.com';
const TIMEOUT_MS = 15000;

const FALLBACK_BLOCKLIST: RegExp[] = [
  /đồ ngu|đồ điên|đồ khùng|mày|tao|đồ rác|vô học|đồ mất dạy/i,
  /tự sát|tự tử|kết liễu|giết/i,
  /kiện tụng|tố cáo (mày|bạn|thằng)/i,
];

function buildPrompt(message: string) {
  return `
Bạn là bộ lọc kiểm duyệt góp ý sinh viên (tiếng Việt) gửi cho giảng viên.
Chỉ chấp nhận nội dung mang tính xây dựng:
- Không tục tĩu, xúc phạm, bôi nhọ, lăng mạ, phân biệt đối xử, đe doạ.
- Không kích động tự hại hay bạo lực.
- Không đưa thông tin nhận diện cá nhân (số điện thoại, email, link, địa chỉ...).
- Khuyến khích góp ý lịch sự, tôn trọng, có gợi ý cải thiện cụ thể.

CHỈ TRẢ LỜI BẰNG JSON HỢP LỆ theo mẫu:
{"ok": true|false, "reason": "Giải thích ngắn gọn bằng tiếng Việt"}

Nội dung cần xét:
"""${message}"""
`.trim();
}

function localFallbackCheck(message: string): { ok: boolean; reason?: string } {
  const txt = message.trim();
  if (!txt) return { ok: false, reason: 'empty' };
  if (FALLBACK_BLOCKLIST.some((rx) => rx.test(txt))) {
    return { ok: false, reason: 'contains banned phrases' };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { message?: string };
    const message = String(body?.message ?? '').trim();
    if (!message) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });

    // Gọi GPT qua proxy
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const prompt = buildPrompt(message);
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Proxy nhận { prompt, model? }. Dùng gpt-5 nếu server bạn hỗ trợ.
        body: JSON.stringify({ prompt, model: 'gpt-5' }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        // Thất bại → fallback local
        const fb = localFallbackCheck(message);
        return NextResponse.json(fb, { status: 200 });
      }

      const data = await res.json().catch(() => null);

      // Thử lấy content theo schema OpenAI, có thể khác tuỳ proxy
      const content: string | undefined =
        data?.choices?.[0]?.message?.content ??
        data?.content ??
        data?.text;

      if (typeof content !== 'string' || !content.trim()) {
        const fb = localFallbackCheck(message);
        return NextResponse.json(fb, { status: 200 });
      }

      // Parse JSON do GPT trả về
      let parsed: any = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Cố gắng trích khối {...}
        const m = content.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
          } catch {
            parsed = null;
          }
        }
      }

      if (parsed && typeof parsed.ok === 'boolean') {
        const reason =
          typeof parsed.reason === 'string'
            ? parsed.reason
            : parsed.ok
            ? 'OK'
            : 'Nội dung chưa phù hợp';
        return NextResponse.json({ ok: parsed.ok, reason }, { status: 200 });
      }

      // Nếu không parse được đúng schema → fallback
      const fb = localFallbackCheck(message);
      return NextResponse.json(fb, { status: 200 });
    } catch (e: any) {
      // Timeout hoặc fetch lỗi → fallback local
      const fb = localFallbackCheck(message);
      return NextResponse.json(fb, { status: 200 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e?.message ?? 'Server error' }, { status: 500 });
  }
}
