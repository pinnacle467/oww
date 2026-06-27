"""Backend tests for the new content endpoints (P0-Task 1).
Covers:
- GET /api/content (public flat map)
- GET /api/admin/content (grouped, requires Bearer)
- PUT /api/admin/content (bulk upsert, requires Bearer)
- Admin media POST/GET/DELETE round-trip for section='pillars-0'.
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "WildAtHeart2026"

EXPECTED_GROUPS = {"brand", "nav", "home", "pricing", "journeys", "faqs", "gallery", "contact", "footer"}
REQUIRED_KEYS = [
    "brand.name",
    "home.manifesto.heading",
    "pricing.hero.title",
    "nav.0.label",
    "pillars.0.title",
    "faqs.0.q",
]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("status") == "success", body
    assert "access_token" in body
    assert body["user"]["email"] == ADMIN_EMAIL
    return body["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---- Public content map ----
class TestPublicContent:
    def test_get_content_returns_flat_map_with_required_keys(self):
        r = requests.get(f"{API}/content", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)
        assert len(data) >= 100, f"Expected >=100 keys, got {len(data)}"
        for k in REQUIRED_KEYS:
            assert k in data, f"Missing required key: {k}"
        # spot value sanity
        assert isinstance(data["brand.name"], str)
        assert data["brand.name"]

    def test_admin_content_requires_bearer(self):
        assert requests.get(f"{API}/admin/content", timeout=10).status_code == 401
        assert requests.put(f"{API}/admin/content", json={"items": []}, timeout=10).status_code == 401


# ---- Authenticated admin content ----
class TestAdminContent:
    def test_admin_content_grouped(self, auth_headers):
        r = requests.get(f"{API}/admin/content", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)
        missing = EXPECTED_GROUPS - set(body.keys())
        assert not missing, f"Missing groups: {missing}"
        # Each list item must have key/value/type/label
        for g, items in body.items():
            assert isinstance(items, list) and items, f"group {g} empty"
            sample = items[0]
            for fld in ("key", "value", "type", "label"):
                assert fld in sample, f"group {g} item missing {fld}: {sample}"

    def test_bulk_update_and_revert(self, auth_headers):
        ORIGINAL = "There is a version of you who has been waiting."
        NEW = "There is a wild woman waiting."
        key = "home.manifesto.heading"
        # update
        r = requests.put(f"{API}/admin/content",
                         headers=auth_headers,
                         json={"items": [{"key": key, "value": NEW}]}, timeout=20)
        assert r.status_code == 200, r.text
        out = r.json()
        assert out.get("updated") == 1, out
        # verify on public endpoint
        data = requests.get(f"{API}/content", timeout=20).json()
        assert data[key] == NEW
        # revert
        rr = requests.put(f"{API}/admin/content",
                          headers=auth_headers,
                          json={"items": [{"key": key, "value": ORIGINAL}]}, timeout=20)
        assert rr.status_code == 200
        assert rr.json().get("updated") == 1
        data2 = requests.get(f"{API}/content", timeout=20).json()
        assert data2[key] == ORIGINAL


# ---- Admin media for pillars-0 (existing endpoints still work) ----
class TestAdminPillarMedia:
    TINY_PNG = (
        "data:image/png;base64,"
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    )

    def test_pillars0_create_get_delete(self, auth_headers):
        cr = requests.post(f"{API}/admin/media", headers=auth_headers, json={
            "section": "pillars-0", "file_url": self.TINY_PNG, "file_type": "image",
            "caption": "TEST_pillar0", "alt_text": "TEST_alt", "category": "journeys",
            "sort_order": 0,
        }, timeout=20)
        assert cr.status_code == 200, cr.text
        mid = cr.json()["id"]

        pg = requests.get(f"{API}/media", params={"section": "pillars-0"}, timeout=20)
        assert pg.status_code == 200
        assert any(m["id"] == mid for m in pg.json()), "Uploaded pillars-0 media not visible publicly"

        dl = requests.delete(f"{API}/admin/media/{mid}", headers=auth_headers, timeout=20)
        assert dl.status_code == 200
        after = requests.get(f"{API}/media", params={"section": "pillars-0"}, timeout=20).json()
        assert not any(m["id"] == mid for m in after), "Pillar media not cleaned up"
