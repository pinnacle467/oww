# AF Audit — Discovery list (Phase AF1)

Generated 2026-06-30, session AF. Read this before making code changes.

The user's original ask:
> "the Website Text and Website Images and Videos section in the admin panel should be completely in sync with the website and all the relevant editing options should be available there."

Below is every hardcoded string still in public-facing JSX. The §2.4 exclusion list from `NEXT_SESSION_PLAN_AF.md` is honoured — those strings are NOT in this list.

## Summary
- Total new content keys: **48**
- Groups touched: `about` (3), `blog` (8), `tour_detail` (6), `home` (1), `nav` (1), `footer` (3), `cookies` (24), `about.travel` (2)
- All defaults are EXACTLY the text currently on screen so the public site has zero visual change after AF.

---

## about (3 new + 2 missing-row catch-ups = 5)

| Key | Default | File:line | Type |
|---|---|---|---|
| `about.blocks.empty` | "More about us, coming soon." | About.jsx:48 | text |
| `about.stories.empty` | "New stories are being written. Check back soon." | About.jsx:79 | text |
| `about.stories.read_cta` | "Read story" | About.jsx:121 | text |
| `about.travel.eyebrow` | "From the road" | components/about/TravelGallery.jsx:52 | text (*useText call already exists but row missing from DB*) |
| `about.travel.title` | "Travel notes in photos and video" | components/about/TravelGallery.jsx:53 | text (*useText call already exists but row missing from DB*) |

§2.4 honoured: "Our Story", "Field Notes", "Stories from the road.", "SISTER BRAND" eyebrow all stay hardcoded.

## blog (8)

| Key | Default | File:line |
|---|---|---|
| `blog.loading` | "Loading the journal..." | Blog.jsx:71 |
| `blog.load_more` | "Read more posts" | Blog.jsx:97 |
| `blog.card.read_more` | "Read more" | Blog.jsx:144 |
| `blog.post.loading` | "Loading..." | BlogPost.jsx:82 |
| `blog.post.not_found_title` | "Post not found" | BlogPost.jsx:90 |
| `blog.post.not_found_body` | "This post may have been removed or is still being drafted. The journal index has every published story." | BlogPost.jsx:91 |
| `blog.post.not_found_cta` | "Back to journal" | BlogPost.jsx:96 |
| `blog.post.back_to_journal` | "Back to the journal" | BlogPost.jsx:121, 206 |

## tour_detail (6)

| Key | Default | File:line |
|---|---|---|
| `tour_detail.loading` | "Loading..." | TourDetail.jsx:137 |
| `tour_detail.not_found_title` | "Tour not found" | TourDetail.jsx:146 |
| `tour_detail.not_found_body` | "This tour may have been moved or is no longer published. View our current journeys instead." | TourDetail.jsx:151 |
| `tour_detail.kind.tour` | "Small Group Tour" | TourDetail.jsx:181 |
| `tour_detail.pdf_only_note` | "A full day-by-day itinerary is available in the PDF below." | TourDetail.jsx:343 |
| `tour_detail.empty_message` | "Full itinerary coming soon. Enquire below and we'll send you the day-by-day plan." | TourDetail.jsx:382 |
| `tour_detail.back_to_tours` | "View all tours" | TourDetail.jsx:69, 88 (also reused in ToursDropdown) |

§2.4 honoured: "Itinerary", "More Details", "Practical information", "What's Included", "What's Not Included", "Investment", "Dates" all stay hardcoded.

## home (1)

| Key | Default | File:line |
|---|---|---|
| `home.journal.card_read_more` | "Read more" | components/home/FromTheJournal.jsx:115 |

## nav (1)

| Key | Default | File:line |
|---|---|---|
| `nav.tours_dropdown.view_all` | "View all tours" | components/layout/ToursDropdown.jsx:88 |

(Same string as `tour_detail.back_to_tours` — could reuse one key. **Decision:** keep one shared key `tour_detail.back_to_tours` and reuse on the dropdown to keep things consistent for the client.)

## footer (3)

| Key | Default | File:line |
|---|---|---|
| `footer.copyright_rights_text` | "All rights reserved." | Footer.jsx:177 |
| `footer.cookies_link` | "Cookies" | Footer.jsx:179 |
| `footer.enquiry_sending` | "Sending" | Footer.jsx:169 |

(Copyright line stays as "© {year} {brand}. {rights_text}" — year is dynamic, brand stays code-level.)

## cookies — Cookies banner + policy page (24)

The entire `/cookies` page and the cookie banner are currently hardcoded.

### Banner (`components/CookieBanner.jsx`)

| Key | Default |
|---|---|
| `cookies.banner.title` | "We use a few essential cookies." |
| `cookies.banner.body_prefix` | "They help the site run smoothly and let us understand which journeys you love most. Read our " |
| `cookies.banner.link_label` | "cookies policy" |
| `cookies.banner.body_suffix` | "." |
| `cookies.banner.decline` | "Decline" |
| `cookies.banner.accept` | "Accept" |

### Policy page (`pages/CookiesPolicy.jsx`)

| Key | Default |
|---|---|
| `cookies.eyebrow` | "Legal" |
| `cookies.title` | "Cookies policy" |
| `cookies.intro` | "This site uses a small number of cookies..." (long) |
| `cookies.what.heading` | "What is a cookie" |
| `cookies.what.body` | "A cookie is a tiny text file..." |
| `cookies.use.heading` | "What we use" |
| `cookies.use.strict_label` | "Strictly necessary." |
| `cookies.use.strict_body` | "These keep the site running. They remember things like your cookie choice..." |
| `cookies.use.analytics_label` | "Anonymous analytics." |
| `cookies.use.analytics_body` | "If you accept, we use a privacy-friendly analytics tool..." |
| `cookies.choice.heading` | "Your choice" |
| `cookies.choice.body` | "You can accept or decline analytics cookies using the banner..." |
| `cookies.preference_label` | "Current preference:" |
| `cookies.status.accepted` | "Accepted" |
| `cookies.status.declined` | "Declined" |
| `cookies.status.not_set` | "Not set" |
| `cookies.change_cta` | "Change my choice" |
| `cookies.contact.heading` | "Contact" |
| `cookies.contact.body` | "If you have a question about how we handle data..." |

---

## Items deliberately SKIPPED (UI machinery / a11y / out-of-scope)

- "Loading..." in admin pages (admin-only, not in public scope).
- Aria-labels like "Open menu", "Previous slide", "Next slide" (a11y machinery).
- "Sending" / "Loading" type ephemeral status messages already covered above where editable.
- Brand fallback placeholder "Once Were Wild" rendered when a blog post has no image (only seen during admin's draft state).
- All §2.4 strings: "Our Story", "Field Notes", "Stories from the road.", "Sister brand", tour-detail tab inner headings.
- "Once Were Wild Travel" brand string in the footer copyright (lives in code-level brand constants; client renames via the logo, not via copyright text).
- Date format strings.

---

## Group order proposal for admin (`WebsiteText.jsx`)

After AF: Home, Tours/Pricing, Tour detail, Gallery, Blog, About, Contact, Cookies, Footer, Nav, FAQs, Pillars, Brand, SEO, Testimonials, Journeys.

`cookies` is the only new group; it needs a `cookies: "Cookies banner + policy"` entry in `GROUP_LABELS`/`GROUP_ORDER`/`GROUP_PREVIEW_TARGETS` (preview path `/cookies`).

`tour_detail` already exists.

---

## Net result

- Public site visual: ZERO change.
- Total content keys: 201 -> 249 (+48).
- Snapshot.json: ~378 KB -> ~395-400 KB (still well under 500 KB).
- Admin gets full coverage of every public-facing string except the small §2.4 list.
