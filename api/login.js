import { checkPassword, loginCookie, readJson, send } from "./_lib.js";
export default async function handler(req, res) {
  if (req.method === "DELETE") { res.setHeader("Set-Cookie", "fg=; Path=/; Max-Age=0"); return send(res, 200, { ok: true }); }
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const { password } = await readJson(req);
  if (!checkPassword(password)) { await new Promise(r => setTimeout(r, 800)); return send(res, 401, { error: "wrong_password" }); }
  res.setHeader("Set-Cookie", loginCookie());
  send(res, 200, { ok: true });
}
