"""
One-off recovery script: rebuild the `media` collection from the WebP/MP4
files that survived on disk in backend/uploads/. The previous environment's
MongoDB (with all media metadata) was lost when the container was recreated,
but the uploaded files are committed to git. This reconstructs the DB rows so
the real images are displayed again instead of the bundled stock defaults.

Metadata that was only in Mongo (caption, alt_text, category, exact sort
order) cannot be recovered and is left blank.
"""
import os
import io
import sys
import uuid
import base64
import shutil
import tempfile
import subprocess
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
from PIL import Image, ImageOps
from pymongo import MongoClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_URL_PREFIX = "/api/uploads"
FFMPEG_BIN = shutil.which("ffmpeg")

# Multi-image sections (show many rows). Everything else is a single slot.
MULTI_SECTIONS = {"hero", "gallery"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v"}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def is_variant(name: str) -> bool:
    stem = name.rsplit(".", 1)[0]
    return stem.endswith("-md") or stem.endswith("-sm")


def gen_lqip(raw: bytes) -> str:
    try:
        with Image.open(io.BytesIO(raw)) as im:
            im = ImageOps.exif_transpose(im)
            if im.mode != "RGB":
                im = im.convert("RGB")
            w = 24
            h = max(1, round(im.size[1] * (w / im.size[0])))
            small = im.resize((w, h), Image.LANCZOS)
            buf = io.BytesIO()
            small.save(buf, "WEBP", quality=40, method=6)
        return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as e:
        print("  lqip fail:", e)
        return ""


def make_video_thumb(video_path: Path, section: str) -> tuple[str, str]:
    """Return (thumb_url, lqip) for a video, or ('','') if ffmpeg missing/fails."""
    if not FFMPEG_BIN:
        return "", ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            for cmd in (
                [FFMPEG_BIN, "-y", "-loglevel", "error", "-ss", "00:00:01",
                 "-i", str(video_path), "-frames:v", "1", "-q:v", "2", str(tmp_path)],
                [FFMPEG_BIN, "-y", "-loglevel", "error",
                 "-i", str(video_path), "-frames:v", "1", "-q:v", "2", str(tmp_path)],
            ):
                res = subprocess.run(cmd, capture_output=True, timeout=30)
                if res.returncode == 0 and tmp_path.exists() and tmp_path.stat().st_size > 0:
                    break
            else:
                return "", ""
            raw = tmp_path.read_bytes()
        finally:
            tmp_path.unlink(missing_ok=True)

        with Image.open(io.BytesIO(raw)) as im:
            im = ImageOps.exif_transpose(im)
            if im.mode != "RGB":
                im = im.convert("RGB")
            if max(im.size) > 1600:
                r = 1600 / max(im.size)
                im = im.resize((round(im.size[0] * r), round(im.size[1] * r)), Image.LANCZOS)
            thumb_name = f"thumb_{video_path.stem}.webp"
            (UPLOADS_DIR / section).mkdir(parents=True, exist_ok=True)
            im.save(UPLOADS_DIR / section / thumb_name, "WEBP", quality=76, method=6)
        thumb_url = f"{UPLOADS_URL_PREFIX}/{section}/{thumb_name}"
        lqip = gen_lqip(raw)
        return thumb_url, lqip
    except Exception as e:
        print("  video thumb fail:", e)
        return "", ""


def build_docs():
    docs = []
    sections = sorted([p.name for p in UPLOADS_DIR.iterdir() if p.is_dir()])
    for section in sections:
        sdir = UPLOADS_DIR / section
        files = [f for f in sdir.iterdir() if f.is_file()]
        # candidate "main" files: non-variant webp + videos; skip thumb_ posters
        mains = []
        for f in files:
            ext = f.suffix.lower()
            if f.name.startswith("thumb_"):
                continue
            if ext == ".webp" and not is_variant(f.name):
                mains.append(f)
            elif ext in VIDEO_EXTS:
                mains.append(f)
        if not mains:
            continue

        # single-slot sections: keep only the newest file (best guess at the
        # image the operator last set as active).
        if section not in MULTI_SECTIONS:
            mains = [max(mains, key=lambda p: p.stat().st_mtime)]

        mains.sort(key=lambda p: p.name)
        print(f"[{section}] rebuilding {len(mains)} item(s)")
        for i, f in enumerate(mains):
            ext = f.suffix.lower()
            base = f.stem
            if ext in VIDEO_EXTS:
                file_url = f"{UPLOADS_URL_PREFIX}/{section}/{f.name}"
                thumb_url, lqip = make_video_thumb(f, section)
                doc = dict(file_url=file_url, srcset={}, thumb_url=thumb_url,
                           file_type="video", lqip=lqip)
            else:
                file_url = f"{UPLOADS_URL_PREFIX}/{section}/{f.name}"
                srcset = {"1600w": file_url}
                md = sdir / f"{base}-md.webp"
                sm = sdir / f"{base}-sm.webp"
                if md.exists():
                    srcset["1200w"] = f"{UPLOADS_URL_PREFIX}/{section}/{md.name}"
                if sm.exists():
                    srcset["800w"] = f"{UPLOADS_URL_PREFIX}/{section}/{sm.name}"
                try:
                    lqip = gen_lqip(f.read_bytes())
                except Exception:
                    lqip = ""
                doc = dict(file_url=file_url, srcset=srcset, thumb_url="",
                           file_type="image", lqip=lqip)

            doc.update(
                id=str(uuid.uuid4()),
                section=section,
                caption="",
                alt_text="",
                category="",
                sort_order=i,
                is_active=True,
                created_at=now_iso(),
            )
            docs.append(doc)
    return docs


def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]

    print(f"DB: {db_name}  ffmpeg: {'yes' if FFMPEG_BIN else 'NO (videos get no poster)'}")
    docs = build_docs()
    print(f"\nTotal reconstructed media docs: {len(docs)}")
    by_sec = {}
    for d in docs:
        by_sec[d["section"]] = by_sec.get(d["section"], 0) + 1
    for s, n in sorted(by_sec.items()):
        print(f"  {s}: {n}")

    if "--commit" in sys.argv:
        old = db.media.count_documents({})
        db.media.delete_many({})
        if docs:
            db.media.insert_one  # noqa
            db.media.insert_many(docs)
        # keep the seed flag so a backend restart will NOT re-add stock defaults
        db.site_settings.update_one(
            {"key": "media_seeded_v1"}, {"$set": {"value": True}}, upsert=True
        )
        print(f"\nCOMMITTED: removed {old} old rows, inserted {len(docs)} new rows.")
    else:
        print("\nDRY RUN (pass --commit to write to Mongo).")


if __name__ == "__main__":
    main()
