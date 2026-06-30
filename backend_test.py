#!/usr/bin/env python3
"""
SESSION AF Backend Testing
Tests forgot-password, reset-password, admin content grouping, and regression checks.
"""

import requests
import json
import time
import re
import subprocess
from typing import Dict, Any, List, Optional

# Backend URL from frontend/.env
BASE_URL = "https://admin-content-sync-5.preview.emergentagent.com/api"

# Admin credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def log_pass(test_name: str, details: str = ""):
    """Log a passed test"""
    msg = f"✅ PASS: {test_name}"
    if details:
        msg += f" - {details}"
    print(msg)
    test_results["passed"].append(test_name)

def log_fail(test_name: str, details: str):
    """Log a failed test"""
    msg = f"❌ FAIL: {test_name} - {details}"
    print(msg)
    test_results["failed"].append(f"{test_name}: {details}")

def log_warning(test_name: str, details: str):
    """Log a warning"""
    msg = f"⚠️  WARNING: {test_name} - {details}"
    print(msg)
    test_results["warnings"].append(f"{test_name}: {details}")

def get_admin_token() -> str:
    """Login as admin and return Bearer token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        raise Exception(f"Admin login failed: {response.status_code} {response.text}")
    data = response.json()
    return data["access_token"]

def get_backend_logs(lines: int = 200) -> str:
    """Get backend error logs"""
    try:
        result = subprocess.run(
            ["tail", "-n", str(lines), "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout
    except Exception as e:
        return f"Error reading logs: {e}"

def extract_reset_token_from_logs(email: str, logs: str) -> Optional[str]:
    """Extract reset token from backend logs for a specific email"""
    # Log format: Reset link for <email> would be: https://.../admin/reset-password?token=<64-hex>
    pattern = rf"Reset link for {re.escape(email)} would be:.*?token=([a-f0-9]{{64}})"
    matches = re.findall(pattern, logs, re.IGNORECASE)
    if matches:
        return matches[-1]  # Return the most recent token
    return None

def clear_backend_logs():
    """Clear backend logs to isolate new entries"""
    try:
        subprocess.run(
            ["sudo", "truncate", "-s", "0", "/var/log/supervisor/backend.err.log"],
            timeout=5
        )
    except Exception as e:
        print(f"Warning: Could not clear logs: {e}")

# ============================================================================
# GROUP A: FORGOT-PASSWORD + RESET-PASSWORD INFRA
# ============================================================================

def test_group_a_forgot_reset_password():
    """Test forgot-password and reset-password flow"""
    print("\n" + "="*80)
    print("GROUP A: FORGOT-PASSWORD + RESET-PASSWORD INFRA")
    print("="*80)
    
    # Clear logs before starting
    clear_backend_logs()
    time.sleep(1)
    
    # A1: Forgot password with admin email
    print("\n--- A1: POST /api/auth/forgot-password with admin email ---")
    response = requests.post(
        f"{BASE_URL}/auth/forgot-password",
        json={"email": ADMIN_EMAIL, "origin": "https://oww.example/"}
    )
    
    if response.status_code == 200:
        body = response.json()
        if "If that email matches" in body.get("message", ""):
            log_pass("A1.1: Forgot-password returns 200 with generic message")
        else:
            log_fail("A1.1: Forgot-password message", f"Unexpected message: {body}")
    else:
        log_fail("A1.1: Forgot-password status", f"Expected 200, got {response.status_code}: {response.text}")
    
    # Wait for log to be written
    time.sleep(2)
    
    # Check logs for reset link
    logs = get_backend_logs(100)
    admin_token = extract_reset_token_from_logs(ADMIN_EMAIL, logs)
    
    if admin_token:
        log_pass("A1.2: Reset link logged for admin email", f"Token: {admin_token[:16]}...")
    else:
        log_fail("A1.2: Reset link in logs", "No reset link found in backend logs")
        print(f"Recent logs:\n{logs[-500:]}")
    
    # A2: Forgot password with unknown email
    print("\n--- A2: POST /api/auth/forgot-password with unknown email ---")
    response = requests.post(
        f"{BASE_URL}/auth/forgot-password",
        json={"email": "nobody@example.com", "origin": "https://oww.example/"}
    )
    
    if response.status_code == 200:
        body = response.json()
        if "If that email matches" in body.get("message", ""):
            log_pass("A2.1: Forgot-password returns same generic 200 for unknown email")
        else:
            log_fail("A2.1: Forgot-password message", f"Unexpected message: {body}")
    else:
        log_fail("A2.1: Forgot-password status", f"Expected 200, got {response.status_code}")
    
    # Check that no reset link was logged for unknown email
    time.sleep(1)
    logs = get_backend_logs(50)
    unknown_token = extract_reset_token_from_logs("nobody@example.com", logs)
    
    if not unknown_token:
        log_pass("A2.2: No reset link logged for unknown email (no enumeration)")
    else:
        log_fail("A2.2: Email enumeration", "Reset link logged for unknown email")
    
    # A3: Rate limiting test
    print("\n--- A3: Rate limiting (4 rapid requests) ---")
    clear_backend_logs()
    time.sleep(1)
    
    for i in range(4):
        response = requests.post(
            f"{BASE_URL}/auth/forgot-password",
            json={"email": ADMIN_EMAIL, "origin": "https://oww.example/"}
        )
        if response.status_code != 200:
            log_fail(f"A3.{i+1}: Rate limit request {i+1}", f"Expected 200, got {response.status_code}")
        time.sleep(0.5)
    
    time.sleep(2)
    logs = get_backend_logs(100)
    reset_links = re.findall(rf"Reset link for {re.escape(ADMIN_EMAIL)}", logs, re.IGNORECASE)
    
    if len(reset_links) <= 3:
        log_pass("A3: Rate limiting working", f"Found {len(reset_links)} reset links (max 3 expected)")
    else:
        log_fail("A3: Rate limiting", f"Found {len(reset_links)} reset links, expected max 3")
    
    # A4: Reset password with bogus token (wrong length)
    print("\n--- A4: POST /api/auth/reset-password with bogus token ---")
    response = requests.post(
        f"{BASE_URL}/auth/reset-password",
        json={"token": "bogus", "new_password": "TempA12345!"}
    )
    
    if response.status_code == 400:
        body = response.json()
        if "not valid" in body.get("detail", "").lower():
            log_pass("A4: Bogus token rejected with 400")
        else:
            log_fail("A4: Bogus token error message", f"Unexpected message: {body}")
    else:
        log_fail("A4: Bogus token status", f"Expected 400, got {response.status_code}")
    
    # A5: Reset password with non-existent token (64-hex)
    print("\n--- A5: POST /api/auth/reset-password with non-existent token ---")
    fake_token = "a" * 64
    response = requests.post(
        f"{BASE_URL}/auth/reset-password",
        json={"token": fake_token, "new_password": "TempA12345!"}
    )
    
    if response.status_code == 400:
        body = response.json()
        if "already been used" in body.get("detail", "").lower() or "no longer valid" in body.get("detail", "").lower():
            log_pass("A5: Non-existent token rejected with 400")
        else:
            log_fail("A5: Non-existent token error message", f"Unexpected message: {body}")
    else:
        log_fail("A5: Non-existent token status", f"Expected 400, got {response.status_code}")
    
    # A6: Reset password with short password
    print("\n--- A6: POST /api/auth/reset-password with short password ---")
    if not admin_token:
        log_fail("A6: Short password test", "No valid token available from A1")
        # Generate a new token
        clear_backend_logs()
        requests.post(f"{BASE_URL}/auth/forgot-password", json={"email": ADMIN_EMAIL, "origin": "https://oww.example/"})
        time.sleep(2)
        logs = get_backend_logs(50)
        admin_token = extract_reset_token_from_logs(ADMIN_EMAIL, logs)
    
    if admin_token:
        response = requests.post(
            f"{BASE_URL}/auth/reset-password",
            json={"token": admin_token, "new_password": "Short"}
        )
        
        if response.status_code == 400:
            body = response.json()
            if "at least 8 characters" in body.get("detail", "").lower():
                log_pass("A6: Short password rejected with 400")
            else:
                log_fail("A6: Short password error message", f"Unexpected message: {body}")
        else:
            log_fail("A6: Short password status", f"Expected 400, got {response.status_code}")
    
    # A7: Reset password with valid token and strong password
    print("\n--- A7: POST /api/auth/reset-password with valid token ---")
    # Generate a fresh token since we may have used it in A6
    clear_backend_logs()
    requests.post(f"{BASE_URL}/auth/forgot-password", json={"email": ADMIN_EMAIL, "origin": "https://oww.example/"})
    time.sleep(2)
    logs = get_backend_logs(50)
    admin_token = extract_reset_token_from_logs(ADMIN_EMAIL, logs)
    
    if not admin_token:
        log_fail("A7: Valid reset", "Could not get fresh token")
    else:
        response = requests.post(
            f"{BASE_URL}/auth/reset-password",
            json={"token": admin_token, "new_password": "TempA12345!"}
        )
        
        if response.status_code == 200:
            body = response.json()
            if "password has been reset" in body.get("message", "").lower():
                log_pass("A7: Valid reset successful with 200")
            else:
                log_fail("A7: Valid reset message", f"Unexpected message: {body}")
        else:
            log_fail("A7: Valid reset status", f"Expected 200, got {response.status_code}: {response.text}")
    
    # A8: Re-use the same token
    print("\n--- A8: Re-use same token immediately ---")
    response = requests.post(
        f"{BASE_URL}/auth/reset-password",
        json={"token": admin_token, "new_password": "TempA12345!"}
    )
    
    if response.status_code == 400:
        body = response.json()
        if "already been used" in body.get("detail", "").lower():
            log_pass("A8: Token re-use rejected with 400")
        else:
            log_fail("A8: Token re-use error message", f"Unexpected message: {body}")
    else:
        log_fail("A8: Token re-use status", f"Expected 400, got {response.status_code}")
    
    # A9: Login with new password
    print("\n--- A9: POST /api/auth/login with new password ---")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": "TempA12345!"}
    )
    
    if response.status_code == 200:
        body = response.json()
        if "access_token" in body:
            new_token = body["access_token"]
            log_pass("A9: Login with new password successful")
        else:
            log_fail("A9: Login response", "No access_token in response")
            new_token = None
    else:
        log_fail("A9: Login status", f"Expected 200, got {response.status_code}: {response.text}")
        new_token = None
    
    # A10: Change password back to original
    print("\n--- A10: POST /api/auth/change-password to restore original ---")
    if not new_token:
        log_fail("A10: Restore password", "No token available from A9")
    else:
        response = requests.post(
            f"{BASE_URL}/auth/change-password",
            json={"current_password": "TempA12345!", "new_password": ADMIN_PASSWORD},
            headers={"Authorization": f"Bearer {new_token}"}
        )
        
        if response.status_code == 200:
            log_pass("A10: Password restored to original")
        else:
            log_fail("A10: Restore password status", f"Expected 200, got {response.status_code}: {response.text}")
    
    # A11: Re-login with original password to confirm
    print("\n--- A11: POST /api/auth/login with original password ---")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code == 200:
        body = response.json()
        if "access_token" in body:
            log_pass("A11: Re-login with original password successful - CREDENTIALS RESTORED")
        else:
            log_fail("A11: Re-login response", "No access_token in response")
    else:
        log_fail("A11: Re-login status", f"Expected 200, got {response.status_code}: {response.text}")

# ============================================================================
# GROUP B: ADMIN CONTENT GROUPING + NEW KEYS
# ============================================================================

def test_group_b_admin_content():
    """Test admin content grouping and new keys"""
    print("\n" + "="*80)
    print("GROUP B: ADMIN CONTENT GROUPING + NEW KEYS")
    print("="*80)
    
    # Get admin token
    try:
        token = get_admin_token()
    except Exception as e:
        log_fail("B: Admin login", str(e))
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # B1: GET /api/admin/content and verify groups
    print("\n--- B1: GET /api/admin/content - verify groups and keys ---")
    response = requests.get(f"{BASE_URL}/admin/content", headers=headers)
    
    if response.status_code != 200:
        log_fail("B1: Admin content status", f"Expected 200, got {response.status_code}")
        return
    
    content_groups = response.json()
    
    # B1.1: tour_detail group with exactly 16 keys
    if "tour_detail" not in content_groups:
        log_fail("B1.1: tour_detail group", "Group not found")
    else:
        tour_detail_keys = [item["key"] for item in content_groups["tour_detail"]]
        expected_keys = [
            "tour_detail.highlights.heading",
            "tour_detail.small_group.heading",
            "tour_detail.small_group.body",
            "tour_detail.testimonials.heading",
            "tour_detail.tab.details",
            "tour_detail.tab.includes",
            "tour_detail.tab.prices",
            "tour_detail.download_pdf",
            "tour_detail.enquire",
            "tour_detail.loading",
            "tour_detail.not_found_title",
            "tour_detail.not_found_body",
            "tour_detail.kind.tour",
            "tour_detail.pdf_only_note",
            "tour_detail.empty_message",
            "tour_detail.back_to_tours"
        ]
        
        if len(tour_detail_keys) == 16:
            log_pass("B1.1a: tour_detail has exactly 16 keys")
        else:
            log_fail("B1.1a: tour_detail key count", f"Expected 16, got {len(tour_detail_keys)}")
        
        missing_keys = [k for k in expected_keys if k not in tour_detail_keys]
        if not missing_keys:
            log_pass("B1.1b: All expected tour_detail keys present")
        else:
            log_fail("B1.1b: tour_detail keys", f"Missing: {missing_keys}")
    
    # B1.2: pricing group should NOT contain tour_detail.* keys
    if "pricing" not in content_groups:
        log_fail("B1.2: pricing group", "Group not found")
    else:
        pricing_keys = [item["key"] for item in content_groups["pricing"]]
        tour_detail_in_pricing = [k for k in pricing_keys if k.startswith("tour_detail.")]
        
        if not tour_detail_in_pricing:
            log_pass("B1.2: pricing group has no tour_detail.* keys (migration successful)")
        else:
            log_fail("B1.2: pricing group migration", f"Found tour_detail keys: {tour_detail_in_pricing}")
    
    # B1.3: about group >= 15 keys with new ones
    if "about" not in content_groups:
        log_fail("B1.3: about group", "Group not found")
    else:
        about_keys = [item["key"] for item in content_groups["about"]]
        expected_new_keys = [
            "about.blocks.empty",
            "about.stories.empty",
            "about.stories.read_cta",
            "about.travel.eyebrow",
            "about.travel.title"
        ]
        
        if len(about_keys) >= 15:
            log_pass("B1.3a: about group has >= 15 keys", f"Found {len(about_keys)}")
        else:
            log_fail("B1.3a: about group key count", f"Expected >= 15, got {len(about_keys)}")
        
        missing_keys = [k for k in expected_new_keys if k not in about_keys]
        if not missing_keys:
            log_pass("B1.3b: All expected new about keys present")
        else:
            log_fail("B1.3b: about new keys", f"Missing: {missing_keys}")
    
    # B1.4: blog group >= 13 keys
    if "blog" not in content_groups:
        log_fail("B1.4: blog group", "Group not found")
    else:
        blog_keys = [item["key"] for item in content_groups["blog"]]
        expected_blog_keys = [
            "blog.loading",
            "blog.load_more",
            "blog.card.read_more",
            "blog.post.loading",
            "blog.post.not_found_title",
            "blog.post.not_found_body",
            "blog.post.not_found_cta",
            "blog.post.back_to_journal"
        ]
        
        if len(blog_keys) >= 13:
            log_pass("B1.4a: blog group has >= 13 keys", f"Found {len(blog_keys)}")
        else:
            log_fail("B1.4a: blog group key count", f"Expected >= 13, got {len(blog_keys)}")
        
        missing_keys = [k for k in expected_blog_keys if k not in blog_keys]
        if not missing_keys:
            log_pass("B1.4b: Expected blog keys present")
        else:
            log_fail("B1.4b: blog keys", f"Missing: {missing_keys}")
    
    # B1.5: home group includes home.journal.card_read_more
    if "home" not in content_groups:
        log_fail("B1.5: home group", "Group not found")
    else:
        home_keys = [item["key"] for item in content_groups["home"]]
        if "home.journal.card_read_more" in home_keys:
            log_pass("B1.5: home.journal.card_read_more present")
        else:
            log_fail("B1.5: home.journal.card_read_more", "Key not found")
    
    # B1.6: footer group includes new keys
    if "footer" not in content_groups:
        log_fail("B1.6: footer group", "Group not found")
    else:
        footer_keys = [item["key"] for item in content_groups["footer"]]
        expected_footer_keys = [
            "footer.enquiry_sending",
            "footer.copyright_rights_text",
            "footer.cookies_link"
        ]
        
        missing_keys = [k for k in expected_footer_keys if k not in footer_keys]
        if not missing_keys:
            log_pass("B1.6: All expected footer keys present")
        else:
            log_fail("B1.6: footer keys", f"Missing: {missing_keys}")
    
    # B2: GET /api/content (public) returns ~226 keys
    print("\n--- B2: GET /api/content (public) - verify total keys ---")
    response = requests.get(f"{BASE_URL}/content")
    
    if response.status_code != 200:
        log_fail("B2: Public content status", f"Expected 200, got {response.status_code}")
    else:
        content = response.json()
        total_keys = len(content)
        
        if total_keys >= 226:
            log_pass("B2: Public content has ~226 keys", f"Found {total_keys}")
        else:
            log_fail("B2: Public content key count", f"Expected ~226, got {total_keys}")
    
    # B3: ROUND-TRIP test
    print("\n--- B3: ROUND-TRIP test - update and restore keys ---")
    
    # Get current values
    response = requests.get(f"{BASE_URL}/content")
    if response.status_code != 200:
        log_fail("B3: Get baseline", "Could not fetch content")
        return
    
    baseline = response.json()
    original_read_cta = baseline.get("about.stories.read_cta", "")
    original_kind_tour = baseline.get("tour_detail.kind.tour", "")
    
    # Update values
    update_payload = {
        "items": [
            {"key": "about.stories.read_cta", "value": "Open story"},
            {"key": "tour_detail.kind.tour", "value": "Group Journey"}
        ]
    }
    
    response = requests.put(
        f"{BASE_URL}/admin/content",
        json=update_payload,
        headers=headers
    )
    
    if response.status_code != 200:
        log_fail("B3.1: Update keys", f"Expected 200, got {response.status_code}: {response.text}")
    else:
        log_pass("B3.1: Update keys successful")
    
    # Verify new values
    response = requests.get(f"{BASE_URL}/content")
    if response.status_code != 200:
        log_fail("B3.2: Get updated content", "Could not fetch content")
    else:
        updated = response.json()
        
        if updated.get("about.stories.read_cta") == "Open story":
            log_pass("B3.2a: about.stories.read_cta updated correctly")
        else:
            log_fail("B3.2a: about.stories.read_cta", f"Expected 'Open story', got '{updated.get('about.stories.read_cta')}'")
        
        if updated.get("tour_detail.kind.tour") == "Group Journey":
            log_pass("B3.2b: tour_detail.kind.tour updated correctly")
        else:
            log_fail("B3.2b: tour_detail.kind.tour", f"Expected 'Group Journey', got '{updated.get('tour_detail.kind.tour')}'")
    
    # Restore original values
    restore_payload = {
        "items": [
            {"key": "about.stories.read_cta", "value": original_read_cta or "Read story"},
            {"key": "tour_detail.kind.tour", "value": original_kind_tour or "Small Group Tour"}
        ]
    }
    
    response = requests.put(
        f"{BASE_URL}/admin/content",
        json=restore_payload,
        headers=headers
    )
    
    if response.status_code != 200:
        log_fail("B3.3: Restore keys", f"Expected 200, got {response.status_code}")
    else:
        log_pass("B3.3: Keys restored to original values")
    
    # Verify restoration
    response = requests.get(f"{BASE_URL}/content")
    if response.status_code == 200:
        restored = response.json()
        if restored.get("about.stories.read_cta") == (original_read_cta or "Read story"):
            log_pass("B3.4: about.stories.read_cta restoration verified")
        else:
            log_fail("B3.4: about.stories.read_cta restoration", f"Value mismatch")
    
    # B4: LABEL BACKFILL - spot check legacy keys
    print("\n--- B4: LABEL BACKFILL - verify human-readable labels ---")
    
    response = requests.get(f"{BASE_URL}/admin/content", headers=headers)
    if response.status_code != 200:
        log_fail("B4: Get admin content", "Could not fetch content")
        return
    
    content_groups = response.json()
    
    # Check a few legacy keys for human-readable labels
    test_keys = {
        "brand.tagline": "brand",
        "home.manifesto.eyebrow": "home",
        "contact.hero.eyebrow": "contact"
    }
    
    for key, group in test_keys.items():
        if group in content_groups:
            items = content_groups[group]
            item = next((i for i in items if i["key"] == key), None)
            
            if item:
                label = item.get("label", "")
                # Label should be human-readable, not just the key itself
                if label and label != key and len(label) > 5:
                    log_pass(f"B4: {key} has human-readable label", f"'{label}'")
                else:
                    log_fail(f"B4: {key} label", f"Label is not human-readable: '{label}'")
            else:
                log_warning(f"B4: {key}", "Key not found in group")

# ============================================================================
# GROUP C: REGRESSION
# ============================================================================

def test_group_c_regression():
    """Test regression checks"""
    print("\n" + "="*80)
    print("GROUP C: REGRESSION")
    print("="*80)
    
    # C1: GET /api/content
    print("\n--- C1: GET /api/content ---")
    response = requests.get(f"{BASE_URL}/content")
    
    if response.status_code == 200:
        content = response.json()
        total_keys = len(content)
        log_pass("C1: GET /api/content returns 200", f"Total keys: {total_keys}")
    else:
        log_fail("C1: GET /api/content", f"Expected 200, got {response.status_code}")
    
    # C2: GET /api/journeys
    print("\n--- C2: GET /api/journeys ---")
    response = requests.get(f"{BASE_URL}/journeys")
    
    if response.status_code == 200:
        journeys = response.json()
        if len(journeys) == 4:
            log_pass("C2: GET /api/journeys returns 4 rows")
        else:
            log_fail("C2: GET /api/journeys count", f"Expected 4, got {len(journeys)}")
    else:
        log_fail("C2: GET /api/journeys", f"Expected 200, got {response.status_code}")
    
    # C3: GET /api/media
    print("\n--- C3: GET /api/media ---")
    response = requests.get(f"{BASE_URL}/media")
    
    if response.status_code == 200:
        media = response.json()
        if len(media) >= 309:
            log_pass("C3: GET /api/media returns >= 309 rows", f"Found {len(media)}")
        else:
            log_fail("C3: GET /api/media count", f"Expected >= 309, got {len(media)}")
    else:
        log_fail("C3: GET /api/media", f"Expected 200, got {response.status_code}")
    
    # C4: GET /api/blog
    print("\n--- C4: GET /api/blog ---")
    response = requests.get(f"{BASE_URL}/blog")
    
    if response.status_code == 200:
        blog_posts = response.json()
        if len(blog_posts) >= 1:
            log_pass("C4: GET /api/blog returns >= 1 published post", f"Found {len(blog_posts)}")
        else:
            log_fail("C4: GET /api/blog count", f"Expected >= 1, got {len(blog_posts)}")
    else:
        log_fail("C4: GET /api/blog", f"Expected 200, got {response.status_code}")
    
    # C5: GET /api/settings
    print("\n--- C5: GET /api/settings ---")
    response = requests.get(f"{BASE_URL}/settings")
    
    if response.status_code == 200:
        settings = response.json()
        if len(settings) == 19:
            log_pass("C5: GET /api/settings returns 19 settings")
        else:
            log_warning("C5: GET /api/settings count", f"Expected 19, got {len(settings)}")
    else:
        log_fail("C5: GET /api/settings", f"Expected 200, got {response.status_code}")
    
    # C6: Check site_snapshot.json exists and was modified
    print("\n--- C6: Check /app/backend/seed_data/site_snapshot.json ---")
    import os
    snapshot_path = "/app/backend/seed_data/site_snapshot.json"
    
    if os.path.exists(snapshot_path):
        stat = os.stat(snapshot_path)
        log_pass("C6: site_snapshot.json exists", f"Size: {stat.st_size} bytes")
    else:
        log_fail("C6: site_snapshot.json", "File not found")

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Run all test groups"""
    print("\n" + "="*80)
    print("SESSION AF BACKEND TESTING")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Admin Email: {ADMIN_EMAIL}")
    print(f"Admin Password: {ADMIN_PASSWORD}")
    
    # Run all test groups
    test_group_a_forgot_reset_password()
    test_group_b_admin_content()
    test_group_c_regression()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"✅ PASSED: {len(test_results['passed'])}")
    print(f"❌ FAILED: {len(test_results['failed'])}")
    print(f"⚠️  WARNINGS: {len(test_results['warnings'])}")
    
    if test_results['failed']:
        print("\nFAILED TESTS:")
        for failure in test_results['failed']:
            print(f"  - {failure}")
    
    if test_results['warnings']:
        print("\nWARNINGS:")
        for warning in test_results['warnings']:
            print(f"  - {warning}")
    
    print("\n" + "="*80)
    print("CRITICAL: Verify admin credentials still work")
    print("="*80)
    
    # Final verification: admin credentials still work
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code == 200 and "access_token" in response.json():
        print("✅ VERIFIED: Admin credentials (info@oncewerewild.com / ChangeMe-OWW-2026!) still work")
    else:
        print("❌ CRITICAL: Admin credentials NOT working! Password may not have been restored!")
        print(f"   Response: {response.status_code} {response.text}")

if __name__ == "__main__":
    main()
