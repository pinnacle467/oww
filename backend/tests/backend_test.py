"""Backend tests for Once Were Wild API.
Covers: contact, leads, auth (login + MFA setup/verify), admin CRUD,
media, settings, change-password, security and lockout.
"""
import os
import time
import uuid
import pytest
import requests
import pyotp
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://build-handover.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "WildAtHeart2026"

# Direct Mongo for cleanup (lockouts)
_mongo = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
_db = _mongo[os.environ.get('DB_NAME', 'test_database')]


@pytest.fixture(scope="session", autouse=True)
def clear_lockouts():
    """Clear login attempts before and after the run."""
    _db.login_attempts.delete_many({})
    yield
    _db.login_attempts.delete_many({})


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    """Login admin and complete MFA, return access token + a contact id."""
    _db.login_attempts.delete_many({})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] in ("mfa_setup", "mfa_required")
    assert "challenge_token" in data

    if data["status"] == "mfa_setup":
        secret = data["secret"]
    else:
        # Read enabled secret from Mongo (for re-runs)
        user = _db.users.find_one({"email": ADMIN_EMAIL})
        secret = user.get("mfa_secret") or user.get("mfa_pending_secret")
        assert secret, "No MFA secret available for an already-enrolled admin"

    code = pyotp.TOTP(secret).now()
    r2 = s.post(f"{API}/auth/mfa/verify", json={"challenge_token": data["challenge_token"], "code": code})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert "access_token" in body
    assert body["user"]["email"] == ADMIN_EMAIL
    return body["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ----------------- Contact -----------------
class TestContact:
    def test_contact_short_message_rejected(self, s):
        r = s.post(f"{API}/contact", json={
            "first_name": "TEST", "last_name": "User", "email": "test@example.com",
            "inquiry_type": "journey", "message": "too short",
        })
        assert r.status_code == 422
        assert "20" in r.json().get("detail", "")

    def test_contact_create_valid(self, s, request):
        payload = {
            "first_name": "TEST_Ada", "last_name": "Lovelace",
            "email": "TEST_ada@example.com", "inquiry_type": "journey",
            "message": "I would love to learn more about your Maleny retreats and pricing.",
        }
        r = s.post(f"{API}/contact", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "message" in data and "id" in data
        request.config._contact_id = data["id"]


# ----------------- Leads -----------------
class TestLeads:
    def test_lead_create(self, s):
        r = s.post(f"{API}/leads", json={"email": "TEST_lead@example.com", "source": "exit_intent"})
        assert r.status_code == 200
        assert "message" in r.json()


# ----------------- Auth / Security -----------------
class TestAuthSecurity:
    def test_admin_no_token_returns_401(self, s):
        r = s.get(f"{API}/admin/stats")
        assert r.status_code == 401

    def test_wrong_password_returns_401(self, s):
        _db.login_attempts.delete_many({})
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG_pw"})
        assert r.status_code == 401
        assert "not correct" in r.json()["detail"].lower()
        _db.login_attempts.delete_many({})

    def test_lockout_after_three_wrong_attempts(self, s):
        """Lockout logic: hit internal 8001 to bypass proxy IPs which vary in k8s ingress.
        NOTE: through the public URL, lockout does NOT trigger because the proxy IP rotates
        per request (request.client.host changes). See test report for RCA."""
        throwaway = f"TEST_lock_{uuid.uuid4().hex[:6]}@example.com"
        _db.login_attempts.delete_many({})
        local = "http://localhost:8001/api/auth/login"
        for _ in range(2):
            r = requests.post(local, json={"email": throwaway, "password": "bad"})
            assert r.status_code == 401
        r3 = requests.post(local, json={"email": throwaway, "password": "bad"})
        assert r3.status_code == 429
        r4 = requests.post(local, json={"email": throwaway, "password": "bad"})
        assert r4.status_code == 429
        _db.login_attempts.delete_many({})


# ----------------- Admin: stats, submissions, media, settings -----------------
class TestAdmin:
    def test_stats(self, s, auth_headers):
        r = s.get(f"{API}/admin/stats", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        for key in ("total_media", "gallery", "charity", "hero",
                    "total_submissions", "unread_submissions", "leads"):
            assert key in body

    def test_submissions_list_and_patch(self, s, auth_headers, request):
        # ensure at least one contact exists
        cid = getattr(request.config, "_contact_id", None)
        if not cid:
            cr = s.post(f"{API}/contact", json={
                "first_name": "TEST_X", "last_name": "Y", "email": "TEST_x@example.com",
                "inquiry_type": "journey",
                "message": "This is a test message for the admin submission listing flow.",
            })
            cid = cr.json()["id"]
        r = s.get(f"{API}/admin/submissions", headers=auth_headers)
        assert r.status_code == 200
        rows = r.json()
        assert any(row["id"] == cid for row in rows)

        # patch to reviewed
        rp = s.patch(f"{API}/admin/submissions/{cid}",
                     headers=auth_headers, json={"status": "reviewed"})
        assert rp.status_code == 200
        # verify persisted
        rows2 = s.get(f"{API}/admin/submissions", headers=auth_headers).json()
        assert next(r2 for r2 in rows2 if r2["id"] == cid)["status"] == "reviewed"

        # patch to responded
        rp2 = s.patch(f"{API}/admin/submissions/{cid}",
                      headers=auth_headers, json={"status": "responded"})
        assert rp2.status_code == 200

    def test_media_crud(self, s, auth_headers):
        tiny_png = ("data:image/png;base64,"
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=")
        # CREATE
        cr = s.post(f"{API}/admin/media", headers=auth_headers, json={
            "section": "gallery", "file_url": tiny_png, "file_type": "image",
            "caption": "TEST_caption", "alt_text": "TEST_alt", "category": "journeys",
            "sort_order": 99,
        })
        assert cr.status_code == 200, cr.text
        media = cr.json()
        mid = media["id"]
        assert media["section"] == "gallery" and media["caption"] == "TEST_caption"

        # PUBLIC GET filtered by section
        pg = s.get(f"{API}/media", params={"section": "gallery"})
        assert pg.status_code == 200
        assert any(m["id"] == mid for m in pg.json())

        # PATCH
        up = s.patch(f"{API}/admin/media/{mid}", headers=auth_headers,
                     json={"caption": "TEST_updated"})
        assert up.status_code == 200
        admin_list = s.get(f"{API}/admin/media", headers=auth_headers,
                           params={"section": "gallery"}).json()
        updated = next(m for m in admin_list if m["id"] == mid)
        assert updated["caption"] == "TEST_updated"

        # DELETE
        dl = s.delete(f"{API}/admin/media/{mid}", headers=auth_headers)
        assert dl.status_code == 200
        gone = s.get(f"{API}/media", params={"section": "gallery"}).json()
        assert not any(m["id"] == mid for m in gone)

    def test_settings_update_persists(self, s, auth_headers):
        # Read existing
        before = s.get(f"{API}/settings").json()
        original_email = before.get("contact_email", "hello@oncewerewild.com")
        new_email = f"TEST_{uuid.uuid4().hex[:6]}@oncewerewild.com"
        up = s.put(f"{API}/admin/settings", headers=auth_headers,
                   json={"settings": {"contact_email": new_email}})
        assert up.status_code == 200
        after = s.get(f"{API}/settings").json()
        assert after["contact_email"] == new_email
        # restore
        s.put(f"{API}/admin/settings", headers=auth_headers,
              json={"settings": {"contact_email": original_email}})


# ----------------- Change password validation -----------------
class TestChangePassword:
    def test_change_password_rejects_wrong_current(self, s, auth_headers):
        r = s.post(f"{API}/auth/change-password", headers=auth_headers,
                   json={"current_password": "definitely_wrong", "new_password": "NewWildAtHeart2026"})
        assert r.status_code == 400
        assert "current password" in r.json()["detail"].lower()
