# Once Were Wild Travel — Detailed Handover (v2026-06-25)

> **Loading instructions for the next agent:**
> 1. Pull the GitHub repo (`pinnacle467/oww`, branch `main`) into `/app` — that's the source of truth for **all code**.
> 2. Immediately run the LIVE-SYNC sequence at the bottom of this doc (it's a single `python3 /app/backend/sync_from_live.py`) — that pulls **every DB row, every image, every video** from production at https://oncewerewild.com into your preview environment so you're working against real data, not an empty shell.
> 3. The sync script + repo together cost **< 10 credits** to re-hydrate the entire project; do not rebuild any of the features below from scratch.
> 4. **Respond to the user in English only.** They have explicitly disliked em dashes ("—") in user-facing copy — never use them in DB content, SEO text, alt text, JSON-LD, or seeded examples. Hyphens (`-`), commas, or colons are fine.

---

## 1. Project at a glance

- **Live site:** https://oncewerewild.com (Bluehost-hosted, Docker compose + Caddy auto-HTTPS).
- **Business:** Once Were Wild Travel — slow, women-only travel journeys (Australia, Maleny retreats, international).
- **Stack:** React 19 (CRA + craco) frontend → Express static server (`frontend/server.js`) → FastAPI backend (uvicorn) → MongoDB.
- **Storage:** `backend/uploads/` is a bind-mounted volume on Bluehost. Images are encoded to WebP + AVIF responsive variants on upload.
- **Admin email/password:** stored at `/app/memory/test_credentials.md` AND in `backend/.env` (ADMIN_EMAIL / ADMIN_PASSWORD, both wrapped in `"…"` so strip quotes when bash-substituting).
- **Live-deploy mechanism:** GitHub push from this preview → Bluehost runs `bash scripts/safe-pull.sh && ./deploy.sh`. The repo carries a `backend/seed_data/site_snapshot.json` (DB-in-a-file) that is auto-applied on container startup *with a per-collection data-loss guard* so direct prod uploads are never overwritten.

---

## 2. What's been built in this session (chronological)

### A. Live-site sync infrastructure
- **`backend/sync_from_live.py`** — pulls every media/journey/about-block/story/content/settings doc from `https://oncewerewild.com` into the preview, downloads every referenced WebP + AVIF file in parallel (24 workers, no rsync needed), and rewrites `backend/seed_data/site_snapshot.json`. **Idempotent and safe to re-run anytime.**
- `media` now mirrors live's 237 docs (89 gallery items across 4 categories including the new "GIving Back to the World" category — note the typo is intentional, it's the client's own naming).
- `journeys` has 4 entries reflecting the client's latest edits.

### B. About Us + Stories feature
- New public page at `/about` (`frontend/src/pages/About.jsx`) — hero (about-hero section in media), text blocks left 35%, Stories blog right 65%.
- New admin page at `/admin/about` (`frontend/src/pages/admin/AboutManager.jsx`) — two stacked panels: Text Blocks (add/edit/delete/reorder/visibility-toggle, heading/paragraph kinds) and Stories (add/edit/delete/reorder/visibility, cover image upload via `POST /api/admin/stories/{id}/cover`).
- Backend collections: `about_blocks` (id, kind, text, sort_order, is_visible) and `stories` (id, title, region, date, excerpt, body, cover_url, cover_srcset, cover_avif_srcset, cover_lqip, sort_order, is_visible).
- API endpoints under `/api/about-blocks`, `/api/stories`, `/api/admin/about-blocks/*`, `/api/admin/stories/*`.
- Snapshot save/apply extended to include `about_blocks` + `stories`. Per-collection safety guard in `_apply_snapshot` (`protect_media=True`) — refuses to wipe any collection that has MORE docs on live than in the incoming snapshot.

### C. Cookie banner + cookies policy
- `frontend/src/components/CookieBanner.jsx` — mounted globally in `SiteLayout`. localStorage key `oww:cookies` = `accepted` | `declined`. Fires `oww:cookie-decision` CustomEvent.
- `frontend/src/pages/CookiesPolicy.jsx` at `/cookies` — full policy + "Change my choice" reset button.
- Footer link `data-testid=footer-cookies-link` added.

### D. Nav + button styling
- "Contact" removed from `NAV_LINKS` (`frontend/src/data/content.js`) — order is now Home / Journeys / Gallery / About. Get In Touch CTA on the right.
- GET IN TOUCH button (Navbar.jsx + mobile drawer) **always** uses `bg-ink/85 + border-gold + text-white` — no more variant that turned gold-on-transparent at the top of the hero.
- Hero readability fixed: `HeroSlideshow.jsx` bottom panel switched from `glass` (12% opacity) → `glass-dark` (now 55% opacity in `index.css`). Added `drop-shadow` to the gold eyebrow line. Gradient wash strengthened from 80/15/30 to 85/30/45.

### E. Hero slideshow cycle bug
- Was: `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;` — completely killed auto-advance on any device with the OS accessibility setting on (client's Windows desktop fell into this).
- Now: always cycles. Reduce-motion only lengthens dwell (5.5s → 9s) and drops the Ken Burns zoom. matchMedia change-listener responds to runtime toggles.

### F. Contact page admin-editability (THIS SESSION'S LATEST CHANGE)
- All 20 previously-hardcoded strings on `/contact` now drive from `useText`: form field labels (`contact.form.first_name_label`, `last_name_label`, `email_label`, `phone_label`, `phone_placeholder`, `inquiry_label`, `inquiry_placeholder`, `message_label`, `message_placeholder`, `referral_label`, `referral_placeholder`), sidebar labels (`contact.info.{email,phone,address,hours}_label`), and validation errors (`contact.errors.{first_name,last_name,email,inquiry,message}`).
- Backend `GET /api/admin/content` now infers a row's `group` from the key prefix when no explicit `group` field exists — this was the critical fix that made the WebsiteText admin show "Contact page" (and all 12 other groups) instead of a single bloated "general" bucket. See `server.py` around line 829.

### G. Em-dash purge
- Stripped from DB (`about_blocks`, `stories`, `content.seo.*.description`).
- Stripped from source: `Seo.jsx`, `Home.jsx` & `Gallery.jsx` JSON-LD, `HeroSlideshow.jsx` & `ImmersiveTeaser.jsx` alt texts.
- Comments and admin-only strings kept (not user-facing).

### H. GitHub push unblocking
- 3 oversized MP4s in `backend/uploads/gallery/` were re-encoded in place (filenames preserved → DB refs intact): 134 MB→15 MB, 95 MB→21 MB, 254 MB→63 MB.
- `git filter-repo --strip-blobs-bigger-than 100M` cleaned the historical big-blob versions out of `.git`.
- Static ffmpeg/ffprobe binaries at `/app/bin/` untracked and added to `.gitignore`.
- `frontend/yarn.lock` (572 KB) was finally added to git so the Docker COPY step on Bluehost doesn't fail.

### I. Bluehost recovery tooling
- `scripts/safe-pull.sh` — POSIX-only (uses `mv` + `cp -rn` + `git`, **no rsync**). Stashes code edits, moves `backend/uploads/` to `/tmp/oww-uploads-backup-<TS>`, pulls, then layers the backup back with `cp -rn` so live-only uploads survive while git's versions win on filename collisions.
- For the very first one-time recovery (when the broken rsync version of the script is already on disk), the inline POSIX one-liner is in chat history (mv + cp -rn).

---

## 3. Code layout — what to read first

```
/app/
├── backend/
│   ├── server.py                  # 2600+ lines, single-file FastAPI app
│   │     • /api/media (GET/admin CRUD), /api/journeys, /api/about-blocks, /api/stories,
│   │       /api/content + /api/admin/content, /api/settings, /api/auth/*, /api/contact (form submit),
│   │       /api/admin/snapshot/{save,apply}, /api/admin/avif/backfill
│   │     • _write_snapshot_now() + _apply_snapshot(protect_media=True) — the deploy-safety core.
│   │     • _encode_webp_to_disk() — image upload pipeline (WebP + AVIF + LQIP + responsive srcset).
│   ├── seed_data/site_snapshot.json   # ~250 KB, the live-DB-in-a-file. AUTO-APPLIED on container startup.
│   ├── uploads/                  # bind-mounted on Bluehost. Contains every gallery item, hero, pillar, etc.
│   ├── sync_from_live.py         # one-shot live-to-preview re-hydration (parallel downloads).
│   ├── .env / .env.example       # MONGO_URL, DB_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET, RESEND_API_KEY (optional), etc.
│   └── tests/                    # pytest + curl-based smoke tests (some written by testing-agent).
├── frontend/
│   ├── server.js                 # Express static server serving the CRA build with cache-control headers.
│   ├── src/
│   │   ├── App.js                # Route table (lazy-loaded).
│   │   ├── data/content.js       # NAV_LINKS (4 items) + other static fallback strings.
│   │   ├── context/ContentContext.jsx  # useText / useRichText / useContent hooks (driven by /api/content).
│   │   ├── hooks/useMediaSlot.js + useGalleryCategories.js
│   │   ├── components/
│   │   │   ├── layout/{Navbar,Footer,SiteLayout,StickyCTA,PageHero}.jsx
│   │   │   ├── home/{HeroSlideshow,ImmersiveTeaser,...}.jsx
│   │   │   ├── gallery/MasonryGallery.jsx
│   │   │   ├── seo/Seo.jsx
│   │   │   ├── ui/FadeImg.jsx    # <picture> tag with AVIF + WebP + LQIP placeholder.
│   │   │   └── CookieBanner.jsx
│   │   └── pages/
│   │       ├── Home.jsx Gallery.jsx Pricing.jsx Contact.jsx About.jsx CookiesPolicy.jsx Charity.jsx
│   │       └── admin/
│   │           ├── AdminDashboard.jsx  (tiles)
│   │           ├── WebsiteText.jsx     (12 groups: Brand / Navigation / Home / Pricing / Journeys / FAQs / Gallery / Contact / Footer / SEO / Pillars / Testimonials)
│   │           ├── WebsiteMedia.jsx    (per-section hero/bg image slots, including about-hero)
│   │           ├── HeroSlideshowManager.jsx
│   │           ├── GalleryManager.jsx  (categories + items + reorder)
│   │           ├── JourneysManager.jsx (CRUD + reorder + itinerary PDF upload)
│   │           ├── AboutManager.jsx    (text blocks + stories panels)
│   │           ├── SettingsManager.jsx (contact_email, contact_phone, contact_address, opening_hours, etc.)
│   │           └── SubmissionsInbox.jsx
│   ├── public/index.html         # has static <link rel="preload"> for the LCP hero image (baked by the backend).
│   └── package.json + yarn.lock
├── scripts/safe-pull.sh          # Bluehost recovery script (POSIX, no rsync).
├── Caddyfile                     # Reverse proxy + Let's Encrypt auto-HTTPS for oncewerewild.com.
├── deploy.sh                     # Bluehost build+restart wrapper (docker compose).
├── DEPLOY.md / DEPLOY_BLUEHOST.md
├── .gitignore                    # excludes /bin/, /app/bin/, .git.backup-*, .env (but not .env.example).
└── memory/
    ├── PRD.md                    # update on every finish.
    └── test_credentials.md       # admin login.
```

---

## 4. Key behaviors the next agent MUST preserve

| Behavior | Why it matters | Where it lives |
|---|---|---|
| Per-collection data-loss guard (`protect_media=True`) | Direct prod uploads on Bluehost must NEVER be overwritten by a `git pull`. The guard refuses to apply a snapshot whose count is smaller than the live DB. | `_apply_snapshot()` in `server.py` |
| Snapshot auto-apply on startup | `git pull` on Bluehost must surface admin-driven DB changes (About blocks, content edits, journeys) without manual MongoDB work. | startup_event in `server.py` |
| `useText()` for ALL public-site strings | Client needs to edit every visible string from Admin → Website Text. NO hardcoded copy in JSX. | `ContentContext.jsx`, every `pages/*.jsx` |
| Group inference from key prefix | Without this, all content shows under one giant "general" bucket in the admin. | `admin_list_content()` in `server.py` |
| `prefers-reduced-motion`: ALWAYS cycle, just gentler | Client's Windows desktop has motion-reduce on; without this fix the hero looks stuck. | `HeroSlideshow.jsx` |
| No em dashes in user-facing copy | Hard client rule. | DB content, source files, alt text, JSON-LD |
| WebP + AVIF + responsive srcset on every image | Lighthouse mobile target 95+. | `_encode_webp_to_disk()` in `server.py`, `FadeImg.jsx` |
| Live-first sync, never push-DB-from-preview | Live is the source of truth. Push CODE from preview, sync DATA from live. | `sync_from_live.py` |

---

## 5. Outstanding / future work (none blocking)

| Pri | Item | Notes |
|---|---|---|
| P2 | Refactor `server.py` (2600 lines) into `routes/`, `services/`, `utils/` modules | Don't until features stable. |
| P2 | Backend file-upload guard rejecting any file > 95 MB | One-line addition in the upload endpoint, blocks future GitHub-busting uploads at source. |
| P2 | `deploy.sh pull` subcommand wrapping `safe-pull.sh` + restart into a single bluehost command | Trivial. |
| P3 | "Pause / Play" affordance on the hero slideshow | Some visitors who set reduce-motion truly don't want auto-rotation. |
| P3 | Lighthouse mobile re-run on live after Bluehost picks up the latest push | Target ≥ 95. |

---

## 6. Live-sync sequence (RUN THIS EVERY TIME YOU LOAD THE PROJECT)

Once the repo is checked out at `/app`, the **only** thing that's missing is the live database state and the live images that aren't bundled in git. Run:

```bash
# 1. Make sure deps are installed (cheap if already there).
cd /app/backend && pip install -q -r requirements.txt
cd /app/frontend && yarn install --frozen-lockfile

# 2. Pull EVERY live DB row + EVERY referenced image/video from oncewerewild.com.
#    Idempotent. Skips files already on disk. Uses 24 parallel workers. Typically 30-90s.
cd /app/backend && python3 sync_from_live.py

# 3. Restart backend so the rewritten snapshot.json is re-applied and caches refresh.
sudo supervisorctl restart backend
sleep 3

# 4. Build + serve the frontend (only needed if you'll be running screenshots/tests).
cd /app/frontend && yarn build && sudo supervisorctl restart frontend
```

**Cost target:** under 10 credits for the entire re-hydration. The sync script itself runs in ~60s wall-time and uses zero LLM tokens. The above is just shell + Python.

**Verification after sync:**
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
echo "media:   $(curl -s $API_URL/api/media | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
echo "journeys: $(curl -s $API_URL/api/journeys | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
echo "categories: $(curl -s $API_URL/api/gallery-categories)"
echo "about:   $(curl -s $API_URL/api/about-blocks | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
echo "stories: $(curl -s $API_URL/api/stories | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
```

Expected at handover time: media≈237, journeys≈4, categories=`["Maleny Retreats","Across the world","Across Australia","GIving Back to the World"]`, about=3+, stories=1+.

If any number is **lower** than what live currently shows, the client has uploaded MORE since this handover was written — that's fine, sync_from_live will pick it up. The opposite (preview having MORE than live) cannot happen because the script always replaces preview → live state.

---

## 7. Deploy procedure (what the user runs on Bluehost)

```bash
cd /var/www/oncewerewild
bash scripts/safe-pull.sh        # POSIX, no rsync. Handles untracked uploads safely.
./deploy.sh                      # docker compose rebuild + restart.
```

---

## 8. Recent test reports

`/app/test_reports/iteration_5.json` ... `/app/test_reports/iteration_13.json` — chronological. iteration_13 flagged the "group inference" bug that this handover documents as fixed.

---

## 9. Hard rules the next agent must follow

1. **English only** in responses.
2. **No em dashes** in any user-facing string (DB content, JSX, SEO, alt text).
3. **Run sync_from_live.py at start, every time.** Never assume the preview DB matches live.
4. **Never push DB state from preview to live.** The flow is one-way: live → preview (data) and preview → live (code).
5. **Preserve the per-collection data-loss guard** in `_apply_snapshot`. The client adds content directly on production.
6. **Use the testing agent** after any non-trivial change. Several iterations in this session caught real bugs only because of the testing-agent verification.
7. **Treat `backend/uploads/` as user data**, not source code. It's tracked in git only as a convenience for the Bluehost bind-mount. Do not delete or restructure without explicit user approval.

— End of handover.
