# NEXT_SESSION_PLAN_AF — Admin coverage audit + AE follow-ups

**Generated:** 2026-06-30, end of Session AE.
**Owner:** Once Were Wild Travel (oncewerewild.com).
**Read this BEFORE you touch any code.** It tells you everything the previous agent left unfinished, what the user explicitly asked for, and what to ship in what order.

---

## 0. Pre-flight (DO FIRST, every session)

1. `cd /app && git status && git log --oneline -10` — confirm you're on the latest commit. The repo should already be checked out into `/app`.
2. Restore the .env files (the repo does NOT carry them — see HANDOVER §11):
   - `/app/backend/.env` — `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `OTP_LOGIN_ENABLED="false"`, `SENDER_EMAIL`, `RESEND_API_KEY` (blank ok), `PUBLIC_SITE_URL`, `CORS_ORIGINS="*"`.
   - `/app/frontend/.env` — `REACT_APP_BACKEND_URL=https://170bcf25-942f-44a3-b7ed-d560a9798f92.preview.emergentagent.com`, `WDS_SOCKET_PORT=443`, `ENABLE_HEALTH_CHECK=false`.
3. `pip install -r /app/backend/requirements.txt -q` and `cd /app/frontend && ls node_modules/.bin/craco` (yarn install only if missing).
4. `sudo supervisorctl restart all` and confirm all 4 services (backend, frontend, mongodb, nginx-code-proxy) are RUNNING. Smoke: `curl -s http://localhost:8001/api/journeys | python3 -m json.tool | head -20`.
5. **Run `python3 /app/backend/sync_from_live.py` in BACKGROUND.** It takes ~2-3 minutes. The previous session already ran it on 2026-06-30 (media 309), but the client may have uploaded more since. Wait for `== DONE ==` in `/tmp/sync.log` before doing any content-key audit work, otherwise you'll add keys against a stale DB.
6. `cat /app/memory/test_credentials.md` — confirm admin = `info@oncewerewild.com` / `ChangeMe-OWW-2026!`.
7. Read `HANDOVER.md` Section AE (the most recent) so you understand what was just shipped. **Do NOT redo AE work.**

---

## 1. End-of-AE outstanding items (clear these FIRST before starting the audit)

### 1.1 Frontend test for AE (highest priority — 10 min)
The user paused before running `auto_frontend_testing_agent` for AE. Run it now.

**Task to pass to `auto_frontend_testing_agent`:**

```
PREVIEW URL: https://170bcf25-942f-44a3-b7ed-d560a9798f92.preview.emergentagent.com
ADMIN: info@oncewerewild.com / ChangeMe-OWW-2026!

TEST 1 - About sister brands rendering
  - Navigate to /about, scroll to bottom.
  - Confirm [data-testid="about-sister-brands"] exists.
  - Confirm 2 cards: [data-testid="sister-card-0"] and [data-testid="sister-card-1"].
  - Confirm sister-card-0 anchor href = "https://lillypillys.com.au" and target="_blank".
  - Confirm sister-card-1 anchor href = "https://momentsbycottageinthewoods.com" and target="_blank".
  - Confirm sister-title visible text contains "stay and gather" and an <em> tag exists inside it (italic markup).
  - Confirm 360px viewport: section renders single-column stacked (md: breakpoint).

TEST 2 - Dual phone numbers on Contact page
  - Navigate to /contact at 1920px viewport.
  - Confirm exactly 2 [data-testid^="contact-phone-row-"] elements.
  - Confirm contact-phone-row-0 contains "Adele:" + a clickable tel link with href starting with "tel:+61".
  - Confirm contact-phone-row-1 contains "Barbara:" + a clickable tel link with href starting with "tel:+61".
  - Confirm the phone hrefs have NO spaces/parens (e.g. tel:+61408943002 not tel:+61 408 943 002).

TEST 3 - Dual phone numbers on Footer
  - On / (home page), scroll to footer.
  - Confirm 2 [data-testid^="footer-phone-row-"] with Adele: and Barbara:.
  - Confirm 360px viewport: phone rows wrap cleanly (no overflow).

TEST 4 - Admin round-trip for sister brands
  - Login at /admin, navigate to /admin/website-text.
  - Open "About page" group.
  - Change about.sister.0.name from "Lillypillys Country Cottages" to "TEST Lillypillys".
  - Save.
  - Reload /about. Confirm the first card now shows "TEST Lillypillys".
  - Revert via admin back to "Lillypillys Country Cottages".

TEST 5 - Admin round-trip for phone numbers
  - From /admin/settings, change contact_phone_1_label to "Test Mum:" and contact_phone_1_number to "+61 400 111 222".
  - Save.
  - Reload /contact. Confirm contact-phone-row-0 shows "Test Mum:" and the tel link href is "tel:+61400111222".
  - Revert via admin: contact_phone_1_label = "Adele:", contact_phone_1_number = "+61 408 943 002".

TEST 6 - Console clean
  - During all the above, zero console errors. Especially watch for "useRichText returned object" warnings.

Report PASS/FAIL into /app/test_result.md as a new agent_communication entry under the AE block (matching prior testing reports).
```

**Acceptance:** all 6 PASS. If any fails, fix BEFORE moving to Section 2.

### 1.2 Snapshot regen (1 min)
The previous session saved the snapshot mid-session with phone numbers pre-populated. If the live sync at pre-flight pulled new media/content, regen the snapshot before any deploy:

```bash
TOKEN=$(curl -sS -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"info@oncewerewild.com","password":"ChangeMe-OWW-2026!"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
curl -sS -X POST http://localhost:8001/api/admin/snapshot/save -H "Authorization: Bearer $TOKEN"
```

### 1.3 If user wants to deploy AE now, STOP for them to push (NOT YOUR JOB)
You do NOT push to GitHub. The user clicks "Save to Github" in the chat input. If asked to push by yourself, refuse and direct them to that button (see support_agent rules in the system prompt).

---

## 2. Session AF — Admin coverage audit (the user's main ask)

### 2.1 User's exact words (verbatim)
> "Also the Website Text and Website Images and Videos section in the admin panel should be completely in sync with the website and all the relevant editing options should be available there."

### 2.2 User-chosen scope (Q&A captured 2026-06-30)
- **B1 = b**: Full audit. Open every public page, list every visible string, ensure each maps to a content key. Add what's missing.
- **B2 = a**: Just verify the existing Website Media flow works and document it. **No new UI** (no per-page filtering or tagging). The media library at /admin/website-media already supports Add / Replace / Delete (shipped in Session AA), and per-page picker UIs (Home Content, Journeys, Blog) all consume from it.
- **B3 = "do nothing for now"**: the specific gaps the previous agent enumerated (see §2.4 below) are NOT in scope for AF.

### 2.3 What "in sync" means in practice
Every visible string on the public site should fall into one of:
1. A content key editable from `/admin/website-text` (preferred for headings, body copy, buttons).
2. A site_setting editable from `/admin/settings` (only for contact info / footer tagline / social URLs / phone numbers).
3. A journey/blog/about_block/home_faq/story row editable from its respective admin page (already covered).

If a string is hardcoded in JSX and the client may ever want to re-word it, it must be moved to (1).

For media (images + videos) on the public site:
- Hero photos, About hero, Page hero photos → already use `useMediaSlot` (named slots in `/admin/website-media`).
- Journey hero + gallery → already use `gallery_media_ids` / `hero_media_id` on the Journey row (admin pickers in `/admin/journeys`).
- Blog cover → already use `cover_media_id` on the Blog row.
- Travel gallery → already uses `travel_gallery` section in media library.
- Testimonials → currently use hardcoded `<Leaf />` lucide icons (no photos). LEAVE AS IS — out of scope unless client asks.

### 2.4 Items the user explicitly said "do nothing for now" (DO NOT TOUCH)
These are real hardcoded strings the previous agent flagged, but the user chose to defer them. Leave them alone:
- The 2-col H3s inside the Inclusions tab on /tours/<slug>: "What's Included" / "What's Not Included" — these pair as a 2-column section and the client wants to keep them as-is.
- The "Itinerary" / "More Details" / "Practical information" sub-headings inside the Details tab on /tours/<slug>.
- The "Investment" / "Dates" eyebrow labels in the Prices & Dates tab.
- The "Sister brand" tile eyebrow on /about (the small "SISTER BRAND" label above each card).
- The "Our Story" / "Field Notes" / "Stories from the road." section labels on /about.

Note them in your handover if you discover more variants, but do NOT make them editable.

### 2.5 The audit method (do this in order)

**Phase AF1 — Discovery (no code changes yet, 20-30 min)**
1. For each public page below, open it in the browser at 1920x800 AND 360x720 and do a visual walkthrough. Make a checklist of every visible string and whether it's editable or hardcoded.
   - `/` (home)
   - `/pricing` (Journeys list)
   - `/tours/maleny-creative-immersion-retreat` (one full tour-detail page — Maleny has the most content seeded)
   - `/gallery`
   - `/blog`
   - `/blog/<first-post-slug>` (the one published post)
   - `/about`
   - `/contact`
   - `/404` (try /this-does-not-exist)
   - Cookie banner (clear localStorage between checks: `localStorage.removeItem('oww-cookie-consent')`)
   - Footer (across all pages)
   - Nav bar (across all pages)

2. For each hardcoded string you find, decide:
   - **MAKE EDITABLE** — string is body copy, headings, buttons, eyebrows, error messages a non-dev might want to rephrase.
   - **SKIP** — it's part of the §2.4 exclusion list OR it's UI machinery (e.g. "Open menu", "Close lightbox") OR it's a date/time format string.
   - **SKIP** — it's already covered by an existing content key (verify by grepping `useText(` in the file).

3. Output the discovery list as a markdown table at `/app/memory/AF_AUDIT_DISCOVERY.md` with columns: `page | string | file:line | suggested_key | group | type (text/richtext)`. Show this to the user BEFORE making any code changes if the list exceeds 40 keys, so they can prioritize.

**Phase AF2 — Implementation (1-2 hrs, the bulk of AF)**
1. Add the new keys to `DEFAULT_CONTENT` in `backend/server.py`. Group them logically under existing groups (`home`, `pricing`, `gallery`, `blog`, `about`, `contact`, `footer`, `nav`, `brand`, `seo`) — only create a new group if no existing one fits.
2. Update the relevant JSX file to consume each new key via `useText("the.new.key", "current hardcoded default")` so the fallback exactly matches what was there before (no public visual change).
3. If any key needs richtext (italic markers), use `useRichText` instead and render the result as React node children (NOT `dangerouslySetInnerHTML` — that's the bug that bit AE; see HANDOVER §AE for context).
4. For groups not yet listed in `/admin/website-text`, extend `WebsiteText.jsx` `GROUP_LABELS` / `GROUP_ORDER` / `GROUP_PREVIEW_TARGETS` (the same pattern Session AC used for `blog` and Session AE used for `about`).
5. Restart backend so the seed loop ($setOnInsert) creates the new rows. `curl -sS http://localhost:8001/api/content | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))"` should grow by the exact number of keys added.
6. Rebuild the frontend (`cd /app/frontend && rm -rf build && yarn build && sudo supervisorctl restart frontend`).
7. Visual smoke: open each page at 1920 + 360 and confirm zero visible regressions.
8. `POST /api/admin/snapshot/save` so the snapshot.json captures the new keys for deploy.

**Phase AF3 — Website Media verification (15 min, no code changes — B2 = a)**
1. Login at `/admin`, open `/admin/website-media`.
2. Confirm Add / Replace / Delete buttons all work for at least one image and one video.
3. Confirm the media library lists all 309 (or current count) items, can filter by section pill, and shows the section badges.
4. Visit `/admin/journeys` → open Maleny → confirm the "Photo gallery" picker opens a modal that lists ALL library media (filterable by section) and clicking "Add" on a tile inserts the ID into `gallery_media_ids`.
5. Same for `/admin/blog` → cover photo picker → `/admin/home-content` → each named media slot.
6. Write a 5-line summary into HANDOVER for the client confirming: "every image and video that appears on the public site is uploaded once to /admin/website-media, then picked from the per-page admin screens — no duplicate uploads, no orphan files (the AC media-cleanup job purges those on a schedule)."

**Phase AF4 — Backend test + frontend smoke (30 min)**
1. `deep_testing_backend_v2` task: verify the N new content keys are seeded with the documented defaults, admin round-trip works for at least 3 of them, idempotence across `supervisorctl restart backend`, regression on /api/journeys + /api/media + /api/blog + /api/auth/login.
2. Visual smoke on each public page at 1920 + 360 (you, not the testing agent).
3. **STOP and ask the user before running `auto_frontend_testing_agent` for AF.** Frontend testing is opt-in per testing protocol.

**Phase AF5 — Handover update**
1. Update `HANDOVER.md` title with `+ AF (admin coverage audit, N new content keys, every visible word now editable)`.
2. Insert a new AF section in "What's been built" listing every key added, grouped by page.
3. Update `memory/PRD.md` with the AF entry.
4. Rename `memory/NEXT_SESSION_PLAN_AF.md` → `.done.md` once everything passes.
5. Delete `memory/AF_AUDIT_DISCOVERY.md` (or keep it as the change log — your call).

### 2.6 Sanity checks (run after Phase AF2)
- Total content keys delta should be +30 to +80 (educated estimate based on the discovery the previous agent did).
- Snapshot.json file size grows proportionally; should still be < 500KB.
- No JS console errors on any page (especially the `[object Object]` bug from AE — `useRichText` is a footgun).
- The new keys appear in `/admin/website-text` under the right group (the GROUP_ORDER controls render order; pick a sensible position).
- Em-dash policy: NO em dashes in any user-facing string. Use hyphens. The previous AE additions are already compliant.

---

## 3. Open backlog (P2 / P3 — do NOT pick up unless user explicitly asks)
Same as the end-of-AD list — none of these blocked AE and none block AF:
- `backend/server.py` module refactor (3,772 lines — getting big).
- 95MB upload guard on `/admin/media`.
- Pause/Play control on the home hero slideshow.
- Mobile Lighthouse audit re-run after AE (and AF) ship.

---

## 4. Hard rules the user has restated multiple times — DO NOT BREAK
- **Every public-site string and every public-site image/video must be editable from admin.** This is the entire reason AF exists.
- **No em dashes** in any user-facing copy. Use hyphens.
- **No new mocks.** If something needs a third-party API, ask the user for keys first via the chat (don't assume Emergent LLM key applies — phone-system / map / etc. are out of scope here).
- **No changes to .env files** that already exist (REACT_APP_BACKEND_URL, MONGO_URL are protected).
- **No git pushes from you.** The user pushes via the "Save to Github" button.
- **Use UUIDs, not Mongo ObjectIds**, for any new collections you add (you shouldn't need to add new ones for AF).
- **Existing visual design is sacred** unless the client explicitly asks for a change. AF should be a content-extraction pass with ZERO visual diff.

---

## 5. Quick reference — credentials, URLs, file paths

- Preview URL: `https://170bcf25-942f-44a3-b7ed-d560a9798f92.preview.emergentagent.com`
- Admin email / password: `info@oncewerewild.com` / `ChangeMe-OWW-2026!`
- Repo: cloned into `/app` (the `.git` folder is preserved; the user pushes via Save to Github)
- Backend: FastAPI at `localhost:8001` via supervisor.
- Frontend: served from `/app/frontend/build` at `localhost:3000` (production build mode, NOT hot reload — `rm -rf build && yarn build && sudo supervisorctl restart frontend` after each frontend code change).
- Snapshot: `/app/backend/seed_data/site_snapshot.json` (~378KB at end of AE, 201 content keys, 14 settings, 309 media).
- Live sync script: `python3 /app/backend/sync_from_live.py` (runs ~2-3 min, ALWAYS in background, watch `/tmp/sync.log`).

Good luck.
