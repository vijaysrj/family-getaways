import { authed, setup, send } from "./_lib.js";
export default function handler(req, res) {
  send(res, authed(req) ? 200 : 401, { ok: authed(req), setup: setup() });
}
