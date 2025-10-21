// app/api/student/feedback/moderate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const PROXY_URL = 'https://gpt-api-19xu.onrender.com'; // proxy PHP của bạn
const TIMEOUT_MS = 15000;

type ModerationResult = { ok: boolean; reason?: string };

function quickLocalScreen(text: string): ModerationResult {
  const clean = String(text || '').trim();

  if (clean.length < 10) return { ok: false, reason: 'Nội dung quá ngắn' };

  // số điện thoại: bắt cả dạng có khoảng trắng/dấu
  const phoneLike = clean.replace(/[^\d]/g, '');
  if (/\d{9,11}/.test(phoneLike)) {
    return { ok: false, reason: 'Không đưa số điện thoại/cá nhân' };
  }

  // email
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(clean)) {
    return { ok: false, reason: 'Không nêu email/cá nhân' };
  }

  // link
  if (/(https?:\/\/|www\.)/i.test(clean)) {
    return { ok: false, reason: 'Không chèn liên kết' };
  }

  // một vài từ thô tục phổ biến (rất tối giản, bạn có thể mở rộng)
  const badWords = /(địt|dm|đmm|c?mm|cặc|đéo|lồn|đụ|fuck|shit)/i;
  if (badWords.test(clean)) {
    return { ok: false, reason: 'Ngôn từ không phù hợp' };
  }

  return { ok: true };
}

function buildPrompt(text: string, kind: 'course' | 'faculty', target: string) {
  return `
Bạn là bộ lọc kiểm duyệt góp ý sinh viên (tiếng Việt). Chỉ chấp nhận nội dung mang tính xây dựng:
- Cấm tục tĩu, xúc phạm, bôi nhọ, lăng mạ, phân biệt đối xử, đe doạ.
- Cấm tố cáo/khởi kiện/kiện cáo/đòi bồi thường.
- Cấm tiết lộ dữ liệu cá nhân (số điện thoại, email, link, địa chỉ...).
- Khuyến khích góp ý lịch sự, tôn trọng, có gợi ý cải thiện cụ thể.

Trả lời **DUY NHẤT** JSON hợp lệ theo mẫu:
{"allowed": true|false, "reason": "Giải thích ngắn gọn bằng tiếng Việt"}

Ngữ cảnh:
- Đối tượng góp ý: ${kind === 'course' ? `Học phần: "${target}"` : `Giảng viên: "${target}"`}

Nội dung góp ý:
"""${text}"""
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      text?: string;
      kind?: string;
      target?: string;
    };

    const text = String(body.text ?? '').trim();
    const rawKind = String(body.kind ?? '').trim().toLowerCase();
    const kind = rawKind === 'course' || rawKind === 'faculty' ? (rawKind as 'course' | 'faculty') : null;
    const target = String(body.target ?? '').trim();

    if (!text || !kind || !target) {
      return NextResponse.json({ ok: false, reason: 'Thiếu dữ liệu' }, { status: 400 });
    }

    // 1) Lọc nhanh phía server để tiết kiệm gọi GPT
    const quick = quickLocalScreen(text);
    if (!quick.ok) {
      return NextResponse.json({ ok: false, reason: quick.reason || 'Nội dung chưa phù hợp' });
    }

    // 2) Gọi GPT qua proxy
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const prompt = buildPrompt(text, kind, target);
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Nếu proxy của bạn không cần "model", có thể bỏ dòng model
      body: JSON.stringify({ prompt, model: 'gpt-5' }),
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`Không gọi được GPT proxy: ${e?.message || e}`);
    });
    clearTimeout(timer);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json(
        { ok: false, reason: `GPT lỗi (${res.status}): ${txt?.slice(0, 200) || 'unknown'}` },
        { status: 502 }
      );
    }

    const data = await res.json().catch(() => null);

    // Proxy trả về schema OpenAI: lấy content tại choices[0].message.content
    const content: string | undefined =
      data?.choices?.[0]?.message?.content ??
      data?.content ??
      data?.text;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ ok: false, reason: 'GPT trả về dữ liệu không hợp lệ' }, { status: 502 });
    }

    // 3) Parse JSON do GPT trả về
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Thử nắn JSON từ trong content (lấy đoạn {...} đầu tiên)
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          return NextResponse.json({ ok: false, reason: 'GPT không trả JSON hợp lệ' }, { status: 502 });
        }
      } else {
        return NextResponse.json({ ok: false, reason: 'GPT không trả JSON hợp lệ' }, { status: 502 });
      }
    }

    const allowed = !!parsed?.allowed;
    const reason =
      typeof parsed?.reason === 'string'
        ? parsed.reason
        : allowed
        ? 'OK'
        : 'Nội dung chưa phù hợp';

    return NextResponse.json({ ok: allowed, reason });
  } catch (e: any) {
    const msg =
      e?.name === 'AbortError'
        ? 'Quá thời gian chờ GPT'
        : e?.message || 'Lỗi máy chủ';
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 });
  }
}
