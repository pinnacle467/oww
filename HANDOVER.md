# Once Were Wild Travel - Detailed Handover (v2026-06-28, Sessions B1 + B2 of Changes 4-7 COMPLETE in preview, NOT YET PUSHED TO LIVE)

> **Loading instructions for the next agent:**
> 1. Pull the GitHub repo (`pinnacle467/oww`, branch `main`) into `/app` - that's the source of truth for **all code**.
> 2. Restore `backend/.env` and `frontend/.env` (the repo doesn't carry them - see Section 11).
> 3. Immediately run the LIVE-SYNC sequence at the bottom of this doc (`python3 /app/backend/sync_from_live.py`) - that pulls **every DB row, every image, every video** from production at https://oncewerewild.com into your preview environment so you're working against real data, not an empty shell.
> 4. The sync script + repo together cost **< 10 credits** to re-hydrate the entire project; do not rebuild any of the features below from scratch.
> 5. **Respond to the user in English only.** They have explicitly disliked em dashes ("—") in user-facing copy - never use them in DB content, SEO text, alt text, JSON-LD, or seeded examples. Hyphens (`-`), commas, or colons are fine.
> 6. **▶︎ START HERE for this hand-off:** Sessions B1 and B2 are both COMPLETE in preview (read **Section 2 entries R and S** for full detail). Both backends passed 9/9 and 8/8 tests; public surfaces verified. The user has NOT yet pushed to live (waiting on a final manual smoke-test of the admin interactive flows). The IMMEDIATE next task is whatever the user nominates next — likely Session C (Blog enhancements) or D (contact deliverability) from the original backlog. **Do NOT redo any B1 or B2 work — it's already shipped to disk and the snapshot has been regenerated. Just verify supervisor + .env then ask the user what's next.**
> 7. **MALENY DECISION (important — read before touching journeys):** The user reversed an earlier Q4 answer. "Maleny Creative Immersion" **stays as `type="tour"`** on `/pricing` — it's an already-planned upcoming trip. Corporate Retreats is a SEPARATE empty category awaiting future bookings. Do NOT re-tag Maleny. The migration that would have done so has been removed from `seed()` (a comment block remains in its place explaining why so it doesn't get reintroduced).

---

## 1. Project at a glance

- **Live site:** https://oncewerewild.com (Bluehost-hosted, Docker compose + Caddy auto-HTTPS).
- **Business:** Once Were Wild Travel - slow, women-only travel journeys (Australia, Maleny retreats, international).
- **Stack:** React 19 (CRA + craco) frontend -> Express static server (`frontend/server.js`) -> FastAPI backend (uvicorn) -> MongoDB.
- **Storage:** `backend/uploads/` is a bind-mounted volume on Bluehost. Images are encoded to WebP + AVIF responsive variants on upload.
- **Admin email/password:** stored at `/app/memory/test_credentials.md` AND in `backend/.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, both wrapped in `"..."` so strip quotes when bash-substituting).
- **Live-deploy mechanism:** GitHub push from this preview -> Bluehost runs `bash scripts/safe-pull.sh && ./deploy.sh`. The repo carries a `backend/seed_data/site_snapshot.json` (DB-in-a-file) that is auto-applied on container startup *with a per-collection data-loss guard* so direct prod uploads are never overwritten.

---

## 2. What's been built (chronological, most recent first)

### S. Tour gallery + 3-section body + Corporate Retreats + duplicate + preview-token (2026-06-28, Session B2 of Changes 4-7 — **COMPLETE in preview, backend tested 8/8, public surfaces verified, NOT YET PUSHED TO LIVE**)

**What this session delivered:** photo galleries on each tour sub-page, the body split into 3 rich-text fields (description / itinerary / practical info), an admin "Duplicate" button that clones a row to a fresh draft, an admin "Preview" button that opens drafts via a one-shot token, and a brand-new "Corporate Retreats" category that lives alongside Tours with its own nav dropdown, index page, and detail pages at `/corporate-retreats/<slug>`.

**Backend changes (`backend/server.py`):**
- Extended `JourneyInput`/`JourneyUpdate` Pydantic models with 5 more fields:
  - `gallery_media_ids: List[str]` (ordered list of media.id values for the photo grid)
  - `description_html: str` (primary B2 body — replaces `body_html` for new content; legacy `body_html` still accepted and migrated)
  - `itinerary_html: str` (optional second section)
  - `practical_html: str` (optional third section)
  - `preview_token: str` (urlsafe random; lets `?preview=<token>` access drafts)
- 2 idempotent startup migrations in `seed()` (search for "B2 migration"):
  - #1: defaults every new field on every existing row (empty list / empty string).
  - #2: where `body_html` is non-empty and `description_html` is empty, copies `body_html` into `description_html`.
  - #3 (REMOVED): Originally re-tagged Maleny Creative Immersion to `type="retreat"`. **User reversed this decision** — see the "Loading instructions" point 7. A comment placeholder remains in the code so future passes don't accidentally reintroduce the re-tag.
- 4 new endpoints:
  - `GET /api/retreats` — public list, pre-filtered to `type="retreat"`, hides drafts/inactive by default.
  - `GET /api/retreats/{slug}` — public single retreat, 404 unless published + active (or unless a matching `?preview=<token>` is supplied).
  - `POST /api/admin/journeys/{id}/duplicate` (Bearer auth) — clones any row into a fresh draft: new UUID, `status="draft"`, fresh `preview_token`, `popular=false`, unique slug `<existing>-copy` via `_unique_slug`, name appended with " (copy)". All other fields (description, gallery, etc) copied verbatim. PDFs (itinerary_url) are NOT physically copied — operator re-uploads.
  - `POST /api/admin/journeys/{id}/preview-token` (Bearer auth) — generates a new urlsafe token, persists it on the row, returns `{ preview_token, slug, type }`. Used by the admin "Preview" button.
- Extended `GET /api/journeys` with optional `?type=tour|retreat`. Legacy rows without a `type` field are returned when `?type=tour` is requested.
- Extended `GET /api/tours/{slug}` to filter by `type="tour"` (legacy rows with no type are accepted as tours) AND to accept `?preview=<token>` for draft access.
- Added `nav.5.label` = "Corporate Retreats" and `nav.5.to` = "/corporate-retreats" to `DEFAULT_CONTENT` (in the `nav` group).

**Frontend public (`frontend/src/`):**
- New `components/tour/TourGallery.jsx` — responsive 2/3-col image grid with srcset, LQIP background, keyboard-navigable lightbox (Escape, Left, Right). Used by `TourDetail.jsx`.
- New `components/layout/RetreatsDropdown.jsx` — mirror of `ToursDropdown.jsx` but fetches `/api/retreats`. Hides the dropdown menu when zero retreats exist (the nav link still works, leads to the empty-state index).
- New `pages/Retreats.jsx` at `/corporate-retreats` — hero + card grid for `type="retreat"` rows, with a polished empty state ("New retreats are on their way." + "Start a conversation" CTA) when the collection is empty.
- Rewrote `pages/TourDetail.jsx` — single component now renders both `/tours/<slug>` AND `/corporate-retreats/<slug>` (detects via `useLocation`, calls the right endpoint, adapts back-link copy). Renders the 3 body sections with H3 dividers ("About this journey" / "Itinerary" / "Practical information"), then the `<TourGallery>`. Reads `?preview=<token>` from the URL and forwards to the API. Shows a gold "Preview mode" ribbon when `tour.status === "draft"`. Falls back to `description_html` -> `body_html` -> summary, so older rows never look broken.
- Updated `components/layout/Navbar.jsx` — when a nav link's `to === "/corporate-retreats"` it now renders `<RetreatsDropdown />`. Tours nav still uses `<ToursDropdown />`.
- Updated `pages/Pricing.jsx` AND `components/layout/ToursDropdown.jsx` — both now fetch with `?type=tour` so retreats never accidentally surface on /pricing or in the Tours dropdown.
- Updated `data/content.js` NAV_LINKS — appended `{ label: "Corporate Retreats", to: "/corporate-retreats" }` as the 6th entry (kept at the end on purpose so existing live `nav.0`–`nav.4` content overrides for Home/Tours/Gallery/About/Blog keep applying to their existing slots).
- Updated `App.js` — added `/corporate-retreats` (Retreats index) and `/corporate-retreats/:slug` (TourDetail with kind=retreat) routes.

**Admin (`frontend/src/pages/admin/JourneysManager.jsx`):**
- Filter tab strip at the top: "Tours (N)" / "Corporate Retreats (N)" — filters the row list by `type`. Default is Tours.
- Creating a row from the Retreats tab defaults `type="retreat"` (the existing Type select inside the form still lets the operator change it).
- The "About this journey" / "Itinerary" / "Practical information" rich-text editors are stacked vertically — same `<RichTextEditor>` TipTap component as the blog. Empty body sections don't render on the public page, so operators can leave any/all blank.
- New `<GalleryPicker>` sub-component: shows currently-selected images (drag-and-drop reorder via native HTML5 drag events, X button to remove) above a filterable thumbnail pool of all images in `/api/media`. Click a thumbnail to add. No new dependencies.
- New per-row "Duplicate" button (calls `/admin/journeys/{id}/duplicate`, confirms first). New per-row "Preview" button (calls `/admin/journeys/{id}/preview-token`, opens `/tours/<slug>?preview=<token>` or `/corporate-retreats/<slug>?preview=<token>` in a new tab — uses `type` returned by the endpoint to pick the URL prefix).
- The "View /tours/..." quick link under each row now correctly switches to "/corporate-retreats/..." for retreat-typed rows.
- The "Mark popular" logic was widened to be type-scoped: it only un-marks other rows of the SAME type, so a popular Tour and a popular Retreat can coexist.
- The `move()` reorder now operates within the visible tab while still keeping the global `sort_order` consistent.

**Verified end-to-end:**
- ✅ Backend: 8/8 B2 tests passed via `deep_testing_backend_v2` (Maleny re-tag now skipped per user decision, B2 schema migration applied to all rows, POST/PATCH roundtrip new fields, duplicate creates valid drafts, preview tokens work, type validation blocks cross-type lookups, regression OK — media count still 237, B1 features still working).
- ✅ Public surfaces verified visually + via `auto_frontend_testing_agent`: nav shows 6 items (HOME / TOURS / GALLERY / ABOUT US / BLOG / CORPORATE RETREATS), Tours dropdown has 4 items including Maleny, Retreats dropdown is empty (correct — empty category awaiting bookings), `/pricing` shows 4 cards, `/corporate-retreats` shows the empty state, `/tours/maleny-creative-immersion` returns 200, `/corporate-retreats/<anything>` returns 404 (no retreats yet).
- ✅ Snapshot regenerated — `backend/seed_data/site_snapshot.json` now carries all 4 journeys with `type="tour"`, populated B2 schema fields.
- ⚠️ Interactive admin flows (TipTap typing, gallery drag-reorder, Preview tab opens with ribbon, Duplicate creates draft with -copy slug) were NOT auto-tested by the agent because they require deep interaction. User will manually smoke-test these before pushing to live. All B2 UI elements (tabs, type/status dropdowns, all three TipTap editors, gallery picker, Preview/Duplicate buttons) were confirmed PRESENT and rendered correctly by the testing agent.

**Not yet shipped to live:**
- User has the code in preview but has NOT pushed to GitHub yet (waiting on manual interactive smoke-test). Deploy path remains: Save to Github -> `cd /var/www/oncewerewild && scripts/safe-pull.sh && ./deploy.sh`. The startup migrations are all idempotent and Maleny re-tag is removed, so the deploy is safe to run with the live DB as-is.

**Decisions made this session (record for future agents):**
- **Q4 reversed:** Maleny stays as a Tour. Corporate Retreats is a separate empty category. (See loading instructions point 7.)
- **Retreats URL pattern:** `/corporate-retreats/<slug>` chosen over `/retreats/<slug>` for SEO and to match the nav copy. There is no redirect from `/retreats/*` — if you ever need one, add it in `App.js`.
- **Body split:** went with the 3-field split (description / itinerary / practical) with a one-time copy migration. `body_html` kept on the schema for backward compatibility but no longer edited in admin.
- **Gallery drag-reorder:** native HTML5 drag (no `@dnd-kit` dependency added).
- **Corporate Retreats nav slot:** appended as nav index 5 to avoid renumbering existing live content overrides for nav.0–nav.4. Visual order is HOME / TOURS / GALLERY / ABOUT US / BLOG / CORPORATE RETREATS.

**Known small UX nits (deliberately not fixed — ask user first):**
- The Corporate Retreats nav item still shows a chevron `▼` even though the dropdown is empty. Hovering does nothing. 2-line conditional fix in `RetreatsDropdown.jsx` (hide chevron when `retreats.length === 0`). User was offered the fix and chose not to insist on it.
- The `JourneyInput.priceUnit` / `priceNote` fields are still single-line text; no rich-text option for those. Out of scope for B2.

---

### R. Tours sub-pages + nav dropdown (2026-06-27, Session B1 of Changes 4-7 — **COMPLETE in preview, backend tested 9/9, public surfaces verified, NOT YET PUSHED TO LIVE**)

**What this session delivered:** every existing tour now has a real content sub-page at `/tours/<slug>` (no more PDF-only links), a Tours dropdown in the navbar listing live tours, and the existing `JourneysManager` admin form is extended with all the B1 fields (slug, hero image, rich-text body, SEO, draft/published status). The 4 existing journeys were auto-migrated to the new schema on backend startup with sensible slugs and `status="published"` so the live site keeps working from second zero.

**Backend changes (`backend/server.py`):**
- Extended `JourneyInput` and `JourneyUpdate` Pydantic models with 7 new optional fields:
  - `slug` (auto-generated from name if blank, kept unique via `_unique_slug` helper)
  - `hero_media_id` (string ID linking to a row in the `media` collection)
  - `body_html` (TipTap rich-text output for the sub-page body)
  - `seo_title`, `seo_description` (override `<title>` and meta description; fall back to name + summary)
  - `status` ("published" | "draft" — drafts are 404'd by public endpoints)
  - `type` ("tour" | "retreat" — **`retreat` is reserved for B2**, all rows default to `"tour"`)
- New helper `_slugify(text)` and `async _unique_slug(base, exclude_id=None)` in `backend/server.py` (search for `# ---- Slug helpers`). Both are used by create/update endpoints and by the startup migration.
- New endpoint `GET /api/tours/{slug}` — public, filters `is_active=True` AND `status="published"` (or status missing for legacy rows). 404s on drafts so unpublished work never leaks.
- `GET /api/journeys` now accepts an optional `?include_drafts=true` flag. Default (no flag) hides drafts and inactive rows. The Tours dropdown uses default behaviour. Admin still uses `/api/admin/journeys` which lists everything.
- Startup migration in `seed()`: every row that's missing `slug`, `status`, or `type` gets backfilled in place. Idempotent — runs every startup but only touches rows that need it. Logs `"Backfilled N legacy journey rows with slug/status/type"` on first run.
- The `journeys` collection was already in `_write_snapshot_now()` / `_apply_snapshot()` so no snapshot plumbing changes needed.

**Frontend public (`frontend/src/`):**
- New page `pages/TourDetail.jsx` — full layout: PageHero with hero image (resolved via `/api/media`), key-details strip (nights | region | dates), rich-text body OR summary fallback, price block (when set), Enquire Now + Download PDF CTAs, "View all tours" back-link. Has its own `<Seo>` block with `TouristTrip` JSON-LD. Handles loading + 404 states cleanly.
- New component `components/layout/ToursDropdown.jsx` — mouse-hover + focus dropdown with a 160ms close timer, fetches `/api/journeys` once, filters `type === "tour" || !type` and `slug` present, lists each tour + a "View all tours" footer link to `/pricing`.
- `components/layout/Navbar.jsx` — when a nav link's `to === "/pricing"` it now renders `<ToursDropdown />` instead of a plain `<Link>`. All other nav links unchanged. Mobile nav unchanged (drawer still has a single Tours link, no sub-items — by design, mobile users tap through to /pricing).
- `pages/Pricing.jsx` — each card now shows a "Find Out More →" link below the Enquire CTA when the row has a `slug`. Variable rename: the local `slug` (used for content-key lookup) is now `contentKey` to avoid clashing with the new URL slug field. Public data shape gets a new `urlSlug` property.
- `App.js` — added `const TourDetail = lazy(() => import("@/pages/TourDetail"))` and `<Route path="/tours/:slug" element={...} />` directly under the existing `/pricing` route.

**Admin (`frontend/src/pages/admin/JourneysManager.jsx`):**
- `EMPTY_DRAFT` extended with the 7 new fields (default `status: "published"`).
- `saveRow()` now sends all 7 B1 fields on every PATCH.
- The shared `<DraftFields>` component (used for both the new-trip form and editing existing rows) gets a new section at the bottom under a `border-t` divider titled "Tour sub-page" containing:
  - URL slug input (with a hint that it auto-generates from name if blank)
  - Status `<select>` dropdown (Published | Draft)
  - Hero image media ID text input (asks operator to paste an ID from `/admin/website-media`)
  - SEO title + SEO meta description fields
  - Full `<RichTextEditor>` (the same TipTap component used by blog and FAQs) for `body_html`
- Each existing row also gets a small "View /tours/`<slug>`" external-link button under the form so the operator can preview the live result with one click.

**Verified end-to-end (this iteration):**
- ✅ Backend: 9/9 tests passed via `deep_testing_backend_v2` (startup migration backfilled 4 legacy rows, `/api/tours/{slug}` 200 for published & 404 for draft/unknown/inactive, all 7 new fields roundtrip through POST/PATCH, slug uniqueness collision yields `-2`/`-3` suffixes, `?include_drafts=true` honoured, `/api/admin/journeys` lists everything, media count still 237).
- ✅ Public visual smoke test: Tours dropdown opens on hover and lists all 4 tours + "View all tours" footer link; 4 "Find Out More" links render on `/pricing`; `/tours/<slug>` renders with the dark fallback hero when no hero image is set.
- ✅ Admin `JourneysManager` "Tour sub-page" section + TipTap editor confirmed present in source (lines 432-465 of the pre-B2 file).
- ✅ Snapshot regenerated — `backend/seed_data/site_snapshot.json` carries all 4 journeys with `slug`, `status="published"`, `type="tour"` populated.

**Not yet shipped to live:** code is in preview waiting for the user to push to GitHub + run safe-pull/deploy on Bluehost. The deploy is safe — the startup migration is idempotent.

### Q. Home page: "Questions Gently Answered" FAQ + extended content sections + Tours CTA (2026-06-27, Session A of Changes 4-7)
- New backend collections: `home_faqs` and `home_sections`. Both have full CRUD endpoints under `/api/admin/...` plus public read endpoints (filter by `is_visible=true`, sorted by `sort_order`):
  - `GET /api/home-faqs` (public, visible only) | `GET /api/admin/home-faqs` (all)
  - `POST /api/admin/home-faqs`, `PATCH /api/admin/home-faqs/{id}`, `DELETE /api/admin/home-faqs/{id}`, `POST /api/admin/home-faqs/reorder`
  - Same shape for `/api/...home-sections`
- Both are folded into `_write_snapshot_now()` and `_apply_snapshot()` so they roundtrip through GitHub pushes like every other collection. Snapshot version stays at 1.
- 8 default FAQs seeded into `home_faqs` (idempotent: only when collection is empty). 4 default content sections seeded into `home_sections` ("Women's Small Group Travel in Australia", "Why Slow Travel?", "Exploring Tasmania with Once Were Wild", "Our Approach to Travel") with light placeholder body text so the page never looks empty.
- New frontend components (all on Home.jsx, in this order: Hero -> Manifesto -> Pillars -> **ToursCtaCard -> HomeContent -> QuestionsAnswered** -> Journal -> Testimonials):
  - `frontend/src/components/home/QuestionsAnswered.jsx` - uses shadcn `Accordion`, auto-hides when zero visible FAQs, heading editable via `home.faq.heading` content key (defaults to exact wording "Questions Gently Answered" per client sign-off).
  - `frontend/src/components/home/HomeContent.jsx` - renders each section's HTML body in `prose` styling, auto-hides when zero visible sections.
  - `frontend/src/components/home/ToursCtaCard.jsx` - **replaces** the older `MalenyFeature` + `ImmersiveTeaser` repeated marketing blocks (per client request: "navigation links are sufficient"). Single compact CTA card linking to `/pricing`. The old components still exist on disk but are no longer mounted.
- New admin pages: `pages/admin/HomeFaqManager.jsx` and `pages/admin/HomeContentManager.jsx`. Both: table view + side drawer editor, TipTap rich-text answer/body field, up/down reorder buttons (calls `/reorder` endpoint), eye-icon visibility toggle, delete with confirm.
- Sidebar links added in `AdminShell.jsx`: "Home Content" and "Home FAQs" between "Trips & Journeys" and "About Us & Stories". Matching dashboard tiles in `AdminDashboard.jsx`.
- 9 new content keys added to DEFAULT_CONTENT in the Home group, all editable in `/admin/website-text`:
  - FAQ: `home.faq.eyebrow`, `home.faq.heading`, `home.faq.intro`
  - Content sections wrapper: `home.content.eyebrow`, `home.content.title`
  - Tours CTA card: `home.tours_cta.eyebrow`, `home.tours_cta.title`, `home.tours_cta.body`, `home.tours_cta.button`
- Backend tests: 27/27 passed (all CRUD paths + auth + regression check on `/api/media`, `/api/about-blocks`, `/api/blog`, `/api/journeys`).
- Frontend visual verification: all 3 sections render, FAQ accordion expands, no console errors.
- **Note on Tours/Corporate Retreats (Change 4/7):** NOT done in this session - those are Session B. The /pricing FAQ accordion (driven by `faqs.N.q/a` content keys, hardcoded to 6) is untouched. There is no `corporate_retreats` collection yet.

### P. Orphan-file cleanup + media endpoint hardening (2026-06-27, earlier this session)
- New script `backend/cleanup_orphans.py`. Scans every collection in MongoDB for strings matching `/api/uploads/...`, builds the "in use" set, and lists/quarantines files that aren't referenced. Dry run by default. With `--commit` moves orphans to `backend/uploads/_orphans_<TS>/` (move, not delete, fully recoverable with `cp -rn`).
- Ran on Bluehost prod: identified and quarantined **859 files (~360 MB)** of orphans that had accumulated from years of admin deletes/replaces that only removed the DB row but not the underlying webp/avif variants. Zero referenced files were missing. 237 DB rows reference 679 files; disk had 1538.
- Patched `DELETE /api/admin/media/{mid}`: now calls new helper `_unlink_media_files()` on every referenced URL (file_url, thumb_url, srcset, avif_srcset) so deletes no longer leak files.
- Patched `PATCH /api/admin/media/{mid}`: when a fresh data URL is submitted (replacing an image), the old file variants are unlinked before the new ones take their place.
- Removed `profiles: ["localdb"]` from the `mongo` service in `docker-compose.yml`. The "media disappeared" outage today was caused by `docker compose up -d` (without `--profile localdb`) leaving the mongo container off, which made the backend crash on startup with `mongo:27017: Temporary failure in name resolution`, which made every `/api/*` 502, which made every image URL 502. With the profile gone, mongo always starts.

### O. Homepage "From the Journal" strip (2026-06-27, earlier this session)
- New component `frontend/src/components/home/FromTheJournal.jsx` mounted on Home.jsx between `MalenyFeature` and `Testimonials`.
- Fetches `/api/blog`, takes the 3 newest published posts, renders them as cards (date / title / excerpt / featured image / "Read more"), with a "Read the journal" CTA linking to `/blog`.
- **Auto-hides when there are zero published posts** (`if (!posts || posts.length === 0) return null`) so the homepage never shows an empty section before the client writes the first post.
- 4 new editable content keys (Home page group in admin Website Text):
  - `home.journal.eyebrow` = "From the Journal"
  - `home.journal.title` = "Stories from \*the road less travelled.\*" (asterisks render italic via `useRichText`)
  - `home.journal.intro` = "Field notes and slow reflections from journeys taken between scheduled tours."
  - `home.journal.cta` = "Read the journal"
- Added to `DEFAULT_CONTENT` in `backend/server.py` AND seeded into the live DB via `PUT /api/admin/content`.
- Verified: strip renders correctly with 3 sample posts (screenshot), self-hides when posts are deleted (DOM count = 0). No regressions on the rest of the homepage.

### N. Nav copy rename: "Journeys" -> "Tours", "About" -> "About Us" (2026-06-27, this session)
- DB rows `nav.1.label` and `nav.3.label` updated via the admin content API. Visible nav order is now **HOME / TOURS / GALLERY / ABOUT US / BLOG / GET IN TOUCH**.
- Defaults updated so a fresh deploy ships the same labels:
  - `backend/server.py` DEFAULT_CONTENT entries `nav.1.label = "Tours"`, `nav.3.label = "About Us"`.
  - `frontend/src/data/content.js` NAV_LINKS array.
- Routes themselves did NOT change (`/pricing` for Tours, `/about` for About Us) - only the labels. Any deep links elsewhere on the site, in JSON-LD, or in body copy (e.g. "Explore our journeys") still say "Journeys" by design - those are editable from Admin -> Website Text.

### M. Blog feature (full CMS) (2026-06-27, this session)
- **New public nav item** "Blog" (5th, after About Us). Backed by `nav.4.label` / `nav.4.to` content rows.
- **Public `/blog` index** (`frontend/src/pages/Blog.jsx`): newest-first cards (title / formatted date / excerpt / featured image / "Read more"), load-more pagination at 9 per page, friendly empty state ("Stories are on their way.") driven by content keys `blog.empty.heading` / `blog.empty.body`, hero title/intro driven by `blog.hero.eyebrow` / `blog.hero.title` / `blog.hero.intro`. SEO entry `seo.blog.*` (with FALLBACKS in `Seo.jsx`).
- **Public `/blog/:slug` detail** (`frontend/src/pages/BlogPost.jsx`): H1 title + date + optional featured image (full responsive `<picture>` with WebP+AVIF+LQIP via FadeImg) + rich-text body via Tailwind `prose` (typography plugin installed), Back-to-journal link top and bottom. Graceful 404 if not found or still in draft.
- **Admin `/admin/blog` Blog Manager** (`frontend/src/pages/admin/BlogManager.jsx`):
  - Table of posts (title, date, status badge, Edit, Delete). Empty state when no posts.
  - One-click Published <-> Draft toggle on the row.
  - Delete with `window.confirm` prompt.
  - "+ New post" and "Edit" open a side-drawer (`PostEditorDrawer`) with: title input, published date (defaults today), Draft/Published toggle, featured image upload (15 MB cap), excerpt textarea, **TipTap WYSIWYG rich text editor** for body, "Save as draft" + "Save and publish" CTAs.
- **Rich text editor** (`frontend/src/components/editor/RichTextEditor.jsx`): TipTap + StarterKit + Link + Image + Placeholder. Toolbar: Bold, Italic, H2, H3, bullet list, ordered list, blockquote, link (prompt-based), inline image upload (multipart to `/api/admin/blog/image`), undo, redo. Stores HTML in `body`.
- **Backend** (`backend/server.py`, lines ~1487-1701):
  - Collection: `blog_posts`. Slug-unique index added in `seed()`.
  - Models: `BlogPostInput`, `BlogPostUpdate`. Helper: `_slugify` + `_unique_blog_slug` (conflicts append `-2`, `-3`, ...).
  - Public endpoints: `GET /api/blog` (published only, newest-first), `GET /api/blog/{slug}` (slug or id fallback).
  - Admin endpoints: `GET /api/admin/blog`, `GET /api/admin/blog/{id}`, `POST /api/admin/blog`, `PATCH /api/admin/blog/{id}`, `DELETE /api/admin/blog/{id}`, `POST /api/admin/blog/{id}/cover` (featured image -> WebP+AVIF+srcset+LQIP via `_encode_webp_to_disk`), `POST /api/admin/blog/image` (inline body image, returns `{url}`).
  - Snapshot integration: `blog_posts` now included in `_write_snapshot_now()` and `_apply_snapshot()` so blog content survives every deploy.
  - PATCH only re-runs slug generation when the title actually changes; old slugs 404 after rename (no automatic redirects).
- **Sidebar + dashboard** updated:
  - `AdminShell.jsx` LINKS array now has `{ to: "/admin/blog", label: "Blog", icon: Newspaper }` between About Us and Messages.
  - `AdminDashboard.jsx` tiles now include a `Blog` tile with `Newspaper` icon.
- **Dependency added:** `@tailwindcss/typography` (dev) + tailwind.config.js `plugins` updated. `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`.
- **Testing:** 8/8 backend pytest cases (`backend/tests/test_blog.py`), full UI flow verified by testing agent (create, publish, public render, status toggle, edit with slug regeneration, delete with confirm). Report: `/app/test_reports/iteration_15.json`.
- **Separation from Stories:** Stories on `/about` are unchanged. Blog is a separate collection (`blog_posts` vs `stories`) and a separate admin manager (`/admin/blog` vs `/admin/about`).

### L. Live-from-prod sync infrastructure (2026-06-24)
- **`backend/sync_from_live.py`** - pulls every media/journey/about-block/story/content/settings doc from `https://oncewerewild.com` into the preview, downloads every referenced WebP + AVIF file in parallel (24 workers, no rsync needed), and rewrites `backend/seed_data/site_snapshot.json`. **Idempotent and safe to re-run anytime.**
- `media` now mirrors live's 237 docs (89 gallery items across 4 categories including the "GIving Back to the World" category - the typo is intentional, it's the client's own naming).
- `journeys` has 4 entries reflecting the client's latest edits.
- **Note (2026-06-27):** sync_from_live currently does NOT pull `blog_posts`. When the client starts publishing real blog posts directly on live, extend the script to mirror them. Quick win for next session.

### K. About Us + Stories feature (2026-06-24)
- Public `/about` page (`frontend/src/pages/About.jsx`) - hero, text blocks left 35%, Stories blog right 65%.
- Admin `/admin/about` (`frontend/src/pages/admin/AboutManager.jsx`) - two stacked panels: Text Blocks (add/edit/delete/reorder/visibility, heading/paragraph kinds) and Stories (add/edit/delete/reorder/visibility, cover image upload via `POST /api/admin/stories/{id}/cover`).
- Backend collections: `about_blocks` (id, kind, text, sort_order, is_visible) and `stories` (id, title, region, date, excerpt, body, cover_url, cover_srcset, cover_avif_srcset, cover_lqip, sort_order, is_visible).
- API endpoints under `/api/about-blocks`, `/api/stories`, `/api/admin/about-blocks/*`, `/api/admin/stories/*`.
- Snapshot save/apply extended to include `about_blocks` + `stories`. Per-collection safety guard in `_apply_snapshot` (`protect_media=True`) refuses to wipe any collection that has MORE docs on live than in the incoming snapshot.

### J. Cookie banner + cookies policy (2026-06-24)
- `frontend/src/components/CookieBanner.jsx` - mounted globally in `SiteLayout`. localStorage key `oww:cookies` = `accepted` | `declined`. Fires `oww:cookie-decision` CustomEvent.
- `frontend/src/pages/CookiesPolicy.jsx` at `/cookies` - full policy + "Change my choice" reset button.
- Footer link `data-testid=footer-cookies-link` added.

### I. Nav + button styling (2026-06-24)
- "Contact" removed from the nav (Get In Touch CTA on the right covers it).
- GET IN TOUCH button (Navbar.jsx + mobile drawer) **always** uses `bg-ink/85 + border-gold + text-white` - no more variant that turned gold-on-transparent at the top of the hero.
- Hero readability fixed: `HeroSlideshow.jsx` bottom panel switched from `glass` (12% opacity) -> `glass-dark` (55% opacity in `index.css`). Added `drop-shadow` to the gold eyebrow line. Gradient wash strengthened from 80/15/30 to 85/30/45.

### H. Hero slideshow cycle bug (2026-06-24)
- Was: `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;` - completely killed auto-advance on any device with the OS accessibility setting on (client's Windows desktop fell into this).
- Now: always cycles. Reduce-motion only lengthens dwell (5.5s -> 9s) and drops the Ken Burns zoom. matchMedia change-listener responds to runtime toggles.

### G. Contact page admin-editability (2026-06-25)
- All 20 previously-hardcoded strings on `/contact` now drive from `useText`: form field labels (`contact.form.first_name_label`, `last_name_label`, `email_label`, `phone_label`, `phone_placeholder`, `inquiry_label`, `inquiry_placeholder`, `message_label`, `message_placeholder`, `referral_label`, `referral_placeholder`), sidebar labels (`contact.info.{email,phone,address,hours}_label`), and validation errors (`contact.errors.{first_name,last_name,email,inquiry,message}`).
- Backend `GET /api/admin/content` now infers a row's `group` from the key prefix when no explicit `group` field exists - this was the critical fix that made the WebsiteText admin show "Contact page" (and all 12 other groups) instead of a single bloated "general" bucket. See `server.py` around line 829.
- **Confirmed (2026-06-27):** the public `/api/content` endpoint serves cached values, so after editing a contact text key the visitor may need a hard refresh. Future enhancement: add `Cache-Control: no-store` to `/api/content` (already proposed; not yet shipped).

### F. Em-dash purge (2026-06-25)
- Stripped from DB (`about_blocks`, `stories`, `content.seo.*.description`).
- Stripped from source: `Seo.jsx`, `Home.jsx` & `Gallery.jsx` JSON-LD, `HeroSlideshow.jsx` & `ImmersiveTeaser.jsx` alt texts.
- Comments and admin-only strings kept (not user-facing). 2026-06-27 audit confirmed no em dashes in new Blog code or `BlogManager.jsx` user-facing strings.

### E. GitHub push unblocking (2026-06-25)
- 3 oversized MP4s in `backend/uploads/gallery/` were re-encoded in place (filenames preserved -> DB refs intact): 134 MB -> 15 MB, 95 MB -> 21 MB, 254 MB -> 63 MB.
- `git filter-repo --strip-blobs-bigger-than 100M` cleaned the historical big-blob versions out of `.git`.
- Static ffmpeg/ffprobe binaries at `/app/bin/` untracked and added to `.gitignore`.
- `frontend/yarn.lock` (572 KB) was finally added to git so the Docker COPY step on Bluehost doesn't fail.

### D. Bluehost recovery tooling (2026-06-25)
- `scripts/safe-pull.sh` - POSIX-only (uses `mv` + `cp -rn` + `git`, **no rsync**). Stashes code edits, moves `backend/uploads/` to `/tmp/oww-uploads-backup-<TS>`, pulls, then layers the backup back with `cp -rn` so live-only uploads survive while git's versions win on filename collisions.
- For the very first one-time recovery (when the broken rsync version of the script is already on disk), the inline POSIX one-liner is in chat history (mv + cp -rn).

---

## 3. Code layout - what to read first

```
/app/
├── backend/
│   ├── server.py                  # ~2860 lines (after Blog feature), single-file FastAPI app
│   │     • /api/media (GET/admin CRUD), /api/journeys, /api/about-blocks, /api/stories,
│   │       /api/blog + /api/admin/blog/*,
│   │       /api/content + /api/admin/content, /api/settings, /api/auth/*, /api/contact (form submit),
│   │       /api/admin/snapshot/{save,apply}, /api/admin/avif/backfill
│   │     • _write_snapshot_now() + _apply_snapshot(protect_media=True) - the deploy-safety core.
│   │       Now includes blog_posts alongside stories/about_blocks/journeys.
│   │     • _encode_webp_to_disk() - image upload pipeline (WebP + AVIF + LQIP + responsive srcset).
│   │     • _slugify + _unique_blog_slug - blog post URL generation.
│   ├── seed_data/site_snapshot.json   # ~260 KB, the live-DB-in-a-file. AUTO-APPLIED on container startup.
│   ├── uploads/                  # bind-mounted on Bluehost. Contains every gallery item, hero, pillar,
│   │                              # plus /uploads/blog/ for new blog featured + inline images.
│   ├── sync_from_live.py         # one-shot live-to-preview re-hydration (parallel downloads).
│   │                              # NOTE: does NOT currently sync blog_posts; extend when needed.
│   ├── tests/test_blog.py        # 8 pytest cases for the Blog API (auth, slug, conflict, CRUD).
│   ├── .env / .env.example       # MONGO_URL, DB_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET, RESEND_API_KEY (optional), etc.
│   └── tests/                    # pytest + curl-based smoke tests (some written by testing-agent).
├── frontend/
│   ├── server.js                 # Express static server serving the CRA build with cache-control headers.
│   ├── src/
│   │   ├── App.js                # Route table (lazy-loaded). NEW: /blog, /blog/:slug, /admin/blog.
│   │   ├── data/content.js       # NAV_LINKS (5 items: Home / Tours / Gallery / About Us / Blog).
│   │   ├── context/ContentContext.jsx  # useText / useRichText / useContent hooks (driven by /api/content).
│   │   ├── hooks/useMediaSlot.js + useGalleryCategories.js
│   │   ├── components/
│   │   │   ├── layout/{Navbar,Footer,SiteLayout,StickyCTA,PageHero}.jsx
│   │   │   ├── home/{HeroSlideshow,ImmersiveTeaser,MalenyFeature,FromTheJournal,...}.jsx
│   │   │   ├── gallery/MasonryGallery.jsx
│   │   │   ├── seo/Seo.jsx       # FALLBACKS now includes a `blog` entry.
│   │   │   ├── ui/FadeImg.jsx    # <picture> tag with AVIF + WebP + LQIP placeholder.
│   │   │   ├── editor/RichTextEditor.jsx   # NEW: TipTap WYSIWYG used by the blog admin.
│   │   │   └── CookieBanner.jsx
│   │   └── pages/
│   │       ├── Home.jsx Gallery.jsx Pricing.jsx Contact.jsx About.jsx CookiesPolicy.jsx Charity.jsx
│   │       ├── Blog.jsx          # NEW: public blog index, empty state + load-more pagination.
│   │       ├── BlogPost.jsx      # NEW: public post detail with prose-styled body.
│   │       └── admin/
│   │           ├── AdminDashboard.jsx  (tiles - now includes Blog tile)
│   │           ├── WebsiteText.jsx     (12 groups: Brand / Navigation / Home / Pricing / Journeys / FAQs / Gallery / Contact / Footer / SEO / Pillars / Testimonials)
│   │           ├── WebsiteMedia.jsx    (per-section hero/bg image slots, including about-hero)
│   │           ├── HeroSlideshowManager.jsx
│   │           ├── GalleryManager.jsx  (categories + items + reorder)
│   │           ├── JourneysManager.jsx (CRUD + reorder + itinerary PDF upload)
│   │           ├── AboutManager.jsx    (text blocks + stories panels)
│   │           ├── BlogManager.jsx     # NEW: post table + side-drawer rich-text editor.
│   │           ├── SettingsManager.jsx (contact_email, contact_phone, contact_address, opening_hours, etc.)
│   │           └── SubmissionsInbox.jsx
│   ├── public/index.html         # has static <link rel="preload"> for the LCP hero image (baked by the backend).
│   ├── tailwind.config.js        # plugins: tailwindcss-animate + @tailwindcss/typography (for prose body).
│   └── package.json + yarn.lock  # NEW deps: @tiptap/{react,starter-kit,extension-link,extension-image,extension-placeholder}, @tailwindcss/typography.
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
| Snapshot auto-apply on startup | `git pull` on Bluehost must surface admin-driven DB changes (About blocks, content edits, journeys, blog posts) without manual MongoDB work. | `on_startup()` in `server.py` |
| `useText()` for ALL public-site strings | Client needs to edit every visible string from Admin -> Website Text. NO hardcoded copy in JSX. The blog hero/empty-state strings follow this pattern. | `ContentContext.jsx`, every `pages/*.jsx` |
| Group inference from key prefix | Without this, all content shows under one giant "general" bucket in the admin. | `admin_list_content()` in `server.py` |
| `prefers-reduced-motion`: ALWAYS cycle, just gentler | Client's Windows desktop has motion-reduce on; without this fix the hero looks stuck. | `HeroSlideshow.jsx` |
| No em dashes in user-facing copy | Hard client rule. Audit any new file you author. | DB content, source files, alt text, JSON-LD |
| WebP + AVIF + responsive srcset on every image | Lighthouse mobile target 95+. Blog featured + inline images go through the same `_encode_webp_to_disk` pipeline. | `_encode_webp_to_disk()` in `server.py`, `FadeImg.jsx` |
| Live-first sync, never push-DB-from-preview | Live is the source of truth. Push CODE from preview, sync DATA from live. | `sync_from_live.py` |
| `blog_posts` in snapshot save + apply | Blog posts must survive deploys exactly like Stories and About blocks. | `_write_snapshot_now()` + `_apply_snapshot()` |

---

## 5. Outstanding / future work (none blocking)

| Pri | Item | Notes |
|---|---|---|
| P1 | Extend `sync_from_live.py` to also mirror `blog_posts` | The Blog feature is new (2026-06-27). Once the client publishes real posts on live, the preview won't auto-mirror them. ~10 lines: add `/api/blog` fetch + download referenced featured/inline images. |
| P2 | Cache-Control: no-store on `/api/content` | Stops the "I edited the label and it's still old in my browser" support tickets. One-line FastAPI dependency. |
| P2 | Refactor `server.py` (~2860 lines) into `routes/`, `services/`, `utils/` modules | Don't until features stable. |
| P2 | Backend file-upload guard rejecting any file > 95 MB | One-line addition in the upload endpoint, blocks future GitHub-busting uploads at source. |
| P2 | `deploy.sh pull` subcommand wrapping `safe-pull.sh` + restart into a single Bluehost command | Trivial. |
| P3 | Blog: scheduled-publish (`publish_at` future date) | Low priority until volume grows. |
| P3 | Blog: per-post SEO override (`blog.post.<slug>.seo.*`) | Currently inherits the site-wide `seo.blog.*` for every post. |
| P3 | "Pause / Play" affordance on the hero slideshow | Some visitors who set reduce-motion truly don't want auto-rotation. |
| P3 | Lighthouse mobile re-run on live after Bluehost picks up the latest push | Target >= 95. |

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
echo "media:    $(curl -s $API_URL/api/media | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
echo "journeys: $(curl -s $API_URL/api/journeys | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
echo "categories: $(curl -s $API_URL/api/gallery-categories)"
echo "about:    $(curl -s $API_URL/api/about-blocks | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
echo "stories:  $(curl -s $API_URL/api/stories | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
echo "blog:     $(curl -s $API_URL/api/blog | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
```

Expected at handover time (2026-06-27): media~237, journeys~4, categories=`["Maleny Retreats","Across the world","Across Australia","GIving Back to the World"]`, about=3+, stories=1+, blog=0 (feature shipped this session, no posts yet).

If any number is **lower** than what live currently shows, the client has uploaded MORE since this handover was written - that's fine, sync_from_live will pick it up (once `blog_posts` is added to the script - see Section 5 P1).

---

## 7. Deploy procedure (what the user runs on Bluehost)

```bash
cd /var/www/oncewerewild
bash scripts/safe-pull.sh        # POSIX, no rsync. Handles untracked uploads safely.
./deploy.sh                      # docker compose rebuild + restart.
```

After the deploy, the auto-applied snapshot will:
- Seed any missing `DEFAULT_CONTENT` rows (including the new `nav.4.label = "Blog"` and `nav.1.label = "Tours"` / `nav.3.label = "About Us"`).
- Replace `blog_posts` only if the snapshot has the same or more posts than live (per-collection guard).
- Replace `stories`, `about_blocks`, `journeys`, `media`, `content`, `site_settings` under the same guard.

---

## 8. Recent test reports

`/app/test_reports/iteration_5.json` ... `iteration_15.json` - chronological. `iteration_13` flagged the "group inference" bug fixed in 2026-06-25's session. `iteration_15` (2026-06-27) is the Blog feature E2E pass (8/8 backend + full UI flow).

---

## 9. Hard rules the next agent must follow

1. **English only** in responses.
2. **No em dashes** in any user-facing string (DB content, JSX, SEO, alt text). Comments are tolerated but discouraged.
3. **Run sync_from_live.py at start, every time.** Never assume the preview DB matches live.
4. **Never push DB state from preview to live.** The flow is one-way: live -> preview (data) and preview -> live (code).
5. **Preserve the per-collection data-loss guard** in `_apply_snapshot`. The client adds content directly on production.
6. **Use the testing agent** after any non-trivial change. Several iterations in this session caught real bugs only because of the testing-agent verification.
7. **Treat `backend/uploads/` as user data**, not source code. It's tracked in git only as a convenience for the Bluehost bind-mount. Do not delete or restructure without explicit user approval.
8. **Authentication is an integration**. If you touch login, JWT, password hashing, password reset, admin seeding, OAuth, or brute-force protection, you MUST call `integration_playbook_expert_v2` BEFORE writing any code. The current setup is plain email+password (no OTP) with bcrypt + 5-attempt/15-minute lockout.

---

## 10. Editor + admin quick reference

| Where | What you can do |
|---|---|
| `/admin` | Sign in (email + password). |
| `/admin/dashboard` | Tile launcher. Includes Blog tile (Newspaper icon). |
| `/admin/website-text` | Edit every public-site string (12 groups, including 29 contact form keys). |
| `/admin/website-media` | Per-section hero/bg image slots. |
| `/admin/hero` | Hero slideshow CRUD + reorder. |
| `/admin/gallery` | Gallery categories + items + reorder. |
| `/admin/journeys` | Tour CRUD + reorder + itinerary PDF upload. (URL still says `/journeys` because routes were not renamed - only the nav label.) |
| `/admin/about` | About text blocks + Stories from the Road blog. |
| `/admin/blog` | **NEW** Standalone blog: post table + side-drawer rich-text editor. |
| `/admin/submissions` | Contact-form inbox. |
| `/admin/settings` | Contact email/phone/address, opening hours, etc. |

The TipTap rich text editor in the Blog manager supports: Bold, Italic, H2, H3, bullet list, numbered list, blockquote, link (HTTP/HTTPS prompt), inline image upload (PNG/JPG/WebP up to 15 MB, encoded to WebP server-side), undo, redo. The HTML it produces is rendered with Tailwind `prose` classes on `/blog/:slug`.

---

## 11. .env files (the repo doesn't carry them)

When you re-clone the repo, recreate these:

**`/app/backend/.env`**
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="oncewerewild"
CORS_ORIGINS="*"
JWT_SECRET="dev-change-me-9f8c1f6e2a4b7d3c5e8a1b9f0d2e4c6a"
ADMIN_EMAIL="info@oncewerewild.com"
ADMIN_PASSWORD="ChangeMe-OWW-2026!"
OTP_LOGIN_ENABLED="false"
PUBLIC_SITE_URL="https://oncewerewild.com"
SENDER_EMAIL="onboarding@resend.dev"
RESEND_API_KEY=""
```
The admin user is seeded idempotently on every backend startup.

**`/app/frontend/.env`**
```
REACT_APP_BACKEND_URL=<your preview URL, e.g. https://auto-build-pull.preview.emergentagent.com>
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

Production `.env` values live on Bluehost only (see Docker compose).

---

- End of handover (2026-06-28).
