// Fallback relay for the Google Photos upload step, used only if the browser can't call Google directly.
// The photo passes through to Google; nothing is stored here.
import { authed, send } from "./_lib.js";
export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  if (!authed(req)) return send(res, 401, { error: "login" });
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const tok = req.headers["x-google-token"], type = req.headers["x-upload-type"] || "image/jpeg";
  if (!tok) return send(res, 400, { error: "no_token" });
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
    method: "POST",
    headers: { Authorization: "Bearer " + tok, "Content-type": "application/octet-stream", "X-Goog-Upload-Content-Type": type, "X-Goog-Upload-Protocol": "raw" },
    body: Buffer.concat(chunks)
  });
  const text = await r.text();
  if (!r.ok) return send(res, r.status, { error: text.slice(0, 300) });
  send(res, 200, { uploadToken: text });
}
