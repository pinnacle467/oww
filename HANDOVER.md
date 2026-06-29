# Once Were Wild Travel - Detailed Handover (v2026-06-29, Sessions B1 + B2 + T + U + V + W + X + Y + Z + **AA (Admin media UX unified + Pricing thumbnail fallback + hero CTA pruned)** COMPLETE in preview, NOT YET PUSHED TO LIVE)

> **Loading instructions for the next agent:**
> 1. Pull the GitHub repo (`pinnacle467/oww`, branch `main`) into `/app` - that's the source of truth for **all code**.
> 2. Restore `backend/.env` and `frontend/.env` (the repo doesn't carry them - see Section 11).
> 3. Immediately run the LIVE-SYNC sequence at the bottom of this doc (`python3 /app/backend/sync_from_live.py`) - that pulls **every DB row, every image, every video** from production at https://oncewerewild.com into your preview environment so you're working against real data, not an empty shell. **You can SKIP this step if you only need to develop against the snapshot that ships in the repo** — the snapshot is auto-applied on backend startup and already contains 237 media rows + 4 published tours + 176 content keys.
> 4. The sync script + repo together cost **< 10 credits** to re-hydrate the entire project; do not rebuild any of the features below from scratch.
> 5. **Respond to the user in English only.** They have explicitly disliked em dashes ("—") in user-facing copy - never use them in DB content, SEO text, alt text, JSON-LD, or seeded examples. Hyphens (`-`), commas, or colons are fine.
> 6. **▶︎ START HERE for this hand-off:** Sessions B1, B2, **T (Phase 1)**, **U (Phase 2)**, **V (Phase 3)**, **W (Phase 4)**, **X (About-Us spacing bug)**, **Y (Phase 5 — 3D Coverflow hero)**, **Z (Tours-page redesign — image-card grid on /pricing + 2-col tour-detail layout with Tabs + sidebar + SwipeableMedia lightbox portal fix)** and **AA (Admin media UX unified: Add / Replace / Delete everywhere there is media; Pricing card thumbnail falls back to first gallery image; "Join a Retreat" hero CTA removed)** of the Changes 1-9 backlog are all COMPLETE in preview. Backend 4/4 (Phase 1) + 11/11 (Phase 2) + 24/24 (Phase 3) + **7/7 (Z1 highlights field)** + frontend 41/41 (Phase 1) + 4/4 (Phase 2) + 5/5 (Phase 3) + 5/5 (Phase 4) + 2/2 (X bug fix) + 4/5 (Phase 5) + **8/8 (Z5 lightbox portal fix incl. mobile)** PASSED. Session AA has not been put through the testing agents yet (manual smoke-test only — the picker upgrade is opt-in via new props, the 2 new backend endpoints follow the existing cover-upload pattern). **The user has NOT yet pushed to live; deploy steps below (point 12).** Likely next candidates: real hero/gallery media uploads per tour by the client (so the new image-card grid + Gallery tab populate with actual photos), blog post body inline images opening in a SwipeableMedia lightbox, or any new client-nominated change. **Do NOT redo any B1, B2, T, U, V, W, X, Y, Z or AA work — it's already on disk.**
> 7. **MALENY DECISION (important — read before touching journeys):** The user reversed an earlier Q4 answer. "Maleny Creative Immersion" **stays as `type="tour"`** on `/pricing` — it's an already-planned upcoming trip. Do NOT re-tag Maleny.
> 8. **CORPORATE RETREATS WAS REMOVED FROM PUBLIC SITE (Session T, 2026-06-28):** Per client direction the entire "Corporate Retreats" public surface area is gone — no nav entry, no separate /corporate-retreats page. The "Corporate and Custom" tour remains as just another card on `/pricing` (it is `type="tour"`). The component files (`Retreats.jsx`, `RetreatsDropdown.jsx`) + backend endpoints (`/api/retreats`, `/api/retreats/{slug}`) + admin JourneysManager tabs are still on disk in case the client asks for re-enable later, but no public route consumes them. See Session T for full detail.
> 9. **SwipeableMedia is now THE site-wide gallery component (Session U).** Any new gallery — Blog post body, Home content block, Pricing card carousels, future destination pages — MUST consume `components/media/SwipeableMedia.jsx`. Do not re-implement carousel logic. The component already handles images, MP4 videos, YouTube and Vimeo embeds, touch swipe, arrows, dots, counter, lightbox.
> 10. **MultiMediaPicker is THE site-wide admin picker (Session V; major upgrade in Session AA).** Any new admin form that needs an ordered list of media (image / MP4 / embed) MUST consume `components/admin/MultiMediaPicker.jsx`. Do not re-implement the picker. As of Session AA the picker also handles direct multi-file uploads, per-tile binary replace, and per-tile permanent delete (with confirm dialog), all gated behind opt-in props (`allowUpload`, `allowDelete`, `uploadSection`, `reloadMedia`) so existing callers that only need pick-from-pool keep working unchanged.
> 11. **The frontend runs a PRODUCTION build (`frontend/start.sh` → `react-scripts build` → `node server.js`)**, NOT a dev server. After ANY frontend code edit you must run `cd /app/frontend && yarn build` (or `sudo supervisorctl restart frontend` which re-runs start.sh). Don't rely on hot reload.
>
> 12. **How to deploy this preview to live (run on the Bluehost SSH terminal):**
>
> Two-step process — push from preview to GitHub first, then pull on Bluehost.
>
> **Step 12a — push preview to GitHub** (in the Emergent chat, NOT terminal):
>    Click the "Save to Github" button in the chat input. This commits every file under `/app` (including the new `frontend/src/index.css` Coverflow rules, the updated `HeroSlideshow.jsx`, the `About.jsx` story-body paragraph splitting, the extended `sync_from_live.py`, the regenerated `backend/seed_data/site_snapshot.json`, the new Phase 3 `MultiMediaPicker.jsx`, the Phase 4 `useSwipeNav.js`, the new **Z Pricing.jsx + TourDetail.jsx redesign**, the **Z highlights field + admin textarea**, the **Z5 SwipeableMedia.jsx portal fix**, and the new **AA MultiMediaPicker.jsx upgrade + AboutManager / BlogManager remove-cover buttons + 2 new backend DELETE endpoints + Pricing.jsx hero fallback + HeroSlideshow.jsx CTA removal**) and pushes to `pinnacle467/oww@main`. Wait for the push confirmation toast.
>
> **Step 12b — pull on Bluehost terminal** (SSH into the Bluehost server, then):
> ```bash
> # Replace /var/www/oncewerewild if the repo lives elsewhere on Bluehost.
> cd /var/www/oncewerewild
>
> # Safe pull — preserves backend/uploads/ (admin-uploaded media) while
> # pulling the new code + snapshot. Always use this script, never a
> # raw `git pull`.
> bash scripts/safe-pull.sh
>
> # Rebuild the frontend production bundle so the live nginx serves the
> # new main.<hash>.js with the Coverflow CSS + paragraph-split renderer.
> cd frontend
> yarn install --frozen-lockfile
> yarn build
> cd ..
>
> # Restart the backend if your Bluehost setup uses supervisor (skip if
> # you use systemd or a different process manager — adapt to taste).
> sudo supervisorctl restart backend  ||  systemctl --user restart oww-backend  ||  echo "(restart backend by hand)"
>
> # Sanity-check the live API has the new fields after restart:
> curl -s https://oncewerewild.com/api/stories | python3 -c "import sys,json; d=json.load(sys.stdin); print('stories=', len(d))"
> curl -s https://oncewerewild.com/api/home-sections | python3 -c "import sys,json; d=json.load(sys.stdin); print('home_sections=', len(d), 'first has media_ids=', 'media_ids' in (d[0] if d else {}))"
> ```
>
> **What to expect after deploy:**
> - **NEW (Session AA):** Every admin surface that handles media now offers consistent **Add / Replace / Delete** affordances:
>   - Tours gallery (`/admin/journeys` → expand a tour → Gallery tab), Blog cover gallery (`/admin/blog` → editor → Cover gallery), Home Content section gallery (`/admin/home-content` → editor → Section gallery) all gain an "Add photos or videos" button (multi-select + progress queue, streams to `/admin/media/upload`, auto-adds to the selection in upload order), per-tile Replace (binary swap via `PATCH /admin/media/{id}` — keeps the same id so ordering is preserved), and per-tile permanent Delete (with confirm dialog → `DELETE /admin/media/{id}`).
>   - Tours gallery now also accepts **videos** (`allowVideos=true`), matching Blog and Home which were already video-enabled.
>   - AboutManager Stories (single `cover_url`) and BlogManager featured image (single `featured_url`) gain explicit "Remove cover" / "Remove image" buttons backed by 2 NEW backend endpoints `DELETE /api/admin/stories/{sid}/cover` + `DELETE /api/admin/blog/{pid}/cover` (clear DB fields + best-effort unlink of files from disk).
>   - All other admin surfaces (Hero Carousel, Gallery Photos & Videos, Website Images & Videos, About Us Travel Gallery, Charity) already used `MediaManager` which already has bulk-add + replace + delete-with-confirm — they are unchanged.
> - **NEW (Session AA):** `/pricing` Tours-index cards fall back to the **first image of the tour's `gallery_media_ids`** when no `hero_media_id` is set. Maleny's "Most Popular" card now shows its Glasshouse Mountains hinterland photo instead of the "M" monogram. The 3 tours with empty galleries (Tasmania / Western Australia / Corporate and Custom) keep their monograms until the operator uploads photos — no admin re-work needed, the moment a photo is added to a tour's gallery the card thumbnail auto-populates on the next public render.
> - **NEW (Session AA):** Home hero secondary CTA "Join a Retreat" is **removed**. Only the primary "Explore Experiences" button remains. The content key `home.hero.cta_secondary` is no longer read by the JSX (the key still exists in DB for now, can be deleted in a future cleanup if desired — no public site code consumes it).
> - **NEW (Session Z):** `/pricing` (Tours index) now shows a clean 3-col image-card grid with gold name-banner + chevron — every card is one clickable tile → `/tours/<slug>`. The "Most Popular" badge is preserved on Maleny. With Session AA the cards now also show real photos once a tour has any gallery image.
> - **NEW (Session Z):** `/tours/<slug>` (Tour Detail) now uses a 2-column layout: title + duration subtitle, hero SwipeableMedia carousel, italic gold-bordered description quote, tab strip (Details / Gallery / What's Included / Prices & Dates) with auto-hidden empty tabs; right sticky sidebar shows Tour highlights checkmark list + Small group tours blurb + Testimonials card. **Itinerary OUTLINE on-page + Full PDF stays in the Download button** (per client direction). Tabs that have no content auto-hide so empty rows look clean.
> - **NEW (Session Z5):** Clicking any image in a SwipeableMedia carousel anywhere on the site (TourDetail hero, Gallery tab, About travel gallery, Blog post gallery, etc.) now opens a true fullscreen lightbox via React portal to `document.body`. Previously the lightbox was trapped inside the `.reveal` ScrollReveal ancestor's transform-induced containing block, letting the sticky sidebar and tabs leak through.
> - Home page hero shows 3D Coverflow on desktop (prev / next slides peek in from sides at 35° tilt). Mobile keeps the existing centred-slide look.
> - About → Stories → "Read story" details now render proper paragraph spacing when the operator left blank lines (fixes the Kangaroo Island story bug).
> - Tap-to-swipe in fullscreen lightboxes on mobile (Phase 4).
> - Blog posts + Home content sections can now have multi-cover galleries via the admin MultiMediaPicker (Phase 3).
> - Tour /pricing card "Maleny Creative Immersion" still shows as a tour (per client direction).
> - "Corporate Retreats" is fully removed from the public nav (per Session T).
>
> **If anything looks wrong after deploy:** roll back with `git reset --hard HEAD~1 && bash scripts/safe-pull.sh` (the snapshot file will revert too, so admin-authored content since the previous deploy will be restored from the previous snapshot).

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

### AA. Admin media UX unified + Pricing card thumbnail fallback + Home hero CTA pruned (2026-06-29, **COMPLETE in preview, NOT YET PUSHED TO LIVE**)

**Client direction (verbatim):**
> "Within the tours section in the admin panel, there needs to be an option to add/replace/remove multiple media directly in the gallery tab in addition to choosing from existing media."
>
> "The add/replace/delete option should be on every section of the website wherever there is a provision for media to be displayed not just limited pages."
>
> "This page should have an image in the thumbnail. It can be any image from the gallery section of that respective tour" (about `/pricing` cards showing monogram letters when no `hero_media_id` is set).
>
> "We don't need this button on hero slideshow" (the "JOIN A RETREAT →" CTA).

**AA1 — MultiMediaPicker upgraded with opt-in Add / Replace / Delete (`frontend/src/components/admin/MultiMediaPicker.jsx`):**
Four new optional props (all default to backwards-compatible no-op so any future caller that only wants pick-from-pool continues to work unchanged):
- `allowUpload: boolean` — when true, renders an "Add photos or videos" button at the top-right of the picker.
- `uploadSection: string` — the media `section` tag applied to newly uploaded rows. Required when `allowUpload` is true. Each consumer passes its own (`tour-gallery`, `blog-gallery`, `home-gallery`) so uploads are discoverable later in `/admin/website-media`.
- `allowDelete: boolean` — when true, each selected tile gets a small red trash icon that opens a confirm dialog ("This will remove the file from Website Media as well as from every page that references it") and on confirm calls `DELETE /api/admin/media/{id}` plus removes the id from the gallery selection.
- `reloadMedia: () => Promise<void>` — callback the picker invokes after every upload / replace / delete so the parent's available-media pool refreshes. Each consumer wires this to a media-only reload helper (`loadMedia`) instead of the full page reload to avoid blowing away in-progress edits on the rest of the form.

Behaviour added:
- **Bulk upload:** multi-file file-picker (`accept="image/*"` or `"image/*,video/*"` depending on `allowVideos`). Each file streams to `POST /api/admin/media/upload` one at a time with a per-file status badge (pending → uploading with spinner → done with check / error with alert icon). A green banner flashes the success count. Newly uploaded media are **auto-added to the current gallery selection in upload order** so the operator doesn't have to scroll the available pool to find them.
- **Replace:** small refresh icon appears top-right on hover over each selected tile. Opens a single-file picker, encodes the file to a data URL via FileReader (same pattern the legacy `MediaManager.replaceImage` already uses) and `PATCH /api/admin/media/{id}` with `{ file_url, file_type }`. Crucially the media row's `id` is preserved, so gallery order and any references from other content (blog posts, home sections) remain valid.
- **Soft remove vs permanent delete:** the existing `X` button still does the lightweight "remove from this gallery, keep the file in Website Media". A second red trash button does the permanent action. The two are visually distinct and `allowDelete` only enables the trash one — callers that don't want destructive ops in their picker can keep just the X.
- **Toast banner** below the heading flashes status messages ("Uploaded 5 items.", "File replaced.", "Deleted permanently.") via a 2.8s setTimeout.
- **Video thumbnails in the picker:** selected and available tiles now show the ffmpeg-extracted `thumb_url` for video rows (when present) plus a small "VIDEO" footer label. Previously video tiles just showed an "MP4" text placeholder.

Test-ids added: `mmp-upload-btn-{ns}`, `mmp-upload-input-{ns}`, `mmp-replace-input-{ns}`, `mmp-queue-{ns}`, `mmp-banner-{ns}`, `mmp-replace-{id}`, `mmp-delete-{id}`, `mmp-delete-dialog-{ns}`, `mmp-delete-cancel-{ns}`, `mmp-delete-confirm-{ns}`. Existing test-ids (`mmp-available-{id}`, `mmp-selected-{id}`, `mmp-remove-{id}`, `mmp-filter-{ns}`, `mmp-empty-{ns}`, `multi-media-picker-{ns}`) are preserved.

**AA2 — Backend (2 NEW endpoints in `backend/server.py`):**
- `DELETE /api/admin/stories/{sid}/cover` (Bearer auth) — clears `cover_url`, `cover_srcset`, `cover_avif_srcset`, `cover_lqip` on the story row and best-effort `unlink(missing_ok=True)` the underlying files from `backend/uploads/stories/`. Returns `{ "message": "Cover removed" }`. Triggers `schedule_snapshot`.
- `DELETE /api/admin/blog/{pid}/cover` (Bearer auth) — same shape for `blog_posts` rows (`featured_url`, `featured_srcset`, `featured_avif_srcset`, `featured_lqip` cleared, disk files unlinked under `backend/uploads/blog/`).
- No new Pydantic models, no migrations needed — both endpoints just write `$set` updates over existing fields.

**AA3 — Consumers wired up:**
- `frontend/src/pages/admin/JourneysManager.jsx`:
  - Top-level `loadMedia` helper added (media-only reload via `api.get('/media')`).
  - `DraftFields` now takes an `onReloadMedia` prop; both call sites (new-row form + per-row drawer) thread `loadMedia` through.
  - MultiMediaPicker call: `allowUpload={true}`, `allowDelete={true}`, `uploadSection="tour-gallery"`, `reloadMedia={onReloadMedia}`, `allowVideos={true}` (was `false`).
- `frontend/src/pages/admin/BlogManager.jsx`:
  - Top-level `loadMedia` helper added.
  - `PostEditorDrawer` takes a new `onReloadMedia` prop, MultiMediaPicker gets `allowUpload={true}`, `allowDelete={true}`, `uploadSection="blog-gallery"`, `reloadMedia={onReloadMedia}`.
  - New "Remove image" button next to the existing "Replace image" on the **single** featured-image field (separate from the multi-cover MultiMediaPicker). When `mode === "edit"` it hits `DELETE /admin/blog/{id}/cover`; in create mode it just drops the client-side `URL.createObjectURL` preview. `window.confirm("Remove the featured image? The file will be deleted from the server.")` gates the destructive call.
- `frontend/src/pages/admin/HomeContentManager.jsx`:
  - Top-level `loadMedia` helper added.
  - `Drawer` sub-component takes a new `onReloadMedia` prop, MultiMediaPicker gets `allowUpload={true}`, `allowDelete={true}`, `uploadSection="home-gallery"`, `reloadMedia={onReloadMedia}`.
- `frontend/src/pages/admin/AboutManager.jsx`:
  - New `removeCover(s)` function calls `DELETE /admin/stories/{s.id}/cover` after `window.confirm`. Renders a "Remove cover" button under the existing "Replace cover" / "Upload cover" button on each story card. Button hidden when `s.cover_url` is empty. Test-id `remove-cover-{s.id}`.

**AA4 — Pricing card thumbnail fallback (`frontend/src/pages/Pricing.jsx`):**
Hero resolution order changed from `hero_media_id → legacy j.image → blank monogram` to **`hero_media_id → first image in gallery_media_ids → legacy j.image → blank monogram`**. Implementation reads `j.gallery_media_ids`, looks each id up in `mediaMap`, returns the first row whose `file_type === "image"`. Reuses the same `abs`/`absMap`/`lqip` plumbing so srcset / AVIF / LQIP all still work; the card hover transform, image zoom and gold name-banner are unchanged. The 4 tours currently in the DB:
- Maleny Creative Immersion: `hero_media_id` empty, gallery has 12 images → card now shows the first gallery image (Glasshouse Mountains hinterland view).
- Tasmanian / Western Australian / Corporate and Custom: empty galleries → fall through to monogram placeholders. The moment the operator uploads any image to a tour's gallery (via the upgraded AA1 picker), the public card auto-populates on next render.

**AA5 — Home hero CTA pruned (`frontend/src/components/home/HeroSlideshow.jsx`):**
- The secondary `<CTAButton>` (testid `hero-cta-retreat`) is removed from both branches of the bottom-overlay (with-tagline overlay AND CTAs-only fallback). Only the primary "Explore Experiences" button (`hero-cta-experiences`) remains.
- The `const cta2 = useText("home.hero.cta_secondary", "Join a Retreat")` declaration is also removed because nothing reads it any more. The content-key row itself stays in DB for now (harmless if `/admin/website-text` still lists it; the public JSX simply no longer consumes it). If the client ever wants the button back, restoring it is a 3-line revert.

**Files touched:**
- Backend: `backend/server.py` (2 new endpoints after the existing story-cover and blog-cover POSTs).
- Frontend: `components/admin/MultiMediaPicker.jsx` (major upgrade, full rewrite with backwards-compat defaults), `components/home/HeroSlideshow.jsx`, `pages/Pricing.jsx`, `pages/admin/JourneysManager.jsx`, `pages/admin/BlogManager.jsx`, `pages/admin/HomeContentManager.jsx`, `pages/admin/AboutManager.jsx`.
- No backend migrations, no snapshot regeneration needed (no schema changes to seeded collections — the 2 new endpoints just clear existing fields).

**Verification status:**
- Backend health: `curl /api/journeys` returns 200, 4 tours. New `DELETE` endpoints registered (FastAPI loaded without errors after restart).
- Frontend production build: `yarn build` succeeded, supervisor restart returned 200 from `:3000`.
- Visual smoke screenshots taken: Maleny `/pricing` card now shows the gallery photo; admin Tours editor → Gallery tab shows the new "Add photos or videos" button with Replace + Delete icons revealing on hover.
- **NOT auto-tested:** the `auto_frontend_testing_agent` was not run on this session per user direction (they prefer to push and verify on live themselves). The picker upgrade is opt-in via new props so callers that don't pass them keep working; the 2 new backend DELETE endpoints follow the same pattern as the existing POST cover-upload endpoints.

**Why no snapshot regen this session:**
The snapshot is collection-row-level data. None of the AA changes added or removed rows from any collection — they only added (a) UI affordances that compose existing endpoints, (b) two new endpoints that mutate existing fields, (c) one component prop change. Running `python3 backend/sync_from_live.py` before the next deploy will pick up any client edits made on live in the meantime; that's the only time a snapshot regen is needed before pushing AA.

**Out of scope (intentionally — these were not in the client's AA brief):**
- Per-tour testimonials on `/tours/<slug>` sidebar (still uses site-wide `testimonials.N.*` content keys — same as Session Z shipped).
- Blog post **body** inline images opening in a SwipeableMedia lightbox (still out of scope; see Session W).
- Pause/Play affordance on hero slideshow (P3 in PRD backlog).
- Per-section delete log/audit trail for admin Trash actions (the confirm dialog is the only safety net right now; if the client wants undo, that's a future enhancement).

---

### Z. Tours-page redesign per client (Adele WhatsApp) reference + SwipeableMedia lightbox portal fix (2026-06-29, **COMPLETE in preview, backend 7/7 + frontend 8/8 PASSED, NOT YET PUSHED TO LIVE**)

**Client direction (verbatim, paraphrased from WhatsApp screenshots she sent):**
> "I like the small pictures with the tour on the first of the tour page. You can clearly see what interests you. It's just more clear to me — when you hit the second page you see all the important information: Details, Price, Gallery, Inclusions. I'm not saying I like the day-by-day itinerary on the page — I think the PDF is better, because people like to print stuff off. But definitely an outline of what we're doing would work here. Then the PDF attachment. Just really clean, and easy to find the essentials."

She also said "**the look in the images is what she wants for every tour she has and adds in future**" — so the new layout is fully data-driven (driven by admin fields, not hardcoded per tour). She referenced arrivederciPuglia.com as the layout pattern but wants it in our gold / cream / ink palette (NOT orange).

**Z1 — Backend (`backend/server.py`):**
- Added optional `highlights: List[str]` field to `JourneyInput` and `JourneyUpdate` Pydantic models. Defaults to `[]`. Powers the "Tour highlights" checkmark list in the right sidebar of `/tours/<slug>`.
- Idempotent startup migration (logged as `Z1: defaulted highlights on N journey rows` on first boot, `0` thereafter): `journeys.update_many({"highlights": {"$exists": False}}, {"$set": {"highlights": []}})`.
- Tested via `deep_testing_backend_v2`: 7/7 PASS including the critical partial-PATCH preservation test (a PATCH without `highlights` does NOT clear the existing array).

**Z2 — Frontend `/pricing` Tours index (`frontend/src/pages/Pricing.jsx`):**
- Replaced the multi-line tier cards with a clean responsive **3-col / 2-col / 1-col image-card grid** (`sm:grid-cols-2 lg:grid-cols-3`). Each card:
  - 4:3 hero photo on top — resolves `hero_media_id` to the media collection (with srcset / lqip), falls back to a monogram-letter placeholder if the tour has no hero image.
  - **Gold name banner** footer with region eyebrow + tour name + chevron icon. Whole card is a single `<Link to="/tours/<slug>">`.
  - "Most Popular" badge top-left on `j.popular` row.
  - Hover: `-translate-y-1.5`, image `scale-105`, banner transitions to `nature-deep`.
  - test-id `pricing-card-{id}` on each card.
- Hero `<PageHero>` and FAQ accordion unchanged.

**Z3 — Frontend `/tours/<slug>` Tour Detail (`frontend/src/pages/TourDetail.jsx`, **full rewrite**):**
- Removed the old single-column PageHero + body sections layout.
- New **2-column layout** (`lg:grid-cols-3`, main `col-span-2`, sidebar `col-span-1`):
  - LEFT main col:
    - H1 tour name + duration subtitle ("X nights - Small Group Tour" / "X nights - Corporate Retreat").
    - Hero `SwipeableMedia` carousel (uses `gallery_media_ids` if present, else `[hero_media_id]`, else hidden).
    - Italic quote box with left gold border (description_html / summary).
    - **Tab strip** with gold active-tab fill + small downward chevron tail. Tabs: Details / Gallery / What's Included / Prices & Dates. **Tabs auto-hide when their content is empty** so empty rows look clean. `flex-nowrap` + `overflow-x-auto no-scrollbar` so all four sit on one line at every viewport; horizontal scroll on tiny mobiles.
    - Tab panels:
      - **Details** = `itinerary_html` outline + `more_details_html` + `practical_html` + **Download Full Itinerary (PDF)** button (per client direction full day-by-day lives in the PDF, not on-page). Friendly empty state if all four are blank.
      - **Gallery** = `SwipeableMedia` of `gallery_media_ids`.
      - **What's Included** = 2-col includes / excludes lists (Check / X icons).
      - **Prices & Dates** = price card + dates card + Enquire CTA + secondary PDF download.
    - Always-visible Enquire CTA + back-link below the tabs.
  - RIGHT sticky sidebar (`lg:sticky lg:top-24`):
    - **Tour highlights** card with checkmark list (gold rings on `bg-gold/15`). Hidden when `highlights = []`.
    - **Small group tours** blurb (admin-editable via `tour_detail.small_group.heading` / `.body` content keys).
    - **Testimonials** card (dark green / cream) sourcing the first two `testimonials.N.quote` / `testimonials.N.author` content keys from the existing home group.
- **Preview ribbon** at the top of the page when the tour `status = "draft"` (preserved from Phase 1).
- Single component handles both `/tours/<slug>` and `/corporate-retreats/<slug>` — uses `useLocation()` to detect the URL prefix and switches API endpoint + back-link copy accordingly. The retreats public surface area is still removed (Session T), but the code path is kept ready in case the client asks for re-enable.

**Z4 — Admin (`frontend/src/pages/admin/JourneysManager.jsx`):**
- Full restructure of the `DraftFields` editor into eight clearly-labelled section cards that mirror the public-page layout, so the operator's mental model maps 1-1 with what they see on `/pricing` and `/tours/<slug>`:
  1. **"Card on the Tours listing"** — name, region, hero_media_id (with "Drives the small image card... opens /tours/<slug>" hint).
  2. **"Detail page header"** — nights (duration subtitle), CTA button text, summary (used as the italic quote), and a Rich description TipTap editor that overrides the summary.
  3. **"Tab: Details"** — itinerary_html outline + more_details_html + practical_html (three TipTap editors with hints reminding the operator to keep the on-page version brief, full plan goes in the PDF).
  4. **"Tab: Gallery"** — gallery_media_ids via the existing MultiMediaPicker (hint: "first image becomes the hero photo if no separate hero is set").
  5. **"Tab: What's Included"** — includes + excludes textareas (with the seeded excludes defaults).
  6. **"Tab: Prices & Dates"** — priceFrom, priceUnit, priceNote, dates.
  7. **"Sidebar: Tour highlights"** — highlights textarea (hint: "The whole panel hides when this is empty").
  8. **"URL, visibility & SEO"** — slug, type, status, is_active checkbox, seo_title, seo_description.
- Each section is a labelled card (`<Section>` wrapper, ~25 lines) with a heading + subtitle describing exactly which part of the public page the fields drive. Subtitles dynamically reference the actual slug (e.g. "Powers the title row and italic quote box on /tours/maleny-creative-immersion") via interpolation.
- The added test-ids `section-card-<rowId>`, `section-header-<rowId>`, `section-details-<rowId>`, `section-gallery-<rowId>`, `section-includes-<rowId>`, `section-prices-<rowId>`, `section-highlights-<rowId>`, `section-seo-<rowId>` make the layout addressable for future Playwright tests.
- Existing Z1 "Tour highlights (one item per line)" textarea is preserved inside the new "Sidebar: Tour highlights" section. test-id `journey-highlights-<rowId>` unchanged.
- Data flow unchanged — newline-joined strings on the form (`_includesText`, `_excludesText`, `_highlightsText`), split via `includesToArray` on save. `EMPTY_DRAFT.highlights = ""`.
- The DraftFields outer container is `grid sm:grid-cols-2 gap-5` but each `<Section>` spans both columns (sm:col-span-2) so all section cards stack vertically; fields inside each section can still be 2-up.

**Z5 — Bug fix (`frontend/src/components/media/SwipeableMedia.jsx`) — SwipeableMedia lightbox portal escape:**
- **Symptom (client report with screenshot):** clicking an image in the SwipeableMedia hero carousel on `/tours/<slug>` opened the lightbox at full size, BUT the sticky right sidebar (Tour highlights / Small group tours / Testimonials) and the DETAILS tab strip still rendered VISIBLE on top of the lightbox image, and the dark `bg-black/95` backdrop wasn't covering the screen.
- **Root cause (CSS containing-block trap):** every section of the new TourDetail.jsx is wrapped in `<ScrollReveal>`, which renders the `.reveal` class. `.reveal` has `transform: translateY(34px)` plus `will-change: opacity, transform`. Per the CSS spec, **any ancestor with a non-`none` transform creates a containing block for ALL its `position: fixed` descendants** (see MDN "Containing block" article). That meant the lightbox's `fixed inset-0 z-[1000]` was being interpreted relative to the carousel's ScrollReveal wrapper instead of the viewport — so it occupied the carousel slot, not the full screen, and the dark backdrop was clipped.
- **Fix:** render the lightbox JSX via `ReactDOM.createPortal(JSX, document.body)`. `document.body` is NOT a containing-block ancestor for fixed-position descendants (the `<html>` initial containing block is), so `fixed inset-0` once again covers the viewport. No other changes — same JSX, same test-ids, same swipe / keyboard / dark-backdrop behaviour.
- **Why this affects only the new TourDetail and not the old pages:** the old single-column tour page didn't wrap the carousel in a ScrollReveal (it was a PageHero). The new 2-col layout uses ScrollReveal around the carousel for the staggered reveal animation. The same trap would have hit Blog / About / Home if they ever wrapped their carousel slot in `.reveal` (none currently do, but the portal fix protects them too).
- Tested via `auto_frontend_testing_agent`: 8/8 PASS on desktop 1440×900 AND mobile 390×844:
  1. Portal escape — `document.querySelector('[data-testid="swipeable-lightbox"]').parentElement === document.body` returns `true`.
  2. Viewport fill — `getBoundingClientRect()` returns `top=0, left=0, width=innerWidth, height=innerHeight`.
  3. Dark backdrop `rgba(0,0,0,0.95)` covers full screen.
  4. Sidebar cards + DETAILS tab fully occluded by z=1000.
  5. Close (X) removes lightbox from DOM, unlocks body scroll.
  6. Arrow keys / Escape work.
  7. Mobile 390×844 regression passes.
  8. No console errors on `/about` regression check.

**NEW admin-editable content keys (auto-grouped under "Tour detail" in `/admin/website-text` via the existing group-from-prefix inference):**
- `tour_detail.highlights.heading` → "Tour highlights"
- `tour_detail.small_group.heading` → "Small group tours"
- `tour_detail.small_group.body` → "For a more private experience and a better quality of service, our small groups are limited to twelve travellers."
- `tour_detail.testimonials.heading` → "Testimonials"
- `tour_detail.tab.details` / `.gallery` / `.includes` / `.prices` → tab labels
- `tour_detail.download_pdf` → "Download Full Itinerary (PDF)"
- `tours.detail.enquire` → "Enquire Now"

**Files touched:**
- `backend/server.py` — `JourneyInput`, `JourneyUpdate` add `highlights`; Z1 migration in `seed()`.
- `frontend/src/pages/Pricing.jsx` — new 3-col image-card grid (replaces tier cards).
- `frontend/src/pages/TourDetail.jsx` — full rewrite (2-col + tabs + sidebar).
- `frontend/src/pages/admin/JourneysManager.jsx` — `highlights` textarea + state plumbing.
- `frontend/src/components/media/SwipeableMedia.jsx` — `createPortal` import + lightbox JSX wrap.

**Out of scope (intentionally — kept Z lean):**
- Per-tour testimonials. The right-sidebar testimonials currently reuse the site-wide `testimonials.N.*` content keys. If the client wants per-tour quotes later, add a `testimonials: List[{quote, author}]` field on `journeys` and render that when non-empty, else fall back to the site-wide keys.
- "Pause / Play" affordance on the hero slideshow (P3 from Section 5).
- Blog post body inline images → SwipeableMedia lightbox (still out of scope).
- Snapshot has NOT been regenerated this session because the only DB write was the `highlights` field on the journeys collection (defaulted to `[]` on every row by the migration); a fresh snapshot would only carry the test-set Tasmanian highlights and we restored that after the visual smoke. Run `python3 backend/sync_from_live.py` after the client populates real highlights via the admin if you want the next deploy to seed them.

### Y. Phase 5 of Changes 1-9 — 3D Coverflow Side-Peek hero transition (2026-06-29, **COMPLETE in preview, frontend 4/5 PASS (the 1 "fail" is a 6px Playwright scrollWidth quirk; side panels are visually clipped correctly), NOT YET PUSHED TO LIVE**)

**User direction:**
"I wanted a 3D transition for Hero Slideshow." → picked **Coverflow Side-Peek** from the 6-option menu → asked to crank intensity to "true Coverflow" parameters.

**What changed:**

- `frontend/src/components/home/HeroSlideshow.jsx`:
  - The `<section>` element now carries `className="hero-stage relative h-[100svh] w-full overflow-hidden bg-ink"` (extra `hero-stage` class for the 3D perspective root).
  - The slides `.map(...)` now computes `prevIdx = (index - 1 + HERO.length) % HERO.length` and `nextIdx = (index + 1) % HERO.length` on each render, assigning one of `active` / `prev` / `next` / `""` to each slide.
  - When `reduceMotion` is true the JSX skips the `prev` and `next` staging (only the active slide is visible) so the global reduce-motion override produces an effective cross-fade instead of a snap-rotation.

- `frontend/src/index.css`:
  - NEW `.hero-stage` rule: `perspective: 1500px; perspective-origin: 50% 50%; overflow: hidden; clip-path: inset(0)` (overflow+clip-path seal 3D-transformed children from leaking past the section on iOS WebKit).
  - REWRITTEN `.hero-slide` rules with staging classes:
    - Default (idle): `opacity: 0; transform: translate3d(0, 0, -600px);` parked deep behind camera.
    - `.prev`: `opacity: 0.75; transform: translate3d(-22%, 0, -180px) rotateY(-35deg); z-index: 2;`
    - `.active`: `opacity: 1; transform: translate3d(0, 0, 0) rotateY(0); z-index: 5;`
    - `.next`: `opacity: 0.75; transform: translate3d(22%, 0, -180px) rotateY(35deg); z-index: 2;`
  - Transition: `opacity 1300ms cubic-bezier(0.22, 1, 0.36, 1), transform 1500ms cubic-bezier(0.22, 1, 0.36, 1)`. Each `.hero-slide` gets `transform-style: preserve-3d; backface-visibility: hidden; will-change: opacity, transform`.
  - **`rotateY` sign convention (READ CAREFULLY before editing):** the side panels' INNER edges (closer to viewport centre) face the viewer. With CSS' right-handed coordinate system, that means `.prev` needs `rotateY(-35deg)` (NEGATIVE) and `.next` needs `rotateY(+35deg)` (POSITIVE). The opposite signs would tilt the OUTER edges forward which feels wrong for a side panel. There's a code comment explaining this above each rule — don't "fix" the signs without re-reading it.

**LCP protected:**
- Active slide (slide 0) paints flat at Z=0 on first mount; no animation triggers until `index` changes.
- The static `<link rel="preload" fetchpriority="high">` tag baked into `index.html` by `regenerate_hero_preload` is untouched and still references slide 0's image.
- Side panels (prev + next) are visible at first paint but with `loading="lazy"` on the `<img>` and lower visual mass (rotated + foreshortened + 0.75 opacity). They cannot steal LCP candidacy from the centred slide.

**Cranked intensity (current ship values):** `translateX: ±22%`, `rotateY: ±35deg`, `opacity: 0.75`, `Z-offset: -180px`. These are tuned for desktop. On mobile (≤480px) the side panels mostly clip behind the section's `overflow:hidden` so the centre stays clean.

**Verified by testing agent:** 17/19 (then 4/5 on re-test after rotateY fix). The single remaining "fail" is a Playwright `scrollWidth` measurement quirk on mobile (reports 396px on a 390px viewport) — visually inspected, the side panels are correctly clipped and no scrollbar is rendered. Auto-advance (4.5s), arrow nav, dot nav, reduce-motion fallback all PASS.

**Files touched:** `frontend/src/components/home/HeroSlideshow.jsx`, `frontend/src/index.css`. **No backend changes.** Snapshot unchanged.

### X. Bug fix - About Us story body preserves blank lines + sync_from_live.py extended (2026-06-29, **VERIFIED in preview, NOT YET PUSHED TO LIVE**)

**Client report:** "On the About Us stories, I added a story on a trip we did to Kangaroo Island. At the bottom of the story, I left a space, but the space doesn't appear on the live site." The closing two lines of the body were:

```
...We'd love to travel with you.

TRAVEL LIVED ... IS A LIFE TRULY LOVED
```

— the blank line between them was missing on the live About page.

**Root cause (forensic):**
1. Backend storage is innocent. A round-trip on `/api/admin/stories` with body `"Para one.\n\nTRAVEL LIVED..."` returned bytes `[10, 10]` for the blank-line position. Pydantic + Mongo preserve newlines exactly.
2. The **currently-deployed live bundle** (`/static/js/main.21a6b2ab.js`, 444 KB) has ZERO occurrences of `whitespace-pre-wrap`, `Read story`, or any story-body rendering markup. The old live About page renders the story body inside a plain block that HTML-normalises consecutive whitespace, so `\n\n` collapsed to a single space.
3. The preview's About.jsx already had `whitespace-pre-wrap` (added in an earlier session) but the user has not yet pushed to live — which is why the client still sees the bug. Also `whitespace-pre-wrap` only produces ~one line-height of blank space (~28 px with `line-height: 1.8` + `text-sm`) which is too subtle to feel like an editorial paragraph break.

**Fix (frontend/src/pages/About.jsx, story-body rendering inside `<details>`):**
- The body string is normalised (`\r\n` → `\n`) then split on **one-or-more blank lines** (`/\n\s*\n+/`).
- Each non-empty chunk renders as its own `<p className="whitespace-pre-line">` inside a `<div className="...space-y-4">`.
- Empty fragments are `.filter(Boolean)`-stripped so a stray trailing newline doesn't render as a phantom `<p>`.
- `whitespace-pre-line` inside each paragraph preserves single newlines as line breaks (without the awkward double-space `\n` produces in pre-wrap).
- **Result:** blank lines in admin → real 16 px margin-top between rendered `<p>` elements. Single-paragraph stories still render exactly one `<p>` (regression-tested).

**Testing agent verification (2/2 PASS + cleanup):**
- Multi-paragraph story (matching the exact client wording) → 2 `<p>` elements, 16 px vertical gap.
- Single-paragraph "Sunrise on Cradle Mountain" → still exactly 1 `<p>` (no spurious empties).
- Test stories cleaned up.

**Secondary fix - `backend/sync_from_live.py` extended:**
The previous script only pulled `media`, `journeys`, `content`, `site_settings`, `gallery_categories`. Editorial CMS collections (`stories`, `about_blocks`, `home_sections`, `home_faqs`, `blog_posts`) were silently missed by sync, which is why a fresh `/app` clone was never seeing client-authored stories like Kangaroo Island. The script now pulls all five additional collections AND writes them into `site_snapshot.json` so the backend's existing `_apply_snapshot()` consumes them on boot. Verified on a re-run: `media=242 journeys=4 content_keys=178 settings_keys=15 categories=4 stories=1 about_blocks=3 home_sections=4 home_faqs=16 blog_posts=1`, snapshot now 286 KB.

**Important finding for the user:** the Kangaroo Island story is **NOT** in live `/api/stories` (only Cradle Mountain is). Either the client saved it as `is_visible: false` (draft, public endpoint filters drafts out), or there's an authentication issue on save. Once the user verifies the story is saved with `is_visible: true` on live admin AND pushes the preview to live via "Save to Github", the blank-line bug will be fully fixed end-to-end. The render-side fix is on disk and tested in preview.

**Files touched:** `frontend/src/pages/About.jsx` (story-body render), `backend/sync_from_live.py` (5 new collection pulls + snapshot keys), `backend/seed_data/site_snapshot.json` (regenerated via sync, 286 KB).

### W. Phase 4 of Changes 1-9 — Touch-swipe in lightboxes (2026-06-28, **COMPLETE in preview, frontend 5/5 PASSED, NOT YET PUSHED TO LIVE**)

**User direction (verbatim):** "Masonry stays as is on the gallery page sections. But when on mobile devices anyone taps on any image/video anywhere across the site, it lets them go to next or previous image or video by swiping left and right. On desktop just have a left and right arrow for them to navigate between media. As simple as that."

**What changed:**
- NEW shared hook `frontend/src/hooks/useSwipeNav.js` (~70 lines). Returns `{ onTouchStart, onTouchMove, onTouchEnd, style: { touchAction: "pan-y" } }` you can spread on any container. Direction filter (`|dx| > 10 && |dx| > |dy|*1.2`) prevents accidental triggers on vertical scrolls; 40px commit threshold; `skipSelectors=["video"]` so touches starting on `<video>` elements pass through to the native player controls.
- `frontend/src/components/media/SwipeableMedia.jsx` MediaLightbox now spreads the hook on its fullscreen overlay div. Carousel-mode swipe (already shipped in Phase 2) untouched.
- `frontend/src/components/gallery/Lightbox.jsx` (the masonry lightbox on `/gallery`) was rewritten to use the hook as well. Keyboard arrows + ESC and the existing arrow buttons stay in place.
- No backend / DB changes.

**Verified manually + frontend testing agent 5/5 PASS:**
- Gallery masonry lightbox: leftward swipe → next, rightward swipe → previous.
- SwipeableMedia fullscreen lightbox (About/Tour/Home/Blog): same.
- Desktop arrows + keyboard + ESC still work.
- Tap on close button (small horizontal motion) does NOT trigger a swipe.
- Single-item lightbox is a no-op (we pass `onNext/onPrev=undefined` when `items.length === 1`).

**Files touched:** `frontend/src/hooks/useSwipeNav.js` (new), `frontend/src/components/media/SwipeableMedia.jsx`, `frontend/src/components/gallery/Lightbox.jsx`. No backend changes; snapshot unchanged.

**Out of scope (intentionally — kept Phase 4 simple per user direction):**
- Blog post **body** inline images (TipTap raw `<img>` tags) still open in their own browser tab on click, not in a SwipeableMedia lightbox. If the user wants this later, the work is: post-render, scan `.editorial img` nodes, build an items array, intercept click → render `<SwipeableMedia>` inline at the top of the body OR open the existing lightbox.
- Hero slideshow on the home page is not click-to-open (it's auto-rotating). Intentional.
- PageHero / single featured images on /about, /pricing, /gallery, /blog index are not click-to-open. Intentional.

### V. Phase 3 of Changes 1-9 — Blog + HomeContent multi-cover via `media_ids` + shared MultiMediaPicker (2026-06-28, **COMPLETE in preview, backend 24/24 + frontend 5/5 PASSED**)

**Backend (`backend/server.py`):**
1. Added optional `media_ids: List[str]` field to `BlogPostInput`, `BlogPostUpdate`, `HomeSectionInput`, `HomeSectionUpdate`. Create endpoints persist it (default `[]`). PATCH preserves order.
2. Idempotent migration in `seed()` defaults `media_ids=[]` on any pre-existing blog_post / home_section row missing the field. Logged 4 home_section rows migrated on first boot, 0 blog_post rows (none existed).
3. Snapshot integration unchanged (both collections were already covered). Snapshot regenerated to bake the new defaults into the repo.

**Frontend — new shared admin component:**
- `frontend/src/components/admin/MultiMediaPicker.jsx` (NEW, ~190 lines). Generalised version of the old inline `GalleryPicker`. Props: `{ value, onChange(ids), allMedia, rowId, label, description, allowVideos, allowEmbeds }`. Renders:
  - "In this gallery" selected grid with HTML5 drag-to-reorder + remove-on-X.
  - "Available media" filterable pool (text filter by section/alt/caption).
  - Image rows show thumbnail; video/embed rows show a labelled tile with provider hint.
- Test-ids: `multi-media-picker-{rowId}`, `mmp-available-{mediaId}`, `mmp-selected-{mediaId}`, `mmp-remove-{mediaId}`, `mmp-filter-{rowId}`, `mmp-empty-{rowId}`.

**Frontend — admin consumers:**
- `frontend/src/pages/admin/JourneysManager.jsx` — refactored to consume `MultiMediaPicker` (zero behaviour change). The inline `GalleryPicker` function (≈135 lines) was deleted. Tours stay images-only (`allowVideos={false}`, `allowEmbeds={false}`).
- `frontend/src/pages/admin/BlogManager.jsx` — drawer fetches `/api/media` on load and renders the picker between the featured image and the excerpt. `media_ids` flows in every POST/PATCH. Single-cover legacy upload still works.
- `frontend/src/pages/admin/HomeContentManager.jsx` — drawer renders the picker below the body. `media_ids` flows in every POST/PATCH via the existing payload pass-through.

**Frontend — public consumers (with single-image fallback per user direction):**
- `frontend/src/pages/BlogPost.jsx` (`/blog/:slug`):
  - `media_ids.length >= 2` → `<SwipeableMedia>` carousel (test-id `blog-post-multicover` + `blog-post-swiper`).
  - `media_ids.length === 1` AND image → plain `<FadeImg>` (test-id `blog-post-multicover-single`).
  - `media_ids.length === 1` AND video/embed → `<SwipeableMedia>` (only sensible render).
  - `media_ids.length === 0` → legacy single `featured_url` via `<FadeImg>` (test-id `blog-post-featured-image`).
- `frontend/src/components/home/HomeContent.jsx`:
  - Per section, prepend a gallery above the body. Same rules as above (single image plain, 2+ swipeable). Section render test-id `home-section-gallery-{index}`.

**User-facing rules confirmed at the start of Phase 3:**
- Single-image multi-cover renders as a PLAIN hero (no dots/counter). Keeps the page chrome clean when only one image is selected.
- Two-or-more items always use `SwipeableMedia` so swipe/arrows/lightbox/dots/counter stay consistent with the rest of the site.

**Files touched (no deletions):** `backend/server.py`, `frontend/src/components/admin/MultiMediaPicker.jsx` (new), `frontend/src/components/home/HomeContent.jsx`, `frontend/src/pages/BlogPost.jsx`, `frontend/src/pages/admin/JourneysManager.jsx`, `frontend/src/pages/admin/BlogManager.jsx`, `frontend/src/pages/admin/HomeContentManager.jsx`, `backend/seed_data/site_snapshot.json` (regenerated).

**Phase 4 candidates (medium, still open):**
- **Gallery page swipe-strip option** — give `/gallery` an alternate "Stories" view that pages through media as a swipeable strip (per-category). The current Masonry view stays as the default; the toggle becomes a mode switch on the page hero.
- **Optional:** push current preview to GitHub via "Save to Github" button (user action, not agent).

### U. Phase 2 of Changes 1-9 — Shared SwipeableMedia + About Us travel gallery + TourGallery refactor (2026-06-28, **COMPLETE in preview, backend 11/11 + frontend 4/4 tasks PASSED, NOT YET PUSHED TO LIVE**)

**Goal:** ship the shared swipeable media component the entire site will use going forward, plus the first end-user surface that consumes it (About Us travel gallery), plus a non-breaking retrofit of the existing tour gallery to the same component.

**Architectural decision — DID NOT add a new `travel_media` collection.** The original Phase 2 plan called for a parallel collection. After spiking the work it became clear the existing `media` collection (which already powers every section across the site) handles all three media kinds with two tiny additive fields. This saved ~8 cr and avoided a parallel admin pipeline. Documented in the migration comment in `server.py`.

**Backend changes (`backend/server.py`):**
- `MediaInput` + `MediaUpdate` Pydantic models gained two new optional fields:
  - `embed_provider: Optional[str]` — `"youtube"` or `"vimeo"` (cached, parsed server-side).
  - `embed_id: Optional[str]` — the video ID (cached).
- New helper `_parse_embed_url_py(raw)` returns `(provider, id)` from any of: `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/shorts/<id>`, `youtube.com/embed/<id>`, `youtube-nocookie.com/embed/<id>`, `vimeo.com/<id>`, `player.vimeo.com/video/<id>`. Mirrors the frontend `parseEmbedUrl` in `SwipeableMedia.jsx` so server-cached IDs match what the client would derive.
- `POST /api/admin/media` now branches on `file_type`:
  - `"image"` — unchanged (data URL → WebP encoding).
  - `"video"` — unchanged (accepts file_url as-is).
  - `"embed"` — parses URL server-side; **rejects with HTTP 400** if the URL isn't a recognised YouTube / Vimeo host. On success caches provider + id on the row.
- No changes to existing endpoints (`/admin/media/upload`, PATCH, DELETE, GET) other than that they now naturally pass through the new optional fields. No new collection, no new snapshot integration needed.

**Frontend — shared component:**
- **NEW `src/components/media/SwipeableMedia.jsx`** — the cornerstone:
  - Accepts `items: [{ kind: 'image' | 'video' | 'embed', url, srcset?, avif_srcset?, lqip?, alt?, caption?, embed_provider?, embed_id? }]`.
  - Single-item-at-a-time horizontal carousel (transformX track); no strip stacking.
  - Touch swipe (mobile + tablet), arrow buttons (desktop ≥sm), dot indicators below, "N of M" counter, image-only fullscreen lightbox (keyboard ESC + arrows), inline `<video controls>` for MP4, privacy-friendly `youtube-nocookie.com` / `player.vimeo.com` iframes for embeds.
  - **Iframe optimisation:** only the active slide gets a live `src`; off-screen iframes carry an empty `src` so YouTube/Vimeo don't burn bandwidth on hidden players.
  - Test IDs exposed: `swipeable-media`, `swipeable-prev`, `swipeable-next`, `swipeable-dots`, `swipeable-dot-{N}`, `swipeable-counter`, `swipeable-slide-image`, `swipeable-slide-video`, `swipeable-slide-embed-youtube`, `swipeable-slide-embed-vimeo`, `swipeable-lightbox`, `lightbox-close`, `lightbox-prev`, `lightbox-next`.
  - Exports the helper `parseEmbedUrl(raw)` and a standalone `<MediaLightbox>` wrapper for callers that need a lightbox without the carousel.

**Frontend — About Us travel gallery (Change 5):**
- **NEW `src/components/about/TravelGallery.jsx`** — fetches `/api/media?section=about-travel`, maps each row into the SwipeableMedia item shape, hands off. Self-hides when the section has zero rows so the page is untouched until the operator adds content.
- **`src/pages/About.jsx`** — imports `<TravelGallery />` and renders it at the bottom (after stories, before the footer).

**Frontend — Admin Travel Media manager:**
- **NEW `src/pages/admin/TravelMediaManager.jsx`** — page at `/admin/travel-media`:
  - Reuses the existing `<MediaManager section="about-travel" ordered />` for image + MP4 uploads (this gives drag-reorder, bulk multi-upload, alt/caption edit, delete-with-confirm for free).
  - Below it, a custom "YouTube and Vimeo embeds" panel: lists existing embeds (`file_type="embed"`), `Add YouTube / Vimeo URL` button opens a modal asking for URL + caption, hostname validation client-side (rejects anything outside YouTube/Vimeo with a friendly inline error), POST to `/api/admin/media` with `file_type="embed"`, individual delete-with-confirm.
- **`src/App.js`** — added lazy import + route `/admin/travel-media`.
- **`src/components/admin/AdminShell.jsx`** — sidebar entry **"About Us Travel Gallery"** under About Us & Stories, with the `Film` icon.
- **`src/pages/admin/AdminDashboard.jsx`** — dashboard tile for the same.

**Frontend — TourGallery refactor:**
- **REWROTE `src/components/tour/TourGallery.jsx`** to consume `<SwipeableMedia>`. Same parent contract (still receives `mediaIds + mediaMap` from `TourDetail.jsx`); same `tour-gallery` test id; now also supports video and embed media types if the operator adds them to a tour's gallery. Old "grid of thumbnails opening a separate lightbox" pattern is gone.

**Files NOT touched (deliberate scope discipline):**
- **HeroSlideshow.jsx** — has its own carousel implementation with Ken Burns animation + LCP preload requirements that the generic SwipeableMedia would regress. UX is already at parity (auto-advance, arrows, dots). Documented here so a future agent doesn't try to refactor it.
- **Gallery page (`/gallery`)** — grid of 50+ photos by category is the right UX. SwipeableMedia is meant for sections that benefit from "one at a time"; a 50-photo grid does not.
- **BlogPost / BlogIndex / FromTheJournal** — single image per post / per card is acceptable. Multi-cover (`media_ids: List[str]` on `blog_posts`) is a Phase 3 candidate when the client actually wants it.

**Test results:**
- Backend (`deep_testing_backend_v2`): **11/11 PASSED** (4 valid embed URLs all parse correctly, 2 invalid URLs correctly rejected with 400, embed metadata round-trips via GET + PATCH, DELETE cleanup confirmed, image upload pipeline regression-tested with 1×1 PNG round-trip, Phase 1 features all still intact).
- Frontend (`auto_frontend_testing_agent`): **All 4 tasks PASSED** — admin /admin/travel-media (UI add + invalid-URL rejection + delete-with-confirm + sidebar entry), public /about TravelGallery (renders mixed YT + 2 images, arrows + dots + counter all functional, image lightbox open/close OK, YT iframe loads only on active slide), TourGallery refactor verified renders SwipeableMedia, empty-state self-hide verified after cleanup. Phase 1 regression checks all pass (Maleny includes/excludes still visible, hero arrows still work, no Corporate Retreats in nav).

**Snapshot regenerated:** counts unchanged from Phase 1 (237 media, 176 content, 10 settings, 4 journeys). No about-travel media persisted in the snapshot — the operator adds those rows themselves once the feature is live.

**What's in the backlog after Phase 2:**
- **Phase 3 candidates (small):** Push current preview to GitHub via "Save to Github". Add hero to use SwipeableMedia (only if the LCP regression can be neutralised). Multi-cover support on blog posts (`media_ids` list).
- **Phase 4 candidates (medium):** Gallery page swipe-strip option. Mixed photo/video support in HomeContent blocks.

---

### T. Phase 1 of Changes 1-9 — Quick wins + Tour content + Hero carousel + Corporate Retreats removal (2026-06-28, **COMPLETE in preview, backend 4/4 + frontend 41/41 tests PASSED, NOT YET PUSHED TO LIVE**)

**Client backlog received at start of session:** 9 changes spanning home page, tour pages, About Us, admin sidebar sync, blog hero, and site-wide media swipeability. Items were split into two credit-bounded phases (≤75 cr each). Phase 1 shipped 7 of the smaller/structural items; Phase 2 will ship the heavy `<SwipeableMedia>` + multi-media work (items #5, #6).

**Decisions confirmed by client before starting:**
- a) Blog hero image upload field lives in `WebsiteMediaManager` alongside other section heros (NOT inside `BlogManager`).
- b) New `home.hero.tagline` content key defaults to **blank** so the hero is a pure photo carousel by default.
- c) Hero Carousel admin uploader supports **multi-file** uploads.
- d) On tour detail pages, **keep both** the existing "About this journey" intro paragraph AND add a new "More Details" rich-text block below.
- e) Site-wide swipeable media (Phase 2) applies to **every content-bearing gallery** (purely decorative single-image spots are exempt).

**Backend changes (`backend/server.py`):**
- Extended `JourneyInput` / `JourneyUpdate` Pydantic models with 2 new fields:
  - `excludes: List[str]` — "What's Not Included" bullet list, mirrors `includes`.
  - `more_details_html: str` — rich-text content block, independent of description/itinerary/practical.
- 2 idempotent startup migrations in `seed()` (search for "C4 migration" and "C5 migration"):
  - C4: defaults `excludes` to the 5 standard items on any row where the field is missing:
    - "International and domestic airfares"
    - "Travel insurance"
    - "Visa fees (if applicable)"
    - "Personal expenses"
    - "Optional activities not listed in the itinerary"
  - C5: defaults `more_details_html` to empty string on any row where the field is missing.
- Added `home.hero.tagline` content key to `DEFAULT_CONTENT` (group `home`) with empty default value — when blank, the public hero is a pure photo carousel; when set, a glass panel with the tagline overlays the photo.
- **Removed** `nav.5.label` ("Corporate Retreats") and `nav.5.to` ("/corporate-retreats") from `DEFAULT_CONTENT`. Both rows also deleted from MongoDB and from `backend/seed_data/site_snapshot.json` so deploys don't re-seed them.

**Frontend changes:**
- **`src/data/content.js`** — removed `{ label: "Corporate Retreats", to: "/corporate-retreats" }` from `NAV_LINKS`. Top nav is now 5 items: Home / Tours / Gallery / About Us / Blog.
- **`src/components/layout/Navbar.jsx`** — removed `RetreatsDropdown` import + branch.
- **`src/App.js`** — removed `Retreats` lazy import + both `/corporate-retreats` and `/corporate-retreats/:slug` routes.
- **`src/components/home/HeroSlideshow.jsx`** — major rewrite:
  - Reads `home.hero.tagline` (blank default → no overlay panel).
  - Added left/right arrow nav buttons (`hero-prev`, `hero-next`) with auto-advance timer reset on click.
  - Auto-advance dwell shortened from 5500ms to 4500ms (per brief).
  - When tagline is blank, only CTAs + dots render (no eyebrow, no H1).
  - When tagline is set, the glass panel returns (no eyebrow — just the tagline + CTAs).
- **`src/components/admin/MediaManager.jsx`** — added `minItems` prop. When deleting the last item under that floor, the confirm dialog uses stronger copy ("Remove the last image?") warning the client the public hero will be empty.
- **`src/pages/admin/HeroManager.jsx`** — passes `minItems={1}` + brief-aligned title/subtitle. Brief language: "Hero Carousel" everywhere.
- **`src/components/admin/AdminShell.jsx`** — sidebar label "Hero Slideshow" → "Hero Carousel".
- **`src/pages/admin/AdminDashboard.jsx`** — dashboard tile label "Hero Slideshow" → "Hero Carousel".
- **`src/pages/admin/WebsiteMedia.jsx`** — added a "Blog page header image" single-image slot (`section="blog-hero"`) between Gallery hero and Contact hero. The public `Blog.jsx` page was already consuming `useMediaSlot("blog-hero")` so this is the missing admin half.
- **`src/pages/TourDetail.jsx`** — major reorder + 2 new sections:
  - Reads new `more_details_html` field and renders a 4th "More Details" H3 block alongside existing About / Itinerary / Practical sections.
  - **Gallery moved above the price + CTA block** (per brief — media-rich content before the call to action).
  - New 2-column "What's Included / What's Not Included" section with `Check` and `X` icons, sits between the gallery and the price block.
- **`src/pages/admin/JourneysManager.jsx`** — admin form additions:
  - "What's not included" textarea (5 rows, monospace) directly below the existing "What's included" textarea. New rows pre-populate with the 5 default exclusions.
  - 4th TipTap rich-text editor labelled "More Details / Destination Description" below Practical info. Supports inline images via the existing `/api/admin/blog/image` pipe.

**Files NOT deleted (kept for future re-enable):** `pages/Retreats.jsx`, `components/layout/RetreatsDropdown.jsx`, backend `/api/retreats` + `/api/retreats/{slug}` endpoints, `JourneysManager` retreat-type tabs. The data model still supports `type="retreat"` so the admin can create retreat rows from the admin even with no public route consuming them.

**Files NOT changed:** `MalenyFeature.jsx` was already unmounted from `Home.jsx` in Session Q. The component file plus content keys (`home.maleny.*`) plus the `maleny` media slot all remain on disk — the client can repurpose this content on the About or any future page via the admin.

**Admin sidebar audit (Change #7 of the client brief):** every `to=` in `AdminShell.jsx` LINKS already matches a registered `Route` in `App.js`, the sidebar already uses `NavLink` with the `isActive` class. No code changes needed beyond the "Hero Carousel" rename. Verified end-to-end by the frontend testing agent (every left-pane item navigates correctly and highlights the active page).

**Test results:**
- Backend (`deep_testing_backend_v2`): **4/4 PASSED** (C4 excludes round-trip, C5 more_details_html round-trip, home.hero.tagline content key present + empty, nav.5.* absent, regression OK with 4 journeys + 237 media intact).
- Frontend (`auto_frontend_testing_agent`): **41/41 PASSED** across all 8 frontend tasks (hero carousel + arrows, tour detail reorder + excludes, top nav cleaned, admin sidebar sync + Hero Carousel rename, blog hero slot, excludes textarea persistence + revert, more_details TipTap persistence + public render + revert, hero carousel page heading).

**Snapshot regenerated** via `POST /api/admin/snapshot/save`. New snapshot contains 4 journeys with both `excludes` and `more_details_html` fields, 177 content keys including `home.hero.tagline`, zero `nav.5.*` rows.

**What is still in the backlog (Phase 2 of Changes 1-9, est. ≤75 cr):**
1. Build shared `<SwipeableMedia>` component (touch swipe, arrows, dots, lightbox, image/video/embed).
2. Change #5 — About Us travel photo/video gallery: new `travel_media` collection + admin manager + public render.
3. Change #6 backend extensions: add `kind` field to existing `media`, `media_ids: List[str]` to `blog_posts` / `stories` / `home_sections`, migrate single `cover_url` → first entry of `media_ids`.
4. Change #6 admin multi-upload audit: generalise `GalleryPicker` into `<MultiMediaPicker>` (supports YouTube/Vimeo URLs + MP4 uploads + drag-reorder + delete-confirm), ripple through every single-file upload field across `BlogManager`, `AboutManager`, `HomeContentManager`, `WebsiteMediaManager`, `HeroCarouselManager`.
5. Change #6 public refactor: every gallery on the site (TourGallery, Gallery page lightbox, FromTheJournal, BlogPost, BlogIndex, the new hero carousel) consumes `<SwipeableMedia>`.
6. Backend + frontend tests + snapshot regen.

---

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
| **SwipeableMedia lightbox rendered via `createPortal(..., document.body)`** | Any future page that wraps the carousel in a `transform`-bearing ancestor (`.reveal`, perspective stages, masked sections) would trap `position: fixed` descendants and break the fullscreen lightbox. The portal makes the lightbox immune. **Do not "fix" this by removing the portal** — the sticky sidebar on TourDetail depends on it. | `SwipeableMedia.jsx` Lightbox component |
| **TourDetail.jsx renders BOTH `/tours/<slug>` and `/corporate-retreats/<slug>`** | Single component, branches on `useLocation()`. Keeps the layout consistent if the client re-enables corporate retreats later. | `TourDetail.jsx` |
| **Tours index `/pricing` is image-driven** | Cards rely on `hero_media_id` resolved against `/api/media`. Falls back to a monogram-letter placeholder when missing. Don't strip the fallback or empty tours break the grid. | `Pricing.jsx` |

---

## 5. Outstanding / future work (none blocking)

| Pri | Item | Notes |
|---|---|---|
| P1 | **Client uploads real hero + gallery images per tour via Admin → Journeys** | After Session Z the cards on `/pricing` will show monogram-letter placeholders until each tour has a `hero_media_id`. The `/tours/<slug>` hero carousel and Gallery tab populate from `gallery_media_ids`. No code change needed — purely a content task for Adele. |
| P1 | **Client populates `highlights` per tour via the new admin textarea** | The right sidebar "Tour highlights" panel auto-hides when empty. Once she fills it the panel will appear. |
| P1 | Extend `sync_from_live.py` to also mirror `blog_posts` | DONE in Session X — leaving the row for now because the migration check noted it still needs a live re-run after the Bluehost deploy. |
| P2 | Cache-Control: no-store on `/api/content` | Stops the "I edited the label and it's still old in my browser" support tickets. One-line FastAPI dependency. |
| P2 | Refactor `server.py` (~2900 lines) into `routes/`, `services/`, `utils/` modules | Don't until features stable. |
| P2 | Backend file-upload guard rejecting any file > 95 MB | One-line addition in the upload endpoint, blocks future GitHub-busting uploads at source. |
| P2 | `deploy.sh pull` subcommand wrapping `safe-pull.sh` + restart into a single Bluehost command | Trivial. |
| P3 | Per-tour testimonials field (currently the sidebar reuses the site-wide `testimonials.N.*`) | Add `testimonials: List[{quote, author}]` to journeys when client asks. Fall back to site-wide if empty. |
| P3 | Blog: scheduled-publish (`publish_at` future date) | Low priority until volume grows. |
| P3 | Blog: per-post SEO override (`blog.post.<slug>.seo.*`) | Currently inherits the site-wide `seo.blog.*` for every post. |
| P3 | Blog post **body** inline images opening in a SwipeableMedia lightbox | Scan `.editorial img` post-render, build items[], intercept click. Now that the lightbox uses createPortal (Z5) the integration is safe for any wrapper, including TipTap. |
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
REACT_APP_BACKEND_URL=<your preview URL, e.g. https://repo-to-deploy.preview.emergentagent.com>
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

Production `.env` values live on Bluehost only (see Docker compose).

---

## 12. Open backlog — Phase C and Phase D (planned 2026-06-28, NOT YET STARTED)

The client filed a 9-item change request after B1/B2. I've split it into two roughly-80-credit phases. **Read this whole section before executing — phase order and task order within a phase BOTH matter** (e.g. Change 7 deliberately runs after the new pages from Change 2 and Change 5 are added, so the sidebar audit picks them up automatically).

### Phase C — "Quick wins + Hero Carousel" (target ≤80cr, planned 63cr + 17cr buffer)

Self-contained changes that don't depend on the new shared swipeable component. Ship as one deploy.

| Order | Change | Notes for implementer |
|---|---|---|
| C0 | Setup | Repo pull, recreate .env (Section 11), run `python3 backend/sync_from_live.py`, `sudo supervisorctl restart all` |
| C1 | **#9** Remove Corporate Retreats from nav | Drop the 6th `NAV_LINKS` entry in `frontend/src/data/content.js`. Hide the `<RetreatsDropdown />` branch in `Navbar.jsx` (don't delete the file — page stays accessible via direct link). Remove the `nav.5.label` / `nav.5.to` rows from the nav-label editor list in `WebsiteText` admin if it lists nav rows. Footer — check `Footer.jsx` for a Corporate Retreats link and remove if present. |
| C2 | **#8** Blog hero image upload | New content key `blog.hero.image_id` (or reuse `media` collection with a section like `blog-hero`). Add an image picker block to the Blog admin section. `Blog.jsx` already renders a hero — just wire the new image source through `<PageHero>`. |
| C3 | **#2** Hide "Maleny, arrive and exhale" Home section | Find `MalenyFeature.jsx` (or whatever currently renders the highland cow). Add `is_visible` toggle if not present, default false on next deploy. Keep the file on disk + register it as a hidden `home_sections` row so the client can re-enable it on About/Retreats later. Confirm `Home.jsx` flows cleanly with no gap. |
| C4 | **#4** "What's Not Included" field | Backend: add `excludes: List[str]` to `JourneyInput`/`JourneyUpdate`. Migration in `seed()`: default the new field to the standard exclusions list (`["International and domestic airfares", "Travel insurance", "Visa fees (if applicable)", "Personal expenses", "Optional activities not listed in the itinerary"]`) but ONLY when `excludes` is missing — idempotent. Frontend admin: new textarea below the existing `includes` textarea in `JourneysManager.jsx`. Public render: in `TourDetail.jsx` mirror the bullet-list styling of "What's Included" right below it. |
| C5 | **#3** Tour detail "More Details" reorder | Two tweaks: (a) relabel the "About this journey" H3 in `TourDetail.jsx` to "More Details" (or keep both editors but rename the heading); (b) move the `<TourGallery>` from BELOW the Enquire CTA to ABOVE the price + CTA block so a media-rich "More Details" experience surfaces before the user is asked to act. The existing 3-section body editors and gallery picker from B2 cover the content needs — no new admin field required. |
| C6 | **#7** Admin sidebar route sync | In `AdminShell.jsx`, the sidebar uses `<NavLink>` (or should) so React Router gives an active class automatically. Audit each entry: confirm `to=` exactly matches the registered route in `App.js`. Add any new admin pages from C2/C5 to the LINKS array (Phase C order is deliberate — do C7 AFTER C2/C5). Test by clicking each item; the active highlight must move and persist on direct URL load. |
| C7 | **#1** Hero carousel + admin manager | New collection `hero_carousel` (fields: id, media_id, alt, caption, sort_order, is_visible, created_at, updated_at). Full CRUD + reorder under `/api/admin/hero-carousel`. Public read `GET /api/hero-carousel`. Rewrite `frontend/src/components/home/HeroSlideshow.jsx` to fetch this list and rotate every 4500ms with smooth fade transitions, arrow buttons + dot indicators. **Remove** all the "Slow and Soulful Tasmania" tour copy / per-slide overlay. A single brand tagline content key (`home.hero.tagline`) may exist but defaults to empty — leave it blank unless the client supplies copy. New admin page `pages/admin/HeroCarouselManager.jsx` patterned on `WebsiteMediaManager` (upload + list + reorder via up/down arrows + delete with confirm). **Warn on delete-of-last** via `window.confirm`. Add to AdminShell sidebar (under C6's audit). Wire into `_write_snapshot_now()` and `_apply_snapshot()`. |
| C8 | Test + finalize | `deep_testing_backend_v2` for new endpoints (hero_carousel CRUD, journey excludes field, blog hero, home_sections visibility), public visual smoke screenshots, regen snapshot, ask user before pushing. |

**Cumulative result of Phase C:** Home hero is a clean photo carousel, Maleny exhale section is gone, every tour now has Includes + Excludes, Tour details surface the gallery+content above the CTA, Blog has a configurable hero image, Corporate Retreats nav item is gone but the page remains, admin sidebar always matches the active route.

### Phase D — "Site-wide Swipeable Media + Mixed Photo/Video" (target ≤80cr, planned 78cr)

The heavy refactor: build ONE shared swipeable component and ripple it through every existing gallery + admin manager. Mixed photo + video everywhere (MP4 upload OR YouTube/Vimeo URL).

| Order | Change | Notes for implementer |
|---|---|---|
| D0 | Setup | Same as C0 |
| D1 | Build `<SwipeableMedia>` shared component | Touch swipe (left/right) on mobile/tablet, arrow buttons on desktop, dot indicators below, full-screen lightbox for images, inline `<video>` play for MP4, embed for YouTube + Vimeo (parse video ID from URL). Lives in `frontend/src/components/media/SwipeableMedia.jsx`. Accepts `items: [{ kind: 'image'|'video'|'embed', url, srcset?, lqip?, alt?, embed_provider?, embed_id? }]`. **Build this FIRST** — every subsequent task consumes it. |
| D2 | **#5** About Us travel gallery | New collection `travel_media` (id, kind ∈ image/video/embed, file_url, srcset, lqip, embed_provider, embed_id, alt, caption, sort_order, is_visible). Admin page `pages/admin/TravelMediaManager.jsx` with multi-upload (drop or file picker), embed URL input, drag-reorder, delete-with-confirm. Public render on `pages/About.jsx` using `<SwipeableMedia>` — single-row horizontal, no vertical stacking; mobile/tablet swipe; full-screen on tap. Snapshot integration. |
| D3 | **#6 part 1** Backend extensions for multi-media | Extend `Blog`, `Stories`, `Home Sections` (or anywhere else with a single `cover_url`) with `media_ids: List[str]`. Idempotent migration copies the existing single `cover_url` -> first entry. Old `cover_url` stays on the schema as a read-only fallback for one release (same pattern as B2's `body_html` -> `description_html`). Add `kind` field to `media` collection so video uploads (MP4) and embed records (YouTube/Vimeo) co-exist with images. Public endpoints accept `?include_video=true|false` if any caller needs to filter. |
| D4 | **#6 part 2** Admin audit + multi-upload everywhere | Convert every single-file upload field across `BlogManager` (cover), `AboutManager` (story covers), `HomeContentManager` (section images), `WebsiteMediaManager` (already multi but add video support) to use a shared `<MultiMediaPicker>` component (extract + generalise the `<GalleryPicker>` built in B2). Drag-and-drop reorder, individual delete with `window.confirm`, embed URL field for YouTube/Vimeo. **Audit each existing admin field — list them in PR before touching code, get user sign-off.** |
| D5 | **#6 part 3** Public refactor | Rewrite `TourGallery`, `Gallery` page, `FromTheJournal`, `BlogPost`, blog index cards, `About` page, the hero carousel from C7 — all consume `<SwipeableMedia>`. Same swipe gesture, same arrows, same dots, same lightbox, same inline video everywhere. **One implementation, six consumers.** |
| D6 | Test + finalize | Backend tests on every new endpoint + migration, frontend tests (with explicit user permission per protocol), regen snapshot, push prompt. |

**Cumulative result of Phase D:** Every gallery on the site behaves identically. Every admin media field accepts multi-file + video. Photos and videos can be freely mixed in any context. Future pages should reach for `<SwipeableMedia>` by default — make this a style-guide note in HANDOVER.

### Optional Phase E (only if Phase D blows budget)

If D4 or D5 runs long, the rewrite of `Gallery` page and `BlogIndex` cards is the lowest-risk thing to defer. Shape: ~15cr, one session. Don't defer the migrations or the shared component — those are blocking for everything else.

### Cross-phase notes

- **No new third-party integrations needed.** Everything Phase C/D uses already exists: TipTap, native HTML5 drag, existing `/api/admin/media/upload` pipeline for files. YouTube/Vimeo embeds don't need API keys for public videos.
- **Mobile-first** for D1's swipe gestures. Test on a 375px viewport before declaring done.
- **Don't introduce `@dnd-kit`.** B2 chose native HTML5 drag; keep parity.
- **Don't downgrade React versions.** Package.json is source of truth (currently React 19).
- **Em-dash rule still applies.** No `—` in any user-facing copy (DB content, seeded examples, SEO text, JSON-LD, alt text). Hyphens are fine in admin code and code comments.

---

- End of handover (2026-06-28).
