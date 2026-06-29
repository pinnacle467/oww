# PRD — Once Were Wild Travel

## Original problem statement
A women-only slow-travel brand (oncewerewild.com) needed a CMS-driven marketing site they could fully self-manage from an admin panel: hero slideshow, journeys/pricing, gallery, about + stories blog, contact form, cookies policy. Hosted on Bluehost via docker compose, deployed via git pull from a GitHub repo (pinnacle467/oww). Live admin uploads must survive every deploy.

## Architecture
- React (CRA + craco) + Tailwind frontend (served via Express static)
- FastAPI + MongoDB backend with WebP + AVIF image pipeline
- Bind-mounted `backend/uploads/` for media
- `backend/seed_data/site_snapshot.json` (DB-in-a-file) auto-applied on container startup with per-collection data-loss guard
- Caddy reverse proxy with auto-HTTPS

## What's implemented (rolling)
- 2026-06-24/25: live-from-prod sync infrastructure (`sync_from_live.py`), About Us + Stories CMS feature, cookie banner + /cookies page, em-dash purge across DB + source, "Contact" removed from nav (Get In Touch CTA covers it), GET IN TOUCH button styled consistently (dark fill + gold border + white text), hero glass-dark panel for readability, hero slideshow now ALWAYS cycles (reduce-motion only gentles it), GitHub push unblocked (oversized videos compressed in place, git history rewritten, yarn.lock tracked), POSIX-only `scripts/safe-pull.sh` for Bluehost deploys, all Contact form text now admin-editable via Website Text → Contact page (29 keys), group inference from key prefix in `admin_list_content`, pillars/testimonials groups labelled in admin.
- 2026-06-27: **Blog feature shipped**. New `Blog` link added to public nav (5th item, after About). Public pages: `/blog` index with newest-first cards (title/date/excerpt/featured image/Read more), 9-per-page load-more, friendly empty state; `/blog/:slug` post detail with H1/date/featured image/rich-text body (Tailwind typography prose) and Back-to-journal link. Admin: new `/admin/blog` Blog Manager (table view + side-drawer editor) with title, date (defaults today), Draft/Published toggle, featured image upload, excerpt, **TipTap rich-text editor** (Bold/Italic/H2/H3/bullet/ordered/quote/link/inline image upload/undo/redo), one-row status toggle, edit/delete with confirmation, slug auto-generation with -2/-3 conflict resolution, snapshot save+apply integration. Backend endpoints: `/api/blog`, `/api/blog/{slug}`, `/api/admin/blog` CRUD, `/api/admin/blog/{id}/cover`, `/api/admin/blog/image`. 8/8 backend pytest pass, full UI flow verified by testing agent. Tailwind typography plugin installed.
- 2026-06-28: Sessions T (Phase 1) + U (Phase 2) of Changes 1-9 - hero carousel arrows + tagline content key + excludes field + more_details TipTap, Corporate Retreats public surface removed, shared `<SwipeableMedia>` component built, About Us TravelGallery + admin TravelMediaManager added, TourGallery refactored onto SwipeableMedia.
- 2026-06-28: **Phase 3 + Phase 4 shipped (backend 24/24, frontend 5/5 + 5/5)**. Phase 3: multi-cover support on blog_posts + home_sections via new `media_ids: List[str]` field on both Pydantic models, idempotent migration defaults to []. NEW shared `frontend/src/components/admin/MultiMediaPicker.jsx` consumed by JourneysManager (refactored — the inline GalleryPicker was deleted), BlogManager (new drawer field), HomeContentManager (new drawer field). Public render: `/blog/:slug` and home content sections both prefer multi-cover gallery via `<SwipeableMedia>` when `media_ids.length >= 2`, plain `<FadeImg>` for single image, legacy `featured_url` fallback on blog posts. Phase 4: NEW `frontend/src/hooks/useSwipeNav.js` hook applied to both lightboxes (SwipeableMedia fullscreen viewer + gallery/Lightbox.jsx). Tapping any image/video on mobile opens a swipeable fullscreen viewer; desktop keeps arrow buttons + keyboard. Video controls excluded via skipSelectors=["video"]; 40px commit threshold; direction filter avoids hijacking vertical scrolls.
- 2026-06-29: **Phase 5 hero + About-Us spacing bug fix shipped (frontend 4/5 + 2/2 PASS)**. Phase 5: 3D Coverflow Side-Peek transition on home hero. `.hero-stage` adds `perspective: 1500px` + `overflow:hidden` + `clip-path:inset(0)` (seals iOS WebKit 3D leak). `.hero-slide.prev/.next` tilt at `rotateY(±35°)` with `translateX(±22%)` and `Z=-180px`, opacity 0.75; active slide flat at Z=0. Reduce-motion users get plain cross-fade (no rotation). LCP protected — slide 0 still paints flat at Z=0 on initial mount, static preload tag untouched. About-Us bug: story body now splits on `/\n\s*\n+/` and renders proper `<p>` elements with `space-y-4`, fixing the client-reported missing-blank-line at the bottom of the Kangaroo Island story. `sync_from_live.py` extended to pull stories/about_blocks/home_sections/home_faqs/blog_posts (previously missed).
- 2026-06-29: **Z — Tours pages redesigned per client (Adele WhatsApp) reference**. Tours index (/pricing) now uses a clean 3-col image-card grid with gold name banner + chevron (replaces the old multi-line tier cards). Tour detail (/tours/<slug>) refactored into a 2-column layout: LEFT main has title + duration subtitle, hero SwipeableMedia carousel, italic gold-bordered description quote, tab strip (Details / Gallery / What's Included / Prices & Dates) with auto-hidden empty tabs; RIGHT sticky sidebar has Tour highlights checkmark list, Small group tours blurb, Testimonials card (dark green/cream, sources first 2 site-wide testimonials.N.* content keys). Itinerary OUTLINE on-page + full day-by-day stays in the downloadable PDF (per client's direction). NEW backend field `highlights: List[str]` on journeys with idempotent Z1 migration. NEW admin textarea in JourneysManager below excludes. NEW admin-editable content keys `tour_detail.*` (highlights heading, small_group heading/body, testimonials heading, tab labels, download_pdf label). Backend 7/7 PASSED via deep_testing_backend_v2 including the critical partial-PATCH preservation test.

## Prioritised backlog
- **P2** Refactor `server.py` (2600 lines) into routes/services/utils modules.
- **P2** Backend upload guard rejecting any file > 95 MB at the API level.
- **P2** `deploy.sh pull` subcommand wrapping safe-pull + restart.
- **P2** `admin_update_content` should `$setOnInsert: {group: prefix, type: 'text', label: key}` so DB rows carry full metadata (not just key/value).
- **P3** Pause/Play affordance on the hero slideshow.
- **P3** Lighthouse mobile re-run on live (target ≥ 95).

## Key constraints (HARD RULES)
- English only.
- No em dashes ("—") in any user-facing string.
- Live is the source of truth — push CODE from preview, sync DATA from live (never push DB from preview).
- Preserve per-collection data-loss guard in `_apply_snapshot`.
- Every public-site string drives from `useText()` so the client can edit it.

## Handover
See `/app/HANDOVER.md` for a full session-by-session report and the live-sync sequence the next agent must run on load.
