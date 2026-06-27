"""Smoke tests for compressed videos and public route accessibility.
Validates iteration 6 changes: video compression (<100MB), cookies page route,
and Contact-link removal does not break /contact direct access.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://load-central.preview.emergentagent.com").rstrip("/")
UPLOAD_DIR = "/app/backend/uploads/gallery"

COMPRESSED_VIDEOS = [
    "91e7dfe008604e55ae0f85459f911fea.mp4",
    "5084e72e854f40a48ca0c015dffd499a.mp4",
    "d252a0f866ae469d9e3d52b5e998ca31.mp4",
]

# --- File-size guard (GitHub 100 MB limit) ---
class TestVideoCompression:
    def test_no_file_under_uploads_exceeds_100mb(self):
        big = []
        for root, _, files in os.walk("/app/backend/uploads"):
            for f in files:
                p = os.path.join(root, f)
                try:
                    sz = os.path.getsize(p)
                    if sz > 100 * 1024 * 1024:
                        big.append((p, sz))
                except OSError:
                    pass
        assert not big, f"Files exceeding 100MB: {big}"

    @pytest.mark.parametrize("fname", COMPRESSED_VIDEOS)
    def test_compressed_video_exists_and_valid_mp4(self, fname):
        path = os.path.join(UPLOAD_DIR, fname)
        assert os.path.exists(path), f"{fname} missing"
        sz = os.path.getsize(path)
        assert sz > 0, f"{fname} is empty"
        assert sz < 100 * 1024 * 1024, f"{fname} too big: {sz}"
        with open(path, "rb") as fp:
            head = fp.read(16)
        assert head[4:8] == b"ftyp", f"{fname} not a valid MP4 (header={head[:16]!r})"


# --- HTTP HEAD against the served video URLs ---
class TestVideoServing:
    @pytest.mark.parametrize("fname", COMPRESSED_VIDEOS)
    def test_video_head_returns_200_and_correct_length(self, fname):
        url = f"{BASE_URL}/api/uploads/gallery/{fname}"
        disk_size = os.path.getsize(os.path.join(UPLOAD_DIR, fname))
        # Some static servers don't implement HEAD reliably; do GET with stream
        r = requests.get(url, stream=True, timeout=30, allow_redirects=True)
        assert r.status_code == 200, f"{url} -> {r.status_code}"
        cl = r.headers.get("Content-Length")
        assert cl is not None, f"No Content-Length on {url}"
        assert int(cl) == disk_size, f"{url} CL={cl} disk={disk_size}"
        r.close()


# --- Public route smoke ---
class TestPublicRoutes:
    @pytest.mark.parametrize("path", ["/", "/pricing", "/gallery", "/about", "/contact", "/cookies"])
    def test_route_returns_200(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=15, allow_redirects=True)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        # SPA: index.html should load
        assert "<div" in r.text.lower() or "<!doctype" in r.text.lower()
