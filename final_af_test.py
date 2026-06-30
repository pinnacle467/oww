#!/usr/bin/env python3
"""
SESSION AF Backend Testing - Final comprehensive test
Uses database to extract tokens since logging isn't working as expected
"""

import requests
import json
import time
import asyncio
import os
import sys
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
import uuid

sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from server import db, seed

BASE_URL = "https://ba765502-99f4-476b-8f71-7e6b0cad8227.preview.emergentagent.com/api"
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

test_results = {"passed": [], "failed": []}

def log_pass(test, details=""):
    msg = f"✅ PASS: {test}"
    if details:
        msg += f" - {details}"
    print(msg)
    test_results["passed"].append(test)

def log_fail(test, details):
    msg = f"❌ FAIL: {test} - {details}"
    print(msg)
    test_results["failed"].append(f"{test}: {details}")

async def test_group_a():
    """Test forgot-password and reset-password flow"""
    print("\n" + "="*80)
    print("GROUP A: FORGOT-PASSWORD + RESET-PASSWORD INFRA")
    print("="*80)
    
    # Ensure admin user exists
    await seed()
    user = await db.users.find_one({"email": ADMIN_EMAIL})
    if not user:
        log_fail("A0: Admin user seed", "Admin user not found after seed")
        return
    
    # A1: Forgot password with admin email
    print("\n--- A1: POST /api/auth/forgot-password with admin email ---")
    await db.password_reset_tokens.delete_many({"user_id": user["id"]})
    
    response = requests.post(
        f"{BASE_URL}/auth/forgot-password",
        json={"email": ADMIN_EMAIL, "origin": "https://oww.example/"}
    )
    
    if response.status_code == 200:
        body = response.json()
        if "If that email matches" in body.get("message", ""):
            log_pass("A1.1: Forgot-password returns 200 with generic message")
        else:
            log_fail("A1.1: Forgot-password message", f"Unexpected: {body}")
    else:
        log_fail("A1.1: Forgot-password status", f"Expected 200, got {response.status_code}")
    
    time.sleep(1)
    
    # Check database for token (since logging isn't working)
    token_doc = await db.password_reset_tokens.find_one({"user_id": user["id"], "used": False})
    if token_doc:
        log_pass("A1.2: Reset token created in database")
    else:
        log_fail("A1.2: Reset token creation", "No token found in database")
        return
    
    # A2: Forgot password with unknown email
    print("\n--- A2: POST /api/auth/forgot-password with unknown email ---")
    response = requests.post(
        f"{BASE_URL}/auth/forgot-password",
        json={"email": "nobody@example.com", "origin": "https://oww.example/"}
    )
    
    if response.status_code == 200:
        body = response.json()
        if "If that email matches" in body.get("message", ""):
            log_pass("A2: Forgot-password returns same generic 200 for unknown email (no enumeration)")
        else:
            log_fail("A2: Forgot-password message", f"Unexpected: {body}")
    else:
        log_fail("A2: Forgot-password status", f"Expected 200, got {response.status_code}")
    
    # A3: Rate limiting
    print("\n--- A3: Rate limiting (4 rapid requests) ---")
    await db.password_reset_rate.delete_many({})
    
    for i in range(4):
        response = requests.post(
            f"{BASE_URL}/auth/forgot-password",
            json={"email": ADMIN_EMAIL, "origin": "https://oww.example/"}
        )
        if response.status_code != 200:
            log_fail(f"A3: Request {i+1}", f"Expected 200, got {response.status_code}")
        time.sleep(0.3)
    
    time.sleep(1)
    rl = await db.password_reset_rate.find_one({"identifier": f"reset:{ADMIN_EMAIL}"})
    if rl and rl.get("count", 0) <= 3:
        log_pass("A3: Rate limiting working", f"Count: {rl.get('count', 0)}")
    else:
        log_fail("A3: Rate limiting", f"Count: {rl.get('count', 0) if rl else 'N/A'}")
    
    # A4-A10: Reset password flow with known token
    print("\n--- A4-A10: Reset password flow ---")
    
    # Create a known token for testing
    plain_token = secrets.token_hex(32)
    token_hash = hashlib.sha256(plain_token.encode()).hexdigest()
    
    await db.password_reset_tokens.update_many(
        {"user_id": user["id"], "used": False},
        {"$set": {"used": True}}
    )
    
    now = datetime.now(timezone.utc)
    await db.password_reset_tokens.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "token_hash": token_hash,
        "expires_at": (now + timedelta(minutes=30)).isoformat(),
        "used": False,
        "created_at": now.isoformat(),
    })
    
    # A4: Bogus token
    response = requests.post(
        f"{BASE_URL}/auth/reset-password",
        json={"token": "bogus", "new_password": "TempA12345!"}
    )
    if response.status_code == 400:
        log_pass("A4: Bogus token rejected with 400")
    else:
        log_fail("A4: Bogus token", f"Expected 400, got {response.status_code}")
    
    # A5: Non-existent token
    fake_token = "a" * 64
    response = requests.post(
        f"{BASE_URL}/auth/reset-password",
        json={"token": fake_token, "new_password": "TempA12345!"}
    )
    if response.status_code == 400:
        log_pass("A5: Non-existent token rejected with 400")
    else:
        log_fail("A5: Non-existent token", f"Expected 400, got {response.status_code}")
    
    # A6: Short password
    response = requests.post(
        f"{BASE_URL}/auth/reset-password",
        json={"token": plain_token, "new_password": "Short"}
    )
    if response.status_code == 400:
        log_pass("A6: Short password rejected with 400")
    else:
        log_fail("A6: Short password", f"Expected 400, got {response.status_code}")
    
    # A7: Valid reset
    response = requests.post(
        f"{BASE_URL}/auth/reset-password",
        json={"token": plain_token, "new_password": "TempA12345!"}
    )
    if response.status_code == 200:
        log_pass("A7: Valid reset successful with 200")
    else:
        log_fail("A7: Valid reset", f"Expected 200, got {response.status_code}: {response.text}")
        return
    
    # A8: Re-use same token
    response = requests.post(
        f"{BASE_URL}/auth/reset-password",
        json={"token": plain_token, "new_password": "TempA12345!"}
    )
    if response.status_code in [400, 422]:
        log_pass("A8: Token re-use rejected")
    else:
        log_fail("A8: Token re-use", f"Expected 400/422, got {response.status_code}")
    
    # A9: Login with new password
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": "TempA12345!"}
    )
    if response.status_code == 200:
        new_token = response.json()["access_token"]
        log_pass("A9: Login with new password successful")
    else:
        log_fail("A9: Login with new password", f"Expected 200, got {response.status_code}")
        return
    
    # A10: Change password back
    response = requests.post(
        f"{BASE_URL}/auth/change-password",
        json={"current_password": "TempA12345!", "new_password": ADMIN_PASSWORD},
        headers={"Authorization": f"Bearer {new_token}"}
    )
    if response.status_code == 200:
        log_pass("A10: Password restored to original")
    else:
        log_fail("A10: Password restore", f"Expected 200, got {response.status_code}")
    
    # A11: Verify original password
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        log_pass("A11: Re-login with original password successful - CREDENTIALS RESTORED")
    else:
        log_fail("A11: Re-login", f"Expected 200, got {response.status_code}")

def test_group_b():
    """Test admin content grouping"""
    print("\n" + "="*80)
    print("GROUP B: ADMIN CONTENT GROUPING + NEW KEYS")
    print("="*80)
    
    token = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # B1: Verify groups
    print("\n--- B1: GET /api/admin/content ---")
    response = requests.get(f"{BASE_URL}/admin/content", headers=headers)
    content_groups = response.json()
    
    # tour_detail group
    if "tour_detail" in content_groups and len(content_groups["tour_detail"]) == 16:
        log_pass("B1.1: tour_detail has exactly 16 keys")
    else:
        log_fail("B1.1: tour_detail", f"Expected 16 keys, got {len(content_groups.get('tour_detail', []))}")
    
    # pricing group should not have tour_detail.* keys
    if "pricing" in content_groups:
        pricing_keys = [item["key"] for item in content_groups["pricing"]]
        tour_detail_in_pricing = [k for k in pricing_keys if k.startswith("tour_detail.")]
        if not tour_detail_in_pricing:
            log_pass("B1.2: pricing group has no tour_detail.* keys (migration successful)")
        else:
            log_fail("B1.2: pricing migration", f"Found: {tour_detail_in_pricing}")
    
    # about group
    if "about" in content_groups and len(content_groups["about"]) >= 15:
        log_pass("B1.3: about group has >= 15 keys", f"Found {len(content_groups['about'])}")
    else:
        log_fail("B1.3: about group", f"Expected >= 15, got {len(content_groups.get('about', []))}")
    
    # blog group
    if "blog" in content_groups and len(content_groups["blog"]) >= 13:
        log_pass("B1.4: blog group has >= 13 keys", f"Found {len(content_groups['blog'])}")
    else:
        log_fail("B1.4: blog group", f"Expected >= 13, got {len(content_groups.get('blog', []))}")
    
    # home.journal.card_read_more
    if "home" in content_groups:
        home_keys = [item["key"] for item in content_groups["home"]]
        if "home.journal.card_read_more" in home_keys:
            log_pass("B1.5: home.journal.card_read_more present")
        else:
            log_fail("B1.5: home.journal.card_read_more", "Key not found")
    
    # footer keys
    if "footer" in content_groups:
        footer_keys = [item["key"] for item in content_groups["footer"]]
        expected = ["footer.enquiry_sending", "footer.copyright_rights_text", "footer.cookies_link"]
        missing = [k for k in expected if k not in footer_keys]
        if not missing:
            log_pass("B1.6: All expected footer keys present")
        else:
            log_fail("B1.6: footer keys", f"Missing: {missing}")
    
    # B2: Public content
    print("\n--- B2: GET /api/content (public) ---")
    response = requests.get(f"{BASE_URL}/content")
    if response.status_code == 200 and len(response.json()) >= 226:
        log_pass("B2: Public content has ~226 keys", f"Found {len(response.json())}")
    else:
        log_fail("B2: Public content", f"Expected >= 226, got {len(response.json())}")
    
    # B3: Round-trip
    print("\n--- B3: ROUND-TRIP test ---")
    baseline = requests.get(f"{BASE_URL}/content").json()
    
    update_payload = {
        "items": [
            {"key": "about.stories.read_cta", "value": "Open story"},
            {"key": "tour_detail.kind.tour", "value": "Group Journey"}
        ]
    }
    response = requests.put(f"{BASE_URL}/admin/content", json=update_payload, headers=headers)
    
    if response.status_code == 200:
        log_pass("B3.1: Update keys successful")
        
        updated = requests.get(f"{BASE_URL}/content").json()
        if updated.get("about.stories.read_cta") == "Open story":
            log_pass("B3.2: about.stories.read_cta updated correctly")
        else:
            log_fail("B3.2: about.stories.read_cta", f"Got '{updated.get('about.stories.read_cta')}'")
        
        if updated.get("tour_detail.kind.tour") == "Group Journey":
            log_pass("B3.3: tour_detail.kind.tour updated correctly")
        else:
            log_fail("B3.3: tour_detail.kind.tour", f"Got '{updated.get('tour_detail.kind.tour')}'")
        
        # Restore
        restore_payload = {
            "items": [
                {"key": "about.stories.read_cta", "value": baseline.get("about.stories.read_cta", "Read story")},
                {"key": "tour_detail.kind.tour", "value": baseline.get("tour_detail.kind.tour", "Small Group Tour")}
            ]
        }
        requests.put(f"{BASE_URL}/admin/content", json=restore_payload, headers=headers)
        log_pass("B3.4: Keys restored")
    else:
        log_fail("B3.1: Update keys", f"Expected 200, got {response.status_code}")
    
    # B4: Label backfill
    print("\n--- B4: LABEL BACKFILL ---")
    response = requests.get(f"{BASE_URL}/admin/content", headers=headers)
    content_groups = response.json()
    
    test_keys = {"brand.tagline": "brand", "home.manifesto.eyebrow": "home"}
    for key, group in test_keys.items():
        if group in content_groups:
            item = next((i for i in content_groups[group] if i["key"] == key), None)
            if item and item.get("label") and item["label"] != key:
                log_pass(f"B4: {key} has human-readable label")
            else:
                log_fail(f"B4: {key}", "Label not human-readable")

def test_group_c():
    """Test regression"""
    print("\n" + "="*80)
    print("GROUP C: REGRESSION")
    print("="*80)
    
    tests = [
        ("C1: GET /api/content", f"{BASE_URL}/content", lambda r: len(r.json()) >= 226),
        ("C2: GET /api/journeys", f"{BASE_URL}/journeys", lambda r: len(r.json()) == 4),
        ("C3: GET /api/media", f"{BASE_URL}/media", lambda r: len(r.json()) >= 309),
        ("C4: GET /api/blog", f"{BASE_URL}/blog", lambda r: len(r.json()) >= 1),
        ("C5: GET /api/settings", f"{BASE_URL}/settings", lambda r: len(r.json()) == 19),
    ]
    
    for test_name, url, check in tests:
        response = requests.get(url)
        if response.status_code == 200 and check(response):
            log_pass(test_name)
        else:
            log_fail(test_name, f"Status: {response.status_code}")
    
    # C6: Snapshot file
    import os
    if os.path.exists("/app/backend/seed_data/site_snapshot.json"):
        log_pass("C6: site_snapshot.json exists")
    else:
        log_fail("C6: site_snapshot.json", "File not found")

async def main():
    print("="*80)
    print("SESSION AF BACKEND TESTING - FINAL COMPREHENSIVE TEST")
    print("="*80)
    
    await test_group_a()
    test_group_b()
    test_group_c()
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"✅ PASSED: {len(test_results['passed'])}")
    print(f"❌ FAILED: {len(test_results['failed'])}")
    
    if test_results['failed']:
        print("\nFAILED TESTS:")
        for failure in test_results['failed']:
            print(f"  - {failure}")
    
    print("\n" + "="*80)
    print("FINAL VERIFICATION: Admin credentials")
    print("="*80)
    response = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if response.status_code == 200:
        print("✅ VERIFIED: Admin credentials (info@oncewerewild.com / ChangeMe-OWW-2026!) still work")
    else:
        print("❌ CRITICAL: Admin credentials NOT working!")

asyncio.run(main())
