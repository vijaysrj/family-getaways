# Our Family Getaways

Family vacation planner: holiday and long-weekend finder, trip ideas, to-dos, bookings, day-by-day plans and diary, AI ideas on the go, and photos saved straight to Google Photos.

Static `index.html` + `shim.js`, with small Vercel functions in `api/`.

Settings (Vercel environment variables):
- `APP_PASSWORD` – the family password
- `AUTH_SECRET` – random string for signing the login cookie
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` – Upstash Redis (added by the Vercel Marketplace integration)
- `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) – for AI ideas; optional `GEMINI_MODEL` / `AI_MODEL`
- `GOOGLE_CLIENT_ID` – OAuth web client for Google Photos uploads

Each year's public holidays: add `holidays/<year>.json` and list the year in `holidays/index.json`.

New places each year: add `places/<year>.json` (an array of `{id, name, kind: "india"|"abroad", region, months[], cost: [lo, hi] in ₹ thousands for the family, days, why, visa?}`) and list the file in `places/index.json`. Places already in the app (same id or name) are skipped.

Weather: trip pages show morning, afternoon, evening and night temperatures for each day from Open-Meteo (free, no key), fetched in the browser when a trip opens. Within about 15 days it's the live forecast; further out it's the average of the same dates over the last 3 years. The packing list gets weather items (warm wear, rain gear, sun and heat gear) added or removed to match. Places can carry optional `lat`/`lon`; otherwise a built-in list or a place search is used, and the family can change the town on the trip page.
