"""
Find and (optionally) quarantine orphan files in backend/uploads/.

An orphan is any file under backend/uploads/ that is NOT referenced by any
document in any collection in the live MongoDB.

By design this is multi-collection-aware: it does not just check `media`.
It scans every value in every document across every non-system collection
for substrings starting with /api/uploads/ . This means stories, blog_posts
(including inline images embedded in the body HTML), journey itinerary PDFs,
hero preload paths in `content`, etc. are all treated as "in use".

Usage (from inside the backend container, where MONGO_URL is in the env):

    # 1) Dry run - just count and print.
    docker compose exec -T backend python3 backend/cleanup_orphans.py

    # 2) Quarantine - moves orphans to backend/uploads/_orphans_<TS>/ so the
    #    site keeps working and you can roll back with a single mv. Nothing
    #    is actually deleted.
    docker compose exec -T backend python3 backend/cleanup_orphans.py --commit

    # 3) After you've verified the site still works and you're happy:
    rm -rf backend/uploads/_orphans_*
"""
import asyncio
import os
import re
import sys
import shutil
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter, defaultdict

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_URL_PREFIX = "/api/uploads"

# Anything moved into one of these top-level folders is considered "system"
# and never touched, even if it isn't referenced. Quarantine output goes here
# so re-running the script doesn't try to quarantine its own quarantine.
PROTECTED_TOP_LEVEL_PREFIXES = ("_orphans_",)

# Match /api/uploads/<anything> inside any string. Greedy up to the next
# whitespace, quote, or HTML attribute terminator. Captures the path part
# after the prefix.
URL_RE = re.compile(r'/api/uploads/([^\s"\'<>)\\]+)')


def collect_strings(doc, out: list[str]):
    """Recursively walk a Mongo doc and pull every string value out."""
    if isinstance(doc, str):
        out.append(doc)
    elif isinstance(doc, dict):
        for v in doc.values():
            collect_strings(v, out)
    elif isinstance(doc, list):
        for v in doc:
            collect_strings(v, out)


async def referenced_paths(db) -> set[Path]:
    """Return the absolute paths of every file referenced by any doc in any
    user-facing collection."""
    referenced: set[Path] = set()
    collections = await db.list_collection_names()
    # Skip system + audit-only collections.
    skip = lambda name: (
        name.startswith("system.")
        or name.startswith("media_backup_")
    )
    for coll in collections:
        if skip(coll):
            continue
        cursor = db[coll].find({}, {"_id": 0})
        async for doc in cursor:
            strings: list[str] = []
            collect_strings(doc, strings)
            for s in strings:
                for m in URL_RE.finditer(s):
                    rel = m.group(1)
                    # Defensive: strip query strings / hash fragments.
                    rel = rel.split("?", 1)[0].split("#", 1)[0]
                    p = (UPLOADS_DIR / rel).resolve()
                    # Stay inside UPLOADS_DIR (no path traversal).
                    try:
                        p.relative_to(UPLOADS_DIR.resolve())
                    except ValueError:
                        continue
                    referenced.add(p)
    return referenced


def all_disk_files() -> set[Path]:
    out: set[Path] = set()
    for p in UPLOADS_DIR.rglob("*"):
        if not p.is_file():
            continue
        # Skip anything inside an existing quarantine folder.
        rel = p.relative_to(UPLOADS_DIR)
        top = rel.parts[0] if rel.parts else ""
        if any(top.startswith(prefix) for prefix in PROTECTED_TOP_LEVEL_PREFIXES):
            continue
        out.add(p.resolve())
    return out


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.1f} {unit}"
        n /= 1024


async def main():
    commit = "--commit" in sys.argv

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"DB: {db_name}")
    print(f"Uploads root: {UPLOADS_DIR}")
    print()

    referenced = await referenced_paths(db)
    on_disk = all_disk_files()
    orphans = sorted(on_disk - referenced)
    missing = sorted(referenced - on_disk)

    print(f"Files referenced by DB (across all collections): {len(referenced)}")
    print(f"Files actually on disk (excluding quarantines):  {len(on_disk)}")
    print(f"Missing (DB points here but file gone):          {len(missing)}")
    print(f"Orphans (file exists but no DB reference):       {len(orphans)}")
    print()

    if missing:
        print("WARNING: the following files are referenced by the DB but do NOT exist on disk:")
        for p in missing[:20]:
            try:
                rel = p.relative_to(UPLOADS_DIR)
            except ValueError:
                rel = p
            print(f"  - {rel}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")
        print()

    if not orphans:
        print("Nothing to clean up.")
        return

    by_section = Counter()
    size_by_section = defaultdict(int)
    total_size = 0
    for p in orphans:
        sec = p.relative_to(UPLOADS_DIR).parts[0]
        by_section[sec] += 1
        sz = p.stat().st_size
        size_by_section[sec] += sz
        total_size += sz

    print(f"{'Section':<20}{'Files':>10}{'Size':>15}")
    print("-" * 45)
    for sec, n in by_section.most_common():
        print(f"{sec:<20}{n:>10}{human(size_by_section[sec]):>15}")
    print("-" * 45)
    print(f"{'TOTAL':<20}{len(orphans):>10}{human(total_size):>15}")
    print()

    if not commit:
        print("Dry run only. Re-run with --commit to QUARANTINE these files.")
        print("Quarantine = moved (not deleted) to backend/uploads/_orphans_<TS>/")
        print("After commit you can verify the site still works, then:")
        print("    rm -rf backend/uploads/_orphans_*")
        return

    # Commit: move every orphan into _orphans_<TS>/, preserving the original
    # folder structure (so a single `mv -n _orphans_<TS>/* ./` reverses it).
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    quarantine = UPLOADS_DIR / f"_orphans_{ts}"
    quarantine.mkdir(parents=True, exist_ok=False)
    print(f"Quarantining {len(orphans)} files into {quarantine} ...")

    moved = 0
    failed = 0
    for p in orphans:
        rel = p.relative_to(UPLOADS_DIR)
        dest = quarantine / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.move(str(p), str(dest))
            moved += 1
        except Exception as e:
            failed += 1
            print(f"  FAILED to move {rel}: {e}")

    print(f"Moved: {moved}.  Failed: {failed}.  Freed (when quarantine is deleted): {human(total_size)}")
    print()
    print("Roll back with:")
    print(f"    cd {UPLOADS_DIR}")
    print(f"    cp -rn _orphans_{ts}/* .  &&  rm -rf _orphans_{ts}")
    print()
    print("Or finalise (permanent delete) once you've verified the site:")
    print(f"    rm -rf {quarantine}")


if __name__ == "__main__":
    asyncio.run(main())
