# Session AD — Plan for next agent

> **Status:** Plan only. NOTHING in this file has been implemented. The current preview state is end-of-Session-AC (Sessions B1 → AC complete, NOT yet pushed to live).

---

## 0. Context — what the client said (verbatim)

> "The one thing I think can be improved in the tours page, is if the gallery is deleted altogether, and instead of having one hero shot on the top, we just have a number of pictures of the tour that people can role through. This would make the headings clearer when you view it on the mobile phone too, as it would give space between the headings. And you don't need photos popping up below, as well as above."
>
> "She wants to go back to the carousel on the hero of the tour and remove the gallery section all together and rename the 'What's Included' section to 'Inclusions'."
>
> "All this should be available to edit for herself in the admin panel of every page on the website."

## 1. Decoded into 3 concrete changes + 1 standing requirement

1. **AD1** — Revert the AB2 single-hero shot. Bring the hero carousel back at the top of `/tours/<slug>`, populated from `gallery_media_ids` (the same pattern that was in place between Sessions W4 → AB).
2. **AD2** — Remove the **Gallery** tab from the tab strip on `/tours/<slug>` entirely. The hero carousel is the only place tour photos appear.
3. **AD3** — Rename the "What's Included" tab to **"Inclusions"**.
4. **AD4** — Verify every label on the tour-detail page is editable from `/admin/website-text` (the client emphasised "available to edit for herself in the admin panel"). Tab labels and most headings already are; this phase is mostly an audit + small fills.

The client did NOT ask to remove `gallery_media_ids` from the data model. KEEP that field — the carousel still consumes it. We're only removing the **public-facing Gallery tab**, not the underlying images. The admin "Photo gallery" picker in `/admin/journeys` also stays as-is (the AB regressions on upload-to-library + soft-X-only are preserved).

---

## 2. Phased plan

Each phase is independently shippable, has its own test, and rolls back cleanly. Do them in order so the public site is never broken mid-phase.

### Phase AD1 — Restore the hero carousel on `/tours/<slug>`

**File:** `/app/frontend/src/pages/TourDetail.jsx`

What to change (look for the AB2 comments and revert them):

1. **Replace the `heroMedia` memo with the original `heroItems` memo** so the array of media items is back. Reference shape from the Session W4 / Session Z implementation:
   ```js
   const heroItems = useMemo(() => {
     if (!tour) return [];
     const galleryIds = Array.isArray(tour.gallery_media_ids) ? tour.gallery_media_ids : [];
     if (galleryIds.length) return buildMediaItems(galleryIds, mediaMap);
     if (tour.hero_media_id) return buildMediaItems([tour.hero_media_id], mediaMap);
     return [];
   }, [tour, mediaMap]);
   ```
   Note `buildMediaItems` already exists at the top of the file (it was used by the old hero carousel + is still used by the Gallery tab — which we're removing in Phase AD2).

2. **Replace the JSX block** that currently renders the AB2 `<img data-testid="tour-hero-shot">` with the old `<SwipeableMedia items={heroItems} aspectRatio="16/9" />` block. Restore the testid `tour-hero-carousel`.

3. **`SwipeableMedia` is imported at the top** — keep the import (it's currently still in use by the Gallery tab, but we're removing that, so the import will stay only because of this hero use). Don't accidentally delete the import line.

4. **Mobile-spacing tweak the client mentioned.** She said "give space between the headings" on mobile. Adjust the wrapper:
   - Confirm the hero carousel has `mt-6 sm:mt-7` (or similar) so on phones there's breathing room between the title/duration subtitle and the carousel.
   - The carousel itself sits in a `rounded-sm overflow-hidden shadow-lg bg-white` wrapper — keep that.
   - The italic gold-bordered description quote that comes immediately AFTER the hero should have at least `mt-6 sm:mt-8` so it's visually distinct on phones.

**Test (Phase AD1):**
- Public `/tours/maleny-creative-immersion-retreat` shows a swipeable hero with 33 photos (it has that many in `gallery_media_ids` after the AC sync).
- `data-testid="tour-hero-carousel"` exists; `data-testid="tour-hero-shot"` no longer exists.
- Clicking the hero opens the Session-Z5 portal-based lightbox (the SwipeableMedia component's existing behaviour).
- Public `/tours/tasmanian-slow-and-soulful-journeys` (which has an EMPTY `gallery_media_ids` array) — confirm graceful fallback: hero block is hidden, headings + description still render. Don't introduce a broken empty `<SwipeableMedia items={[]} />`.

### Phase AD2 — Remove the Gallery tab from `/tours/<slug>`

**File:** `/app/frontend/src/pages/TourDetail.jsx`

1. **Find the `tabs` array** (it's around line 250-285 in the current build, near where `galleryTabLabel` is read from `useText("tour_detail.tabs.gallery", ...)`).

2. **Remove the Gallery tab object** from the array. The remaining tabs should be:
   - Details
   - What's Included → renamed to "Inclusions" in Phase AD3
   - Prices & Dates

3. **Delete the JSX block** that renders the Gallery tab's content (the `<SwipeableMedia items={galleryItems}/>` block — this is the one that currently shows the duplicated photos the client complained about).

4. **Remove the unused `galleryItems` memo and `galleryTabLabel` `useText` call** so the code stays clean. The lint job will complain about unused variables otherwise.

5. **Auto-hide logic for empty tabs** is already in place from Session Z — but our Gallery removal is permanent, not conditional. Hard-delete is the cleaner pattern here.

6. **Mobile spacing knock-on (the client called this out specifically).** With the Gallery tab gone, the remaining 3 tabs should spread evenly on phones. Confirm:
   - On a 360px-wide viewport, the tab strip wraps cleanly (no horizontal scroll).
   - Each tab label has enough padding (`px-3 sm:px-4 py-2.5`) that the labels never collide.

7. **Optional: orphan content-key cleanup.** The `tour_detail.tabs.gallery` content key will now be unused. **Do not delete it from the DB or DEFAULT_CONTENT** — the seed is idempotent and the orphan key in `/admin/website-text` is harmless (it just won't affect the public site). If you want to hide it from the admin UI, that's a separate UX cleanup — out of scope for AD.

**Test (Phase AD2):**
- Public `/tours/maleny-creative-immersion-retreat` shows only 3 tabs: Details / Inclusions / Prices & Dates.
- No "Gallery" tab anywhere. `data-testid="tour-gallery-content"` (or whatever it was) no longer exists.
- Mobile (360px viewport): tab strip fits without horizontal scroll; the headings + description below the hero have breathing room.
- The hero carousel (Phase AD1) is the ONLY place tour photos appear on the page.

### Phase AD3 — Rename "What's Included" → "Inclusions"

**File:** `/app/backend/server.py`

1. **Update the seed default** for the existing content key. Find the `_c("pricing", "tour_detail.tabs.included", "What's Included", ...)` line in `DEFAULT_CONTENT` (it's in the pricing or journeys group — search for `tour_detail.tabs.included`) and change the third argument to `"Inclusions"`.

2. **One-time idempotent migration** so existing DBs (preview + live after deploy) actually pick up the new label. The seed uses `$setOnInsert` so it WON'T overwrite the existing row. Add a small startup migration block right next to the AB1 small_group_text migration:

   ```python
   # AD3 migration — rename "What's Included" tour-detail tab to "Inclusions".
   # Only updates the row when it still holds the old default; preserves any
   # custom client edits. Idempotent.
   res_inc = await db.content.update_one(
       {"key": "tour_detail.tabs.included", "value": "What's Included"},
       {"$set": {"value": "Inclusions", "updated_at": now_iso()}},
   )
   if res_inc.modified_count:
       logger.info("AD3: renamed tour_detail.tabs.included to 'Inclusions'")
   ```

3. **No frontend code change** needed — `TourDetail.jsx` already reads this via `useText("tour_detail.tabs.included", "...")`. As long as the DB row has value="Inclusions", that's what the tab will say.

**Test (Phase AD3):**
- After backend restart, the DB row `tour_detail.tabs.included` has value `"Inclusions"` (verify with a quick `curl /api/content | grep included`).
- Public `/tours/<any-slug>` shows the second tab labelled "Inclusions" (not "What's Included").
- Admin `/admin/website-text` → "Journeys & Pricing page" group (or wherever the key is filed) shows the row with the new value, editable.
- Editing it back to a custom value (e.g. "What you get") and saving in admin → public page updates. Then editing back to "Inclusions" → public reverts. Confirms the round-trip still works.
- **Critical idempotence check:** after a second `supervisorctl restart backend`, the row stays at "Inclusions" (the migration's filter `{"value": "What's Included"}` no longer matches, so it doesn't re-write).

### Phase AD4 — Audit "everything editable from admin"

The client's standing requirement was "All this should be available to edit for herself in the admin panel of every page on the website." Most of this is already done (Session Z added `tour_detail.*` keys for the tab labels + sidebar headings; AC added the blog keys). Audit each public surface and fill any gaps. Below is the audit checklist — items prefixed `✓` are already done, items prefixed `?` need verification, items prefixed `✗` need a new content key.

**Tour-detail page (`/tours/<slug>`):**
- ✓ Tour name (per-tour, on the journey row)
- ✓ Duration subtitle (per-tour, derived from `nights`)
- ✓ Description quote (per-tour, on the journey row as `summary` / `description_html`)
- ✓ Highlights checkmark list (per-tour, Z1 `highlights[]` field)
- ✓ Small group tours sidebar body (per-tour, AB1 `small_group_text` field + global fallback `tour_detail.small_group.body`)
- ✓ Tab labels: Details / Inclusions / Prices & Dates (content keys `tour_detail.tabs.*`)
- ✓ Highlights heading, Small group heading, Testimonials heading (content keys `tour_detail.*.heading`)
- ✓ Download PDF button label (content key `tour_detail.download_pdf`)
- ? **Testimonials sidebar card content** — currently sources first 2 site-wide `testimonials.N.*` keys. The client may eventually want PER-TOUR testimonials. Not raised in AD; flag as P3 backlog.

**Blog page (`/blog`):**
- ✓ Eyebrow / title / intro / empty-state heading / empty-state body — all 5 AC1 keys are in DB.
- ? **Blog post body inline images** — opening in a SwipeableMedia lightbox is still on the Session W backlog. Not raised in AD.

**Home page (`/`):**
- ✓ Hero eyebrow / title / tagline / CTA (Session AA pruned the second CTA, primary stays)
- ✓ Section bodies via Home Content sections (admin: `/admin/home-content`)
- ✓ Home FAQs (admin: `/admin/home-faqs`)
- ✓ Testimonials (admin: site-wide `testimonials.N.*` keys via `/admin/website-text`)

**Other pages already confirmed editable end-to-end** in prior sessions: Pricing index, Gallery, Travel Gallery, About, Contact, Charity. No changes needed for AD.

**Spot-checks to run during AD4:**
1. Open `/admin/website-text` and confirm there are 13 groups (after AC1 added blog there should be: brand, nav, home, pricing, journeys, faqs, gallery, blog, contact, pillars, testimonials, footer, seo). All 13 expand without errors.
2. Inside the "Journeys & Pricing page" group, verify all 4 tab-label keys are listed and editable: `tour_detail.tabs.details`, `tour_detail.tabs.included`, `tour_detail.tabs.prices`. **`tour_detail.tabs.gallery`** will also be listed (it's an orphan after AD2) — leave it; the client can ignore it. Optionally add a small note in the field's `label` saying "(unused — Gallery tab removed)" by editing `DEFAULT_CONTENT`'s `label` parameter, but this is cosmetic and not blocking.
3. Inside the same group, verify the new "Inclusions" value (Phase AD3) appears and is editable.
4. Inside the "Blog page" group (AC1), verify all 5 keys appear and the "Preview Blog page" pill links to `/blog`.

**Test (Phase AD4):**
No code change in this phase if the audit confirms everything works. If a gap is found, add the missing key(s) to `DEFAULT_CONTENT` with the right group and re-run the seed (`supervisorctl restart backend`). No new endpoints needed.

### Phase AD5 — Live re-sync + handover update

**Reminder from Session AC:** the `sync_from_live.py` AVIF probe reliably exceeds the 120s foreground timeout. **Always** run it via `nohup python3 sync_from_live.py > /tmp/sync.log 2>&1 &` and tail the log periodically. The Mongo replace + snapshot write happens at the end, after the probe completes.

After running the sync:
1. `sudo supervisorctl restart backend` to re-apply the snapshot. The AD3 migration will re-fire and rename any "What's Included" rows in the freshly synced data.
2. Spot-check that the AD3 rename took effect: `curl /api/content | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['tour_detail.tabs.included'])"` should print `Inclusions`.

Then update:
- `/app/memory/PRD.md` — add a Session AD entry at the top of the chronological list.
- `/app/HANDOVER.md` — bump the title to include `+ AD (Hero carousel restored, Gallery tab removed, "Inclusions" rename)`, add the AD section at the top of "What's been built", update the "What to expect after deploy" list.
- `/app/memory/NEXT_SESSION_PLAN_AD.md` — delete this file once AD is shipped (or rename to `NEXT_SESSION_PLAN_AD.done.md` for history).

---

## 3. Testing requirements (mandatory per the test_result.md protocol)

### Backend tests (deep_testing_backend_v2)
Only AD3 needs backend testing — it's the only phase that touches `server.py`. The test plan:
1. **Migration ran:** GET `/api/content`, confirm `tour_detail.tabs.included` == "Inclusions" (after a fresh boot following the migration commit).
2. **Idempotence:** PUT the key to a custom value via `/api/admin/content` → restart backend → confirm the custom value SURVIVED (the migration's filter `{"value": "What's Included"}` does not match, so it doesn't overwrite).
3. **Round-trip via admin:** PUT `/api/admin/content` with `[{"key":"tour_detail.tabs.included","value":"Inclusions custom"}]` → re-GET → confirm.
4. **Regression:** GET `/api/journeys` still returns 4 rows with `highlights` + `small_group_text` (Z1 + AB1 intact), GET `/api/media` still returns >= 286 rows (or whatever the current sync count is), no 500s.

### Frontend tests (auto_frontend_testing_agent — ASK USER FIRST)
After all 3 phases land, the frontend test plan should cover:
1. **Phase AD1:** `/tours/maleny-creative-immersion-retreat` shows the swipeable hero carousel with multiple photos; clicking opens the portal lightbox; `data-testid="tour-hero-carousel"` exists; `data-testid="tour-hero-shot"` does NOT exist.
2. **Phase AD2:** Same page has only 3 tabs (Details / Inclusions / Prices & Dates); no "Gallery" tab; mobile viewport (360px) renders cleanly with no horizontal scroll.
3. **Phase AD3:** The 2nd tab label is "Inclusions" (not "What's Included"). Editing the key in `/admin/website-text` → "Journeys & Pricing page" group changes the public label live.
4. **Phase AD4:** Spot-check that all 13 groups in `/admin/website-text` expand and 1-2 sample edits round-trip to the public site.

---

## 4. Risks & rollback per phase

| Phase | Risk | Rollback |
|---|---|---|
| AD1 | A tour with empty `gallery_media_ids` AND empty `hero_media_id` would render a broken carousel. | The `heroItems.length > 0` guard around the JSX block handles this — verify Tasmanian (empty gallery) renders cleanly. |
| AD2 | Operator has links/anchors pointing to the Gallery tab. | Unlikely (no current internal links use the tab anchor). If found, redirect to `#details` or top-of-page. |
| AD3 | Idempotent migration runs on every boot — small Mongo write per boot for new installs. | Acceptable. The `$exists`-guard pattern wouldn't fit here because the value-based filter is what makes the migration idempotent. |
| AD4 | None — audit-only. | N/A |
| AD5 | Live sync timeout. | Always run in background per Session AC notes. |

---

## 5. Out of scope for AD

These were NOT in the client's AD brief — leave for a future session unless the client raises them:
- Removing `gallery_media_ids` from the Journey data model. (Keep — the carousel needs it.)
- Removing the admin "Photo gallery" picker from `/admin/journeys`. (Keep — it's the only way to manage carousel content.)
- Per-tour testimonials.
- Blog post body inline images opening in a lightbox.
- Pause/Play button on the home hero slideshow.
- Server.py refactor into modules.
- Backend upload guard rejecting files > 95 MB at the API level.

---

## 6. Estimated effort

Phase | Hours
---|---
AD1 (revert hero) | 0.25
AD2 (remove Gallery tab + mobile spacing) | 0.5
AD3 (rename + migration) | 0.25
AD4 (audit) | 0.5
AD5 (live sync + handover) | 0.5
Backend testing | 0.25
Frontend testing | 0.5
**Total** | **~3 hours**

Should be a single focused session, including all testing and the deploy handoff.

---

## 7. Files the next agent will touch

| File | Phase | What changes |
|---|---|---|
| `frontend/src/pages/TourDetail.jsx` | AD1, AD2 | Restore `heroItems` memo + `<SwipeableMedia>` block; remove Gallery tab + content + `galleryItems`/`galleryTabLabel`; tighten mobile spacing |
| `backend/server.py` | AD3 | Update `_c("pricing", "tour_detail.tabs.included", ...)` default + add AD3 migration block in `startup_event` |
| `memory/PRD.md` | AD5 | Add Session AD entry |
| `HANDOVER.md` | AD5 | Bump title, add AD section to "What's been built", update "What to expect after deploy" |
| `backend/seed_data/site_snapshot.json` | AD5 | Auto-regenerated by `sync_from_live.py` |
| `test_result.md` | AD3 (before testing) | Add the AD3 task block + agent_communication entry per the existing test_result.md schema |

**No other files should change.** If the audit (AD4) finds a missing content key, the only addition is one more line in `DEFAULT_CONTENT` — flag back to the user before doing it so they can review the wording.

---

## 8. Pre-flight checklist for the next agent

Before starting AD1:
- [ ] Pull `/app` from `pinnacle467/oww@main` (this plan assumes the AC code is already pushed; if not, restore the .env files per HANDOVER.md Section 11 and `python3 backend/sync_from_live.py` first).
- [ ] Confirm `/admin` login works with the credentials in `/app/memory/test_credentials.md`.
- [ ] Run `python3 backend/sync_from_live.py` in background (`nohup ... &`) before touching code. Picks up any client edits between now and when AD starts.
- [ ] Verify the AC content seed is in place: `curl /api/content | python3 -c "import json,sys; d=json.load(sys.stdin); print([k for k in d if k.startswith('blog')])"` should return all 5 blog keys.

If any of those fail, stop and triage before starting AD1.

---

- End of plan (2026-06-29).
