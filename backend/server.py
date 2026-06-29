from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import io
import base64
import secrets
import asyncio
import shutil
import subprocess
import tempfile
import resend
from PIL import Image, ImageOps

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ISSUER = "Once Were Wild"

# Where to write converted uploads. Served back to clients as /uploads/...
# A flat URL string (instead of a 7 MB base64 data URL) is what unlocks
# instant hero paint and lets the browser cache the asset across visits.
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
UPLOADS_URL_PREFIX = "/api/uploads"

# Where to publish llms.txt / llms-full.txt and the hero preload snippet
# in index.html. In production (yarn build) the served files live in
# `frontend/build`; in development they live in `frontend/public`. We
# prefer build/ if it exists so dynamic regenerators always reach the
# files the browser actually sees.
_FE_BUILD = ROOT_DIR.parent / "frontend" / "build"
_FE_PUBLIC = ROOT_DIR.parent / "frontend" / "public"
PUBLIC_DIR = _FE_BUILD if (_FE_BUILD / "index.html").is_file() else _FE_PUBLIC
# Always also mirror the writes into public/ so a future `yarn build`
# starts from the latest content.
PUBLIC_MIRROR = _FE_PUBLIC if PUBLIC_DIR == _FE_BUILD else None
SITE_URL = os.environ.get("PUBLIC_SITE_URL", "https://oncewerewild.com")

# Email one-time-passcode login. Toggle via OTP_LOGIN_ENABLED in backend/.env.
# When disabled, admins sign in with email + password only (useful for testing).
OTP_LOGIN_ENABLED = os.environ.get("OTP_LOGIN_ENABLED", "false").lower() == "true"
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
resend.api_key = RESEND_API_KEY

app = FastAPI(title="Once Were Wild API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------------------- Helpers -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(payload: dict, minutes: int) -> str:
    data = {**payload, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session. Please sign in again.")


async def get_current_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    return {"id": user["id"], "email": user["email"], "name": user.get("name", "")}


async def send_otp_email(to_email: str, code: str):
    html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
      <tr><td align="center">
        <table width="440" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;border:1px solid #eee;">
          <tr><td style="background:#2D4A3E;padding:24px 32px;color:#ffffff;font-size:18px;letter-spacing:2px;">ONCE WERE WILD</td></tr>
          <tr><td style="padding:32px;">
            <p style="color:#1C1C1C;font-size:16px;margin:0 0 16px;">Here is your single use code to sign in to your website manager.</p>
            <p style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#2D4A3E;margin:16px 0;text-align:center;">{code}</p>
            <p style="color:#5A5A5A;font-size:14px;margin:16px 0 0;">This code expires in 10 minutes. If you did not try to sign in, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="padding:16px 32px;background:#f9f7f4;color:#9a9a9a;font-size:12px;">Once Were Wild Travel</td></tr>
        </table>
      </td></tr>
    </table>
    """
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": f"Your Once Were Wild login code: {code}",
        "html": html,
    }
    await asyncio.to_thread(resend.Emails.send, params)



# ----------------------------- Models -----------------------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class MfaVerifyInput(BaseModel):
    challenge_token: str
    code: str


class ChallengeInput(BaseModel):
    challenge_token: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


class ContactInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = ""
    inquiry_type: str
    message: str
    referral_source: Optional[str] = ""


class LeadInput(BaseModel):
    email: EmailStr
    source: str = "exit_intent"


class StatusUpdate(BaseModel):
    status: str


class MediaInput(BaseModel):
    section: str
    file_url: str
    file_type: str = "image"
    caption: Optional[str] = ""
    alt_text: Optional[str] = ""
    category: Optional[str] = ""
    sort_order: int = 0
    # Phase 2 (Change 6) - embed metadata for YouTube / Vimeo rows. When
    # file_type == "embed", file_url stores the canonical embed page URL
    # (e.g. https://youtu.be/abc123) and these fields cache the parsed
    # provider + id so the frontend doesn't re-parse on every render.
    embed_provider: Optional[str] = ""    # "youtube" | "vimeo" | ""
    embed_id: Optional[str] = ""


def _looks_like_data_url(s: Optional[str]) -> bool:
    return isinstance(s, str) and s.startswith("data:")


# Phase 2 (Change 6) - parse YouTube / Vimeo URLs into (provider, id) for
# embed-type media rows. Mirrors the frontend parseEmbedUrl() in
# components/media/SwipeableMedia.jsx so the server caches the same metadata.
import re as _re_embed
from urllib.parse import urlparse as _urlparse_embed, parse_qs as _parse_qs_embed


def _parse_embed_url_py(raw: str):
    if not raw or not isinstance(raw, str):
        return (None, None)
    try:
        u = _urlparse_embed(raw.strip())
        host = (u.hostname or "").replace("www.", "")
        if host == "youtu.be":
            vid = (u.path or "").lstrip("/").split("/")[0]
            if vid:
                return ("youtube", vid)
        if host in {"youtube.com", "m.youtube.com", "youtube-nocookie.com"}:
            qs = _parse_qs_embed(u.query or "")
            if "v" in qs and qs["v"]:
                return ("youtube", qs["v"][0])
            m = _re_embed.match(r"^/(shorts|embed|v)/([\w-]{6,})", u.path or "")
            if m:
                return ("youtube", m.group(2))
        if host == "vimeo.com":
            m = _re_embed.search(r"(\d{6,})", u.path or "")
            if m:
                return ("vimeo", m.group(1))
        if host == "player.vimeo.com":
            m = _re_embed.search(r"/video/(\d+)", u.path or "")
            if m:
                return ("vimeo", m.group(1))
    except Exception:
        return (None, None)
    return (None, None)


"""Image utilities. Variants and quality tuning live at the top so future
tuning is in one place. AVIF is generated alongside WebP for a typical
20–35 % byte saving on modern browsers while WebP stays as the fallback
on the (now-tiny) cohort that lacks AVIF support."""
try:
    import pillow_avif  # noqa: F401 — registers the AVIF codec with Pillow
    _AVIF_OK = True
except Exception:
    _AVIF_OK = False


# Responsive image variants. Encoding the same source at three sizes lets
# the browser pick the smallest variant that fits, which is what cuts
# mobile LCP from "way-too-big" to "good". Quality is intentionally lower
# than v1 (88) because hero photography still looks photographic at 76,
# while the file is ~55 % smaller. The "sm" variant uses an even more
# aggressive 68 because phones never need pixel-perfect 8K detail.
IMAGE_VARIANTS = (
    ("",   1600, 76, 55),   # default (desktop)  webp_q, avif_q
    ("md", 1200, 74, 52),   # narrow desktops / tablets
    ("sm",  800, 68, 48),   # mobile
)


def _encode_webp_to_disk(raw_bytes: bytes, section: str) -> tuple[str, str, dict, dict]:
    """Encode an image into three responsive WebP variants AND matching
    AVIF variants on disk. Returns a tiny inline LQIP (~600 B base64) so
    the frontend can paint the hero colours in the FIRST FRAME.

    Returns: (default_file_url, lqip, srcset_map, avif_srcset_map)
        srcset_map:      {"1600w": url, "1200w": url, "800w": url}   (.webp)
        avif_srcset_map: {"1600w": url, "1200w": url, "800w": url}   (.avif)
    """
    with Image.open(io.BytesIO(raw_bytes)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")

        section_dir = UPLOADS_DIR / section
        section_dir.mkdir(parents=True, exist_ok=True)
        base_id = uuid.uuid4().hex
        srcset: dict[str, str] = {}
        avif_srcset: dict[str, str] = {}
        default_url = ""
        for suffix, max_dim, quality, avif_quality in IMAGE_VARIANTS:
            variant = im.copy()
            if max(variant.size) > max_dim:
                ratio = max_dim / max(variant.size)
                variant = variant.resize(
                    (round(variant.size[0] * ratio), round(variant.size[1] * ratio)),
                    Image.LANCZOS,
                )
            # WebP (universal support)
            filename = f"{base_id}{('-' + suffix) if suffix else ''}.webp"
            out_path = section_dir / filename
            method = 4 if suffix == "sm" else 6
            variant.save(out_path, "WEBP", quality=quality, method=method)
            url = f"{UPLOADS_URL_PREFIX}/{section}/{filename}"
            srcset[f"{max_dim}w"] = url
            if suffix == "":
                default_url = url

            # AVIF (modern browsers — ~20-35% smaller at equivalent quality).
            # Fail silently if the codec is unavailable so uploads keep working.
            if _AVIF_OK:
                try:
                    avif_filename = f"{base_id}{('-' + suffix) if suffix else ''}.avif"
                    avif_path = section_dir / avif_filename
                    variant.save(avif_path, "AVIF", quality=avif_quality, speed=6)
                    avif_srcset[f"{max_dim}w"] = f"{UPLOADS_URL_PREFIX}/{section}/{avif_filename}"
                except Exception as e:
                    logger.warning("AVIF encode failed for %s: %s", filename, e)

        # Build LQIP from the smallest variant we already have in memory.
        lqip_w = 24
        lqip_h = max(1, round(variant.size[1] * (lqip_w / variant.size[0])))
        lqip = variant.resize((lqip_w, lqip_h), Image.LANCZOS)
        buf = io.BytesIO()
        lqip.save(buf, "WEBP", quality=40, method=6)
        lqip_b64 = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    return default_url, lqip_b64, srcset, avif_srcset


def _generate_lqip(raw_bytes: bytes) -> str:
    """Return a tiny inline base64 WebP placeholder (~600 B) WITHOUT writing
    a full file to disk. Used to backfill placeholders for assets already
    shipped in the React `public/` folder."""
    with Image.open(io.BytesIO(raw_bytes)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")
        lqip_w = 24
        lqip_h = max(1, round(im.size[1] * (lqip_w / im.size[0])))
        lqip = im.resize((lqip_w, lqip_h), Image.LANCZOS)
        buf = io.BytesIO()
        lqip.save(buf, "WEBP", quality=40, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def convert_image_to_webp(data_url: str, section: str = "misc") -> tuple[str, str]:
    """Wrapper around _encode_webp_to_disk that accepts a data: URL.
    Returns (file_url, lqip) — both strings. Non-image / non-data URLs are
    returned with an empty LQIP. (srcset is dropped — only seed media used
    this helper, and seed media is fed straight into Mongo.)"""
    if not _looks_like_data_url(data_url):
        return data_url, ""
    try:
        header, b64 = data_url.split(",", 1)
    except ValueError:
        return data_url, ""
    if not header.startswith("data:image/"):
        return data_url, ""
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return data_url, ""
    try:
        url, lqip, _srcset, _avif = _encode_webp_to_disk(raw, section)
        return url, lqip
    except Exception as e:
        logger.warning("WebP conversion failed (%s) — storing original.", e)
        return data_url, ""


def convert_image_data_url(data_url: str, section: str) -> tuple[str, str, dict]:
    """Decode an image data URL and write the responsive WebP variants to disk.
    Returns (file_url, lqip, srcset). On failure returns (data_url, "", {}).

    The AVIF variants are still generated by `_encode_webp_to_disk` but are
    not returned here for backward-compat with the existing callers; admin
    callers that need the AVIF srcset should use the upload endpoint instead.
    """
    if not _looks_like_data_url(data_url):
        return data_url, "", {}
    try:
        header, b64 = data_url.split(",", 1)
        if not header.startswith("data:image/"):
            return data_url, "", {}
        raw = base64.b64decode(b64)
        url, lqip, srcset, _avif = _encode_webp_to_disk(raw, section)
        return url, lqip, srcset
    except Exception as e:
        logger.warning("Image data-URL conversion failed (%s) — storing original.", e)
        return data_url, "", {}


def convert_video_data_url(data_url: str, section: str) -> tuple[str, str, str]:
    """Decode a video data URL, write the original file to disk and extract a
    WebP poster frame. Returns (file_url, thumb_url, lqip). On failure returns
    (data_url, "", "")."""
    if not _looks_like_data_url(data_url):
        return data_url, "", ""
    try:
        header, b64 = data_url.split(",", 1)
        raw = base64.b64decode(b64)
        ext = ".mp4"
        for guess, token in ((".webm", "webm"), (".mov", "quicktime"), (".m4v", "x-m4v"), (".mp4", "mp4")):
            if token in header:
                ext = guess
                break
        section_dir = UPLOADS_DIR / section
        section_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{ext}"
        out_path = section_dir / filename
        out_path.write_bytes(raw)
        file_url = f"{UPLOADS_URL_PREFIX}/{section}/{filename}"
        thumb_url, lqip = _extract_video_thumb(out_path, section)
        return file_url, thumb_url, lqip
    except Exception as e:
        logger.warning("Video data-URL conversion failed (%s) — storing original.", e)
        return data_url, "", ""


FFMPEG_BIN = shutil.which("ffmpeg")


def _extract_video_thumb(video_path: Path, section: str) -> tuple[str, str]:
    """Grab a frame ~1s into the video, pipe it through Pillow and write it
    out as a WebP thumbnail with an LQIP. Returns (thumb_url, lqip). On any
    failure (missing ffmpeg, broken video) returns ("", "") and the gallery
    falls back to a solid poster on the frontend."""
    if not FFMPEG_BIN:
        logger.warning("ffmpeg binary not found — skipping video thumbnail extraction.")
        return "", ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            # `-ss 00:00:01` before -i seeks fast; -frames:v 1 grabs one frame.
            # If the clip is shorter than 1 s, fall back to the first frame.
            cmd = [
                FFMPEG_BIN, "-y", "-loglevel", "error",
                "-ss", "00:00:01", "-i", str(video_path),
                "-frames:v", "1", "-q:v", "2", str(tmp_path),
            ]
            res = subprocess.run(cmd, capture_output=True, timeout=20)
            if res.returncode != 0 or not tmp_path.exists() or tmp_path.stat().st_size == 0:
                # Retry on the very first frame.
                cmd_first = [
                    FFMPEG_BIN, "-y", "-loglevel", "error",
                    "-i", str(video_path),
                    "-frames:v", "1", "-q:v", "2", str(tmp_path),
                ]
                res = subprocess.run(cmd_first, capture_output=True, timeout=20)
                if res.returncode != 0 or not tmp_path.exists() or tmp_path.stat().st_size == 0:
                    logger.warning("ffmpeg could not extract a frame from %s: %s",
                                   video_path.name, res.stderr.decode(errors="ignore")[:200])
                    return "", ""
            raw = tmp_path.read_bytes()
        finally:
            tmp_path.unlink(missing_ok=True)
        url, lqip, _srcset, _avif = _encode_webp_to_disk(raw, section)
        return url, lqip
    except Exception as e:
        logger.warning("Video thumbnail extraction failed for %s: %s", video_path.name, e)
        return "", ""


class MediaUpdate(BaseModel):
    file_url: Optional[str] = None
    caption: Optional[str] = None
    alt_text: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None
    # Phase 2 (Change 6) - embed metadata updates.
    embed_provider: Optional[str] = None
    embed_id: Optional[str] = None
    file_type: Optional[str] = None


class SettingsUpdate(BaseModel):
    settings: dict


class ContentItem(BaseModel):
    key: str
    value: str


class ContentBulkUpdate(BaseModel):
    items: List[ContentItem]


class GalleryCategoriesUpdate(BaseModel):
    categories: List[str]


# ----------------------------- Auth Routes -----------------------------
@api_router.post("/auth/login")
async def login(data: LoginInput, request: Request):
    email = data.email.lower().strip()
    # Lock per account (email). Behind the k8s ingress, request.client.host is the
    # rotating proxy IP, so an IP based key would never trigger. Email keyed lockout
    # is robust and also blocks distributed attempts against one account.
    identifier = email

    # Tunables — per the auth playbook (5 attempts / 15 minutes).
    MAX_ATTEMPTS = 5
    LOCKOUT_MINUTES = 15

    record = await db.login_attempts.find_one({"identifier": identifier})
    # If the user is still inside an active lockout window, reject early.
    if record and record.get("locked_until"):
        locked_until = datetime.fromisoformat(record["locked_until"])
        if locked_until > datetime.now(timezone.utc):
            mins = int((locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
            raise HTTPException(status_code=429, detail=f"Too many attempts. Please try again in {mins} minutes.")
        # Lockout has expired — wipe the stale counter so a single fat-finger
        # after a long break does not instantly re-lock the account.
        await db.login_attempts.delete_one({"identifier": identifier})
        record = None

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        count = (record.get("count", 0) if record else 0) + 1
        update = {"identifier": identifier, "count": count, "updated_at": now_iso()}
        if count >= MAX_ATTEMPTS:
            update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        if count >= MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail=f"Too many attempts. Your account is locked for {LOCKOUT_MINUTES} minutes.")
        remaining = MAX_ATTEMPTS - count
        raise HTTPException(
            status_code=401,
            detail=f"The email or password you entered is not correct. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    await db.login_attempts.delete_one({"identifier": identifier})

    user_public = {"id": user["id"], "email": user["email"], "name": user.get("name", "")}

    # OTP disabled: sign in directly with email + password.
    if not OTP_LOGIN_ENABLED:
        access = create_token({"sub": user["id"], "type": "access"}, minutes=720)
        return {"status": "success", "access_token": access, "user": user_public}

    # OTP enabled: generate a single-use 6 digit code, store it, email it.
    code = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "code_hash": hash_password(code),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
            "used": False,
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    try:
        await send_otp_email(user["email"], code)
    except Exception as e:
        logger.error(f"Failed to send OTP email: {e}")
        raise HTTPException(status_code=502, detail="We could not send your login code right now. Please try again in a moment.")

    challenge = create_token({"sub": user["id"], "type": "otp_challenge"}, minutes=10)
    name, _, domain = user["email"].partition("@")
    masked = (name[0] + "***" + name[-1] if len(name) > 2 else name[0] + "***") + "@" + domain
    return {"status": "otp_required", "challenge_token": challenge, "sent_to": masked}


async def _issue_otp(user):
    code = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "code_hash": hash_password(code),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
            "used": False,
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    await send_otp_email(user["email"], code)


@api_router.post("/auth/otp/verify")
async def otp_verify(data: MfaVerifyInput):
    payload = decode_token(data.challenge_token)
    if payload.get("type") != "otp_challenge":
        raise HTTPException(status_code=401, detail="Invalid verification session. Please sign in again.")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")

    rec = await db.otp_codes.find_one({"user_id": user["id"]})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="No login code in progress. Please sign in again.")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="That code has expired. Please request a new one.")
    if not verify_password(data.code.strip(), rec["code_hash"]):
        raise HTTPException(status_code=401, detail="That code is not correct. Please check your email and try again.")

    await db.otp_codes.update_one({"user_id": user["id"]}, {"$set": {"used": True}})
    access = create_token({"sub": user["id"], "type": "access"}, minutes=720)
    return {"access_token": access, "user": {"id": user["id"], "email": user["email"], "name": user.get("name", "")}}


@api_router.post("/auth/otp/resend")
async def otp_resend(data: ChallengeInput):
    payload = decode_token(data.challenge_token)
    if payload.get("type") != "otp_challenge":
        raise HTTPException(status_code=401, detail="Invalid session. Please sign in again.")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")
    try:
        await _issue_otp(user)
    except Exception as e:
        logger.error(f"Failed to resend OTP email: {e}")
        raise HTTPException(status_code=502, detail="We could not resend your code right now. Please try again shortly.")
    return {"message": "A fresh code is on its way to your inbox."}


@api_router.get("/auth/me")
async def me(admin: dict = Depends(get_current_admin)):
    return admin


@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordInput, admin: dict = Depends(get_current_admin)):
    user = await db.users.find_one({"id": admin["id"]})
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is not correct.")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Your new password must be at least 8 characters.")
    await db.users.update_one({"id": admin["id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    return {"message": "Your password has been updated."}


# ----------------------------- Contact / Leads -----------------------------
@api_router.post("/contact")
async def create_contact(data: ContactInput):
    if len(data.message.strip()) < 20:
        raise HTTPException(status_code=422, detail="Please write a message of at least 20 characters.")
    doc = data.model_dump()
    doc.update({"id": str(uuid.uuid4()), "created_at": now_iso(), "status": "new"})
    await db.contact_submissions.insert_one(doc)
    return {"message": "Thank you. Your message has reached us and we will be in touch soon.", "id": doc["id"]}


@api_router.post("/leads")
async def create_lead(data: LeadInput):
    doc = {"id": str(uuid.uuid4()), "email": data.email.lower().strip(),
           "source": data.source, "created_at": now_iso()}
    await db.leads.insert_one(doc)
    return {"message": "You are on the list. Keep an eye on your inbox."}


@api_router.get("/admin/submissions")
async def list_submissions(admin: dict = Depends(get_current_admin)):
    rows = await db.contact_submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return rows


@api_router.patch("/admin/submissions/{sid}")
async def update_submission(sid: str, data: StatusUpdate, admin: dict = Depends(get_current_admin)):
    if data.status not in ("new", "reviewed", "responded"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.contact_submissions.update_one({"id": sid}, {"$set": {"status": data.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"message": "Updated"}


@api_router.delete("/admin/submissions/{sid}")
async def delete_submission(sid: str, admin: dict = Depends(get_current_admin)):
    await db.contact_submissions.delete_one({"id": sid})
    return {"message": "Removed"}


@api_router.get("/admin/leads")
async def list_leads(admin: dict = Depends(get_current_admin)):
    return await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


# ----------------------------- Media -----------------------------
def _media_doc_file_urls(doc: dict) -> list[str]:
    """Every /api/uploads/... URL this media doc references, across all
    responsive variants. Used to wipe files from disk when the row is
    deleted or the underlying file is replaced, so we never leak orphans."""
    urls: list[str] = []
    if not doc:
        return urls
    fu = doc.get("file_url")
    if fu:
        urls.append(fu)
    tu = doc.get("thumb_url")
    if tu:
        urls.append(tu)
    for k in ("srcset", "avif_srcset"):
        d = doc.get(k) or {}
        if isinstance(d, dict):
            urls.extend(v for v in d.values() if v)
    return urls


def _unlink_media_files(urls: list[str], exclude: set[str] | None = None) -> None:
    """Best-effort unlink of every uploads-path URL in `urls`. Anything in
    `exclude` is kept (used when a PATCH replaces a file - we keep the new
    URL even if it happens to match an old variant by coincidence)."""
    exclude = exclude or set()
    for u in urls:
        if not u or not isinstance(u, str):
            continue
        if u in exclude:
            continue
        if not u.startswith(UPLOADS_URL_PREFIX):
            continue
        try:
            Path("/app/backend" + u.replace(UPLOADS_URL_PREFIX, "/uploads")).unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Could not unlink media file %s: %s", u, e)


@api_router.get("/media")
async def list_media(section: Optional[str] = Query(None)):
    q = {"is_active": True}
    if section:
        q["section"] = section
    rows = await db.media.find(q, {"_id": 0}).sort("sort_order", 1).to_list(2000)
    return rows


@api_router.get("/admin/media")
async def admin_list_media(section: Optional[str] = Query(None), admin: dict = Depends(get_current_admin)):
    q = {}
    if section:
        q["section"] = section
    rows = await db.media.find(q, {"_id": 0}).sort("sort_order", 1).to_list(2000)
    return rows


@api_router.post("/admin/media")
async def create_media(data: MediaInput, admin: dict = Depends(get_current_admin)):
    doc = data.model_dump()
    lqip = ""
    file_type = doc.get("file_type", "image")
    if file_type == "image":
        new_url, lqip = convert_image_to_webp(doc["file_url"], doc.get("section") or "misc")
        doc["file_url"] = new_url
    elif file_type == "embed":
        # YouTube / Vimeo embed - file_url IS the user-supplied embed URL.
        # Parse provider + id server-side and cache them on the row so the
        # frontend doesn't need to re-parse the URL on every render.
        provider, eid = _parse_embed_url_py(doc.get("file_url", ""))
        if provider and eid:
            doc["embed_provider"] = provider
            doc["embed_id"] = eid
        else:
            raise HTTPException(status_code=400, detail="Unsupported embed URL (YouTube and Vimeo are accepted)")
    doc.update({"id": str(uuid.uuid4()), "created_at": now_iso(), "is_active": True, "lqip": lqip})
    await db.media.insert_one(doc)
    doc.pop("_id", None)
    await schedule_snapshot()
    return doc


@api_router.post("/admin/media/upload")
async def upload_media(
    section: str = Form(...),
    category: str = Form(""),
    alt_text: str = Form(""),
    sort_order: int = Form(0),
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    """
    Streamed binary upload of a single image or video. Used by the bulk
    uploader so the browser never has to hold N base64 strings in memory.
    Each request handles one file end-to-end, freeing memory immediately.
    """
    is_video = (file.content_type or "").startswith("video/")
    raw = await file.read()
    thumb_url = ""
    srcset: dict[str, str] = {}
    try:
        if is_video:
            section_dir = UPLOADS_DIR / section
            section_dir.mkdir(parents=True, exist_ok=True)
            # Preserve the original extension where sensible; default to .mp4.
            ext = ".mp4"
            for guess in (".mp4", ".mov", ".webm", ".m4v"):
                if (file.filename or "").lower().endswith(guess):
                    ext = guess
                    break
            filename = f"{uuid.uuid4().hex}{ext}"
            out_path = section_dir / filename
            out_path.write_bytes(raw)
            file_url = f"{UPLOADS_URL_PREFIX}/{section}/{filename}"
            # Run ffmpeg to grab a poster frame so the gallery and admin tile
            # can render an actual still instead of a broken <img>.
            thumb_url, lqip = _extract_video_thumb(out_path, section)
            file_type = "video"
        else:
            file_url, lqip, srcset, avif_srcset = _encode_webp_to_disk(raw, section)
            file_type = "image"
    finally:
        # Free the raw bytes ASAP — important when uploading many large files.
        del raw

    doc = {
        "id": str(uuid.uuid4()),
        "section": section,
        "file_url": file_url,
        "srcset": srcset,
        "avif_srcset": avif_srcset if file_type == "image" else {},
        "thumb_url": thumb_url,
        "file_type": file_type,
        "caption": "",
        "alt_text": alt_text or "",
        "category": category or "",
        "sort_order": sort_order,
        "is_active": True,
        "lqip": lqip,
        "created_at": now_iso(),
    }
    await db.media.insert_one(doc)
    doc.pop("_id", None)
    if section == "hero":
        await regenerate_hero_preload()
    await schedule_snapshot()
    return doc


@api_router.patch("/admin/media/{mid}")
async def update_media(mid: str, data: MediaUpdate, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        return {"message": "Nothing to update"}
    # If a fresh file is being uploaded (data URL), convert it to a disk-backed
    # file. Images become responsive WebP variants (with a fresh srcset so the
    # public <img srcset> never keeps pointing at the OLD photo); videos are
    # written to disk and get a poster frame.
    old_files: list[str] = []
    if _looks_like_data_url(update.get("file_url")):
        existing = await db.media.find_one({"id": mid}, {"_id": 0})
        old_files = _media_doc_file_urls(existing or {})
        section = (existing or {}).get("section") or "misc"
        header = update["file_url"].split(",", 1)[0]
        ftype = update.get("file_type") or ("video" if header.startswith("data:video/") else (existing or {}).get("file_type")) or "image"
        if ftype == "video":
            new_url, thumb_url, lqip = convert_video_data_url(update["file_url"], section)
            update["file_url"] = new_url
            update["thumb_url"] = thumb_url
            update["lqip"] = lqip
            update["srcset"] = {}
            update["file_type"] = "video"
        else:
            new_url, lqip, srcset = convert_image_data_url(update["file_url"], section)
            update["file_url"] = new_url
            update["lqip"] = lqip
            update["srcset"] = srcset
            update["thumb_url"] = ""
            update["file_type"] = "image"
    res = await db.media.update_one({"id": mid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Media not found")
    # Wipe the previous file variants from disk now that the row points at
    # the new ones. Excludes the new file_url just in case (paranoia).
    if old_files:
        _unlink_media_files(old_files, exclude={update.get("file_url", "")})
    existing = await db.media.find_one({"id": mid}, {"section": 1, "_id": 0})
    if existing and existing.get("section") == "hero":
        await regenerate_hero_preload()
    await schedule_snapshot()
    return {"message": "Updated"}


@api_router.delete("/admin/media/{mid}")
async def delete_media(mid: str, admin: dict = Depends(get_current_admin)):
    existing = await db.media.find_one({"id": mid}, {"_id": 0})
    await db.media.delete_one({"id": mid})
    # Best-effort cleanup of the underlying webp/avif/mp4 variants so we
    # don't leak orphan files on disk every time the admin removes a photo.
    if existing:
        _unlink_media_files(_media_doc_file_urls(existing))
    if existing and existing.get("section") == "hero":
        await regenerate_hero_preload()
    await schedule_snapshot()
    return {"message": "Removed"}


# Manual snapshot trigger — handy when the operator wants to force-save right
# before committing to git. The endpoint also returns the counts so the admin
# UI can confirm what was captured.
@api_router.post("/admin/snapshot/save")
async def save_snapshot_now(admin: dict = Depends(get_current_admin)):
    counts = await _write_snapshot_now()
    return {"message": "Snapshot saved.", "counts": counts, "path": str(SNAPSHOT_FILE)}


@api_router.get("/admin/snapshot/status")
async def snapshot_status(admin: dict = Depends(get_current_admin)):
    if not SNAPSHOT_FILE.is_file():
        return {"exists": False}
    st = SNAPSHOT_FILE.stat()
    return {
        "exists": True,
        "path": str(SNAPSHOT_FILE),
        "size_bytes": st.st_size,
        "modified_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
    }


# ----------------------------- Settings -----------------------------
@api_router.get("/settings")
async def get_settings():
    rows = await db.site_settings.find({}, {"_id": 0}).to_list(200)
    return {r["key"]: r["value"] for r in rows}


@api_router.put("/admin/settings")
async def update_settings(data: SettingsUpdate, admin: dict = Depends(get_current_admin)):
    for key, value in data.settings.items():
        await db.site_settings.update_one({"key": key},
                                          {"$set": {"key": key, "value": value, "updated_at": now_iso()}},
                                          upsert=True)
    await schedule_snapshot()
    return {"message": "Your changes have been saved."}


# ----------------------------- Content (editable copy) -----------------------------
@api_router.get("/content")
async def get_content():
    rows = await db.content.find({}, {"_id": 0, "key": 1, "value": 1}).to_list(5000)
    return {r["key"]: r["value"] for r in rows}


@api_router.get("/admin/content")
async def admin_list_content(admin: dict = Depends(get_current_admin)):
    rows = await db.content.find({}, {"_id": 0}).to_list(5000)
    groups = {}
    for r in rows:
        # Infer group from the key prefix when the document doesn't carry one
        # explicitly (the live-site sync + admin bulk-update only round-trip
        # {key, value}, so the stored `group` field often gets dropped). All
        # of our keys follow `<group>.<rest>` so a prefix lookup is the most
        # reliable source of truth.
        key = r["key"]
        explicit = r.get("group")
        if explicit:
            g = explicit
        elif "." in key:
            g = key.split(".", 1)[0]
        else:
            g = "general"
        groups.setdefault(g, []).append({
            "key": key,
            "value": r.get("value", ""),
            "type": r.get("type", "text"),
            "label": r.get("label", key),
        })
    for g in groups:
        groups[g].sort(key=lambda x: x["key"])
    return groups


@api_router.put("/admin/content")
async def admin_update_content(data: ContentBulkUpdate, admin: dict = Depends(get_current_admin)):
    updated = 0
    for item in data.items:
        res = await db.content.update_one(
            {"key": item.key},
            {"$set": {"value": item.value, "updated_at": now_iso()}},
            upsert=True,
        )
        if res.modified_count or res.upserted_id:
            updated += 1
    # Keep the AI-search feed (llms.txt) in lockstep with the live content.
    # Cheap (one Mongo read + two small disk writes) so we just await it.
    await regenerate_llm_feeds()
    await schedule_snapshot()
    return {"message": "Your changes have been saved.", "updated": updated}


# ----------------------------- Gallery categories -----------------------------
DEFAULT_GALLERY_CATEGORIES = ["Maleny Retreats", "Across Australia", "Across the World"]


async def _read_gallery_categories() -> List[str]:
    row = await db.site_settings.find_one({"key": "gallery_categories"})
    if row and isinstance(row.get("value"), list):
        return [str(c).strip() for c in row["value"] if str(c).strip()]
    return list(DEFAULT_GALLERY_CATEGORIES)


@api_router.get("/gallery-categories")
async def get_gallery_categories():
    """Public read for the gallery filter pills. Returns the admin-managed
    category list (the legacy 'All' pill has been removed by product design;
    the first category is the default selected one on page load)."""
    return await _read_gallery_categories()


@api_router.put("/admin/gallery-categories")
async def update_gallery_categories(data: GalleryCategoriesUpdate, admin: dict = Depends(get_current_admin)):
    # Normalise: strip, drop empties, drop "All" (reserved), de-dup case-insensitively.
    seen = {}
    cleaned = []
    for raw in data.categories:
        c = str(raw).strip()
        if not c or c.lower() == "all":
            continue
        if c.lower() in seen:
            continue
        seen[c.lower()] = c
        cleaned.append(c)
    await db.site_settings.update_one(
        {"key": "gallery_categories"},
        {"$set": {"key": "gallery_categories", "value": cleaned}},
        upsert=True,
    )
    await schedule_snapshot()
    return {"categories": cleaned}


class CategoryRename(BaseModel):
    old: str
    new: str


@api_router.post("/admin/gallery-categories/rename")
async def rename_gallery_category(data: CategoryRename, admin: dict = Depends(get_current_admin)):
    """Rename a category AND update every media item that referenced it.
    Falls back to a no-op if the names match or the old name is missing."""
    old = data.old.strip()
    new = data.new.strip()
    if not old or not new or old == new:
        return {"updated_items": 0}
    cats = await _read_gallery_categories()
    cats = [new if c == old else c for c in cats]
    # De-dup if the new name collided with an existing one.
    seen, deduped = set(), []
    for c in cats:
        if c.lower() in seen:
            continue
        seen.add(c.lower())
        deduped.append(c)
    await db.site_settings.update_one(
        {"key": "gallery_categories"},
        {"$set": {"value": deduped}},
        upsert=True,
    )
    res = await db.media.update_many({"category": old}, {"$set": {"category": new}})
    await schedule_snapshot()
    return {"updated_items": res.modified_count, "categories": deduped}


@api_router.get("/admin/stats")
async def stats(admin: dict = Depends(get_current_admin)):
    total_media = await db.media.count_documents({"is_active": True})
    gallery = await db.media.count_documents({"section": "gallery", "is_active": True})
    charity = await db.media.count_documents({"section": "charity", "is_active": True})
    hero = await db.media.count_documents({"section": "hero", "is_active": True})
    total_sub = await db.contact_submissions.count_documents({})
    unread = await db.contact_submissions.count_documents({"status": "new"})
    leads = await db.leads.count_documents({})
    journeys = await db.journeys.count_documents({"is_active": True})
    return {"total_media": total_media, "gallery": gallery, "charity": charity,
            "hero": hero, "total_submissions": total_sub, "unread_submissions": unread,
            "leads": leads, "journeys": journeys}


# ============================== Journeys (trip cards on /pricing) ==============
# Editable from /admin/journeys. Each journey is a card on the public Pricing
# page. Operator can add new trips, edit existing, upload a downloadable PDF
# itinerary. Field shape matches the legacy hardcoded JOURNEYS list so the
# public component renders identically after migration.

ITINERARY_DIR = UPLOADS_DIR / "itineraries"
ITINERARY_DIR.mkdir(parents=True, exist_ok=True)
MAX_ITINERARY_BYTES = 25 * 1024 * 1024  # 25 MB hard cap


class JourneyInput(BaseModel):
    name: str
    region: str = ""
    nights: str = ""
    dates: str = ""
    priceFrom: str = ""
    priceUnit: str = ""
    priceNote: str = ""
    popular: bool = False
    summary: str = ""
    includes: List[str] = Field(default_factory=list)
    excludes: List[str] = Field(default_factory=list)  # C4 — What's Not Included
    highlights: List[str] = Field(default_factory=list)  # Z1 — Tour highlights (sidebar checkmark list on /tours/<slug>)
    cta: str = "Enquire"
    is_active: bool = True
    # B1 additions - drive the new /tours/<slug> sub-pages and the nav dropdown.
    slug: str = ""                 # if blank, auto-generated from `name`
    hero_media_id: str = ""        # links to media.id; empty means use a placeholder
    body_html: str = ""            # LEGACY (B1) - kept for backward compat. B2 splits this into 3 fields below.
    seo_title: str = ""            # <title> tag; falls back to name when blank
    seo_description: str = ""      # meta description; falls back to summary when blank
    status: str = "published"      # "draft" or "published" - drafts hidden from public
    type: str = "tour"             # "tour" or "retreat" - retreats live at /corporate-retreats/<slug>
    # B2 additions
    gallery_media_ids: List[str] = Field(default_factory=list)  # ordered list of media.id values for the photo grid
    description_html: str = ""     # primary sub-page body (replaces body_html). TipTap rich-text.
    itinerary_html: str = ""       # optional itinerary section, rendered below description with an H3 divider
    practical_html: str = ""       # optional practical info section, rendered below itinerary with an H3 divider
    preview_token: str = ""        # short random string; when set, allows preview of drafts via ?preview=<token>
    # C5 — "More Details" rich-text content block on the tour sub-page.
    # Sits above the price + CTA so a media-rich destination description
    # surfaces before the visitor is asked to act. TipTap-authored HTML,
    # supports inline images via the existing /api/admin/blog/image pipe.
    more_details_html: str = ""


class JourneyUpdate(BaseModel):
    # All optional — caller sends only fields they want to change.
    name: Optional[str] = None
    region: Optional[str] = None
    nights: Optional[str] = None
    dates: Optional[str] = None
    priceFrom: Optional[str] = None
    priceUnit: Optional[str] = None
    priceNote: Optional[str] = None
    popular: Optional[bool] = None
    summary: Optional[str] = None
    includes: Optional[List[str]] = None
    excludes: Optional[List[str]] = None  # C4 — What's Not Included
    highlights: Optional[List[str]] = None  # Z1 — Tour highlights (sidebar checkmark list on /tours/<slug>)
    cta: Optional[str] = None
    is_active: Optional[bool] = None
    slug: Optional[str] = None
    hero_media_id: Optional[str] = None
    body_html: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    # B2 additions
    gallery_media_ids: Optional[List[str]] = None
    description_html: Optional[str] = None
    itinerary_html: Optional[str] = None
    practical_html: Optional[str] = None
    preview_token: Optional[str] = None
    # C5 additions
    more_details_html: Optional[str] = None


class JourneyReorder(BaseModel):
    ids: List[str]


def _journey_view(doc: dict) -> dict:
    """Drop internal Mongo `_id` before returning to the client."""
    doc.pop("_id", None)
    return doc


# ---- Slug helpers (B1 - sub-pages at /tours/<slug>) -------------------------
import re as _re_slug

def _slugify(text: str) -> str:
    """Slugify to a-z0-9-, collapse repeats, max 80 chars. Strict so URLs are
    stable across browsers and case-insensitive lookups never collide."""
    if not text:
        return ""
    s = text.strip().lower()
    s = _re_slug.sub(r"[^a-z0-9]+", "-", s)
    s = _re_slug.sub(r"-+", "-", s).strip("-")
    return s[:80]


async def _unique_slug(base: str, exclude_id: Optional[str] = None) -> str:
    """Return `base` if free, else base-2, base-3, ... Skip the row with
    `exclude_id` (used on PATCH so a row doesn't collide with itself)."""
    if not base:
        base = "tour"
    candidate = base
    i = 2
    while True:
        q = {"slug": candidate}
        if exclude_id:
            q["id"] = {"$ne": exclude_id}
        existing = await db.journeys.find_one(q, {"_id": 0, "id": 1})
        if not existing:
            return candidate
        candidate = f"{base}-{i}"
        i += 1


@api_router.get("/journeys")
async def list_journeys(include_drafts: bool = False, type: Optional[str] = None):
    """Public list of active journeys, sorted by `sort_order`. The /pricing
    page and the Tours nav dropdown both consume this. By default drafts and
    inactive rows are hidden; set `include_drafts=true` from authenticated
    admin contexts only. The optional `type` param filters to a single
    journey type (e.g. `type=tour` for the tours dropdown, `type=retreat`
    for the corporate retreats dropdown)."""
    query: dict = {"is_active": True}
    if not include_drafts:
        # status field may be missing on legacy rows - allow both
        query["$or"] = [{"status": "published"}, {"status": {"$exists": False}}]
    if type:
        # Legacy rows pre-B1 have no `type` field — treat them as "tour".
        if type == "tour":
            query["$and"] = [{"$or": [{"type": "tour"}, {"type": {"$exists": False}}]}]
        else:
            query["type"] = type
    out = []
    cursor = db.journeys.find(query).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_journey_view(row))
    return out


@api_router.get("/tours/{slug}")
async def get_tour_by_slug(slug: str, preview: Optional[str] = None):
    """Public single-tour fetch by slug. Used by /tours/<slug> detail page.
    Drafts and inactive rows are 404'd so unpublished work never leaks,
    UNLESS the caller provides a `?preview=<token>` query param that
    matches the row's stored `preview_token` — in that case drafts are
    returned so the admin can review before publishing. Filters by
    `type="tour"` (legacy rows with no type are treated as tours)."""
    # First locate the row by slug + type filter, regardless of status.
    doc = await db.journeys.find_one({
        "slug": slug,
        "is_active": True,
        "$or": [{"type": "tour"}, {"type": {"$exists": False}}],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Tour not found")
    # If status is draft, require a matching preview token.
    if doc.get("status") == "draft":
        token = (doc.get("preview_token") or "").strip()
        if not preview or not token or preview != token:
            raise HTTPException(status_code=404, detail="Tour not found")
    return _journey_view(doc)


@api_router.get("/retreats")
async def list_retreats(include_drafts: bool = False):
    """Public list of active corporate retreats. Mirrors the structure of
    GET /api/journeys but pre-filters to `type="retreat"` so the retreats
    dropdown and /corporate-retreats index never accidentally surface a
    tour. Drafts are hidden by default."""
    query: dict = {"is_active": True, "type": "retreat"}
    if not include_drafts:
        query["$or"] = [{"status": "published"}, {"status": {"$exists": False}}]
    out = []
    cursor = db.journeys.find(query).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_journey_view(row))
    return out


@api_router.get("/retreats/{slug}")
async def get_retreat_by_slug(slug: str, preview: Optional[str] = None):
    """Public single-retreat fetch by slug. Used by /corporate-retreats/<slug>
    detail page. Drafts are 404'd unless a matching preview token is
    supplied. Filters by `type="retreat"`."""
    doc = await db.journeys.find_one({
        "slug": slug,
        "is_active": True,
        "type": "retreat",
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Retreat not found")
    if doc.get("status") == "draft":
        token = (doc.get("preview_token") or "").strip()
        if not preview or not token or preview != token:
            raise HTTPException(status_code=404, detail="Retreat not found")
    return _journey_view(doc)


@api_router.get("/admin/journeys")
async def admin_list_journeys(admin: dict = Depends(get_current_admin)):
    out = []
    cursor = db.journeys.find({}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_journey_view(row))
    return out


@api_router.post("/admin/journeys")
async def admin_create_journey(data: JourneyInput, admin: dict = Depends(get_current_admin)):
    next_order = await db.journeys.count_documents({})
    payload = data.model_dump()
    base_slug = _slugify(payload.get("slug") or payload.get("name") or "")
    payload["slug"] = await _unique_slug(base_slug or "tour")
    doc = {
        "id": str(uuid.uuid4()),
        **payload,
        "itinerary_url": "",
        "itinerary_filename": "",
        "sort_order": next_order,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.journeys.insert_one(doc)
    await schedule_snapshot()
    return _journey_view(doc)


@api_router.patch("/admin/journeys/{jid}")
async def admin_update_journey(jid: str, data: JourneyUpdate, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        return {"message": "Nothing to update"}
    if "slug" in update:
        update["slug"] = await _unique_slug(_slugify(update["slug"]) or "tour", exclude_id=jid)
    elif "name" in update:
        # If the name changed but no explicit slug was provided AND the current
        # row has no slug yet, derive one. Existing slugs are NOT auto-rewritten
        # on name change because that would break inbound links and SEO.
        existing = await db.journeys.find_one({"id": jid}, {"slug": 1, "_id": 0})
        if existing and not (existing.get("slug") or "").strip():
            update["slug"] = await _unique_slug(_slugify(update["name"]) or "tour", exclude_id=jid)
    update["updated_at"] = now_iso()
    res = await db.journeys.update_one({"id": jid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Journey not found")
    await schedule_snapshot()
    return {"message": "Updated"}


@api_router.delete("/admin/journeys/{jid}")
async def admin_delete_journey(jid: str, admin: dict = Depends(get_current_admin)):
    # Best-effort: remove the PDF too if one exists, so we don't leave orphans.
    existing = await db.journeys.find_one({"id": jid}, {"itinerary_url": 1, "_id": 0})
    if existing and existing.get("itinerary_url"):
        try:
            local = "/app/backend" + existing["itinerary_url"].replace("/api/uploads", "/uploads")
            Path(local).unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Could not unlink itinerary file: %s", e)
    res = await db.journeys.delete_one({"id": jid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Journey not found")
    await schedule_snapshot()
    return {"message": "Removed"}


@api_router.post("/admin/journeys/reorder")
async def admin_reorder_journeys(data: JourneyReorder, admin: dict = Depends(get_current_admin)):
    for i, jid in enumerate(data.ids):
        await db.journeys.update_one({"id": jid}, {"$set": {"sort_order": i, "updated_at": now_iso()}})
    await schedule_snapshot()
    return {"message": "Reordered", "count": len(data.ids)}


@api_router.post("/admin/journeys/{jid}/duplicate")
async def admin_duplicate_journey(jid: str, admin: dict = Depends(get_current_admin)):
    """Clone an existing journey into a fresh draft. The new row gets a new
    UUID, status='draft', and a unique slug derived from the existing slug
    with `-copy` appended (collision-safe via `_unique_slug`). All other
    fields are copied verbatim — the operator can then tweak and publish."""
    src = await db.journeys.find_one({"id": jid}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Journey not found")
    base_slug = (src.get("slug") or _slugify(src.get("name") or "tour")) + "-copy"
    new_slug = await _unique_slug(base_slug)
    next_order = await db.journeys.count_documents({})
    clone = {**src}
    clone["id"] = str(uuid.uuid4())
    clone["slug"] = new_slug
    clone["status"] = "draft"
    clone["popular"] = False                 # don't double up the highlight
    clone["preview_token"] = secrets.token_urlsafe(16)
    clone["itinerary_url"] = ""              # PDFs aren't physically copied; operator can re-upload
    clone["itinerary_filename"] = ""
    clone["sort_order"] = next_order
    clone["name"] = (src.get("name") or "") + " (copy)"
    clone["created_at"] = now_iso()
    clone["updated_at"] = now_iso()
    await db.journeys.insert_one(clone)
    await schedule_snapshot()
    return _journey_view(clone)


@api_router.post("/admin/journeys/{jid}/preview-token")
async def admin_regenerate_preview_token(jid: str, admin: dict = Depends(get_current_admin)):
    """Regenerate the preview token for a journey row. Used by the admin
    "Preview" button — clicking it invalidates the previous link and
    returns a fresh one. The token is stored on the row and validated by
    GET /api/tours/{slug}?preview=<token> (or /api/retreats)."""
    existing = await db.journeys.find_one({"id": jid}, {"_id": 0, "id": 1, "slug": 1, "type": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Journey not found")
    token = secrets.token_urlsafe(16)
    await db.journeys.update_one(
        {"id": jid},
        {"$set": {"preview_token": token, "updated_at": now_iso()}},
    )
    await schedule_snapshot()
    return {
        "preview_token": token,
        "slug": existing.get("slug") or "",
        "type": existing.get("type") or "tour",
    }


@api_router.post("/admin/journeys/{jid}/itinerary")
async def admin_upload_itinerary(
    jid: str,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    """Attach a downloadable PDF itinerary to a journey card. Replaces any
    previous file on this journey (the old PDF is deleted so we don't
    accumulate orphans on disk)."""
    journey = await db.journeys.find_one({"id": jid}, {"_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    # Hard-limit size before reading into memory.
    if file.size and file.size > MAX_ITINERARY_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_ITINERARY_BYTES // (1024*1024)} MB)")

    content_type = (file.content_type or "").lower()
    filename_lower = (file.filename or "").lower()
    if "pdf" not in content_type and not filename_lower.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted for itineraries")

    raw = await file.read()
    if len(raw) > MAX_ITINERARY_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_ITINERARY_BYTES // (1024*1024)} MB)")

    # Save to disk with a uuid filename; remember the original filename so the
    # download link in the browser uses a friendly name.
    safe_name = "".join(c for c in (file.filename or "itinerary.pdf") if c.isalnum() or c in (" ", ".", "_", "-")).strip() or "itinerary.pdf"
    if not safe_name.lower().endswith(".pdf"):
        safe_name = safe_name + ".pdf"
    fid = uuid.uuid4().hex
    out_path = ITINERARY_DIR / f"{fid}.pdf"
    out_path.write_bytes(raw)

    # Remove the previous PDF (if any) to keep the disk tidy.
    prev = (journey or {}).get("itinerary_url")
    if prev:
        try:
            old_local = "/app/backend" + prev.replace("/api/uploads", "/uploads")
            Path(old_local).unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Could not unlink old itinerary file: %s", e)

    new_url = f"{UPLOADS_URL_PREFIX}/itineraries/{fid}.pdf"
    await db.journeys.update_one(
        {"id": jid},
        {"$set": {
            "itinerary_url": new_url,
            "itinerary_filename": safe_name,
            "updated_at": now_iso(),
        }},
    )
    await schedule_snapshot()
    return {"itinerary_url": new_url, "itinerary_filename": safe_name}


@api_router.delete("/admin/journeys/{jid}/itinerary")
async def admin_remove_itinerary(jid: str, admin: dict = Depends(get_current_admin)):
    journey = await db.journeys.find_one({"id": jid}, {"itinerary_url": 1, "_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if journey.get("itinerary_url"):
        try:
            local = "/app/backend" + journey["itinerary_url"].replace("/api/uploads", "/uploads")
            Path(local).unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Could not unlink itinerary file: %s", e)
    await db.journeys.update_one(
        {"id": jid},
        {"$set": {"itinerary_url": "", "itinerary_filename": "", "updated_at": now_iso()}},
    )
    await schedule_snapshot()
    return {"message": "Itinerary removed"}


@api_router.post("/admin/avif/backfill")
async def admin_avif_backfill(
    sections: str = "",
    admin: dict = Depends(get_current_admin),
):
    """Scan backend/uploads/ and generate .avif siblings for every .webp
    that doesn't already have one. Updates each media row's avif_srcset
    accordingly.

    `sections` is a comma-separated whitelist (e.g. "hero,pillars-0").
    Empty means all sections.

    Heavy operation — recommended to run once per server after deploying
    the AVIF code, then it's a no-op on subsequent calls."""
    if not _AVIF_OK:
        raise HTTPException(status_code=503, detail="pillow-avif-plugin not installed on this server")

    targets = [s.strip() for s in sections.split(",") if s.strip()] if sections else None
    converted = 0
    skipped = 0
    failed = 0
    sections_seen = set()

    for section_dir in sorted(UPLOADS_DIR.iterdir()):
        if not section_dir.is_dir():
            continue
        if section_dir.name == "itineraries":
            continue
        if targets and section_dir.name not in targets:
            continue
        sections_seen.add(section_dir.name)
        for webp in section_dir.glob("*.webp"):
            avif = webp.with_suffix(".avif")
            if avif.exists():
                skipped += 1
                continue
            try:
                with Image.open(webp) as im:
                    im = im.convert("RGB")
                    suffix = webp.stem.rsplit("-", 1)[-1] if "-" in webp.stem else ""
                    q = 48 if suffix == "sm" else 52 if suffix == "md" else 55
                    im.save(avif, "AVIF", quality=q, speed=6)
                converted += 1
            except Exception as e:
                logger.warning("AVIF backfill failed for %s: %s", webp.name, e)
                failed += 1

    # After encoding the files, walk the media collection and fill in
    # avif_srcset for any row whose webp variants now have AVIF siblings.
    docs_updated = 0
    async for row in db.media.find({"file_type": "image"}, {"_id": 0, "id": 1, "srcset": 1, "avif_srcset": 1}):
        srcset = row.get("srcset") or {}
        existing = row.get("avif_srcset") or {}
        new_avif = dict(existing)
        for w, url in srcset.items():
            if not isinstance(url, str) or not url.endswith(".webp"):
                continue
            avif_url = url[:-len(".webp")] + ".avif"
            local = "/app/backend" + avif_url.replace(UPLOADS_URL_PREFIX, "/uploads")
            if Path(local).exists():
                new_avif[w] = avif_url
        if new_avif != existing:
            await db.media.update_one({"id": row["id"]}, {"$set": {"avif_srcset": new_avif}})
            docs_updated += 1

    return {
        "converted": converted,
        "skipped_existing": skipped,
        "failed": failed,
        "media_docs_updated": docs_updated,
        "sections": sorted(sections_seen),
    }


# ============================== About Us (text blocks) ========================
# Editable blocks that build the body of the public /about page. Each block is
# either a heading or a paragraph; the operator can add, remove, reorder and
# toggle visibility from /admin/about.


class AboutBlockInput(BaseModel):
    kind: str = "paragraph"          # "paragraph" | "heading"
    text: str = ""
    is_visible: bool = True


class AboutBlockUpdate(BaseModel):
    kind: Optional[str] = None
    text: Optional[str] = None
    is_visible: Optional[bool] = None


class AboutBlockReorder(BaseModel):
    ids: List[str]


def _about_view(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@api_router.get("/about-blocks")
async def list_about_blocks():
    out = []
    cursor = db.about_blocks.find({"is_visible": True}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_about_view(row))
    return out


@api_router.get("/admin/about-blocks")
async def admin_list_about_blocks(admin: dict = Depends(get_current_admin)):
    out = []
    cursor = db.about_blocks.find({}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_about_view(row))
    return out


@api_router.post("/admin/about-blocks")
async def admin_create_about_block(data: AboutBlockInput, admin: dict = Depends(get_current_admin)):
    next_order = await db.about_blocks.count_documents({})
    doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "sort_order": next_order,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.about_blocks.insert_one(doc)
    await schedule_snapshot()
    return _about_view(doc)


@api_router.patch("/admin/about-blocks/{bid}")
async def admin_update_about_block(bid: str, data: AboutBlockUpdate, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        return {"message": "Nothing to update"}
    update["updated_at"] = now_iso()
    res = await db.about_blocks.update_one({"id": bid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Block not found")
    await schedule_snapshot()
    return {"message": "Updated"}


@api_router.delete("/admin/about-blocks/{bid}")
async def admin_delete_about_block(bid: str, admin: dict = Depends(get_current_admin)):
    res = await db.about_blocks.delete_one({"id": bid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Block not found")
    await schedule_snapshot()
    return {"message": "Removed"}


@api_router.post("/admin/about-blocks/reorder")
async def admin_reorder_about_blocks(data: AboutBlockReorder, admin: dict = Depends(get_current_admin)):
    for i, bid in enumerate(data.ids):
        await db.about_blocks.update_one({"id": bid}, {"$set": {"sort_order": i, "updated_at": now_iso()}})
    await schedule_snapshot()
    return {"message": "Reordered", "count": len(data.ids)}


# ============================== Home FAQs ("Questions Gently Answered") =======
# Accordion of Q&A pairs shown on the home page. Standalone collection so the
# admin can add, edit, delete, reorder and toggle visibility without touching
# the older /pricing-page FAQs (those still live as `faqs.N.q/a` content keys).


class HomeFaqInput(BaseModel):
    question: str = ""
    answer: str = ""           # HTML (rich text) so links/formatting survive
    is_visible: bool = True


class HomeFaqUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    is_visible: Optional[bool] = None


class HomeFaqReorder(BaseModel):
    ids: List[str]


def _faq_view(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@api_router.get("/home-faqs")
async def list_home_faqs():
    out = []
    cursor = db.home_faqs.find({"is_visible": True}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_faq_view(row))
    return out


@api_router.get("/admin/home-faqs")
async def admin_list_home_faqs(admin: dict = Depends(get_current_admin)):
    out = []
    cursor = db.home_faqs.find({}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_faq_view(row))
    return out


@api_router.post("/admin/home-faqs")
async def admin_create_home_faq(data: HomeFaqInput, admin: dict = Depends(get_current_admin)):
    next_order = await db.home_faqs.count_documents({})
    doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "sort_order": next_order,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.home_faqs.insert_one(doc)
    await schedule_snapshot()
    return _faq_view(doc)


@api_router.patch("/admin/home-faqs/{fid}")
async def admin_update_home_faq(fid: str, data: HomeFaqUpdate, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        return {"message": "Nothing to update"}
    update["updated_at"] = now_iso()
    res = await db.home_faqs.update_one({"id": fid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")
    await schedule_snapshot()
    return {"message": "Updated"}


@api_router.delete("/admin/home-faqs/{fid}")
async def admin_delete_home_faq(fid: str, admin: dict = Depends(get_current_admin)):
    res = await db.home_faqs.delete_one({"id": fid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")
    await schedule_snapshot()
    return {"message": "Removed"}


@api_router.post("/admin/home-faqs/reorder")
async def admin_reorder_home_faqs(data: HomeFaqReorder, admin: dict = Depends(get_current_admin)):
    for i, fid in enumerate(data.ids):
        await db.home_faqs.update_one({"id": fid}, {"$set": {"sort_order": i, "updated_at": now_iso()}})
    await schedule_snapshot()
    return {"message": "Reordered", "count": len(data.ids)}


# ============================== Home Content Sections =========================
# Long-form rich-text sections rendered on the home page. Each section has its
# own H2 heading and HTML body, can be reordered and toggled visible/hidden.


class HomeSectionInput(BaseModel):
    heading: str = ""
    body: str = ""             # HTML (rich text)
    is_visible: bool = True
    # Phase 3: optional ordered list of media.id values for an inline gallery
    # rendered above the body via the shared <SwipeableMedia> component.
    media_ids: List[str] = Field(default_factory=list)


class HomeSectionUpdate(BaseModel):
    heading: Optional[str] = None
    body: Optional[str] = None
    is_visible: Optional[bool] = None
    media_ids: Optional[List[str]] = None


class HomeSectionReorder(BaseModel):
    ids: List[str]


def _section_view(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@api_router.get("/home-sections")
async def list_home_sections():
    out = []
    cursor = db.home_sections.find({"is_visible": True}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_section_view(row))
    return out


@api_router.get("/admin/home-sections")
async def admin_list_home_sections(admin: dict = Depends(get_current_admin)):
    out = []
    cursor = db.home_sections.find({}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_section_view(row))
    return out


@api_router.post("/admin/home-sections")
async def admin_create_home_section(data: HomeSectionInput, admin: dict = Depends(get_current_admin)):
    next_order = await db.home_sections.count_documents({})
    payload = data.model_dump()
    # Phase 3: ensure media_ids defaults to [] (Pydantic Field handles new POSTs,
    # this keeps shape consistent even if older clients omit the field entirely).
    if "media_ids" not in payload or payload.get("media_ids") is None:
        payload["media_ids"] = []
    doc = {
        "id": str(uuid.uuid4()),
        **payload,
        "sort_order": next_order,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.home_sections.insert_one(doc)
    await schedule_snapshot()
    return _section_view(doc)


@api_router.patch("/admin/home-sections/{sid}")
async def admin_update_home_section(sid: str, data: HomeSectionUpdate, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        return {"message": "Nothing to update"}
    update["updated_at"] = now_iso()
    res = await db.home_sections.update_one({"id": sid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    await schedule_snapshot()
    return {"message": "Updated"}


@api_router.delete("/admin/home-sections/{sid}")
async def admin_delete_home_section(sid: str, admin: dict = Depends(get_current_admin)):
    res = await db.home_sections.delete_one({"id": sid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    await schedule_snapshot()
    return {"message": "Removed"}


@api_router.post("/admin/home-sections/reorder")
async def admin_reorder_home_sections(data: HomeSectionReorder, admin: dict = Depends(get_current_admin)):
    for i, sid in enumerate(data.ids):
        await db.home_sections.update_one({"id": sid}, {"$set": {"sort_order": i, "updated_at": now_iso()}})
    await schedule_snapshot()
    return {"message": "Reordered", "count": len(data.ids)}


# ============================== Stories (mini blog on /about) ==================
# Trip stories shown as cards on the public /about page. Cover images are
# uploaded via the dedicated endpoint below — they live in /uploads/stories/
# but DO NOT get a row in the media collection (so they don't pollute the
# gallery / hero pickers).


class StoryInput(BaseModel):
    title: str
    region: str = ""
    date: str = ""               # free-form, e.g. "March 2025"
    excerpt: str = ""
    body: str = ""
    is_visible: bool = True


class StoryUpdate(BaseModel):
    title: Optional[str] = None
    region: Optional[str] = None
    date: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    is_visible: Optional[bool] = None


class StoryReorder(BaseModel):
    ids: List[str]


def _story_view(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@api_router.get("/stories")
async def list_stories():
    out = []
    cursor = db.stories.find({"is_visible": True}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_story_view(row))
    return out


@api_router.get("/admin/stories")
async def admin_list_stories(admin: dict = Depends(get_current_admin)):
    out = []
    cursor = db.stories.find({}).sort([("sort_order", 1), ("created_at", 1)])
    async for row in cursor:
        out.append(_story_view(row))
    return out


@api_router.post("/admin/stories")
async def admin_create_story(data: StoryInput, admin: dict = Depends(get_current_admin)):
    next_order = await db.stories.count_documents({})
    doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "cover_url": "",
        "cover_srcset": {},
        "cover_avif_srcset": {},
        "cover_lqip": "",
        "sort_order": next_order,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.stories.insert_one(doc)
    await schedule_snapshot()
    return _story_view(doc)


@api_router.patch("/admin/stories/{sid}")
async def admin_update_story(sid: str, data: StoryUpdate, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        return {"message": "Nothing to update"}
    update["updated_at"] = now_iso()
    res = await db.stories.update_one({"id": sid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Story not found")
    await schedule_snapshot()
    return {"message": "Updated"}


@api_router.delete("/admin/stories/{sid}")
async def admin_delete_story(sid: str, admin: dict = Depends(get_current_admin)):
    # Best-effort cleanup of the cover image so we don't leak files.
    existing = await db.stories.find_one({"id": sid}, {"_id": 0, "cover_url": 1, "cover_srcset": 1})
    if existing:
        urls = [existing.get("cover_url", "")]
        urls.extend((existing.get("cover_srcset") or {}).values())
        for u in urls:
            if u and u.startswith(UPLOADS_URL_PREFIX):
                try:
                    Path("/app/backend" + u.replace(UPLOADS_URL_PREFIX, "/uploads")).unlink(missing_ok=True)
                except Exception as e:
                    logger.warning("Could not unlink story cover %s: %s", u, e)
    res = await db.stories.delete_one({"id": sid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Story not found")
    await schedule_snapshot()
    return {"message": "Removed"}


@api_router.post("/admin/stories/reorder")
async def admin_reorder_stories(data: StoryReorder, admin: dict = Depends(get_current_admin)):
    for i, sid in enumerate(data.ids):
        await db.stories.update_one({"id": sid}, {"$set": {"sort_order": i, "updated_at": now_iso()}})
    await schedule_snapshot()
    return {"message": "Reordered", "count": len(data.ids)}


@api_router.post("/admin/stories/{sid}/cover")
async def admin_upload_story_cover(
    sid: str,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    """Encode the uploaded image to WebP (+ responsive variants + AVIF) and
    attach the URLs to the story. Replaces any previous cover on this story."""
    story = await db.stories.find_one({"id": sid}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Cover must be an image")

    raw = await file.read()
    try:
        file_url, lqip, srcset, avif_srcset = _encode_webp_to_disk(raw, "stories")
    finally:
        del raw

    # Remove the previous cover files (if any).
    prev_urls = [story.get("cover_url", "")] + list((story.get("cover_srcset") or {}).values()) + list((story.get("cover_avif_srcset") or {}).values())
    for u in prev_urls:
        if u and u.startswith(UPLOADS_URL_PREFIX) and u != file_url:
            try:
                Path("/app/backend" + u.replace(UPLOADS_URL_PREFIX, "/uploads")).unlink(missing_ok=True)
            except Exception as e:
                logger.warning("Could not unlink old story cover %s: %s", u, e)

    await db.stories.update_one(
        {"id": sid},
        {"$set": {
            "cover_url": file_url,
            "cover_srcset": srcset,
            "cover_avif_srcset": avif_srcset,
            "cover_lqip": lqip,
            "updated_at": now_iso(),
        }},
    )
    await schedule_snapshot()
    return {"cover_url": file_url, "cover_srcset": srcset, "cover_avif_srcset": avif_srcset, "cover_lqip": lqip}


# ============================== Blog (standalone /blog) =======================
# Public blog separate from Stories on the About page. Posts have a slug,
# featured image (optional), excerpt, rich-text HTML body, draft/published
# status and a free-form published_date string. Posts are auto-sorted
# newest-first by published_date.

import re as _re_slug


class BlogPostInput(BaseModel):
    title: str
    published_date: str = ""        # ISO date string (YYYY-MM-DD); blank => "today"
    excerpt: str = ""
    body: str = ""                  # HTML produced by the admin TipTap editor
    status: str = "draft"           # "draft" | "published"
    # Phase 3: optional ordered list of media.id values for a multi-cover
    # gallery shown at the top of the public post via <SwipeableMedia>.
    # When empty, the existing single `featured_url` is used as the cover.
    media_ids: List[str] = Field(default_factory=list)


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    published_date: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    status: Optional[str] = None
    media_ids: Optional[List[str]] = None


def _slugify(text: str) -> str:
    s = _re_slug.sub(r"[^a-zA-Z0-9\s-]", "", (text or "").lower()).strip()
    s = _re_slug.sub(r"[\s_-]+", "-", s).strip("-")
    return s or uuid.uuid4().hex[:8]


async def _unique_blog_slug(base_slug: str, exclude_id: Optional[str] = None) -> str:
    slug = base_slug
    n = 2
    while True:
        q = {"slug": slug}
        if exclude_id:
            q["id"] = {"$ne": exclude_id}
        existing = await db.blog_posts.find_one(q, {"_id": 0, "id": 1})
        if not existing:
            return slug
        slug = f"{base_slug}-{n}"
        n += 1


def _blog_view(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _normalise_published_date(value: Optional[str]) -> str:
    """Accept YYYY-MM-DD or anything else; if blank, default to today."""
    if value and isinstance(value, str) and value.strip():
        return value.strip()
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@api_router.get("/blog")
async def list_blog_posts():
    """Public list of published posts, newest first."""
    out = []
    cursor = db.blog_posts.find({"status": "published"}).sort([
        ("published_date", -1), ("created_at", -1),
    ])
    async for row in cursor:
        out.append(_blog_view(row))
    return out


@api_router.get("/blog/{slug}")
async def get_blog_post(slug: str):
    """Public single post by slug (or id fallback)."""
    row = await db.blog_posts.find_one({"slug": slug, "status": "published"})
    if not row:
        row = await db.blog_posts.find_one({"id": slug, "status": "published"})
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return _blog_view(row)


@api_router.get("/admin/blog")
async def admin_list_blog_posts(admin: dict = Depends(get_current_admin)):
    out = []
    cursor = db.blog_posts.find({}).sort([
        ("published_date", -1), ("created_at", -1),
    ])
    async for row in cursor:
        out.append(_blog_view(row))
    return out


@api_router.get("/admin/blog/{pid}")
async def admin_get_blog_post(pid: str, admin: dict = Depends(get_current_admin)):
    row = await db.blog_posts.find_one({"id": pid})
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return _blog_view(row)


@api_router.post("/admin/blog")
async def admin_create_blog_post(data: BlogPostInput, admin: dict = Depends(get_current_admin)):
    title = data.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    status = data.status if data.status in ("draft", "published") else "draft"
    slug = await _unique_blog_slug(_slugify(title))
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "title": title,
        "published_date": _normalise_published_date(data.published_date),
        "excerpt": data.excerpt or "",
        "body": data.body or "",
        "status": status,
        "featured_url": "",
        "featured_srcset": {},
        "featured_avif_srcset": {},
        "featured_lqip": "",
        "media_ids": list(data.media_ids or []),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.blog_posts.insert_one(doc)
    await schedule_snapshot()
    return _blog_view(doc)


@api_router.patch("/admin/blog/{pid}")
async def admin_update_blog_post(pid: str, data: BlogPostUpdate, admin: dict = Depends(get_current_admin)):
    existing = await db.blog_posts.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Post not found")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        return {"message": "Nothing to update"}
    if "title" in update:
        new_title = update["title"].strip()
        if not new_title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        update["title"] = new_title
        if _slugify(existing.get("title", "")) != _slugify(new_title):
            update["slug"] = await _unique_blog_slug(_slugify(new_title), exclude_id=pid)
    if "status" in update and update["status"] not in ("draft", "published"):
        raise HTTPException(status_code=400, detail="Status must be draft or published")
    if "published_date" in update:
        update["published_date"] = _normalise_published_date(update["published_date"])
    update["updated_at"] = now_iso()
    await db.blog_posts.update_one({"id": pid}, {"$set": update})
    await schedule_snapshot()
    return {"message": "Updated", "slug": update.get("slug") or existing.get("slug")}


@api_router.delete("/admin/blog/{pid}")
async def admin_delete_blog_post(pid: str, admin: dict = Depends(get_current_admin)):
    existing = await db.blog_posts.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Post not found")
    # Best-effort featured image cleanup.
    urls = [existing.get("featured_url", "")]
    urls.extend((existing.get("featured_srcset") or {}).values())
    urls.extend((existing.get("featured_avif_srcset") or {}).values())
    for u in urls:
        if u and u.startswith(UPLOADS_URL_PREFIX):
            try:
                Path("/app/backend" + u.replace(UPLOADS_URL_PREFIX, "/uploads")).unlink(missing_ok=True)
            except Exception as e:
                logger.warning("Could not unlink blog featured image %s: %s", u, e)
    await db.blog_posts.delete_one({"id": pid})
    await schedule_snapshot()
    return {"message": "Removed"}


@api_router.post("/admin/blog/{pid}/cover")
async def admin_upload_blog_cover(
    pid: str,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    """Encode the featured image to WebP (+ AVIF + srcset + LQIP) and attach
    the URLs to the post. Replaces any previous cover on this post."""
    post = await db.blog_posts.find_one({"id": pid}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Featured image must be an image")
    raw = await file.read()
    try:
        file_url, lqip, srcset, avif_srcset = _encode_webp_to_disk(raw, "blog")
    finally:
        del raw

    prev_urls = (
        [post.get("featured_url", "")]
        + list((post.get("featured_srcset") or {}).values())
        + list((post.get("featured_avif_srcset") or {}).values())
    )
    for u in prev_urls:
        if u and u.startswith(UPLOADS_URL_PREFIX) and u != file_url:
            try:
                Path("/app/backend" + u.replace(UPLOADS_URL_PREFIX, "/uploads")).unlink(missing_ok=True)
            except Exception as e:
                logger.warning("Could not unlink old blog cover %s: %s", u, e)

    await db.blog_posts.update_one(
        {"id": pid},
        {"$set": {
            "featured_url": file_url,
            "featured_srcset": srcset,
            "featured_avif_srcset": avif_srcset,
            "featured_lqip": lqip,
            "updated_at": now_iso(),
        }},
    )
    await schedule_snapshot()
    return {
        "featured_url": file_url,
        "featured_srcset": srcset,
        "featured_avif_srcset": avif_srcset,
        "featured_lqip": lqip,
    }


@api_router.post("/admin/blog/image")
async def admin_upload_blog_body_image(
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    """Upload an inline image from the rich-text editor's image button.
    Returns a URL that the editor inserts as an <img src=...>."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Inline content must be an image")
    raw = await file.read()
    try:
        file_url, _lqip, _srcset, _avif = _encode_webp_to_disk(raw, "blog")
    finally:
        del raw
    return {"url": file_url}



@api_router.get("/")
async def root():
    return {"message": "Once Were Wild API"}


app.include_router(api_router)


# Long-lived cache headers on uploaded media. Filenames are UUIDs, so the
# content for a given URL never changes — perfect candidates for `immutable`.
# Without this, the browser revalidates every reload and the hero appears
# blank until the round-trip completes.
class _ImmutableStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        if resp.status_code == 200:
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return resp


# Serve uploaded media. Lives under /uploads/{section}/{uuid}.webp and is
# routed through the same /api ingress prefix so the frontend's
# REACT_APP_BACKEND_URL keeps working without extra config.
app.mount("/api/uploads", _ImmutableStaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------- LLM-friendly text feeds -----------------------------
# llms.txt is the de facto convention for AI search engines (ChatGPT search,
# Perplexity, Claude search, Gemini, Google SGE, etc.). It's plain markdown
# served at the site root that summarises the brand, products and pages.
# We regenerate both files from the live content + media every time the
# admin saves text, so they always reflect what humans see on the site.

def _content_map_from_rows(rows: list) -> dict:
    return {r["key"]: r.get("value", "") for r in rows}


def _strip_md_markers(text: str) -> str:
    # Single-pass cleanup of the *italic* markers used in titles.
    return (text or "").replace("*", "").strip()


async def _build_llms_short() -> str:
    rows = await db.content.find({}, {"_id": 0, "key": 1, "value": 1}).to_list(5000)
    c = _content_map_from_rows(rows)
    settings_rows = await db.site_settings.find({}, {"_id": 0, "key": 1, "value": 1}).to_list(200)
    s = {r["key"]: r["value"] for r in settings_rows}

    brand_name = c.get("brand.name", "Once Were Wild")
    brand_sub = c.get("brand.sub", "Travel")
    tagline = _strip_md_markers(c.get("brand.tagline", "Rediscover the woman who was always wild at heart."))
    manifesto = _strip_md_markers(c.get("home.manifesto.body.1", ""))

    contact_email = s.get("contact_email", "info@oncewerewild.com")
    contact_phone = s.get("contact_phone", "+61 457 999 411")
    contact_address = s.get("contact_address", "584 Maleny-Montville Rd, Balmoral Ridge QLD 4552")
    contact_hours = s.get("contact_hours", "Monday to Friday, 9am to 5pm AEST")

    journey_ids = ("maleny", "small-group", "corporate")
    journeys_md = []
    for jid in journey_ids:
        name = c.get(f"journeys.{jid}.name")
        if not name:
            continue
        summary = _strip_md_markers(c.get(f"journeys.{jid}.summary", ""))
        nights = c.get(f"journeys.{jid}.nights", "")
        dates = c.get(f"journeys.{jid}.dates", "")
        price = c.get(f"journeys.{jid}.priceFrom", "")
        journeys_md.append(
            f"- **{name}** ({nights}, {dates}) — {summary} Starting {price}."
        )

    return f"""# {brand_name} {brand_sub}

> {tagline}

{manifesto}

A richer machine-readable version of this site is at /llms-full.txt. The site
is also represented in standard schema.org JSON-LD inside every HTML page.

## Pages

- [Home]({SITE_URL}/) — brand story, manifesto, featured journeys.
- [Journeys and pricing]({SITE_URL}/pricing) — all journey tiers, inclusions,
  dates and pricing, plus a frequently asked questions accordion.
- [Gallery]({SITE_URL}/gallery) — photography and short clips from past
  journeys, filterable by region.
- [Contact]({SITE_URL}/contact) — enquiry form, phone, email and live map.

## Core offerings

{chr(10).join(journeys_md) if journeys_md else "_See the journeys page for the current catalogue._"}

## Contact

- Email: {contact_email}
- Phone: {contact_phone}
- Address: {contact_address}
- Hours: {contact_hours}

## Notes for AI agents

- Group sizes are intentionally small, typically 6 to 8 women.
- Most journeys are all inclusive of accommodation, meals as specified,
  wine with dinner, guided experiences and ground transport.
- Maleny is in the Sunshine Coast hinterland, about a 90 minute drive
  from Brisbane.
- A 20 percent deposit secures a place. Balance is due 60 days prior to
  departure. Travel insurance is strongly advised.
- This site is operated by humans. Email is the best channel for enquiries.

_Last refreshed: {now_iso()}_
"""


async def _build_llms_full() -> str:
    rows = await db.content.find({}, {"_id": 0}).to_list(5000)
    groups: dict[str, list] = {}
    for r in rows:
        groups.setdefault(r.get("group", "general"), []).append(r)

    faqs = sorted([r for r in rows if r["key"].startswith("faqs.")], key=lambda r: r["key"])
    out: list[str] = ["# Once Were Wild Travel — full content feed", "",
                      f"_Generated for AI search agents. Last refreshed: {now_iso()}_", ""]

    # Frequently asked questions
    qa = {}
    for r in faqs:
        idx, field = r["key"].split(".")[1], r["key"].split(".")[2]
        qa.setdefault(idx, {})[field] = _strip_md_markers(r.get("value", ""))
    if qa:
        out.append("## Frequently asked questions")
        for idx in sorted(qa, key=int):
            q = qa[idx].get("q"); a = qa[idx].get("a")
            if q and a:
                out.append(f"\n### {q}\n\n{a}")
        out.append("")

    # Journey details
    journey_ids = ("maleny", "small-group", "corporate")
    out.append("## Journeys")
    cmap = _content_map_from_rows(rows)
    for jid in journey_ids:
        name = cmap.get(f"journeys.{jid}.name")
        if not name:
            continue
        out.append(f"\n### {name}")
        out.append(f"- Region: {cmap.get(f'journeys.{jid}.region', '')}")
        out.append(f"- Nights: {cmap.get(f'journeys.{jid}.nights', '')}")
        out.append(f"- Dates: {cmap.get(f'journeys.{jid}.dates', '')}")
        out.append(f"- Price from: {cmap.get(f'journeys.{jid}.priceFrom', '')}")
        out.append(f"- Price unit: {cmap.get(f'journeys.{jid}.priceUnit', '')}")
        out.append(f"- Note: {cmap.get(f'journeys.{jid}.priceNote', '')}")
        out.append(f"- Summary: {_strip_md_markers(cmap.get(f'journeys.{jid}.summary', ''))}")
        includes = (cmap.get(f"journeys.{jid}.includes", "") or "").split("|")
        out.append("- Includes:")
        for inc in includes:
            inc = inc.strip()
            if inc:
                out.append(f"  - {inc}")

    # Home manifesto + pillars
    if "home.manifesto.heading" in cmap:
        out.append("\n## Manifesto")
        out.append(f"\n**{_strip_md_markers(cmap['home.manifesto.heading'])}**")
        for i in range(5):
            body = cmap.get(f"home.manifesto.body.{i}")
            if body:
                out.append(f"\n{_strip_md_markers(body)}")

    if any(k.startswith("pillars.") for k in cmap):
        out.append("\n## How we travel")
        for i in range(3):
            t = cmap.get(f"pillars.{i}.title")
            d = cmap.get(f"pillars.{i}.desc")
            if t and d:
                out.append(f"\n### {t}\n\n{_strip_md_markers(d)}")

    return "\n".join(out) + "\n"


async def regenerate_llm_feeds() -> None:
    """Write llms.txt and llms-full.txt to the served public folder so the
    React static handler returns them at the site root. Safe to call as
    often as we like — both files overwrite atomically."""
    try:
        short = await _build_llms_short()
        full = await _build_llms_full()
        for d in (PUBLIC_DIR, PUBLIC_MIRROR):
            if d is None:
                continue
            (d / "llms.txt").write_text(short, encoding="utf-8")
            (d / "llms-full.txt").write_text(full, encoding="utf-8")
    except Exception as e:
        logger.warning("regenerate_llm_feeds failed: %s", e)


# ------- Static hero preload (LCP optimisation) -------
# Browsers can only discover the LCP image once React mounts and the
# /api/media call resolves — which is far too late for a sub-2.5s LCP.
# So on every hero change we replace a marker meta tag in index.html
# with an actual <link rel="preload"> (with imagesrcset!). Now the
# browser sees the preload at HTML parse time and the hero image is in
# flight before the React bundle finishes downloading.
#
# Why a meta tag (not an HTML comment)?  Because CRA's HTML minifier
# strips comments at build time. A meta tag survives and is also
# semantically harmless on its own.

import re

HERO_MARKER_RE = re.compile(
    r'(<link rel="preload" as="image"[^>]*data-hero-preload[^>]*>\s*)*'
    r'<meta name="x-hero-preload" content="[^"]*"\s*/?>',
    re.IGNORECASE,
)


async def regenerate_hero_preload() -> None:
    try:
        # Pick the first active hero, sorted just like the public endpoint.
        cursor = db.media.find({"section": "hero", "is_active": True}).sort([
            ("sort_order", 1), ("created_at", 1),
        ])
        first = await cursor.to_list(1)

        preload_tag = ""
        if first:
            row = first[0]
            srcset = row.get("srcset") or {}
            default = row.get("file_url", "")
            if srcset and default:
                srcset_attr = ", ".join(f"{u} {w}" for w, u in srcset.items())
                preload_tag = (
                    f'<link rel="preload" as="image" data-hero-preload '
                    f'href="{default}" '
                    f'imagesrcset="{srcset_attr}" '
                    f'imagesizes="100vw" '
                    f'fetchpriority="high">'
                )
            elif default:
                preload_tag = (
                    f'<link rel="preload" as="image" data-hero-preload '
                    f'href="{default}" fetchpriority="high">'
                )
        replacement = (preload_tag + '<meta name="x-hero-preload" content="generated" />')

        for d in (PUBLIC_DIR, PUBLIC_MIRROR):
            if d is None:
                continue
            index_path = d / "index.html"
            if not index_path.is_file():
                continue
            html = index_path.read_text(encoding="utf-8")
            new_html, n = HERO_MARKER_RE.subn(replacement, html, count=1)
            if n and new_html != html:
                index_path.write_text(new_html, encoding="utf-8")
                logger.info("Regenerated hero preload in %s", index_path)
    except Exception as e:
        logger.warning("regenerate_hero_preload failed: %s", e)


# ----------------------------- Seeding -----------------------------
DEFAULT_SETTINGS = {
    "contact_email": "info@oncewerewild.com",
    "contact_phone": "+61 457 999 411",
    "contact_address": "584 Maleny-Montville Rd, Balmoral Ridge QLD 4552",
    "contact_hours": "Monday to Friday, 9am to 5pm AEST",
    "footer_tagline": "Slow journeys for women ready to rediscover their wild.",
    "instagram_url": "https://instagram.com/oncewerewild",
    "facebook_url": "https://facebook.com/oncewerewild",
}


def _c(group, key, value, label=None, type_="text"):
    return {"group": group, "key": key, "value": value, "label": label or key, "type": type_}


DEFAULT_CONTENT = [
    # Brand
    _c("brand", "brand.name", "Once Were Wild", "Brand name"),
    _c("brand", "brand.sub", "Travel", "Brand suffix"),
    _c("brand", "brand.tagline", "Rediscover the woman who was always wild at heart.", "Brand tagline (hero)"),

    # Navigation (5 routes: Home / Journeys / Gallery / About / Blog)
    _c("nav", "nav.0.label", "Home", "Nav 1 label"),
    _c("nav", "nav.0.to", "/", "Nav 1 link"),
    _c("nav", "nav.1.label", "Tours", "Nav 2 label"),
    _c("nav", "nav.1.to", "/pricing", "Nav 2 link"),
    _c("nav", "nav.2.label", "Gallery", "Nav 3 label"),
    _c("nav", "nav.2.to", "/gallery", "Nav 3 link"),
    _c("nav", "nav.3.label", "About Us", "Nav 4 label"),
    _c("nav", "nav.3.to", "/about", "Nav 4 link"),
    _c("nav", "nav.4.label", "Blog", "Nav 5 label"),
    _c("nav", "nav.4.to", "/blog", "Nav 5 link"),
    _c("nav", "nav.cta", "Get In Touch", "Header CTA label"),

    # Home — hero buttons
    _c("home", "home.hero.cta_primary", "Explore Experiences", "Hero primary button"),
    _c("home", "home.hero.cta_secondary", "Join a Retreat", "Hero secondary button"),
    # C7 — optional overlay tagline for the hero photo carousel. Blank by
    # default so the carousel is pure photo. Client can add a short
    # brand-wide line via /admin/website-text → Home group.
    _c("home", "home.hero.tagline", "", "Optional hero overlay text (leave blank for pure photo carousel)"),

    # Home — Manifesto
    _c("home", "home.manifesto.eyebrow", "Our Belief", "Manifesto eyebrow"),
    _c("home", "home.manifesto.heading", "There is a version of you who has been waiting.", "Manifesto heading"),
    _c("home", "home.manifesto.body.0",
       "She has earned every grey hair, every passport stamp, every hard won lesson. She is ready to move.",
       "Manifesto paragraph 1", "richtext"),
    _c("home", "home.manifesto.body.1",
       "We design personal, unprocessed and unrushed journeys that invite you to rediscover your inner wild. Grounded in connection and shaped by untamed roads and shared tables, we turn a lifetime of lived travel into your next unforgettable story.",
       "Manifesto paragraph 2", "richtext"),
    _c("home", "home.manifesto.body.2",
       "We do not do tourist tracks or checkbox travel. We curate intimate, small group journeys for women ready to step out of their comfort zones and dive into the world.",
       "Manifesto paragraph 3", "richtext"),
    _c("home", "home.manifesto.pullQuote", "This is travel lived, and life truly loved.", "Manifesto pull quote"),

    # Home — "From the Journal" strip (3 latest blog posts)
    _c("home", "home.journal.eyebrow", "From the Journal", "Journal strip eyebrow"),
    _c("home", "home.journal.title", "Stories from *the road less travelled.*",
       "Journal strip title (italic part wrapped in asterisks)", "richtext"),
    _c("home", "home.journal.intro",
       "Field notes and slow reflections from journeys taken between scheduled tours.",
       "Journal strip intro"),
    _c("home", "home.journal.cta", "Read the journal", "Journal strip CTA button label"),

    # Home — "Questions Gently Answered" FAQ accordion
    _c("home", "home.faq.eyebrow", "Common Questions", "Home FAQ eyebrow"),
    _c("home", "home.faq.heading", "Questions Gently Answered", "Home FAQ section heading (above the accordion)"),
    _c("home", "home.faq.intro",
       "Quiet answers to the things most often asked before stepping into a journey with us.",
       "Home FAQ intro paragraph"),

    # Home — Extended rich-text content sections
    _c("home", "home.content.eyebrow", "More to know", "Home content sections eyebrow"),
    _c("home", "home.content.title", "Slow stories, *gently shared.*",
       "Home content sections title (italic part wrapped in asterisks)", "richtext"),

    # Home — Minimal Tours CTA card (replaces older repeated Tasmania + Maleny marketing blocks)
    _c("home", "home.tours_cta.eyebrow", "Our Journeys", "Tours CTA card eyebrow"),
    _c("home", "home.tours_cta.title", "Slow tours, *soulful retreats.*",
       "Tours CTA card title (italic part wrapped in asterisks)", "richtext"),
    _c("home", "home.tours_cta.body",
       "Small group journeys across Australia and beyond, plus immersive Maleny retreats in the Sunshine Coast hinterland.",
       "Tours CTA card body"),
    _c("home", "home.tours_cta.button", "Explore all tours", "Tours CTA card button label"),

    # Home — Pillars (3)
    _c("home", "home.pillars.eyebrow", "How We Travel", "Pillars eyebrow"),
    _c("home", "home.pillars.title", "Three ways to step *beyond the familiar.*", "Pillars title"),
    _c("home", "pillars.0.title", "Small Group Journeys", "Pillar 1 title"),
    _c("home", "pillars.0.desc", "Carefully curated adventures for women who want depth over distance, and meaning over mere sightseeing.", "Pillar 1 description", "richtext"),
    _c("home", "pillars.0.cta", "View journeys", "Pillar 1 CTA"),
    _c("home", "pillars.0.to", "/pricing", "Pillar 1 link"),
    _c("home", "pillars.1.title", "Maleny Retreats", "Pillar 2 title"),
    _c("home", "pillars.1.desc", "Nestled in the Sunshine Coast hinterland, our Maleny retreats are spaces to breathe, to create, and to return to yourself.", "Pillar 2 description", "richtext"),
    _c("home", "pillars.1.cta", "Discover the retreat", "Pillar 2 CTA"),
    _c("home", "pillars.1.to", "/pricing", "Pillar 2 link"),
    _c("home", "pillars.2.title", "Corporate and Custom", "Pillar 3 title"),
    _c("home", "pillars.2.desc", "Your team, your story, your experience. We build journeys from scratch around what matters to your people.", "Pillar 3 description", "richtext"),
    _c("home", "pillars.2.cta", "Start a conversation", "Pillar 3 CTA"),
    _c("home", "pillars.2.to", "/contact", "Pillar 3 link"),

    # Home — Immersive teaser
    _c("home", "home.immersive.eyebrow", "Featured Journey", "Immersive eyebrow"),
    _c("home", "home.immersive.heading", "Slow and Soulful Tasmania", "Immersive heading"),
    _c("home", "home.immersive.body", "Twenty three nights of untamed coastline, pristine wilderness and farm to table flavour, shared with a small circle of like minded women.", "Immersive body", "richtext"),
    _c("home", "home.immersive.cta", "Discover More", "Immersive CTA"),

    # Home — Maleny feature
    _c("home", "home.maleny.eyebrow", "Immersive Retreats", "Maleny eyebrow"),
    _c("home", "home.maleny.heading", "Maleny, where you arrive and exhale.", "Maleny heading"),
    _c("home", "home.maleny.body",
       "Tucked behind the Sunshine Coast and rising 425 metres above the sea, Maleny and Montville are the calm behind the coast, the green behind the gold. A six night immersion of making, moving and nourishing, never rushed, always intentional. You simply arrive, and breathe out.",
       "Maleny body", "richtext"),
    _c("home", "home.maleny.tags", "create,explore,feel,taste,transform", "Maleny tags (comma separated)"),
    _c("home", "home.maleny.cta", "Explore the retreat", "Maleny CTA"),

    # Home — Testimonials
    _c("home", "home.testimonials.eyebrow", "In Their Words", "Testimonials eyebrow"),
    _c("home", "home.testimonials.title", "Stories that linger long *after the road.*", "Testimonials title"),
    _c("home", "testimonials.0.quote", "Your awesome guides, Barbara and Adele, effervescent and meticulous in equal measure.", "Testimonial 1 quote", "richtext"),
    _c("home", "testimonials.0.author", "A travelling guest", "Testimonial 1 author"),
    _c("home", "testimonials.1.quote", "Barbara and Adele, your exceptional guides, combine lively energy with a meticulous approach to travel.", "Testimonial 2 quote", "richtext"),
    _c("home", "testimonials.1.author", "Western Australia journey", "Testimonial 2 author"),
    _c("home", "testimonials.2.quote", "I came to wander and I left changed. The pace, the women, the land. All of it stayed with me.", "Testimonial 3 quote", "richtext"),
    _c("home", "testimonials.2.author", "Maleny retreat guest", "Testimonial 3 author"),
    _c("home", "testimonials.3.quote", "Nothing to organise, nothing to prove. Just space to feel like myself again.", "Testimonial 4 quote", "richtext"),
    _c("home", "testimonials.3.author", "Creative immersion guest", "Testimonial 4 author"),

    # Pricing page
    _c("pricing", "pricing.hero.eyebrow", "Journeys and Investment", "Pricing eyebrow"),
    _c("pricing", "pricing.hero.title", "Where will you *go next?*", "Pricing title"),
    _c("pricing", "pricing.hero.intro", "Every journey is all inclusive, intimate and thoughtfully paced. Here is what it takes to join us.", "Pricing intro", "richtext"),
    _c("pricing", "pricing.popular_label", "Most Popular", "Most popular ribbon"),
    _c("pricing", "pricing.fine_print_title", "The fine print", "Fine print eyebrow"),
    _c("pricing", "pricing.fine_print",
       "A 20 percent deposit secures your place. The balance is due 60 days prior to departure. Cancellations from booking to 60 days prior incur a $500 fee. Cancellations within 60 days are non refundable unless we are able to rebook your place, where a $500 fee applies. Travel insurance is strongly advised.",
       "Fine print body", "richtext"),
    _c("pricing", "pricing.faq.eyebrow", "Good to Know", "FAQ eyebrow"),
    _c("pricing", "pricing.faq.title", "Questions, *gently answered.*", "FAQ title"),
    _c("pricing", "pricing.faq.footer_note", "Still wondering if this is for you? It probably is.", "FAQ closing line"),
    _c("pricing", "pricing.faq.cta", "Book a discovery call", "FAQ CTA"),

    # Journeys (3)
    _c("journeys", "journeys.maleny.name", "Maleny Creative Immersion", "Maleny — name"),
    _c("journeys", "journeys.maleny.region", "Sunshine Coast Hinterland", "Maleny — region"),
    _c("journeys", "journeys.maleny.nights", "6 nights", "Maleny — nights"),
    _c("journeys", "journeys.maleny.dates", "22 to 28 November 2026, or 28 November to 4 December 2026", "Maleny — dates"),
    _c("journeys", "journeys.maleny.priceFrom", "From $4,200", "Maleny — price from"),
    _c("journeys", "journeys.maleny.priceUnit", "per person, twin share", "Maleny — price unit"),
    _c("journeys", "journeys.maleny.priceNote", "Single from $4,750 per person", "Maleny — price note"),
    _c("journeys", "journeys.maleny.summary", "A curated small group immersion blending art, nature, rest and shared experience.", "Maleny — summary", "richtext"),
    _c("journeys", "journeys.maleny.cta", "Enquire about Maleny", "Maleny — CTA"),
    _c("journeys", "journeys.maleny.includes",
       "Premium, peaceful accommodation|Bespoke dining by an accomplished chef|Australian wines paired with dinner|Master artisan creative workshops|Guided hinterland walks and experiences|All transportation and daily flow",
       "Maleny — includes (one per line, use | to separate)", "richtext"),

    _c("journeys", "journeys.small-group.name", "Slow and Soulful Journeys", "Slow & Soulful — name"),
    _c("journeys", "journeys.small-group.region", "Tasmania and Western Australia", "Slow & Soulful — region"),
    _c("journeys", "journeys.small-group.nights", "12 to 23 nights", "Slow & Soulful — nights"),
    _c("journeys", "journeys.small-group.dates", "January and February 2027", "Slow & Soulful — dates"),
    _c("journeys", "journeys.small-group.priceFrom", "From $7,950", "Slow & Soulful — price from"),
    _c("journeys", "journeys.small-group.priceUnit", "per person, 12 night tours", "Slow & Soulful — price unit"),
    _c("journeys", "journeys.small-group.priceNote", "Full 23 night odyssey from $15,200, GST included", "Slow & Soulful — price note"),
    _c("journeys", "journeys.small-group.summary", "Intimate small group odysseys across Australia's most breathtaking states, six to eight women.", "Slow & Soulful — summary", "richtext"),
    _c("journeys", "journeys.small-group.cta", "Enquire about a journey", "Slow & Soulful — CTA"),
    _c("journeys", "journeys.small-group.includes",
       "Twin share accommodation throughout|Meals as specified, wine with dinner|All experiences unless marked optional|Farm to table cuisine and local wines|Wildlife, wilderness and cultural discovery|Effervescent, meticulous hosting",
       "Slow & Soulful — includes (use | to separate)", "richtext"),

    _c("journeys", "journeys.corporate.name", "Corporate and Custom", "Corporate — name"),
    _c("journeys", "journeys.corporate.region", "Designed around your people", "Corporate — region"),
    _c("journeys", "journeys.corporate.nights", "Tailored", "Corporate — nights"),
    _c("journeys", "journeys.corporate.dates", "By arrangement", "Corporate — dates"),
    _c("journeys", "journeys.corporate.priceFrom", "Enquire", "Corporate — price from"),
    _c("journeys", "journeys.corporate.priceUnit", "bespoke quotation", "Corporate — price unit"),
    _c("journeys", "journeys.corporate.priceNote", "Custom small group Australian journeys, minimum 7 nights", "Corporate — price note"),
    _c("journeys", "journeys.corporate.summary", "Step out of the noise and into the rainforest. All inclusive retreats built for your team.", "Corporate — summary", "richtext"),
    _c("journeys", "journeys.corporate.cta", "Start a conversation", "Corporate — CTA"),
    _c("journeys", "journeys.corporate.includes",
       "Fully hosted, seamless planning|Custom itinerary from scratch|Private group, families or teams|Maleny corporate rainforest retreats|Celebrations and milestone journeys|Flexible dates and group sizes",
       "Corporate — includes (use | to separate)", "richtext"),

    # FAQs
    _c("faqs", "faqs.0.q", "Who travels with Once Were Wild?", "FAQ 1 — question"),
    _c("faqs", "faqs.0.a", "Our journeys are designed for women, often 45 and beyond, who are curious, independent and ready to step gently out of the everyday. Groups stay small, usually six to eight, so connection comes easily.", "FAQ 1 — answer", "richtext"),
    _c("faqs", "faqs.1.q", "What is included in the price?", "FAQ 2 — question"),
    _c("faqs", "faqs.1.a", "Most journeys are all inclusive of accommodation, meals as specified, wine with dinner, guided experiences and transport. Each journey page lists exactly what is covered so there are no surprises.", "FAQ 2 — answer", "richtext"),
    _c("faqs", "faqs.2.q", "How do I secure my place?", "FAQ 3 — question"),
    _c("faqs", "faqs.2.a", "A 20 percent deposit reserves your spot. The balance is due 60 days before departure. We will guide you gently through every step once you register your interest.", "FAQ 3 — answer", "richtext"),
    _c("faqs", "faqs.3.q", "Can you cater for dietary needs?", "FAQ 4 — question"),
    _c("faqs", "faqs.3.a", "We thoughtfully accommodate most dietary needs. As our shared menus include animal proteins we cannot cater for vegan diets on the standard retreat, though a dedicated vegan retreat can be arranged with enough interest.", "FAQ 4 — answer", "richtext"),
    _c("faqs", "faqs.4.q", "Do you arrange corporate and private journeys?", "FAQ 5 — question"),
    _c("faqs", "faqs.4.a", "Yes. We build custom small group journeys and corporate retreats from scratch, designed entirely around your people, your story and your dates.", "FAQ 5 — answer", "richtext"),
    _c("faqs", "faqs.5.q", "Is travel insurance required?", "FAQ 6 — question"),
    _c("faqs", "faqs.5.a", "Travel insurance is strongly advised for every guest, to protect you from unexpected situations that may require a change of plans at short notice.", "FAQ 6 — answer", "richtext"),

    # Gallery page
    _c("gallery", "gallery.hero.eyebrow", "The Gallery", "Gallery eyebrow"),
    _c("gallery", "gallery.hero.title", "Moments that linger *long after.*", "Gallery title"),
    _c("gallery", "gallery.hero.intro", "A gathering of light, landscape and laughter from the road. Wander through, and imagine yourself among them.", "Gallery intro", "richtext"),

    # Contact page
    _c("contact", "contact.hero.eyebrow", "Say Hello", "Contact eyebrow"),
    _c("contact", "contact.hero.title", "Let us begin *a conversation.*", "Contact title"),
    _c("contact", "contact.hero.intro", "Tell us where your heart is pointing. We read every message ourselves, and we would love to hear from you.", "Contact intro", "richtext"),
    _c("contact", "contact.info.eyebrow", "Reach us directly", "Contact info eyebrow"),
    _c("contact", "contact.form.submit_idle", "Send message", "Form submit button (idle)"),
    _c("contact", "contact.form.submit_sending", "Sending your message", "Form submit button (sending)"),
    _c("contact", "contact.success.heading", "Thank you.", "Success heading"),
    _c("contact", "contact.success.send_another", "Send another message", "Success CTA"),
    _c("contact", "contact.directions.label", "Get Directions", "Directions button"),

    # Footer
    _c("footer", "footer.explore_label", "Explore", "Footer explore heading"),
    _c("footer", "footer.reach_label", "Reach us", "Footer reach heading"),
    _c("footer", "footer.enquiry_label", "Quick enquiry", "Footer enquiry heading"),
    _c("footer", "footer.enquiry_name_placeholder", "Your name", "Footer name placeholder"),
    _c("footer", "footer.enquiry_email_placeholder", "Your email", "Footer email placeholder"),
    _c("footer", "footer.enquiry_submit", "Send enquiry", "Footer submit"),
    _c("footer", "footer.copyright_suffix", "Slow journeys, wild hearts", "Footer right-side tagline"),

    # ---------------------------------------------------------------
    # SEO + GEO (per-page meta). Each page's <Seo> component reads
    # these from ContentContext so the operator can A/B test titles
    # and descriptions without touching code. Defaults below are
    # keyword-rich for the target Australian women's-travel market.
    # ---------------------------------------------------------------
    _c("seo", "seo.home.title",
       "Women only travel Australia | Slow group tours & Maleny retreat",
       "Home — browser tab title (under 60 characters)"),
    _c("seo", "seo.home.description",
       "Once Were Wild — small group, women-only journeys across Tasmania, "
       "Western Australia and beyond, plus a creative Maleny retreat in the "
       "Sunshine Coast hinterland. Slow travel for women 45+.",
       "Home — meta description (140–160 characters)"),
    _c("seo", "seo.home.keywords",
       "women only travel Australia, women's small group tours, slow travel for women, "
       "Maleny retreat, Sunshine Coast hinterland retreat, women's wellness retreat Queensland, "
       "Tasmania women's tour, Western Australia women's tour, midlife travel women",
       "Home — meta keywords (comma separated)"),

    _c("seo", "seo.pricing.title",
       "Women's small group tours Australia | Tasmania, WA & Maleny pricing",
       "Pricing — browser tab title"),
    _c("seo", "seo.pricing.description",
       "All Once Were Wild journeys for women: 12–23 night small group odysseys "
       "through Tasmania and Western Australia, plus the 6 night Maleny creative "
       "retreat. Inclusions, dates, prices and FAQs in one place.",
       "Pricing — meta description"),
    _c("seo", "seo.pricing.keywords",
       "women's small group tour Australia pricing, Tasmania women's tour cost, "
       "Western Australia women's tour, Maleny creative retreat price, "
       "all inclusive women's tour Australia, slow travel pricing",
       "Pricing — meta keywords"),

    _c("seo", "seo.gallery.title",
       "Once Were Wild Travel gallery | Women's tours of Australia & Maleny",
       "Gallery — browser tab title"),
    _c("seo", "seo.gallery.description",
       "Photographs and short clips from past Once Were Wild journeys — "
       "Tasmania, Western Australia, Sunshine Coast hinterland and beyond. "
       "A glimpse of slow, soulful small group travel for women.",
       "Gallery — meta description"),
    _c("seo", "seo.gallery.keywords",
       "women's tour photography Australia, Tasmania women's tour gallery, "
       "Maleny retreat photos, slow travel gallery, women's small group travel images",
       "Gallery — meta keywords"),

    _c("seo", "seo.contact.title",
       "Contact Once Were Wild Travel | Women's tour and Maleny retreat enquiries",
       "Contact — browser tab title"),
    _c("seo", "seo.contact.description",
       "Speak to the team behind Once Were Wild Travel. Email, phone, the "
       "Maleny office address and a quick enquiry form for women considering "
       "a small group journey or hinterland retreat.",
       "Contact — meta description"),
    _c("seo", "seo.contact.keywords",
       "Once Were Wild contact, women's tour enquiry Australia, Maleny retreat enquiry, "
       "book women's small group tour, Sunshine Coast hinterland retreat booking",
       "Contact — meta keywords"),

    # OG image overrides — leave blank to fall back to the brand logo.
    _c("seo", "seo.home.og_image", "", "Home — Open Graph image URL"),
    _c("seo", "seo.pricing.og_image", "", "Pricing — Open Graph image URL"),
    _c("seo", "seo.gallery.og_image", "", "Gallery — Open Graph image URL"),
    _c("seo", "seo.contact.og_image", "", "Contact — Open Graph image URL"),
]



# Default media bundled with the site. Seeded once into the `media` collection
# so the admin sees exactly what is live and can replace/delete any item.
# Once seeded, the admin owns the records (re-seeding is disabled via a flag).
#
# IMPORTANT: This is the FALLBACK. On fresh deploys the seed() function
# prefers `backend/seed_data/site_snapshot.json` (committed to git on every
# admin write) so the operator's curated site survives container rebuilds
# and `git pull` on the Bluehost VPS. DEFAULT_MEDIA is only used if the
# snapshot is missing (e.g. the very first deploy before any admin edits).
DEFAULT_MEDIA = [
    # Hero slideshow (5)
    {"section": "hero", "file_url": "/assets/images/hero/hero-01.webp", "caption": "Lone tree wrapped in morning fog across the Maleny hinterland", "alt_text": "Lone tree in Maleny fog"},
    {"section": "hero", "file_url": "/assets/images/hero/hero-02.webp", "caption": "A woman pausing to take in a wide rocky coastal view", "alt_text": "Rocky coastal view"},
    {"section": "hero", "file_url": "/assets/images/hero/hero-03.webp", "caption": "A woman among tall gum trees in a tranquil forest", "alt_text": "Tall gum trees"},
    {"section": "hero", "file_url": "/assets/images/hero/hero-04.webp", "caption": "Friends resting together on a timber verandah at golden hour", "alt_text": "Friends on verandah"},
    {"section": "hero", "file_url": "/assets/images/hero/hero-05.webp", "caption": "A quiet passage opening toward the ocean", "alt_text": "Passage toward the ocean"},

    # Gallery (10)
    {"section": "gallery", "file_url": "/assets/images/gallery/gallery-01.webp", "caption": "A quiet moment above the bay", "category": "Across Australia"},
    {"section": "gallery", "file_url": "/assets/images/gallery/gallery-02.webp", "caption": "Standing where the lake meets the range", "category": "Across Australia"},
    {"section": "gallery", "file_url": "/assets/images/gallery/gallery-03.webp", "caption": "Among the old gum trees", "category": "Maleny Retreats"},
    {"section": "gallery", "file_url": "/assets/images/gallery/gallery-04.webp", "caption": "Coastline walk, Broken Head", "category": "Across Australia"},
    {"section": "gallery", "file_url": "/assets/images/gallery/gallery-05.webp", "caption": "Walking the green roads together", "category": "Across the World"},
    {"section": "gallery", "file_url": "/assets/images/gallery/gallery-06.webp", "caption": "Into the wild woodland", "category": "Across Australia"},
    {"section": "gallery", "file_url": "/assets/images/gallery/gallery-07.webp", "caption": "Hands shaping clay in the studio", "category": "Maleny Retreats"},
    {"section": "gallery", "file_url": "/assets/images/gallery/gallery-08.webp", "caption": "A creative workshop in progress", "category": "Maleny Retreats"},
    {"section": "gallery", "file_url": "/assets/images/pillar-retreat.webp", "caption": "The hinterland garden at rest", "category": "Maleny Retreats"},
    {"section": "gallery", "file_url": "/assets/images/charity/charity-01.webp", "caption": "Stillness and breath", "category": "Across the World"},

    # Single-image sections (9)
    {"section": "pillars-0",    "file_url": "/assets/images/hero/hero-03.webp",       "caption": "First pillar card"},
    {"section": "pillars-1",    "file_url": "/assets/images/pillar-retreat.webp",     "caption": "Second pillar card"},
    {"section": "pillars-2",    "file_url": "/assets/images/pillar-corporate.webp",   "caption": "Third pillar card"},
    {"section": "immersive",    "file_url": "/assets/images/hero/hero-05.webp",       "caption": "Featured journey backdrop"},
    {"section": "maleny",       "file_url": "/assets/images/pillar-retreat.webp",     "caption": "Maleny retreat portrait"},
    {"section": "pricing-hero", "file_url": "/assets/images/hero/hero-02.webp",       "caption": "Journeys page hero"},
    {"section": "gallery-hero", "file_url": "/assets/images/gallery/gallery-04.webp", "caption": "Gallery page hero"},
    {"section": "contact-hero", "file_url": "/assets/images/hero/hero-04.webp",       "caption": "Contact page hero"},
    {"section": "contact-bg",   "file_url": "/assets/images/pillar-retreat.webp",     "caption": "Contact form backdrop"},
]


# Default journeys (trip cards on /pricing) — seeded once into the `journeys`
# collection so the operator can edit, add, delete and upload PDF itineraries
# from /admin/journeys. The shape matches the legacy JOURNEYS list in
# frontend/src/data/content.js so the public page renders identically.

# Default home FAQs ("Questions Gently Answered"). Seeded ONCE into the
# `home_faqs` collection. The client edits, reorders and toggles visibility
# from /admin/home-faqs and never gets re-overwritten.
DEFAULT_HOME_FAQS = [
    {"question": "What types of tours do you offer?",
     "answer": "<p>We design slow, small group journeys for women. Our flagship trips run across Tasmania and Western Australia, and we also host immersive creative retreats in the Maleny hinterland on Queensland's Sunshine Coast.</p>"},
    {"question": "Are your tours women-only?",
     "answer": "<p>Yes. Every scheduled departure is curated for women travellers, often aged 45 and beyond, who value depth and connection over crowds and itineraries.</p>"},
    {"question": "How many people are in each group?",
     "answer": "<p>Groups are intentionally small, usually six to eight guests, so the pace stays gentle and conversation has room to breathe.</p>"},
    {"question": "What is included in the tour price?",
     "answer": "<p>Most journeys are all inclusive of accommodation, meals as specified, wine with dinner, guided experiences and ground transport. Each tour page lists exactly what is covered so there are no surprises.</p>"},
    {"question": "What fitness level is required?",
     "answer": "<p>A moderate level of mobility is plenty. We balance gentle walks, rest and beautiful food with the occasional longer hike. If you have any specific concerns, get in touch and we will talk it through.</p>"},
    {"question": "Can I join as a solo traveller?",
     "answer": "<p>Absolutely. Most of our guests arrive solo. Twin share accommodation is the default, and single rooms can be arranged for a supplement on most journeys.</p>"},
    {"question": "How do I book or enquire?",
     "answer": "<p>Use the Get In Touch form on our contact page, or email us directly. We reply personally within a day or two and walk you through every step.</p>"},
    {"question": "What happens if I need to cancel?",
     "answer": "<p>Cancellation terms vary slightly by journey. Travel insurance is strongly advised for every guest and we will share the exact terms when you register your interest.</p>"},
]


# Default home content sections (long-form rich text). Each section becomes
# an H2 + body block on the home page. The client edits these in
# /admin/home-content. Light placeholder text so the page never looks empty.
DEFAULT_HOME_SECTIONS = [
    {
        "heading": "Women's Small Group Travel in Australia",
        "body": "<p>Once Were Wild Travel is built around women who are quietly ready for something deeper than a tour. Our journeys move through Tasmania, Western Australia and the Maleny hinterland, in groups small enough to feel like friends and slow enough to actually arrive.</p><p>Every itinerary is shaped around connection: with the landscape, with the women you travel beside, and with the quieter version of yourself that travel like this tends to bring forward.</p>",
    },
    {
        "heading": "Why Slow Travel?",
        "body": "<p>We believe a journey only really begins when the rush stops. Slow travel is not about fewer experiences, it is about deeper ones: longer stays in fewer places, time for unhurried meals, room for conversation, and space to notice where you are.</p><p>You will not be moved through this country at the pace of a coach tour. You will walk, listen, taste, rest and return home with stories that actually feel like yours.</p>",
    },
    {
        "heading": "Exploring Tasmania with Once Were Wild",
        "body": "<p>Tasmania is the heart of what we do. Twelve and twenty three night odysseys through ancient wilderness, untouched coast and farm to table cellar doors. Wildlife at dawn, fireside dinners at night, and the people who make this island feel like home.</p>",
    },
    {
        "heading": "Our Approach to Travel",
        "body": "<p>Hosted personally, paced gently, and curated for women who want their travel to mean something. We work with people, not numbers; with landscapes, not landmarks; and with time, not tick lists. If that sounds like the kind of journey you have been waiting for, you are exactly where you should be.</p>",
    },
]


DEFAULT_JOURNEYS = [
    {
        "name": "Maleny Creative Immersion",
        "region": "Sunshine Coast Hinterland",
        "nights": "6 nights",
        "dates": "22 to 28 November 2026, or 28 November to 4 December 2026",
        "priceFrom": "From $4,200",
        "priceUnit": "per person, twin share",
        "priceNote": "Single from $4,750 per person",
        "popular": False,
        "summary": "A curated small group immersion blending art, nature, rest and shared experience.",
        "includes": [
            "Premium, peaceful accommodation",
            "Bespoke dining by an accomplished chef",
            "Australian wines paired with dinner",
            "Master artisan creative workshops",
            "Guided hinterland walks and experiences",
            "All transportation and daily flow",
        ],
        "cta": "Enquire about Maleny",
    },
    {
        "name": "Slow and Soulful Journeys",
        "region": "Tasmania and Western Australia",
        "nights": "12 to 23 nights",
        "dates": "January and February 2027",
        "priceFrom": "From $7,950",
        "priceUnit": "per person, 12 night tours",
        "priceNote": "Full 23 night odyssey from $15,200, GST included",
        "popular": True,
        "summary": "Intimate small group odysseys across Australia's most breathtaking states, six to eight women.",
        "includes": [
            "Twin share accommodation throughout",
            "Meals as specified, wine with dinner",
            "All experiences unless marked optional",
            "Farm to table cuisine and local wines",
            "Wildlife, wilderness and cultural discovery",
            "Effervescent, meticulous hosting",
        ],
        "cta": "Enquire about a journey",
    },
    {
        "name": "Corporate and Custom",
        "region": "Designed around your people",
        "nights": "Tailored",
        "dates": "By arrangement",
        "priceFrom": "Enquire",
        "priceUnit": "bespoke quotation",
        "priceNote": "Custom small group Australian journeys, minimum 7 nights",
        "popular": False,
        "summary": "Step out of the noise and into the rainforest. All inclusive retreats built for your team.",
        "includes": [
            "Fully hosted, seamless planning",
            "Custom itinerary from scratch",
            "Private group, families or teams",
            "Maleny corporate rainforest retreats",
            "Celebrations and milestone journeys",
            "Flexible dates and group sizes",
        ],
        "cta": "Start a conversation",
    },
]


# ============================== Snapshot system ===============================
# The MongoDB content (media library, page text, settings) is not in git, so
# a fresh deploy on Bluehost normally boots with stock images. To fix that
# we keep a JSON snapshot of the live site at backend/seed_data/site_snapshot.json
# which IS in git. The snapshot is rewritten after every admin write
# (debounced), and the seed() function loads from it on a fresh DB.
SEED_DATA_DIR = ROOT_DIR / "seed_data"
SNAPSHOT_FILE = SEED_DATA_DIR / "site_snapshot.json"
# Keys in site_settings that should NOT travel between environments (they are
# either runtime flags or contain secrets / per-deploy state).
SNAPSHOT_EXCLUDE_SETTINGS = {
    "media_seeded_v1", "media_recompressed_v2", "media_srcset_v3",
    "snapshot_applied_hash", "snapshot_applied_reason",
}

_snapshot_lock = asyncio.Lock()
_snapshot_task: Optional[asyncio.Task] = None


async def _write_snapshot_now() -> dict:
    """Dump the editable collections (media + content + site_settings +
    gallery categories) to backend/seed_data/site_snapshot.json. Returns
    counts for logging."""
    SEED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    media_docs = []
    async for row in db.media.find({}, {"_id": 0}):
        media_docs.append(row)
    content_docs = []
    async for row in db.content.find({}, {"_id": 0}):
        content_docs.append(row)
    settings_docs = []
    async for row in db.site_settings.find({"key": {"$nin": list(SNAPSHOT_EXCLUDE_SETTINGS)}}, {"_id": 0}):
        settings_docs.append(row)
    journey_docs = []
    async for row in db.journeys.find({}, {"_id": 0}):
        journey_docs.append(row)
    about_docs = []
    async for row in db.about_blocks.find({}, {"_id": 0}):
        about_docs.append(row)
    story_docs = []
    async for row in db.stories.find({}, {"_id": 0}):
        story_docs.append(row)
    blog_docs = []
    async for row in db.blog_posts.find({}, {"_id": 0}):
        blog_docs.append(row)
    home_faq_docs = []
    async for row in db.home_faqs.find({}, {"_id": 0}):
        home_faq_docs.append(row)
    home_section_docs = []
    async for row in db.home_sections.find({}, {"_id": 0}):
        home_section_docs.append(row)

    payload = {
        "version": 1,
        "generated_at": now_iso(),
        "media": media_docs,
        "content": content_docs,
        "site_settings": settings_docs,
        "journeys": journey_docs,
        "about_blocks": about_docs,
        "stories": story_docs,
        "blog_posts": blog_docs,
        "home_faqs": home_faq_docs,
        "home_sections": home_section_docs,
    }
    # Write atomically: dump to .tmp then rename, so a partial write never
    # leaves a corrupt JSON on disk.
    import json as _json
    tmp = SNAPSHOT_FILE.with_suffix(".json.tmp")
    tmp.write_text(_json.dumps(payload, indent=2, ensure_ascii=False, default=str))
    tmp.replace(SNAPSHOT_FILE)
    # Keep the auto-migration hash in lockstep so the file we just wrote is
    # NOT treated as "new content to re-apply" on the next backend start.
    fh = _snapshot_file_hash()
    if fh:
        await db.site_settings.update_one(
            {"key": "snapshot_applied_hash"},
            {"$set": {"key": "snapshot_applied_hash", "value": fh, "updated_at": now_iso()}},
            upsert=True,
        )
    return {"media": len(media_docs), "content": len(content_docs), "settings": len(settings_docs), "journeys": len(journey_docs)}


async def schedule_snapshot(delay: float = 2.0):
    """Debounced snapshot writer. Multiple admin writes within `delay`
    seconds coalesce into a single JSON dump."""
    global _snapshot_task
    async with _snapshot_lock:
        if _snapshot_task and not _snapshot_task.done():
            _snapshot_task.cancel()

        async def _runner():
            try:
                await asyncio.sleep(delay)
                counts = await _write_snapshot_now()
                logger.info("Snapshot written: %s", counts)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.warning("Snapshot write failed: %s", e)

        _snapshot_task = asyncio.create_task(_runner())


async def _load_from_snapshot() -> Optional[dict]:
    """Read backend/seed_data/site_snapshot.json if it exists.
    Returns the parsed payload or None."""
    if not SNAPSHOT_FILE.is_file():
        return None
    try:
        import json as _json
        return _json.loads(SNAPSHOT_FILE.read_text())
    except Exception as e:
        logger.warning("Could not read snapshot %s: %s", SNAPSHOT_FILE, e)
        return None


def _snapshot_file_hash() -> Optional[str]:
    """SHA1 of the on-disk snapshot, used to decide whether a
    `git pull` brought in a newer one and we need to re-apply it."""
    if not SNAPSHOT_FILE.is_file():
        return None
    import hashlib
    h = hashlib.sha1()
    h.update(SNAPSHOT_FILE.read_bytes())
    return h.hexdigest()


async def _apply_snapshot(snapshot: dict, *, reason: str, protect_media: bool = False) -> dict:
    """Replace the live DB collections with the contents of `snapshot`.

    Used both for fresh-DB seeding and for the auto-migration that fires
    when a deploy pulls in a newer snapshot.json from git.

    Safety: before wiping media we copy the existing rows into
    `media_backup_<iso>` so the operator can recover if needed.

    When `protect_media=True` we SKIP the media replacement if the snapshot has
    fewer media docs than the live DB (the operator must have uploaded directly
    on production). The rest of the snapshot (content, journeys, about_blocks,
    stories, settings) is always applied so feature releases still propagate."""
    media_docs = snapshot.get("media") or []
    content_docs = snapshot.get("content") or []
    settings_docs = snapshot.get("site_settings") or []

    skip_media = False
    if protect_media:
        db_media_count = await db.media.count_documents({})
        if len(media_docs) < db_media_count:
            logger.warning(
                "Snapshot has %d media docs but DB has %d, SKIPPING media replacement "
                "to protect operator uploads. Other collections (content, journeys, "
                "about_blocks, stories) will still be applied.",
                len(media_docs), db_media_count,
            )
            skip_media = True

    if not skip_media:
        # Backup current media before replacing.
        existing = await db.media.find({}, {"_id": 0}).to_list(length=10000)
        if existing:
            backup_name = "media_backup_" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
            await db[backup_name].insert_many(existing)
            logger.info("Backed up %d existing media rows to %s", len(existing), backup_name)

        await db.media.delete_many({})
        if media_docs:
            # Normalise required defaults on older snapshots.
            for m in media_docs:
                m.setdefault("id", str(uuid.uuid4()))
                m.setdefault("is_active", True)
                m.setdefault("created_at", now_iso())
                m.setdefault("sort_order", 0)
                m.setdefault("file_type", "image")
                m.setdefault("caption", "")
                m.setdefault("alt_text", "")
                m.setdefault("category", "")
            await db.media.insert_many(media_docs)

    for entry in content_docs:
        if not entry.get("key"):
            continue
        await db.content.update_one({"key": entry["key"]}, {"$set": entry}, upsert=True)

    for entry in settings_docs:
        if not entry.get("key") or entry["key"] in SNAPSHOT_EXCLUDE_SETTINGS:
            continue
        await db.site_settings.update_one(
            {"key": entry["key"]}, {"$set": entry}, upsert=True
        )

    # Journeys / About / Stories: same per-collection guard as media.
    # If the snapshot has FEWER docs than the live DB, skip that collection so
    # we never lose entries that the operator added on prod between snapshots.
    async def _safe_replace(coll_name: str, snapshot_items: list, label: str) -> None:
        if not snapshot_items:
            return
        if protect_media:
            live_count = await db[coll_name].count_documents({})
            if len(snapshot_items) < live_count:
                logger.warning(
                    "Snapshot has %d %s but DB has %d, SKIPPING %s replacement.",
                    len(snapshot_items), label, live_count, label,
                )
                return
        await db[coll_name].delete_many({})
        await db[coll_name].insert_many([dict(x) for x in snapshot_items])

    await _safe_replace("journeys", snapshot.get("journeys") or [], "journeys")
    await _safe_replace("about_blocks", snapshot.get("about_blocks") or [], "about_blocks")
    await _safe_replace("stories", snapshot.get("stories") or [], "stories")
    await _safe_replace("blog_posts", snapshot.get("blog_posts") or [], "blog_posts")
    await _safe_replace("home_faqs", snapshot.get("home_faqs") or [], "home_faqs")
    await _safe_replace("home_sections", snapshot.get("home_sections") or [], "home_sections")

    # Record the snapshot hash so we don't keep re-applying the same file.
    fh = _snapshot_file_hash()
    if fh:
        await db.site_settings.update_one(
            {"key": "snapshot_applied_hash"},
            {"$set": {"key": "snapshot_applied_hash", "value": fh, "updated_at": now_iso()}},
            upsert=True,
        )
        await db.site_settings.update_one(
            {"key": "snapshot_applied_reason"},
            {"$set": {"key": "snapshot_applied_reason", "value": reason, "updated_at": now_iso()}},
            upsert=True,
        )

    counts = {"media": len(media_docs), "content": len(content_docs), "settings": len(settings_docs)}
    logger.info("Snapshot applied (%s): %s", reason, counts)
    return counts


async def seed():
    await db.users.create_index("email", unique=True)
    await db.media.create_index("section")
    await db.content.create_index("key", unique=True)
    await db.blog_posts.create_index("slug", unique=True, sparse=True)
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email,
            "password_hash": hash_password(admin_password), "name": "Once Were Wild",
            "role": "admin", "mfa_enabled": False, "created_at": now_iso(),
        })
        logger.info("Seeded admin user")
    for key, value in DEFAULT_SETTINGS.items():
        await db.site_settings.update_one({"key": key}, {"$setOnInsert": {"key": key, "value": value}}, upsert=True)
    # Idempotent content seed.
    for entry in DEFAULT_CONTENT:
        await db.content.update_one(
            {"key": entry["key"]},
            {"$setOnInsert": {
                "key": entry["key"], "value": entry["value"],
                "group": entry["group"], "type": entry.get("type", "text"),
                "label": entry.get("label", entry["key"]),
                "created_at": now_iso(),
            }},
            upsert=True,
        )
    # One-time media seed AND auto-migration on every deploy.
    #
    # Source of truth for content is `backend/seed_data/site_snapshot.json`
    # (committed to git, rewritten on every admin write here). On startup:
    #   * If the DB is fresh (no media_seeded_v1 flag) -> seed from snapshot
    #     if it exists, else fall back to bundled DEFAULT_MEDIA.
    #   * If the DB is already seeded but the on-disk snapshot's SHA1 differs
    #     from the hash we last applied, replay the snapshot. This is what
    #     fixes "Bluehost shows stock images after git pull" - the older
    #     stock seed gets superseded by the new snapshot on the next deploy
    #     without any SSH intervention.
    snapshot_payload = await _load_from_snapshot()
    file_hash = _snapshot_file_hash()
    applied_hash_row = await db.site_settings.find_one({"key": "snapshot_applied_hash"})
    applied_hash = (applied_hash_row or {}).get("value")

    flag = await db.site_settings.find_one({"key": "media_seeded_v1"})
    if not flag:
        if snapshot_payload and isinstance(snapshot_payload.get("media"), list) and snapshot_payload["media"]:
            await _apply_snapshot(snapshot_payload, reason="fresh-db-seed")
        else:
            for i, m in enumerate(DEFAULT_MEDIA):
                doc = {
                    "id": str(uuid.uuid4()),
                    "section": m["section"],
                    "file_url": m["file_url"],
                    "file_type": m.get("file_type", "image"),
                    "caption": m.get("caption", ""),
                    "alt_text": m.get("alt_text", ""),
                    "category": m.get("category", ""),
                    "sort_order": i,
                    "is_active": True,
                    "created_at": now_iso(),
                }
                await db.media.insert_one(doc)
            logger.info("Seeded %d default media items (no snapshot found)", len(DEFAULT_MEDIA))
        await db.site_settings.insert_one({"key": "media_seeded_v1", "value": True})
    elif snapshot_payload and file_hash and file_hash != applied_hash:
        # DB already seeded, but the snapshot file changed since the last apply.
        # Pass protect_media=True so _apply_snapshot will SKIP the media block
        # only when the operator has uploaded MORE images directly on prod than
        # the snapshot in git contains. Content, journeys, about_blocks and
        # stories from the snapshot are still applied so feature releases land.
        await _apply_snapshot(snapshot_payload, reason="auto-migration-on-startup", protect_media=True)

    # Seed default journeys (trip cards). Idempotent — only inserts if the
    # journeys collection is empty. Operator can edit, add or delete after.
    if await db.journeys.count_documents({}) == 0:
        for i, j in enumerate(DEFAULT_JOURNEYS):
            await db.journeys.insert_one({
                "id": str(uuid.uuid4()),
                **j,
                "is_active": True,
                "itinerary_url": "",
                "itinerary_filename": "",
                "sort_order": i,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        logger.info("Seeded %d default journeys", len(DEFAULT_JOURNEYS))
    else:
        # Self-healing dedupe: in a small window of earlier code, the seed
        # could fire twice (once on first deploy, once after a snapshot
        # migration replayed the empty pre-feature snapshot and the next
        # restart found count==0 again). Keep the OLDEST doc for each name,
        # delete the duplicates. Idempotent - no-op on already-clean data.
        pipeline = [
            {"$sort": {"created_at": 1, "_id": 1}},
            {"$group": {"_id": "$name", "keep_id": {"$first": "$id"}, "all_ids": {"$push": "$id"}}},
        ]
        async for grp in db.journeys.aggregate(pipeline):
            dupes = [i for i in grp["all_ids"] if i != grp["keep_id"]]
            if dupes:
                logger.info("Journey dedupe: removing %d duplicate(s) of %r", len(dupes), grp["_id"])
                await db.journeys.delete_many({"id": {"$in": dupes}})
        # Backfill any missing itinerary fields on legacy rows (pre-feature).
        await db.journeys.update_many(
            {"itinerary_url": {"$exists": False}},
            {"$set": {"itinerary_url": "", "itinerary_filename": ""}},
        )

    # B1 migration - backfill the sub-page fields on every existing journey.
    # Idempotent: only touches rows that don't already have the field. Runs on
    # every startup so freshly-pulled-from-live snapshots get patched too.
    legacy_rows = await db.journeys.find(
        {"$or": [
            {"slug": {"$exists": False}}, {"slug": ""},
            {"status": {"$exists": False}},
            {"type": {"$exists": False}},
        ]},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "status": 1, "type": 1},
    ).to_list(length=500)
    for row in legacy_rows:
        patch: dict = {}
        if not (row.get("slug") or "").strip():
            base = _slugify(row.get("name") or "tour")
            patch["slug"] = await _unique_slug(base or "tour", exclude_id=row["id"])
        if not row.get("status"):
            patch["status"] = "published"
        if not row.get("type"):
            patch["type"] = "tour"
        if patch:
            patch["updated_at"] = now_iso()
            await db.journeys.update_one({"id": row["id"]}, {"$set": patch})
    if legacy_rows:
        logger.info("Backfilled %d legacy journey rows with slug/status/type", len(legacy_rows))

    # B2 migration #1 - default new fields on every journey row. Idempotent
    # because we only $set the keys when they're missing.
    b2_default_fields = {
        "gallery_media_ids": [],
        "description_html": "",
        "itinerary_html": "",
        "practical_html": "",
        "preview_token": "",
    }
    b2_touched = 0
    for field_name, default_value in b2_default_fields.items():
        res = await db.journeys.update_many(
            {field_name: {"$exists": False}},
            {"$set": {field_name: default_value}},
        )
        b2_touched += res.modified_count or 0
    if b2_touched:
        logger.info("B2 default fields backfilled on %d journey row updates", b2_touched)

    # B2 migration #2 - copy any existing `body_html` (B1 single field) into
    # `description_html` (B2 primary body) when description_html is empty.
    # Lets us split the public TourDetail rendering into 3 sections without
    # losing previously-written content.
    copy_rows = await db.journeys.find(
        {
            "$and": [
                {"body_html": {"$exists": True, "$nin": [None, ""]}},
                {"$or": [
                    {"description_html": {"$exists": False}},
                    {"description_html": ""},
                ]},
            ]
        },
        {"_id": 0, "id": 1, "body_html": 1},
    ).to_list(length=500)
    for row in copy_rows:
        await db.journeys.update_one(
            {"id": row["id"]},
            {"$set": {"description_html": row.get("body_html") or "", "updated_at": now_iso()}},
        )
    if copy_rows:
        logger.info("B2: copied body_html -> description_html on %d rows", len(copy_rows))

    # B2 migration #3 - REMOVED (2026-06-27)
    # Originally re-tagged "Maleny Creative Immersion" to type='retreat' per
    # an early Q4 answer, but the user clarified that Maleny stays as a Tour
    # (it's an already-planned upcoming trip). Corporate Retreats is a
    # SEPARATE empty category for future bookings. Leaving this comment in
    # place so the rationale is clear and we don't accidentally reintroduce
    # the migration on a future pass.

    # C4 migration - default `excludes` ("What's Not Included") on every row.
    # Idempotent: only $set when the field is missing. Standard exclusions
    # list per client brief; operator can edit per-tour in admin.
    DEFAULT_EXCLUDES = [
        "International and domestic airfares",
        "Travel insurance",
        "Visa fees (if applicable)",
        "Personal expenses",
        "Optional activities not listed in the itinerary",
    ]
    res_excl = await db.journeys.update_many(
        {"excludes": {"$exists": False}},
        {"$set": {"excludes": DEFAULT_EXCLUDES}},
    )
    if res_excl.modified_count:
        logger.info("C4: defaulted excludes on %d journey rows", res_excl.modified_count)

    # C5 migration - default `more_details_html` empty string on every row.
    res_md = await db.journeys.update_many(
        {"more_details_html": {"$exists": False}},
        {"$set": {"more_details_html": ""}},
    )
    if res_md.modified_count:
        logger.info("C5: defaulted more_details_html on %d journey rows", res_md.modified_count)

    # Z1 migration - default `highlights = []` on every journey row.
    # Drives the new "Tour highlights" sidebar checkmark list on /tours/<slug>.
    # Idempotent: only $sets when the field is missing.
    res_hl = await db.journeys.update_many(
        {"highlights": {"$exists": False}},
        {"$set": {"highlights": []}},
    )
    if res_hl.modified_count:
        logger.info("Z1: defaulted highlights on %d journey rows", res_hl.modified_count)

    # Phase 3 migration - default `media_ids` to [] on every existing blog_post
    # and home_section row. Idempotent (only $sets when missing). When
    # `media_ids` is non-empty the public page renders <SwipeableMedia> above
    # the body; when empty the existing single-cover code paths still apply.
    res_blog_mids = await db.blog_posts.update_many(
        {"media_ids": {"$exists": False}},
        {"$set": {"media_ids": []}},
    )
    if res_blog_mids.modified_count:
        logger.info("Phase 3: defaulted media_ids on %d blog_post rows", res_blog_mids.modified_count)

    res_hs_mids = await db.home_sections.update_many(
        {"media_ids": {"$exists": False}},
        {"$set": {"media_ids": []}},
    )
    if res_hs_mids.modified_count:
        logger.info("Phase 3: defaulted media_ids on %d home_section rows", res_hs_mids.modified_count)

    # Seed default home FAQs ("Questions Gently Answered"). Idempotent — only
    # inserts if the collection is empty so the client's edits are never lost.
    if await db.home_faqs.count_documents({}) == 0:
        for i, f in enumerate(DEFAULT_HOME_FAQS):
            await db.home_faqs.insert_one({
                "id": str(uuid.uuid4()),
                "question": f["question"],
                "answer": f["answer"],
                "is_visible": True,
                "sort_order": i,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        logger.info("Seeded %d default home FAQs", len(DEFAULT_HOME_FAQS))

    # Seed default home content sections (long-form rich-text blocks).
    if await db.home_sections.count_documents({}) == 0:
        for i, s in enumerate(DEFAULT_HOME_SECTIONS):
            await db.home_sections.insert_one({
                "id": str(uuid.uuid4()),
                "heading": s["heading"],
                "body": s["body"],
                "is_visible": True,
                "sort_order": i,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        logger.info("Seeded %d default home content sections", len(DEFAULT_HOME_SECTIONS))

    # Migrate any legacy data:image/... rows to disk-backed WebP so the public
    # API returns short URLs and the hero paints instantly. This is run once
    # per row (we update file_url in place, so the second pass is a no-op).
    migrated = 0
    async for row in db.media.find({"file_url": {"$regex": "^data:image/"}}):
        new_url, lqip = convert_image_to_webp(row["file_url"], row.get("section") or "misc")
        if new_url != row["file_url"]:
            await db.media.update_one({"id": row["id"]}, {"$set": {"file_url": new_url, "lqip": lqip}})
            migrated += 1
    if migrated:
        logger.info("Migrated %d media rows from data URL to disk WebP", migrated)

    # One-time re-compression + LQIP backfill: ensures every existing WebP on
    # disk is ≤2048 px / quality 88 AND that every row has a tiny inline
    # placeholder so the hero section never paints blank. Idempotent via flag.
    recompress_flag = await db.site_settings.find_one({"key": "media_recompressed_v2"})
    if not recompress_flag:
        recompressed = 0
        async for row in db.media.find({"file_url": {"$regex": f"^{UPLOADS_URL_PREFIX}/"}}):
            try:
                rel = row["file_url"][len(UPLOADS_URL_PREFIX) + 1:]
                old_path = UPLOADS_DIR / rel
                if not old_path.is_file():
                    continue
                # Re-encode if oversized OR if the LQIP is missing.
                needs_re_encode = old_path.stat().st_size > 600 * 1024
                needs_lqip = not row.get("lqip")
                if not needs_re_encode and not needs_lqip:
                    continue
                raw = old_path.read_bytes()
                new_url, lqip, _srcset, _avif = _encode_webp_to_disk(raw, row.get("section") or "misc")
                patch = {"lqip": lqip}
                if needs_re_encode:
                    patch["file_url"] = new_url
                    old_path.unlink(missing_ok=True)
                else:
                    # Drop the freshly-written full file since the old one is fine.
                    new_rel = new_url[len(UPLOADS_URL_PREFIX) + 1:]
                    (UPLOADS_DIR / new_rel).unlink(missing_ok=True)
                await db.media.update_one({"id": row["id"]}, {"$set": patch})
                recompressed += 1
            except Exception as e:
                logger.warning("Re-compression / LQIP skipped for %s: %s", row.get("id"), e)
        await db.site_settings.insert_one({"key": "media_recompressed_v2", "value": True})
        if recompressed:
            logger.info("Re-compressed / LQIP-backfilled %d media rows", recompressed)


    # --- v3: responsive variants (srcset). Re-encodes every /api/uploads/
    # image into three WebP variants (1600/1200/800 px) and stores the
    # srcset map on the row. Massive mobile LCP win — phones now download
    # 70-90 KB images instead of 500-800 KB hero photos. Idempotent via flag.
    srcset_flag = await db.site_settings.find_one({"key": "media_srcset_v3"})
    if not srcset_flag:
        rebuilt = 0
        async for row in db.media.find({"file_type": {"$ne": "video"},
                                          "file_url": {"$regex": f"^{UPLOADS_URL_PREFIX}/"}}):
            try:
                if row.get("srcset"):
                    continue
                rel = row["file_url"][len(UPLOADS_URL_PREFIX) + 1:]
                old_path = UPLOADS_DIR / rel
                if not old_path.is_file():
                    continue
                raw = old_path.read_bytes()
                new_url, lqip, srcset, avif_srcset = _encode_webp_to_disk(raw, row.get("section") or "misc")
                # Delete the old single-variant file — the new pipeline writes
                # three fresh files with a different base UUID.
                old_path.unlink(missing_ok=True)
                await db.media.update_one(
                    {"id": row["id"]},
                    {"$set": {"file_url": new_url, "srcset": srcset, "lqip": lqip}},
                )
                rebuilt += 1
            except Exception as e:
                logger.warning("Srcset rebuild skipped for %s: %s", row.get("id"), e)
        await db.site_settings.insert_one({"key": "media_srcset_v3", "value": True})
        if rebuilt:
            logger.info("Rebuilt %d images with responsive srcset variants", rebuilt)


    # One-time LQIP backfill for SEEDED slot rows whose file_url points at
    # the React public folder (/assets/...). Without this, every sub-page
    # PageHero paints solid green (bg-nature-deep) until the 300+ KB image
    # finishes downloading. Reading the file off /app/frontend/public and
    # running it through the WebP/LQIP encoder gives us a ~600 byte inline
    # placeholder we can paint in the first frame. Idempotent via flag.
    slot_lqip_flag = await db.site_settings.find_one({"key": "slot_lqips_v1"})
    if not slot_lqip_flag:
        slotted = 0
        async for row in db.media.find({"file_url": {"$regex": "^/assets/"}}):
            try:
                if row.get("lqip"):
                    continue
                asset_path = PUBLIC_DIR / row["file_url"].lstrip("/")
                if not asset_path.is_file():
                    continue
                # Only the LQIP — the file itself is already served by the
                # frontend's StaticFiles handler.
                lqip = _generate_lqip(asset_path.read_bytes())
                await db.media.update_one({"id": row["id"]}, {"$set": {"lqip": lqip}})
                slotted += 1
            except Exception as e:
                logger.warning("Slot LQIP backfill skipped for %s: %s", row.get("id"), e)
        await db.site_settings.insert_one({"key": "slot_lqips_v1", "value": True})
        if slotted:
            logger.info("Generated %d LQIPs for seeded slot rows", slotted)

    # One-time video poster backfill: for every video row that is missing a
    # thumb_url / lqip, pull the underlying file off disk and run ffmpeg to
    # grab a frame. Idempotent via flag — delete the row to re-run.
    video_thumb_flag = await db.site_settings.find_one({"key": "media_video_thumbs_v1"})
    if not video_thumb_flag:
        thumbed = 0
        async for row in db.media.find({"file_type": "video"}):
            try:
                if row.get("thumb_url"):
                    continue
                file_url = row.get("file_url", "")
                if not file_url.startswith(f"{UPLOADS_URL_PREFIX}/"):
                    continue
                rel = file_url[len(UPLOADS_URL_PREFIX) + 1:]
                video_path = UPLOADS_DIR / rel
                if not video_path.is_file():
                    continue
                thumb_url, lqip = _extract_video_thumb(video_path, row.get("section") or "misc")
                if thumb_url:
                    await db.media.update_one(
                        {"id": row["id"]},
                        {"$set": {"thumb_url": thumb_url, "lqip": lqip}},
                    )
                    thumbed += 1
            except Exception as e:
                logger.warning("Video thumb backfill skipped for %s: %s", row.get("id"), e)
        await db.site_settings.insert_one({"key": "media_video_thumbs_v1", "value": True})
        if thumbed:
            logger.info("Generated %d video thumbnails", thumbed)


@app.on_event("startup")
async def on_startup():
    await seed()
    # Build llms.txt / llms-full.txt at boot so the AI-search feed is
    # always up to date even when no admin edits have happened recently.
    await regenerate_llm_feeds()
    # Bake the current hero into index.html as a <link rel="preload"> so
    # the browser starts fetching the LCP image at HTML parse time.
    await regenerate_hero_preload()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
