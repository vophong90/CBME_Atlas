// app/api/student/feedback/moderate/route.ts
import { NextResponse } from 'next/server';

const PROXY_URL = 'https://gpt-api-19xu.onrender.com'; // proxy PHP của bạn
const TIMEOUT_MS = 15000;

type ModerationResult = { ok: boolean; reason?: string };

function quickLocalScreen(text: string): ModerationResult {
  const clean = text.trim();
  if (clean.length < 10) return { ok: false, reason: 'Nội dung quá ngắn' };
  // chặn số điện thoại cơ bản
  if (/\b\d{9,11}\b/.test(clean.replace(/\s+/g, ''))) {
    return { ok: false, reason: 'Không đưa số điện thoại/cá nhân' };
  }
  // chặn link
  if (/(https?:\/\/|www\.)/i.test(clean)) {
    return { ok: false, reason: 'Không chèn liên kết' };
  }
  return { ok: true };
}

function buildPrompt(text: string, kind: 'course'|'faculty', target: string) {
  // Proxy của bạn chỉ nhận 1 "prompt" => gói toàn bộ hướng dẫn vào đây.
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
    const { text, kind, target } = await req.json();
    if (!text || !kind || !target) {
      return NextResponse.json({ ok: false, reason: 'Thiếu dữ liệu' }, { status: 400 });
    }

    // 1) Lọc nhanh phía server để tiết kiệm gọi GPT
    const quick = quickLocalScreen(String(text));
    if (!quick.ok) {
      return NextResponse.json({ ok: false, reason: quick.reason || 'Nội dung chưa phù hợp' });
    }

    // 2) Gọi GPT qua proxy của bạn
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const prompt = buildPrompt(String(text), kind as any, String(target));
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Proxy của bạn nhận {prompt, model?}; nếu đã set mặc định gpt-5 ở server thì có thể bỏ "model".
      body: JSON.stringify({ prompt, model: 'gpt-5' }),
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`Không gọi được GPT proxy: ${e?.message || e}`);
    });
    clearTimeout(timer);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json({ ok: false, reason: `GPT lỗi (${res.status}): ${txt?.slice(0, 200) || 'unknown'}` });
    }

    const data = await res.json();
    // Proxy trả về schema OpenAI: lấy content tại choices[0].message.content
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ ok: false, reason: 'GPT trả về dữ liệu không hợp lệ' });
    }

    // 3) Parse JSON do GPT trả về
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      // fallback: nếu không đúng JSON, từ chối
      return NextResponse.json({ ok: false, reason: 'GPT không trả JSON hợp lệ' });
    }

    const allowed = !!parsed?.allowed;
    const reason = typeof parsed?.reason === 'string' ? parsed.reason : (allowed ? 'OK' : 'Nội dung chưa phù hợp');

    return NextResponse.json({ ok: allowed, reason });
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Quá thời gian chờ GPT' : (e?.message || 'Lỗi máy chủ');
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 });
  }
}
