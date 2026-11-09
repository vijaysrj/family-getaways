import { authed, redis, pipeline, readJson, send, setup } from "./_lib.js";
import fs from "node:fs";
const seed = JSON.parse(fs.readFileSync(new URL("./_seed.json", import.meta.url), "utf8"));

const COLS = ["holidays", "destinations", "prefs", "trips", "research"];
const key = c => "fg:c:" + c;
const ok = (c, id) => COLS.includes(c) && /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(id || "x");

async function ensureSeed() {
  if (await redis("EXISTS", "fg:seeded")) return;
  const cmds = [];
  for (const c of COLS) for (const [id, d] of Object.entries(seed[c] || {})) cmds.push(["HSETNX", key(c), id, JSON.stringify(d)]);
  cmds.push(["SET", "fg:seeded", "1"]);
  await pipeline(cmds);
}

export default async function handler(req, res) {
  if (!authed(req)) return send(res, 401, { error: "login" });
  if (!setup().storage) return send(res, 503, { error: "storage_missing" });
  try {
    if (req.method === "GET") {
      await ensureSeed();
      const all = await pipeline(COLS.map(c => ["HGETALL", key(c)]));
      const out = {};
      COLS.forEach((c, i) => { const a = all[i] || [], o = {}; for (let j = 0; j < a.length; j += 2) o[a[j]] = JSON.parse(a[j + 1]); out[c] = o; });
      return send(res, 200, out);
    }
    const { c, id, data } = await readJson(req);
    if (!ok(c, id)) return send(res, 400, { error: "bad_path" });
    if (req.method === "PUT") {
      const s = JSON.stringify(data ?? {});
      if (s.length > 900000) return send(res, 413, { error: "too_large" });
      await redis("HSET", key(c), id, s);
      return send(res, 200, { ok: true });
    }
    if (req.method === "DELETE") { await redis("HDEL", key(c), id); return send(res, 200, { ok: true }); }
    send(res, 405, { error: "method" });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}
