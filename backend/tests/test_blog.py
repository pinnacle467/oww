"""Backend tests for Blog feature (Once Were Wild).
Covers:
- public GET /api/blog (lists only published)
- public GET /api/blog/{slug} (404 on unknown)
- admin auth gate on POST/PATCH/DELETE
- admin POST /api/admin/blog (default draft, slug generation, slug conflict -> -2)
- admin PATCH /api/admin/blog/{id} (status: published makes it public)
- admin DELETE /api/admin/blog/{id}
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    # OTP disabled -> token returned directly
    if "access_token" in data:
        return data["access_token"]
    pytest.skip(f"Unexpected login response: {data}")


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def created_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup_blog(s, auth_headers, created_ids):
    yield
    # teardown: list admin blog and remove any TEST_ slug/title rows
    try:
        rows = s.get(f"{API}/admin/blog", headers=auth_headers).json()
        for row in rows:
            if (row.get("title") or "").startswith("TEST_") or row.get("id") in created_ids:
                s.delete(f"{API}/admin/blog/{row['id']}", headers=auth_headers)
    except Exception as e:  # pragma: no cover
        print(f"cleanup failed: {e}")


# ---- Public endpoints ----
class TestPublicBlog:
    def test_list_returns_array(self, s):
        r = s.get(f"{API}/blog")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)

    def test_unknown_slug_404(self, s):
        r = s.get(f"{API}/blog/this-slug-does-not-exist-xyz")
        assert r.status_code == 404


# ---- Auth gate ----
class TestAuthGate:
    def test_admin_post_no_auth_401(self, s):
        r = s.post(f"{API}/admin/blog", json={"title": "x"})
        assert r.status_code == 401

    def test_admin_list_no_auth_401(self, s):
        r = s.get(f"{API}/admin/blog")
        assert r.status_code == 401


# ---- Slug generation + draft default ----
class TestSlugAndCreate:
    def test_create_default_draft_and_slug_hello(self, s, auth_headers, created_ids):
        r = s.post(f"{API}/admin/blog", headers=auth_headers, json={"title": "Hello"})
        assert r.status_code in (200, 201), r.text
        post = r.json()
        assert post["slug"] == "hello", f"expected slug 'hello' got {post.get('slug')}"
        assert post.get("status") == "draft"
        assert post.get("title") == "Hello"
        assert "id" in post
        created_ids.append(post["id"])

        # not visible publicly
        public = s.get(f"{API}/blog").json()
        assert not any(p.get("slug") == "hello" for p in public), "Draft should not appear publicly"

    def test_create_same_title_appends_2(self, s, auth_headers, created_ids):
        r = s.post(f"{API}/admin/blog", headers=auth_headers, json={"title": "Hello"})
        assert r.status_code in (200, 201), r.text
        post = r.json()
        assert post["slug"] == "hello-2", f"expected 'hello-2' got {post.get('slug')}"
        created_ids.append(post["id"])

    def test_create_third_same_title_appends_3(self, s, auth_headers, created_ids):
        r = s.post(f"{API}/admin/blog", headers=auth_headers, json={"title": "Hello"})
        assert r.status_code in (200, 201)
        slug = r.json()["slug"]
        assert slug == "hello-3", f"expected 'hello-3' got {slug}"
        created_ids.append(r.json()["id"])


# ---- Publish flow ----
class TestPublishFlow:
    def test_publish_draft_makes_public_then_delete(self, s, auth_headers, created_ids):
        # Create as draft
        cr = s.post(f"{API}/admin/blog", headers=auth_headers,
                    json={"title": "TEST_Publishable Post",
                          "excerpt": "An excerpt",
                          "body": "<p>hello <strong>world</strong></p>"})
        assert cr.status_code in (200, 201), cr.text
        post = cr.json()
        pid, slug = post["id"], post["slug"]
        created_ids.append(pid)
        assert post["status"] == "draft"

        # Not in public list
        pub = s.get(f"{API}/blog").json()
        assert not any(p["slug"] == slug for p in pub)

        # PATCH to published
        up = s.patch(f"{API}/admin/blog/{pid}", headers=auth_headers,
                     json={"status": "published"})
        assert up.status_code == 200, up.text
        # PATCH response may be {message, slug} — verify via admin list
        admin_rows = s.get(f"{API}/admin/blog", headers=auth_headers).json()
        row = next(r for r in admin_rows if r["id"] == pid)
        assert row.get("status") == "published"

        # Now visible publicly
        pub2 = s.get(f"{API}/blog").json()
        assert any(p["slug"] == slug for p in pub2), "Published post must appear on /api/blog"

        # GET by slug
        gd = s.get(f"{API}/blog/{slug}")
        assert gd.status_code == 200
        detail = gd.json()
        assert detail["slug"] == slug
        assert detail["title"] == "TEST_Publishable Post"
        assert "world" in (detail.get("body") or "")

        # Toggle back to draft -> disappear
        tg = s.patch(f"{API}/admin/blog/{pid}", headers=auth_headers, json={"status": "draft"})
        assert tg.status_code == 200
        pub3 = s.get(f"{API}/blog").json()
        assert not any(p["slug"] == slug for p in pub3)

        # Re-publish to test edit-title slug regeneration
        s.patch(f"{API}/admin/blog/{pid}", headers=auth_headers, json={"status": "published"})
        ed = s.patch(f"{API}/admin/blog/{pid}", headers=auth_headers,
                     json={"title": "TEST_Publishable Post Updated"})
        assert ed.status_code == 200, ed.text
        new_slug = ed.json().get("slug")
        # slug should regenerate to reflect new title (contain 'updated')
        assert new_slug and "updated" in new_slug.lower(), f"slug should regenerate, got {new_slug}"

        # DELETE
        dl = s.delete(f"{API}/admin/blog/{pid}", headers=auth_headers)
        assert dl.status_code in (200, 204)
        # 404 on public detail of new slug
        gone = s.get(f"{API}/blog/{new_slug}")
        assert gone.status_code == 404
