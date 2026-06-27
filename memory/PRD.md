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
