"""Backend tests for the Contact-section admin content editing.

Verifies:
  * Login as admin via /api/auth/login
  * GET /api/admin/content returns groups with the new contact keys
  * PUT /api/admin/content persists a change and GET /api/content reflects it
  * Default copy reverts back when restored
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "WildAtHeart2026"

REQUIRED_CONTACT_KEYS = [
    "contact.hero.eyebrow",
    "contact.hero.title",
    "contact.hero.intro",
    "contact.info.eyebrow",
    "contact.info.email_label",
    "contact.info.phone_label",
    "contact.info.address_label",
    "contact.info.hours_label",
    "contact.form.first_name_label",
    "contact.form.last_name_label",
    "contact.form.email_label",
    "contact.form.phone_label",
    "contact.form.phone_placeholder",
    "contact.form.inquiry_label",
    "contact.form.inquiry_placeholder",
    "contact.form.message_label",
    "contact.form.message_placeholder",
    "contact.form.referral_label",
    "contact.form.referral_placeholder",
    "contact.form.submit_idle",
    "contact.form.submit_sending",
    "contact.errors.first_name",
    "contact.errors.last_name",
    "contact.errors.email",
    "contact.errors.inquiry",
    "contact.errors.message",
    "contact.success.heading",
    "contact.success.send_another",
    "contact.directions.label",
]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    # Could be either {access_token} or {status:'otp_required',...}
    if data.get("status") == "otp_required":
        pytest.skip("OTP required for admin login in this env")
    token = data.get("access_token")
    assert token, f"No access_token in response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def test_admin_content_contains_all_contact_keys(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/content", headers=auth_headers, timeout=20)
    assert r.status_code == 200, r.text
    groups = r.json()
    assert "contact" in groups, f"contact group missing. Got groups: {list(groups.keys())}"
    contact_items = groups["contact"]
    present_keys = {it["key"] for it in contact_items}
    missing = [k for k in REQUIRED_CONTACT_KEYS if k not in present_keys]
    assert not missing, f"Missing contact keys in admin content: {missing}"
    # Sanity: each item exposes value
    for it in contact_items:
        assert "key" in it and "value" in it


def test_public_content_returns_contact_keys():
    r = requests.get(f"{BASE_URL}/api/content", timeout=20)
    assert r.status_code == 200
    data = r.json()
    # /api/content may be flat dict {key: value}
    if isinstance(data, dict):
        keys = set(data.keys())
    else:
        keys = {row["key"] for row in data}
    missing = [k for k in REQUIRED_CONTACT_KEYS if k not in keys]
    assert not missing, f"Public /api/content missing keys: {missing}"


def test_edit_first_name_label_persists_and_reverts(auth_headers):
    target = "contact.form.first_name_label"
    new_val = "Your given name"
    # PUT new value
    r = requests.put(
        f"{BASE_URL}/api/admin/content",
        json={"items": [{"key": target, "value": new_val}]},
        headers=auth_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text

    # GET public content reflects change
    g = requests.get(f"{BASE_URL}/api/content", timeout=20).json()
    val = g.get(target) if isinstance(g, dict) else {row["key"]: row["value"] for row in g}.get(target)
    assert val == new_val, f"Public content not updated. Got {val!r}"

    # Revert
    revert = requests.put(
        f"{BASE_URL}/api/admin/content",
        json={"items": [{"key": target, "value": "First name"}]},
        headers=auth_headers,
        timeout=20,
    )
    assert revert.status_code == 200, revert.text
    g2 = requests.get(f"{BASE_URL}/api/content", timeout=20).json()
    val2 = g2.get(target) if isinstance(g2, dict) else {row["key"]: row["value"] for row in g2}.get(target)
    assert val2 == "First name", f"Revert failed: {val2!r}"
