"""Backend tests for new About + Stories endpoints and live-sync regression.

Covers iteration 5 review request:
 - Public GET /api/about-blocks and /api/stories
 - Admin auth gating (401 without token)
 - Admin CRUD for about-blocks (POST/PATCH/DELETE/reorder)
 - Admin CRUD for stories (POST/PATCH/DELETE/reorder)
 - Story cover upload (multipart) returns urls + file is reachable
 - is_visible toggling hides from public but not admin
 - Snapshot persistence after admin write
 - Live-sync regression (media, gallery-categories)
"""

import io
import os
import time
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://build-handover.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "WildAtHeart2026"
SNAPSHOT_PATH = "/app/backend/seed_data/site_snapshot.json"


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- public endpoints ----------------
class TestPublicEndpoints:
    def test_public_about_blocks_returns_visible_sorted(self):
        r = requests.get(f"{BASE_URL}/api/about-blocks", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # at least 3 seeded
        # Every returned block must be visible
        for b in data:
            assert b["is_visible"] is True
            assert "_id" not in b
            assert b["kind"] in ("paragraph", "heading")
        # sorted by sort_order ascending
        orders = [b["sort_order"] for b in data]
        assert orders == sorted(orders)
        # Find seeded heading
        headings = [b for b in data if b["kind"] == "heading"]
        assert any("path to here" in (b.get("text") or "").lower() for b in headings)

    def test_public_stories_returns_visible_sorted(self):
        r = requests.get(f"{BASE_URL}/api/stories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        for s in data:
            assert s["is_visible"] is True
            assert "_id" not in s
        orders = [s["sort_order"] for s in data]
        assert orders == sorted(orders)
        # Seeded story title check
        assert any("cradle mountain" in (s.get("title") or "").lower() for s in data)


# ---------------- admin auth gating ----------------
class TestAdminAuthGating:
    def test_admin_about_blocks_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/about-blocks", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_stories_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/stories", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_about_blocks_with_token(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/about-blocks", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_stories_with_token(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stories", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- admin CRUD: about-blocks ----------------
class TestAdminAboutBlocksCRUD:
    def test_full_lifecycle_create_update_visibility_delete(self, admin_headers):
        # CREATE
        payload = {"kind": "paragraph", "text": "TEST_iter5 temporary paragraph"}
        r = requests.post(f"{BASE_URL}/api/admin/about-blocks", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        assert created["kind"] == "paragraph"
        assert created["text"] == payload["text"]
        assert created["is_visible"] is True
        bid = created["id"]

        # PATCH kind + text
        r = requests.patch(
            f"{BASE_URL}/api/admin/about-blocks/{bid}",
            json={"kind": "heading", "text": "TEST_iter5 updated heading"},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200

        # Verify update via admin list
        r = requests.get(f"{BASE_URL}/api/admin/about-blocks", headers=admin_headers, timeout=15)
        admin_list = r.json()
        match = [b for b in admin_list if b["id"] == bid]
        assert match and match[0]["kind"] == "heading"
        assert match[0]["text"] == "TEST_iter5 updated heading"

        # PATCH is_visible -> false: should disappear from public list
        r = requests.patch(
            f"{BASE_URL}/api/admin/about-blocks/{bid}",
            json={"is_visible": False},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200

        public_ids = [b["id"] for b in requests.get(f"{BASE_URL}/api/about-blocks", timeout=15).json()]
        assert bid not in public_ids

        admin_ids = [b["id"] for b in requests.get(f"{BASE_URL}/api/admin/about-blocks", headers=admin_headers, timeout=15).json()]
        assert bid in admin_ids

        # DELETE
        r = requests.delete(f"{BASE_URL}/api/admin/about-blocks/{bid}", headers=admin_headers, timeout=15)
        assert r.status_code in (200, 204)
        admin_ids = [b["id"] for b in requests.get(f"{BASE_URL}/api/admin/about-blocks", headers=admin_headers, timeout=15).json()]
        assert bid not in admin_ids

    def test_reorder_about_blocks(self, admin_headers):
        # Create two temp blocks
        ids = []
        for i in range(2):
            r = requests.post(
                f"{BASE_URL}/api/admin/about-blocks",
                json={"kind": "paragraph", "text": f"TEST_iter5 reorder {i}"},
                headers=admin_headers,
                timeout=15,
            )
            assert r.status_code in (200, 201)
            ids.append(r.json()["id"])

        # Reorder reverse
        reversed_ids = list(reversed(ids))
        r = requests.post(
            f"{BASE_URL}/api/admin/about-blocks/reorder",
            json={"ids": reversed_ids},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text

        admin_list = requests.get(f"{BASE_URL}/api/admin/about-blocks", headers=admin_headers, timeout=15).json()
        positions = {b["id"]: b["sort_order"] for b in admin_list if b["id"] in reversed_ids}
        # reversed_ids[0] should now have lower sort_order than reversed_ids[1]
        assert positions[reversed_ids[0]] < positions[reversed_ids[1]]

        # Cleanup
        for bid in ids:
            requests.delete(f"{BASE_URL}/api/admin/about-blocks/{bid}", headers=admin_headers, timeout=15)


# ---------------- admin CRUD: stories ----------------
class TestAdminStoriesCRUD:
    def test_full_lifecycle_and_cover_upload(self, admin_headers):
        # CREATE
        payload = {
            "title": "TEST_iter5 story",
            "region": "Nowhere",
            "date": "Jan 2026",
            "excerpt": "Excerpt text.",
            "body": "Body text body text.",
        }
        r = requests.post(f"{BASE_URL}/api/admin/stories", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        assert created["title"] == payload["title"]
        assert created["is_visible"] is True
        sid = created["id"]

        # PATCH
        r = requests.patch(
            f"{BASE_URL}/api/admin/stories/{sid}",
            json={"title": "TEST_iter5 updated", "is_visible": False},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200

        # is_visible=false should hide from public
        public_ids = [s["id"] for s in requests.get(f"{BASE_URL}/api/stories", timeout=15).json()]
        assert sid not in public_ids

        # Re-enable
        requests.patch(
            f"{BASE_URL}/api/admin/stories/{sid}",
            json={"is_visible": True},
            headers=admin_headers,
            timeout=15,
        )

        # COVER UPLOAD: build a real valid PNG via PIL
        from PIL import Image
        img = Image.new("RGB", (64, 64), color=(120, 80, 60))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        files = {"file": ("test.png", buf, "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/stories/{sid}/cover",
            headers=admin_headers,
            files=files,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        cover = r.json()
        assert cover.get("cover_url"), f"missing cover_url: {cover}"
        assert isinstance(cover.get("cover_srcset"), dict)
        assert isinstance(cover.get("cover_avif_srcset"), dict)

        # File must be fetchable
        cover_url = cover["cover_url"]
        full_url = cover_url if cover_url.startswith("http") else f"{BASE_URL}{cover_url}"
        rr = requests.get(full_url, timeout=15)
        assert rr.status_code == 200, f"cover url not reachable: {full_url} -> {rr.status_code}"
        assert len(rr.content) > 50

        # DELETE
        r = requests.delete(f"{BASE_URL}/api/admin/stories/{sid}", headers=admin_headers, timeout=15)
        assert r.status_code in (200, 204)
        admin_ids = [s["id"] for s in requests.get(f"{BASE_URL}/api/admin/stories", headers=admin_headers, timeout=15).json()]
        assert sid not in admin_ids

    def test_reorder_stories(self, admin_headers):
        ids = []
        for i in range(2):
            r = requests.post(
                f"{BASE_URL}/api/admin/stories",
                json={"title": f"TEST_iter5 reorder {i}", "region": "X", "date": "Y", "excerpt": "e", "body": "b"},
                headers=admin_headers,
                timeout=15,
            )
            assert r.status_code in (200, 201)
            ids.append(r.json()["id"])

        reversed_ids = list(reversed(ids))
        r = requests.post(
            f"{BASE_URL}/api/admin/stories/reorder",
            json={"ids": reversed_ids},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text

        admin_list = requests.get(f"{BASE_URL}/api/admin/stories", headers=admin_headers, timeout=15).json()
        positions = {s["id"]: s["sort_order"] for s in admin_list if s["id"] in reversed_ids}
        assert positions[reversed_ids[0]] < positions[reversed_ids[1]]

        # Cleanup
        for sid in ids:
            requests.delete(f"{BASE_URL}/api/admin/stories/{sid}", headers=admin_headers, timeout=15)


# ---------------- snapshot persistence ----------------
class TestSnapshotPersistence:
    def test_snapshot_contains_new_block_within_seconds(self, admin_headers):
        marker = f"TEST_iter5 snapshot {int(time.time())}"
        r = requests.post(
            f"{BASE_URL}/api/admin/about-blocks",
            json={"kind": "paragraph", "text": marker},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code in (200, 201)
        bid = r.json()["id"]

        # Wait for debounced writer (2s) + buffer
        deadline = time.time() + 12
        found = False
        last_mtime = None
        while time.time() < deadline:
            try:
                with open(SNAPSHOT_PATH, "r") as f:
                    snap = json.load(f)
                blocks = snap.get("about_blocks") or []
                if any(b.get("id") == bid for b in blocks):
                    found = True
                    break
                last_mtime = os.path.getmtime(SNAPSHOT_PATH)
            except FileNotFoundError:
                pass
            time.sleep(1)

        # cleanup
        requests.delete(f"{BASE_URL}/api/admin/about-blocks/{bid}", headers=admin_headers, timeout=15)
        assert found, f"snapshot did not pick up new block within 12s (last_mtime={last_mtime})"


# ---------------- live-sync regression ----------------
class TestLiveSyncRegression:
    def test_gallery_hero_live_file(self):
        r = requests.get(f"{BASE_URL}/api/media?section=gallery-hero", timeout=15)
        assert r.status_code == 200
        items = r.json()
        urls = [it.get("file_url") for it in items]
        expected = "/api/uploads/gallery-hero/140114b8107045ab9d0e4502ef210816.webp"
        assert any(expected in (u or "") for u in urls), f"expected {expected} in {urls}"

    def test_gallery_categories_exact(self):
        r = requests.get(f"{BASE_URL}/api/gallery-categories", timeout=15)
        assert r.status_code == 200
        cats = r.json()
        # Could be list of strings or list of dicts
        if cats and isinstance(cats[0], dict):
            names = [c.get("name") for c in cats]
        else:
            names = cats
        assert names == ["Maleny Retreats", "Across the world", "Across Australia"], names

    def test_gallery_section_89_unique(self):
        r = requests.get(f"{BASE_URL}/api/media?section=gallery", timeout=15)
        assert r.status_code == 200
        items = r.json()
        urls = [it.get("file_url") for it in items]
        assert len(urls) == 89, f"expected 89, got {len(urls)}"
        assert len(set(urls)) == len(urls), "duplicate URLs found"


# ---------------- existing hero regression ----------------
class TestExistingHerosIntact:
    @pytest.mark.parametrize("section", ["gallery-hero", "pricing-hero", "contact-hero"])
    def test_hero_loads(self, section):
        r = requests.get(f"{BASE_URL}/api/media?section={section}", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1, f"{section} has no items"
