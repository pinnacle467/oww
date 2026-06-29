"""
One-shot sync: pull authoritative data from https://oncewerewild.com (LIVE) and
overlay it on the preview environment so the preview matches live exactly.

Steps:
  1. GET /api/media (all sections, no filter)
  2. GET /api/journeys, /api/content, /api/settings, /api/gallery-categories
  3. Download every referenced image file (original + -sm + -md responsive
     variants) that isn't already on disk under ./uploads/
  4. Replace local Mongo collections: media, journeys, content, site_settings
  5. Write a fresh site_snapshot.json so the next deploy preserves this state

Run from /app/backend with: python3 sync_from_live.py
"""
import asyncio
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

LIVE = "https://oncewerewild.com"
UPLOADS = Path(__file__).parent / "uploads"
SEED = Path(__file__).parent / "seed_data"
SEED.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (preview-sync)"}


def get(url, default=None):
    r = requests.get(url, headers=UA, timeout=30)
    if r.status_code != 200:
        print(f"  ! GET {url} -> {r.status_code}")
        return default
    return r.json()


def download(rel_url: str) -> bool:
    """Download a /api/uploads/... file from live into local uploads/ if missing."""
    if not rel_url or not rel_url.startswith("/api/uploads/"):
        return False
    rel = rel_url[len("/api/uploads/"):]
    target = UPLOADS / rel
    if target.exists() and target.stat().st_size > 0:
        return True
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = requests.get(LIVE + rel_url, headers=UA, timeout=20, stream=True)
    except requests.exceptions.RequestException:
        return False
    if r.status_code != 200:
        return False
    try:
        with target.open("wb") as f:
            for chunk in r.iter_content(64 * 1024):
                f.write(chunk)
    except Exception:
        return False
    return True


def download_many(urls, workers=16, label="files"):
    """Parallel download. Returns (ok, missing) counts."""
    ok = 0
    missing = 0
    todo = [u for u in urls if not (UPLOADS / u[len("/api/uploads/"):]).exists()]
    if not todo:
        print(f"  all {len(urls)} {label} already on disk")
        return len(urls), 0
    print(f"  {len(todo)} {label} to fetch (skipping {len(urls)-len(todo)} already present)")
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(download, u): u for u in todo}
        done = 0
        for fut in as_completed(futs):
            done += 1
            if fut.result():
                ok += 1
            else:
                missing += 1
            if done % 50 == 0:
                print(f"    .. {done}/{len(todo)} done ({ok} ok, {missing} missing)")
    return ok, missing


def all_referenced_urls(media_docs):
    """Collect every /api/uploads/... URL referenced by media docs, including
    responsive (-sm/-md) and AVIF variants if present."""
    urls = set()
    for d in media_docs:
        fu = d.get("file_url")
        if fu:
            urls.add(fu)
        for k in ("srcset", "avif_srcset"):
            ss = d.get(k) or {}
            if isinstance(ss, dict):
                for u in ss.values():
                    if u:
                        urls.add(u)
        if d.get("thumb_url"):
            urls.add(d["thumb_url"])
    return urls


async def main():
    print("== Fetching live data ==")
    media = get(f"{LIVE}/api/media") or []
    journeys = get(f"{LIVE}/api/journeys") or []
    content = get(f"{LIVE}/api/content") or {}
    settings = get(f"{LIVE}/api/settings") or {}
    gallery_cats = get(f"{LIVE}/api/gallery-categories") or []
    # 2026-06-29: pull the editorial CMS collections too so a fresh sync
    # captures admin-authored content (stories on /about, blog posts,
    # home-page rich-text sections, home FAQs, about_blocks). Previously
    # these lived only on the live DB and got dropped by `delete_many`
    # below when older syncs replaced media + journeys + content. Each
    # endpoint is wrapped in `or []` so a 404 on stale live builds is
    # treated as "empty" rather than a sync failure.
    stories = get(f"{LIVE}/api/stories") or []
    about_blocks = get(f"{LIVE}/api/about-blocks") or []
    home_sections = get(f"{LIVE}/api/home-sections") or []
    home_faqs = get(f"{LIVE}/api/home-faqs") or []
    blog_posts = get(f"{LIVE}/api/blog") or []
    print(
        f"  media={len(media)} journeys={len(journeys)} content_keys={len(content)} "
        f"settings_keys={len(settings)} categories={gallery_cats} stories={len(stories)} "
        f"about_blocks={len(about_blocks)} home_sections={len(home_sections)} "
        f"home_faqs={len(home_faqs)} blog_posts={len(blog_posts)}"
    )

    # ---- 1. Download referenced files in parallel ----
    urls = all_referenced_urls(media)
    # Also try avif counterparts of every webp. Most of these may 404 — that's
    # fine; we skip them in parallel so it stays fast.
    extra = set()
    for u in list(urls):
        if u.endswith(".webp"):
            extra.add(u[:-5] + ".avif")
    print(f"\n== Downloading {len(urls)} referenced webps (parallel) ==")
    ok1, miss1 = download_many(list(urls), workers=24, label="webp")
    print(f"  webp result: {ok1} ok, {miss1} missing")
    print(f"\n== Downloading {len(extra)} candidate avifs (best-effort, parallel) ==")
    ok2, miss2 = download_many(list(extra), workers=24, label="avif")
    print(f"  avif result: {ok2} ok, {miss2} missing (404s are normal)")

    # ---- 2. Replace Mongo collections ----
    print("\n== Replacing local Mongo collections ==")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    await db.media.delete_many({})
    if media:
        await db.media.insert_many(media)
    print(f"  media: {await db.media.count_documents({})} docs")

    await db.journeys.delete_many({})
    if journeys:
        await db.journeys.insert_many(journeys)
    print(f"  journeys: {await db.journeys.count_documents({})} docs")

    # content + site_settings are key/value collections
    if isinstance(content, dict) and content:
        await db.content.delete_many({})
        await db.content.insert_many([{"key": k, "value": v} for k, v in content.items()])
        print(f"  content: {await db.content.count_documents({})} docs")

    if isinstance(settings, dict) and settings:
        await db.site_settings.delete_many({})
        await db.site_settings.insert_many([{"key": k, "value": v} for k, v in settings.items()])
        print(f"  site_settings: {await db.site_settings.count_documents({})} docs")

    if isinstance(gallery_cats, list) and gallery_cats:
        await db.gallery_categories.delete_many({})
        await db.gallery_categories.insert_many(
            [{"name": name, "sort_order": i} for i, name in enumerate(gallery_cats)]
        )
        print(f"  gallery_categories: {await db.gallery_categories.count_documents({})} docs")

    # Replace editorial CMS collections (added 2026-06-29). Each block is
    # idempotent: if live returned no rows we leave the local copy alone so
    # an offline live host doesn't wipe local fixtures.
    for coll_name, payload in (
        ("stories", stories),
        ("about_blocks", about_blocks),
        ("home_sections", home_sections),
        ("home_faqs", home_faqs),
        ("blog_posts", blog_posts),
    ):
        if isinstance(payload, list) and payload:
            await db[coll_name].delete_many({})
            await db[coll_name].insert_many(payload)
            print(f"  {coll_name}: {await db[coll_name].count_documents({})} docs")

    # ---- 3. Write snapshot file so the next deploy is preserved ----
    # `content` and `site_settings` must be a list of {key, value, ...} docs
    # because _apply_snapshot() iterates and calls .get("key") on each entry.
    content_list = [{"key": k, "value": v} for k, v in (content or {}).items()]
    settings_list = [{"key": k, "value": v} for k, v in (settings or {}).items()]
    snapshot = {
        "version": 1,
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "media": media,
        "content": content_list,
        "site_settings": settings_list,
        "journeys": journeys,
        "gallery_categories": gallery_cats,
        # 2026-06-29: bundle editorial CMS collections too. _apply_snapshot()
        # in server.py needs a matching block to consume these on boot.
        "stories": stories,
        "about_blocks": about_blocks,
        "home_sections": home_sections,
        "home_faqs": home_faqs,
        "blog_posts": blog_posts,
    }
    snap_path = SEED / "site_snapshot.json"
    snap_path.write_text(json.dumps(snapshot, default=str, indent=2))
    print(f"\n  snapshot -> {snap_path} ({snap_path.stat().st_size} bytes)")
    print("\n== DONE ==")


if __name__ == "__main__":
    asyncio.run(main())
