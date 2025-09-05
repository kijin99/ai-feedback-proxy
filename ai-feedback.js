// Vercel Serverless Function (Node.js)
// 경로: api/ai-feedback.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*"); // 운영시 허용 도메인으로 바꾸기 권장
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");

  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { code, submittedAt } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "No code submitted" });
    }

    // 간단 복붙 의심 휴리스틱
    const codeLength = code.length;
    const diffSec = submittedAt ? Math.max(0, Math.floor((Date.now() - new Date(submittedAt).getTime()) / 1000)) : 0;
    const suspicious = (diffSec < 5 && codeLength > 200) || (diffSec < 20 && codeLength > 600);
    const suspicion = suspicious ? `⚠️ 제출 ${diffSec}s / ${codeLength}자 → 복붙 의심` : "";

    // 기본 피드백 (백업)
    let feedback =
      "코드 목적을 한 문장으로 설명해보세요.\n경계값(빈 입력/0/음수) 처리와 간단한 테스트 2~3개를 추가해보세요.";

    // Gemini 호출
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = [
        "당신은 초보 친화형 코딩 멘토입니다.",
        "아래 학생 코드를 보고 4~6줄로 간단히 피드백하세요:",
        "- 잘한 점 1~2개",
        "- 부족한 점/버그 가능성",
        "- 개선 포인트(가독성/함수 분리/에러 처리/테스트 제안 중 2~3개)",
        "",
        "학생 코드:",
        "```",
        code,
        "```",
      ].join("\n");
      const result = await model.generateContent(prompt);
      feedback = result.response.text();
    }

    return res.json({ success: true, suspicion, feedback });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "INTERNAL", detail: String(e?.message || e) });
  }
}
