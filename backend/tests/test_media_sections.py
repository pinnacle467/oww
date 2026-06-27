"""Backend regression for hero & gallery media sections after gallery category rename.
- GET /api/media?section=hero and ?section=gallery must work without auth.
- POST/DELETE on /api/admin/media for both sections still works (Bearer required).
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "WildAtHeart2026"

TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
)


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}",
            "Content-Type": "application/json"}


@pytest.mark.parametrize("section", ["hero", "gallery"])
def test_public_media_endpoint_no_auth(section):
    r = requests.get(f"{API}/media", params={"section": section}, timeout=20)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_admin_media_requires_bearer():
    assert requests.post(f"{API}/admin/media", json={"section": "hero", "file_url": TINY_PNG}, timeout=10).status_code == 401


@pytest.mark.parametrize("section,category", [
    ("hero", None),
    ("gallery", "Maleny Retreats"),
])
def test_media_create_visible_publicly_then_delete(auth_headers, section, category):
    payload = {
        "section": section,
        "file_url": TINY_PNG,
        "file_type": "image",
        "caption": f"TEST_{section}_round_trip",
        "sort_order": 999,
    }
    if category:
        payload["category"] = category
    cr = requests.post(f"{API}/admin/media", headers=auth_headers, json=payload, timeout=20)
    assert cr.status_code == 200, cr.text
    mid = cr.json()["id"]

    pg = requests.get(f"{API}/media", params={"section": section}, timeout=20)
    assert pg.status_code == 200
    found = [m for m in pg.json() if m["id"] == mid]
    assert found, f"{section} upload not visible publicly"
    if category:
        assert found[0].get("category") == category

    dl = requests.delete(f"{API}/admin/media/{mid}", headers=auth_headers, timeout=20)
    assert dl.status_code == 200
    after = requests.get(f"{API}/media", params={"section": section}, timeout=20).json()
    assert not any(m["id"] == mid for m in after), f"{section} media not cleaned up"
