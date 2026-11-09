import { authed, readJson, send } from "./_lib.js";

function parse(text) {
  const t = String(text || "").replace(/^```(?:json)?|```$/gm, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return JSON.parse(t.slice(a, b + 1));
}

export default async function handler(req, res) {
  if (!authed(req)) return send(res, 401, { code: "login" });
  if (req.method !== "POST") return send(res, 405, { code: "method" });
  const { prompt, fast } = await readJson(req);
  if (!prompt || prompt.length > 60000) return send(res, 400, { code: "invalid_request" });
  try {
    let text;
    if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 8192, ...(fast ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } })
      });
      const j = await r.json();
      if (r.status === 429) return send(res, 429, { code: "rate_limited" });
      if (!r.ok) { console.error("gemini", r.status, j.error?.message); return send(res, 502, { code: "upstream_error", message: j.error?.message }); }
      text = j.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    } else if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env.AI_MODEL || "claude-haiku-5-5", max_tokens: 6000, messages: [{ role: "user", content: prompt }] })
      });
      const j = await r.json();
      if (r.status === 429) return send(res, 429, { code: "rate_limited" });
      if (!r.ok) return send(res, 502, { code: "upstream_error", message: j.error?.message });
      text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    } else return send(res, 503, { code: "ai_missing" });
    try { return send(res, 200, parse(text)); } catch { console.error("ai invalid_json", text.length, text.slice(-200)); return send(res, 502, { code: "invalid_json" }); }
  } catch (e) { console.error("ai error", e); send(res, 502, { code: "upstream_error", message: String(e.message || e) }); }
}
