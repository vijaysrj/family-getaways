/* Our Family Getaways: connects the app to its own server (login, saving, AI ideas) and to Google Photos. */
(function () {
  "use strict";
  const COLS = ["holidays", "destinations", "prefs", "trips", "research"];
  let state = null, setupInfo = null, me = null, polling = null;
  const subs = [];
  const dirty = {}; // "c/id" -> time of last local write, so a poll doesn't undo typing in progress

  /* ---------- login screen ---------- */
  const css = `#fg-login{position:fixed;inset:0;z-index:100;overflow:auto;background:#fffaf4;color:#2b1d12;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#fg-login .sky{position:relative;background:linear-gradient(180deg,#ffb36b 0%,#ffd8a8 55%,#fff1e0 100%);padding:28px 16px 120px;text-align:center;overflow:hidden}
#fg-login .sun{position:absolute;left:50%;top:150px;width:220px;height:220px;margin-left:-110px;border-radius:50%;background:radial-gradient(circle,#fff3bf 0 45%,rgba(255,243,191,.35) 46% 62%,transparent 63%)}
#fg-login .brand{position:relative;display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:1.05rem}
#fg-login h1{position:relative;font-size:clamp(2rem,7vw,3.4rem);line-height:1.05;margin:26px auto 12px;max-width:14ch;letter-spacing:-.01em}
#fg-login .tag{position:relative;max-width:40ch;margin:0 auto;color:#5c3d24;font-size:1.05rem}
#fg-login .hills{position:absolute;left:0;right:0;bottom:0;width:100%;height:120px}
#fg-login form{position:relative;max-width:380px;margin:-70px auto 0;background:#fff;border:1px solid #f1dfcf;border-radius:22px;padding:22px;box-shadow:0 18px 50px rgba(120,60,0,.12)}
#fg-login form label{display:block;font-weight:700;font-size:.9rem;margin-bottom:8px}
#fg-login input{width:100%;box-sizing:border-box;font-size:1rem;padding:12px 14px;border:1.5px solid #ead7c6;border-radius:12px;margin-bottom:10px;background:#fffaf4}
#fg-login button{width:100%;font-size:1rem;font-weight:800;padding:13px;border:0;border-radius:12px;color:#fff;background:linear-gradient(90deg,#f59f00,#f76707);cursor:pointer}
#fg-login .err{color:#c92a2a;font-size:.88rem;min-height:1.2em;margin-top:8px;text-align:center}
#fg-login .feats{max-width:1040px;margin:34px auto 0;padding:0 16px 40px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
#fg-login .feat{background:#fff;border:1px solid #f3e4d6;border-radius:18px;padding:16px}
#fg-login .feat i{font-style:normal;font-size:1.5rem}#fg-login .feat b{display:block;margin:6px 0 4px}#fg-login .feat span{color:#7a6656;font-size:.9rem}
#fg-login .note{text-align:center;color:#9a8473;font-size:.8rem;padding:0 16px 30px}
#fg-login .card{max-width:380px;margin:-70px auto 0;position:relative;background:#fff;border-radius:22px;padding:22px;border:1px solid #f1dfcf}#fg-login ul{color:#5c4a3c;font-size:.92rem}`;
  const FEATS = [["📅", "Every long weekend, found", "Public holidays turned into breaks, with the leave days you'd need."],
    ["🧭", "Places for each season", "Ideas in India and abroad that skip the rains, with rough costs."],
    ["✅", "To-dos and bookings", "Tickets, hotels, visas and packing, in one shared list."],
    ["✨", "Ideas on the go", "Ask what to do right now, with your trip already filled in."],
    ["📷", "Diary and photos", "A note for each day, photos saved to Google Photos."]];
  function loginScreen(info) {
    return new Promise(resolve => {
      const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      const d = document.createElement("div"); d.id = "fg-login";
      const missing = [!info.password && "a family password (APP_PASSWORD)", !info.storage && "the Upstash Redis database"].filter(Boolean);
      const top = `<div class="sky"><div class="sun"></div><div class="brand"><img src="/icon.svg" width="34" height="34" alt="">Our Family Getaways</div>
        <h1>Plan every holiday together</h1><p class="tag">Long weekends, trip ideas, to-dos and memories for the four of us, in one place.</p>
        <svg class="hills" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70 Q200 20 420 60 T820 50 T1200 60 V120 H0Z" fill="#ffe1bf"/><path d="M0 95 Q260 55 520 88 T1000 80 T1200 86 V120 H0Z" fill="#fffaf4"/></svg></div>`;
      d.innerHTML = top + (missing.length
        ? `<div class="card"><b>Almost ready</b><p>The app still needs these in Vercel settings:</p><ul>${missing.map(m => `<li>${m}</li>`).join("")}</ul></div>`
        : `<form><label for="fg-pw">Family password</label><input id="fg-pw" type="password" autocomplete="current-password" required autofocus><button>Open our planner</button><div class="err"></div></form>`)
        + `<div class="feats">${FEATS.map(f => `<div class="feat"><i>${f[0]}</i><b>${f[1]}</b><span>${f[2]}</span></div>`).join("")}</div><div class="note">Private to our family. You stay signed in on this device.</div>`;
      const mount = () => document.body.appendChild(d);
      document.body ? mount() : document.addEventListener("DOMContentLoaded", mount);
      const f = d.querySelector("form"); if (!f) return;
      f.addEventListener("submit", async e => {
        e.preventDefault(); const err = d.querySelector(".err"); err.textContent = "";
        const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: d.querySelector("input").value }) });
        if (r.ok) { d.remove(); resolve(); } else err.textContent = r.status === 401 ? "That password didn't work." : "Couldn't sign in. Try again.";
      });
    });
  }
  document.addEventListener("click", async e => {
    const b = e.target.closest && e.target.closest("#signout"); if (!b) return;
    try { await fetch("/api/login", { method: "DELETE" }); } catch (_) {}
    try { sessionStorage.removeItem("fg-gtok"); } catch (_) {}
    location.href = "/";
  });
  async function ensureLogin() {
    if (me) return me;
    me = (async () => {
      const r = await fetch("/api/me"); const j = await r.json(); setupInfo = j.setup;
      if (!j.ok) await loginScreen(j.setup);
      if (setupInfo.google) window.GP = makeGP(setupInfo.google);
      return true;
    })();
    return me;
  }

  /* ---------- data: same shape the app expects (collections, docs, live snapshots) ---------- */
  let staticHol = null;
  async function loadStaticHolidays() {
    if (staticHol) return staticHol;
    staticHol = {};
    try {
      const idx = await (await fetch("/holidays/index.json", { cache: "no-cache" })).json();
      await Promise.all((idx.years || []).map(async y => { try { staticHol[y] = await (await fetch(`/holidays/${y}.json`, { cache: "no-cache" })).json(); } catch (_) {} }));
    } catch (_) {}
    return staticHol;
  }
  let staticPlaces = null;
  async function loadStaticPlaces() {
    if (staticPlaces) return staticPlaces;
    staticPlaces = [];
    try {
      const idx = await (await fetch("/places/index.json", { cache: "no-cache" })).json();
      for (const f of idx.files || []) { try { const a = await (await fetch("/places/" + f, { cache: "no-cache" })).json(); staticPlaces.push(...(Array.isArray(a) ? a : [])); } catch (_) {} }
    } catch (_) {}
    return staticPlaces;
  }
  async function fetchAll() {
    const r = await fetch("/api/db", { credentials: "same-origin" });
    if (r.status === 401) { me = null; location.reload(); return; }
    if (!r.ok) throw { code: "unavailable", message: (await r.json().catch(() => ({}))).error || r.statusText };
    const data = await r.json();
    const sh = await loadStaticHolidays();
    for (const y in sh) if (!data.holidays[y]) data.holidays[y] = sh[y]; // yearly lists shipped with the site fill in missing years
    const norm = x => String(x || "").toLowerCase().replace(/[^a-z]/g, "");
    const have = new Set(Object.values(data.destinations).map(d => norm(d.name)));
    for (const p of await loadStaticPlaces()) if (p && p.id && !data.destinations[p.id] && !have.has(norm(p.name))) { data.destinations[p.id] = p; have.add(norm(p.name)); } // new places added each year
    const now = Date.now();
    if (state) for (const k in dirty) { if (now - dirty[k] < 8000) { const [c, id] = k.split("/"); if (state[c][id] === undefined) delete data[c][id]; else data[c][id] = state[c][id]; } else delete dirty[k]; }
    state = data; notify();
  }
  const snapCol = c => { const docs = Object.entries(state[c] || {}).map(([id, d]) => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(d)) })); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }; };
  const snapDoc = (c, id) => { const d = state[c] && state[c][id]; return { id, exists: d !== undefined, data: () => d === undefined ? undefined : JSON.parse(JSON.stringify(d)) }; };
  function notify() {
    for (const s of subs) {
      const v = s.id ? state[s.c] && state[s.c][s.id] : state[s.c];
      const sig = JSON.stringify(v === undefined ? null : v);
      if (sig === s.last) continue; s.last = sig;
      try { s.cb(s.id ? snapDoc(s.c, s.id) : snapCol(s.c)); } catch (e) { console.error(e); }
    }
  }
  function startPolling() {} // no background checks: data loads when the app opens or is refreshed
  function subscribe(c, id, cb, err) {
    const s = { c, id, cb, last: undefined }; subs.push(s);
    (state ? Promise.resolve() : (subscribe.p = subscribe.p || fetchAll())).then(() => { if (s.last === undefined) { notify(); } startPolling(); }, e => err && err(e));
    return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); };
  }
  async function write(method, c, id, data) {
    dirty[c + "/" + id] = Date.now();
    if (method === "PUT") state[c][id] = JSON.parse(JSON.stringify(data)); else delete state[c][id];
    notify();
    const r = await fetch("/api/db", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c, id, data }) });
    if (!r.ok) throw { code: "write_failed", message: (await r.json().catch(() => ({}))).error || r.statusText };
    dirty[c + "/" + id] = Date.now();
  }
  const db = {
    collection: c => ({ onSnapshot: (cb, err) => subscribe(c, null, cb, err), doc: id => db.doc(c + "/" + id) }),
    doc: path => { const [c, id] = path.split("/"); return {
      onSnapshot: (cb, err) => subscribe(c, id, cb, err),
      get: async () => { if (!state) await fetchAll(); return snapDoc(c, id); },
      set: data => write("PUT", c, id, data),
      update: data => write("PUT", c, id, { ...(state[c][id] || {}), ...data }),
      delete: () => write("DELETE", c, id)
    }; }
  };

  /* ---------- AI ideas ---------- */
  async function aiJson(prompt, opts = {}) {
    let r;
    try { r = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: typeof prompt === "string" ? prompt : prompt.map(m => m.content).join("\n\n") }), signal: opts.signal }); }
    catch (e) { throw { code: e.name === "AbortError" ? "cancelled" : "upstream_error", message: String(e) }; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { code: j.code || "upstream_error", message: j.message || r.statusText };
    return j;
  }
  const sample = Object.assign(async (p, o) => ({ text: JSON.stringify(await aiJson(p, o)) }), { json: aiJson });

  window.claude = {
    use: async name => {
      await ensureLogin();
      if (name === "db") return setupInfo.storage ? db : null;
      if (name === "sample") return setupInfo.ai ? sample : null;
      return null;
    }
  };

  /* ---------- Google Photos: photos go straight to the family's own Google Photos ---------- */
  function makeGP(clientId) {
    const SCOPES = "https://www.googleapis.com/auth/photoslibrary.appendonly https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata";
    let tok = null, exp = 0, client = null, gis = null, relay = false;
    const loadGis = () => gis || (gis = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = res; s.onerror = () => rej(new Error("Couldn't load Google sign-in")); document.head.appendChild(s); }));
    try { const c = JSON.parse(sessionStorage.getItem("fg-gtok") || "null"); if (c && c.exp > Date.now() + 60000) { tok = c.tok; exp = c.exp; } } catch (_) {}
    async function token(interactive) {
      if (tok && Date.now() < exp - 60000) return tok;
      if (!interactive) return null;
      await loadGis();
      return new Promise((res, rej) => {
        client = google.accounts.oauth2.initTokenClient({
          client_id: clientId, scope: SCOPES,
          callback: r => { if (r.error) return rej({ code: "denied", message: r.error }); tok = r.access_token; exp = Date.now() + (r.expires_in || 3600) * 1000; try { sessionStorage.setItem("fg-gtok", JSON.stringify({ tok, exp })); } catch (_) {} res(tok); },
          error_callback: e => rej({ code: e && e.type === "popup_closed" ? "popup" : "denied", message: (e && e.message) || "Google sign-in failed" })
        });
        client.requestAccessToken({ prompt: "" });
      });
    }
    const api = async (path, opts = {}) => {
      const r = await fetch("https://photoslibrary.googleapis.com/v1/" + path, { ...opts, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(opts.headers || {}) } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw { code: "google_" + r.status, status: r.status, message: (j.error && j.error.message) || r.statusText };
      return j;
    };
    async function shrinkForRelay(f) {
      if (f.size < 4.2e6) return f;
      const bmp = await createImageBitmap(f, { imageOrientation: "from-image" }); const m = 3000, k = Math.min(1, m / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
    }
    async function uploadBytes(f) {
      const type = f.type || "image/jpeg";
      if (!relay) {
        try {
          const r = await fetch("https://photoslibrary.googleapis.com/v1/uploads", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-type": "application/octet-stream", "X-Goog-Upload-Content-Type": type, "X-Goog-Upload-Protocol": "raw" }, body: f });
          if (r.ok) return await r.text();
          throw { code: "google_" + r.status, message: await r.text() };
        } catch (e) { if (e && e.code) throw e; relay = true; } // network/CORS refusal: send through our own relay instead
      }
      const b = await shrinkForRelay(f);
      const r = await fetch("/api/gphotos", { method: "POST", headers: { "x-google-token": tok, "x-upload-type": b.type || type }, body: b });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw { code: "upload_failed", message: j.error || r.statusText };
      return j.uploadToken;
    }
    return {
      async upload(files, o) {
        await token(true);
        let album = (o.albums || [])[o.albums.length - 1] || null, made = null;
        const newAlbum = async () => { const a = await api("albums", { method: "POST", body: JSON.stringify({ album: { title: o.albumTitle.slice(0, 500) } }) }); return { id: a.id, url: a.productUrl }; };
        if (!album) album = made = await newAlbum();
        const items = []; let failed = 0; const ups = [];
        for (let i = 0; i < files.length; i++) {
          o.progress && o.progress(i + 1, files.length);
          try { ups.push({ uploadToken: await uploadBytes(files[i]), fileName: files[i].name || `photo-${i + 1}.jpg`, f: files[i] }); } catch (e) { failed++; if (String(e.code).startsWith("google_401")) throw e; }
        }
        for (let i = 0; i < ups.length; i += 50) {
          const chunk = ups.slice(i, i + 50);
          const body = a => JSON.stringify({ albumId: a.id, newMediaItems: chunk.map(u => ({ description: o.describe(u.f).slice(0, 1000), simpleMediaItem: { uploadToken: u.uploadToken, fileName: u.fileName } })) });
          let res;
          try { res = await api("mediaItems:batchCreate", { method: "POST", body: body(album) }); }
          catch (e) { if (e.status === 400 || e.status === 403 || e.status === 404) { album = made = await newAlbum(); res = await api("mediaItems:batchCreate", { method: "POST", body: body(album) }); } else throw e; } // album belongs to another Google account: start one in this account
          for (const r of res.newMediaItemResults || []) { if (r.mediaItem) items.push({ id: r.mediaItem.id, url: r.mediaItem.productUrl, baseUrl: r.mediaItem.baseUrl, name: r.mediaItem.filename }); else failed++; }
        }
        return { album, newAlbum: !!made, items, failed };
      },
      async thumbs(ids, interactive) {
        if (!(await token(interactive))) return {};
        const out = {};
        for (let i = 0; i < ids.length; i += 50) {
          const q = ids.slice(i, i + 50).map(id => "mediaItemIds=" + encodeURIComponent(id)).join("&");
          try { const j = await api("mediaItems:batchGet?" + q); for (const r of j.mediaItemResults || []) if (r.mediaItem) out[r.mediaItem.id] = r.mediaItem.baseUrl; } catch (e) { if (e.status === 401) { tok = null; throw e; } }
        }
        return out;
      }
    };
  }
})();
