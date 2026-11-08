import crypto from "node:crypto";

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const setup = () => ({
  storage: !!(RURL && RTOK),
  password: !!process.env.APP_PASSWORD,
  ai: !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY),
  google: process.env.GOOGLE_CLIENT_ID || ""
});

export async function redis(...cmd) {
  const r = await fetch(RURL, { method: "POST", headers: { Authorization: `Bearer ${RTOK}` }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
export async function pipeline(cmds) {
  const r = await fetch(RURL.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: `Bearer ${RTOK}` }, body: JSON.stringify(cmds) });
  const j = await r.json();
  return j.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

const token = () => crypto.createHmac("sha256", process.env.AUTH_SECRET || "x").update("v1:" + (process.env.APP_PASSWORD || "")).digest("hex");
export function checkPassword(p) {
  const a = Buffer.from(String(p || "")), b = Buffer.from(process.env.APP_PASSWORD || "");
  return !!process.env.APP_PASSWORD && a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function loginCookie() {
  return `fg=${token()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
}
export function authed(req) {
  if (!process.env.APP_PASSWORD) return false;
  const m = /(?:^|;\s*)fg=([a-f0-9]{64})/.exec(req.headers.cookie || "");
  return !!m && crypto.timingSafeEqual(Buffer.from(m[1]), Buffer.from(token()));
}
export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  const s = Buffer.concat(chunks).toString("utf8");
  return s ? JSON.parse(s) : {};
}
