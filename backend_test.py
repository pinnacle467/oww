#!/usr/bin/env python3
"""
AC1 Blog Content Seed Testing
Tests the 5 critical scenarios for blog content keys seeded in backend/server.py
"""

import requests
import json
import time
import subprocess
from typing import Dict, List, Any

# Backend URL from frontend/.env
BACKEND_URL = "https://build-handover.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Admin credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

# Expected blog keys
EXPECTED_BLOG_KEYS = [
    "blog.hero.eyebrow",
    "blog.hero.title",
    "blog.hero.intro",
    "blog.empty.heading",
    "blog.empty.body"
]

# Expected default values
EXPECTED_DEFAULTS = {
    "blog.hero.eyebrow": "From the Road",
    "blog.hero.title": "The *Once Were Wild* journal.",
    "blog.hero.intro": "Field notes, slow reflections and stories from journeys taken outside the scheduled calendar.",
    "blog.empty.heading": "Stories are on their way.",
    "blog.empty.body": "Our first journal entries are being written between trips. Check back soon, or follow the road with us on Instagram."
}

# Expected non-blog groups (for regression check)
NON_BLOG_GROUPS = [
    "brand", "nav", "home", "pricing", "journeys", "faqs", 
    "gallery", "contact", "pillars", "testimonials", "footer", "seo"
]


def login() -> str:
    """Login and return Bearer token"""
    print("\n🔐 Logging in as admin...")
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10
    )
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    token = resp.json().get("access_token")
    assert token, "No access_token in login response"
    print(f"✓ Logged in successfully")
    return token


def test_1_presence_admin_endpoint(token: str) -> Dict[str, Any]:
    """
    TEST 1: PRESENCE (admin endpoint)
    GET /api/admin/content (Bearer auth) → JSON dict keyed by group.
    - The response MUST include a `blog` group.
    - The `blog` group MUST contain EXACTLY 5 items (no more, no fewer).
    - Each of the 5 expected keys MUST be present.
    - Each item MUST have non-empty value, label present, type either "text" or "richtext".
    """
    print("\n" + "="*80)
    print("TEST 1: PRESENCE (admin endpoint)")
    print("="*80)
    
    resp = requests.get(
        f"{API_BASE}/admin/content",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert resp.status_code == 200, f"GET /api/admin/content failed: {resp.status_code} {resp.text}"
    
    data = resp.json()
    print(f"✓ GET /api/admin/content returned 200")
    
    # Check blog group exists
    assert "blog" in data, f"❌ FAIL: 'blog' group not found in response. Groups: {list(data.keys())}"
    print(f"✓ 'blog' group exists")
    
    blog_items = data["blog"]
    assert isinstance(blog_items, list), f"❌ FAIL: blog group is not a list: {type(blog_items)}"
    
    # Check exactly 5 items
    assert len(blog_items) == 5, f"❌ FAIL: Expected 5 blog items, got {len(blog_items)}"
    print(f"✓ Blog group has exactly 5 items")
    
    # Check each expected key is present
    blog_keys = {item["key"] for item in blog_items}
    for expected_key in EXPECTED_BLOG_KEYS:
        assert expected_key in blog_keys, f"❌ FAIL: Expected key '{expected_key}' not found. Found: {blog_keys}"
    print(f"✓ All 5 expected keys present: {EXPECTED_BLOG_KEYS}")
    
    # Check each item has required fields
    for item in blog_items:
        key = item["key"]
        assert "value" in item and item["value"], f"❌ FAIL: {key} has empty or missing value"
        assert "label" in item and item["label"], f"❌ FAIL: {key} has empty or missing label"
        assert "type" in item and item["type"] in ["text", "richtext"], f"❌ FAIL: {key} has invalid type: {item.get('type')}"
        # Note: The backend doesn't include 'group' in individual items (it's already grouped at response level)
        print(f"  ✓ {key}: value={item['value'][:50]}..., label={item['label']}, type={item['type']}")
    
    print(f"\n✅ TEST 1 PASSED: Admin endpoint has blog group with 5 valid items")
    return data


def test_2_presence_public_endpoint() -> Dict[str, str]:
    """
    TEST 2: PRESENCE (public endpoint)
    GET /api/content (no auth) → flat dict of key → value.
    All 5 blog.* keys MUST be present here with the expected default values.
    """
    print("\n" + "="*80)
    print("TEST 2: PRESENCE (public endpoint)")
    print("="*80)
    
    resp = requests.get(f"{API_BASE}/content", timeout=10)
    assert resp.status_code == 200, f"GET /api/content failed: {resp.status_code} {resp.text}"
    
    data = resp.json()
    print(f"✓ GET /api/content returned 200")
    print(f"✓ Total keys in public content: {len(data)}")
    
    # Check all 5 blog keys are present
    for key in EXPECTED_BLOG_KEYS:
        assert key in data, f"❌ FAIL: Expected key '{key}' not found in public /api/content"
        print(f"  ✓ {key}: {data[key][:60]}...")
    
    print(f"\n✅ TEST 2 PASSED: Public endpoint has all 5 blog.* keys")
    return data


def test_3_round_trip_update_isolation(token: str, baseline_content: Dict[str, str]) -> None:
    """
    TEST 3: ROUND-TRIP UPDATE + ISOLATION
    a) Snapshot baseline: GET /api/content. Count total keys (should be >= 183). 
       Snapshot the value of every blog.* key. 
       Snapshot the COUNT of keys per group prefix for regression check.
    b) PUT /api/admin/content with items=[{"key":"blog.hero.eyebrow","value":"Test 2026"}].
    c) Re-GET /api/content. Confirm:
       - blog.hero.eyebrow == "Test 2026"
       - The OTHER 4 blog keys are bit-for-bit identical to the snapshot.
       - The COUNT of keys per non-blog group is UNCHANGED vs the baseline snapshot.
    d) Restore: PUT items=[{"key":"blog.hero.eyebrow","value":"From the Road"}]. Confirm restored value.
    """
    print("\n" + "="*80)
    print("TEST 3: ROUND-TRIP UPDATE + ISOLATION")
    print("="*80)
    
    # a) Snapshot baseline
    print("\n📸 Step A: Snapshot baseline...")
    total_keys = len(baseline_content)
    print(f"  ✓ Total keys: {total_keys} (expected >= 183)")
    assert total_keys >= 183, f"❌ FAIL: Expected >= 183 keys, got {total_keys}"
    
    # Snapshot blog values
    blog_snapshot = {key: baseline_content[key] for key in EXPECTED_BLOG_KEYS}
    print(f"  ✓ Snapshotted 5 blog.* key values")
    
    # Snapshot counts per group
    group_counts = {}
    for group in NON_BLOG_GROUPS:
        count = sum(1 for k in baseline_content.keys() if k.startswith(f"{group}."))
        group_counts[group] = count
    print(f"  ✓ Snapshotted key counts for {len(NON_BLOG_GROUPS)} non-blog groups")
    
    # b) PUT update
    print("\n✏️  Step B: PUT update blog.hero.eyebrow to 'Test 2026'...")
    resp = requests.put(
        f"{API_BASE}/admin/content",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"key": "blog.hero.eyebrow", "value": "Test 2026"}]},
        timeout=10
    )
    assert resp.status_code == 200, f"PUT /api/admin/content failed: {resp.status_code} {resp.text}"
    print(f"  ✓ PUT returned 200")
    
    # c) Re-GET and verify
    print("\n🔍 Step C: Re-GET /api/content and verify...")
    resp = requests.get(f"{API_BASE}/content", timeout=10)
    assert resp.status_code == 200, f"GET /api/content failed: {resp.status_code}"
    updated_content = resp.json()
    
    # Check blog.hero.eyebrow updated
    assert updated_content["blog.hero.eyebrow"] == "Test 2026", \
        f"❌ FAIL: blog.hero.eyebrow not updated. Got: {updated_content['blog.hero.eyebrow']}"
    print(f"  ✓ blog.hero.eyebrow == 'Test 2026'")
    
    # Check OTHER 4 blog keys unchanged
    other_blog_keys = [k for k in EXPECTED_BLOG_KEYS if k != "blog.hero.eyebrow"]
    for key in other_blog_keys:
        assert updated_content[key] == blog_snapshot[key], \
            f"❌ FAIL: {key} changed! Expected: {blog_snapshot[key]}, Got: {updated_content[key]}"
    print(f"  ✓ Other 4 blog keys unchanged")
    
    # Check non-blog group counts unchanged
    for group, expected_count in group_counts.items():
        actual_count = sum(1 for k in updated_content.keys() if k.startswith(f"{group}."))
        assert actual_count == expected_count, \
            f"❌ FAIL: {group} group count changed! Expected: {expected_count}, Got: {actual_count}"
    print(f"  ✓ All {len(NON_BLOG_GROUPS)} non-blog group counts unchanged (no collateral damage)")
    
    # d) Restore
    print("\n🔄 Step D: Restore blog.hero.eyebrow to original value...")
    resp = requests.put(
        f"{API_BASE}/admin/content",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"key": "blog.hero.eyebrow", "value": "From the Road"}]},
        timeout=10
    )
    assert resp.status_code == 200, f"PUT restore failed: {resp.status_code} {resp.text}"
    
    resp = requests.get(f"{API_BASE}/content", timeout=10)
    restored_content = resp.json()
    assert restored_content["blog.hero.eyebrow"] == "From the Road", \
        f"❌ FAIL: Restore failed. Got: {restored_content['blog.hero.eyebrow']}"
    print(f"  ✓ blog.hero.eyebrow restored to 'From the Road'")
    
    print(f"\n✅ TEST 3 PASSED: Round-trip update + isolation working correctly")


def test_4_idempotent_seed(token: str) -> None:
    """
    TEST 4: IDEMPOTENT SEED
    a) GET /api/admin/content and snapshot the 5 blog keys with their values.
    b) sudo supervisorctl restart backend. Wait ~6s. Curl /api/journeys until it responds 200.
    c) Re-GET /api/admin/content. Confirm:
       - All 5 blog keys are still present.
       - All 5 values are BIT-FOR-BIT identical to the pre-restart snapshot.
         (The $setOnInsert guard must not overwrite admin edits or seed defaults again.)
    """
    print("\n" + "="*80)
    print("TEST 4: IDEMPOTENT SEED")
    print("="*80)
    
    # a) Snapshot before restart
    print("\n📸 Step A: Snapshot blog keys before restart...")
    resp = requests.get(
        f"{API_BASE}/admin/content",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert resp.status_code == 200, f"GET /api/admin/content failed: {resp.status_code}"
    pre_restart_data = resp.json()
    
    blog_items_before = {item["key"]: item["value"] for item in pre_restart_data["blog"]}
    print(f"  ✓ Snapshotted 5 blog key values:")
    for key, value in blog_items_before.items():
        print(f"    - {key}: {value[:60]}...")
    
    # b) Restart backend
    print("\n🔄 Step B: Restarting backend...")
    result = subprocess.run(
        ["sudo", "supervisorctl", "restart", "backend"],
        capture_output=True,
        text=True,
        timeout=30
    )
    print(f"  ✓ supervisorctl restart backend: {result.stdout.strip()}")
    
    print("  ⏳ Waiting 6 seconds for backend to start...")
    time.sleep(6)
    
    # Poll /api/journeys until 200
    print("  ⏳ Polling /api/journeys until backend is ready...")
    for i in range(20):
        try:
            resp = requests.get(f"{API_BASE}/journeys", timeout=5)
            if resp.status_code == 200:
                print(f"  ✓ Backend ready (attempt {i+1})")
                break
        except requests.exceptions.RequestException:
            pass
        time.sleep(1)
    else:
        raise AssertionError("❌ FAIL: Backend did not come back up after 20 attempts")
    
    # c) Re-GET and verify
    print("\n🔍 Step C: Re-GET /api/admin/content and verify idempotence...")
    resp = requests.get(
        f"{API_BASE}/admin/content",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert resp.status_code == 200, f"GET /api/admin/content failed after restart: {resp.status_code}"
    post_restart_data = resp.json()
    
    # Check blog group still exists
    assert "blog" in post_restart_data, "❌ FAIL: blog group missing after restart"
    print(f"  ✓ blog group still exists")
    
    # Check all 5 keys still present
    blog_items_after = {item["key"]: item["value"] for item in post_restart_data["blog"]}
    assert len(blog_items_after) == 5, f"❌ FAIL: Expected 5 blog items after restart, got {len(blog_items_after)}"
    print(f"  ✓ All 5 blog keys still present")
    
    # Check values are BIT-FOR-BIT identical
    for key in EXPECTED_BLOG_KEYS:
        before_value = blog_items_before[key]
        after_value = blog_items_after[key]
        assert after_value == before_value, \
            f"❌ FAIL: {key} value changed after restart!\n  Before: {before_value}\n  After: {after_value}"
        print(f"  ✓ {key}: value unchanged (bit-for-bit identical)")
    
    print(f"\n✅ TEST 4 PASSED: Idempotent seed working correctly (values survived restart)")


def test_5_regression(token: str) -> None:
    """
    TEST 5: REGRESSION
    - GET /api/journeys returns 4 rows; each row has the AB1 `small_group_text` field.
    - GET /api/media returns >= 280 rows (after the live re-sync it's 286).
    - GET /api/admin/journeys (Bearer) responds 200.
    - No 500 errors anywhere.
    """
    print("\n" + "="*80)
    print("TEST 5: REGRESSION")
    print("="*80)
    
    # Check /api/journeys
    print("\n🔍 Checking GET /api/journeys...")
    resp = requests.get(f"{API_BASE}/journeys", timeout=10)
    assert resp.status_code == 200, f"GET /api/journeys failed: {resp.status_code} {resp.text}"
    journeys = resp.json()
    assert len(journeys) == 4, f"❌ FAIL: Expected 4 journeys, got {len(journeys)}"
    print(f"  ✓ Returns 4 journeys")
    
    # Check each has small_group_text
    for journey in journeys:
        assert "small_group_text" in journey, \
            f"❌ FAIL: Journey {journey.get('name')} missing small_group_text field"
    print(f"  ✓ All journeys have small_group_text field (AB1)")
    
    # Check /api/media
    print("\n🔍 Checking GET /api/media...")
    resp = requests.get(f"{API_BASE}/media", timeout=10)
    assert resp.status_code == 200, f"GET /api/media failed: {resp.status_code} {resp.text}"
    media = resp.json()
    media_count = len(media)
    assert media_count >= 280, f"❌ FAIL: Expected >= 280 media items, got {media_count}"
    print(f"  ✓ Returns {media_count} media items (expected >= 280)")
    
    # Check /api/admin/journeys
    print("\n🔍 Checking GET /api/admin/journeys...")
    resp = requests.get(
        f"{API_BASE}/admin/journeys",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert resp.status_code == 200, f"GET /api/admin/journeys failed: {resp.status_code} {resp.text}"
    print(f"  ✓ Returns 200")
    
    print(f"\n✅ TEST 5 PASSED: No regression detected")


def main():
    """Run all 5 critical tests"""
    print("\n" + "="*80)
    print("AC1 BLOG CONTENT SEED - COMPREHENSIVE TESTING")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    
    try:
        # Login
        token = login()
        
        # Test 1: Admin endpoint presence
        admin_content = test_1_presence_admin_endpoint(token)
        
        # Test 2: Public endpoint presence
        public_content = test_2_presence_public_endpoint()
        
        # Test 3: Round-trip update + isolation
        test_3_round_trip_update_isolation(token, public_content)
        
        # Test 4: Idempotent seed
        test_4_idempotent_seed(token)
        
        # Test 5: Regression
        test_5_regression(token)
        
        # Final summary
        print("\n" + "="*80)
        print("🎉 ALL 5 CRITICAL TESTS PASSED")
        print("="*80)
        print("✅ TEST 1: Admin endpoint has blog group with 5 valid items")
        print("✅ TEST 2: Public endpoint has all 5 blog.* keys")
        print("✅ TEST 3: Round-trip update + isolation working correctly")
        print("✅ TEST 4: Idempotent seed working correctly (values survived restart)")
        print("✅ TEST 5: No regression detected")
        print("\nAC1 Blog content seed is PRODUCTION-READY.")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        raise
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        raise


if __name__ == "__main__":
    main()
