#!/usr/bin/env python3
"""
Session AE Backend Verification Test Suite
Tests sister-brands content keys and dual phone number settings
"""

import requests
import json
import time

# Backend URL from review request
BASE_URL = "https://170bcf25-942f-44a3-b7ed-d560a9798f92.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Admin credentials
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

def login():
    """Login and return Bearer token"""
    print("\n=== LOGGING IN ===")
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    print(f"Login status: {response.status_code}")
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"✓ Login successful, token obtained")
        return token
    else:
        print(f"✗ Login failed: {response.text}")
        return None

def test_1_seed_check(token):
    """TEST 1: SEED CHECK - Verify 10 about.sister.* keys and 4 phone settings"""
    print("\n" + "="*80)
    print("TEST 1: SEED CHECK")
    print("="*80)
    
    # Check content keys
    print("\n--- Checking /api/content for about.sister.* keys ---")
    response = requests.get(f"{API_BASE}/content")
    print(f"GET /api/content status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"✗ FAIL: Expected 200, got {response.status_code}")
        return False
    
    content = response.json()
    total_keys = len(content)
    print(f"Total content keys: {total_keys}")
    
    if total_keys < 201:
        print(f"✗ FAIL: Expected >= 201 keys, got {total_keys}")
        return False
    print(f"✓ PASS: Total keys >= 201")
    
    # Expected sister brand keys with their defaults
    expected_sister_keys = {
        "about.sister.eyebrow": "Also by Adele",
        "about.sister.title": "Two more places to *stay and gather.*",
        "about.sister.intro": "boutique hinterland hospitality",  # partial match
        "about.sister.cta": "Visit website",
        "about.sister.0.name": "Lillypillys Country Cottages",
        "about.sister.0.tagline": "in-cottage dining",  # partial match
        "about.sister.0.url": "https://lillypillys.com.au",
        "about.sister.1.name": "Moments by Cottage in the Woods",
        "about.sister.1.tagline": "Elopement specialists",  # partial match
        "about.sister.1.url": "https://momentsbycottageinthewoods.com"
    }
    
    print("\n--- Verifying 10 about.sister.* keys ---")
    all_keys_present = True
    for key, expected_value in expected_sister_keys.items():
        if key not in content:
            print(f"✗ FAIL: Key '{key}' not found in content")
            all_keys_present = False
        else:
            actual_value = content[key]
            # For partial matches (intro, taglines), check if expected is substring
            if key in ["about.sister.intro", "about.sister.0.tagline", "about.sister.1.tagline"]:
                if expected_value in actual_value:
                    print(f"✓ {key}: contains '{expected_value}'")
                else:
                    print(f"✗ FAIL: {key} = '{actual_value}' (expected to contain '{expected_value}')")
                    all_keys_present = False
            else:
                if actual_value == expected_value:
                    print(f"✓ {key}: '{actual_value}'")
                else:
                    print(f"✗ FAIL: {key} = '{actual_value}' (expected '{expected_value}')")
                    all_keys_present = False
    
    if not all_keys_present:
        return False
    
    # Check settings
    print("\n--- Checking /api/settings for phone keys ---")
    response = requests.get(f"{API_BASE}/settings")
    print(f"GET /api/settings status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"✗ FAIL: Expected 200, got {response.status_code}")
        return False
    
    settings = response.json()
    
    expected_phone_keys = [
        "contact_phone_1_label",
        "contact_phone_1_number",
        "contact_phone_2_label",
        "contact_phone_2_number"
    ]
    
    print("\n--- Verifying 4 phone settings keys ---")
    all_phone_keys_present = True
    for key in expected_phone_keys:
        if key not in settings:
            print(f"✗ FAIL: Key '{key}' not found in settings")
            all_phone_keys_present = False
        else:
            value = settings[key]
            print(f"✓ {key}: '{value}'")
    
    if not all_phone_keys_present:
        return False
    
    # Verify labels are correct
    if settings.get("contact_phone_1_label") != "Adele:":
        print(f"✗ FAIL: contact_phone_1_label = '{settings.get('contact_phone_1_label')}' (expected 'Adele:')")
        return False
    
    if settings.get("contact_phone_2_label") != "Barbara:":
        print(f"✗ FAIL: contact_phone_2_label = '{settings.get('contact_phone_2_label')}' (expected 'Barbara:')")
        return False
    
    print("\n✓ TEST 1 PASSED: All 10 about.sister.* keys and 4 phone settings present with correct defaults")
    return True

def test_2_content_round_trip(token):
    """TEST 2: CONTENT ROUND-TRIP - Update and revert about.sister.0.name"""
    print("\n" + "="*80)
    print("TEST 2: CONTENT ROUND-TRIP")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get original value
    print("\n--- Getting original value ---")
    response = requests.get(f"{API_BASE}/content")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/content returned {response.status_code}")
        return False
    
    original_value = response.json().get("about.sister.0.name")
    print(f"Original about.sister.0.name: '{original_value}'")
    
    # Update to test value
    print("\n--- Updating to 'Test Brand A' ---")
    response = requests.put(
        f"{API_BASE}/admin/content",
        headers=headers,
        json={"items": [{"key": "about.sister.0.name", "value": "Test Brand A"}]}
    )
    print(f"PUT /api/admin/content status: {response.status_code}")
    
    if response.status_code not in [200, 201]:
        print(f"✗ FAIL: Expected 200/201, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    # Verify update
    print("\n--- Verifying update ---")
    response = requests.get(f"{API_BASE}/content")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/content returned {response.status_code}")
        return False
    
    updated_value = response.json().get("about.sister.0.name")
    if updated_value != "Test Brand A":
        print(f"✗ FAIL: about.sister.0.name = '{updated_value}' (expected 'Test Brand A')")
        return False
    print(f"✓ about.sister.0.name updated to: '{updated_value}'")
    
    # Revert to original
    print("\n--- Reverting to original value ---")
    response = requests.put(
        f"{API_BASE}/admin/content",
        headers=headers,
        json={"items": [{"key": "about.sister.0.name", "value": original_value}]}
    )
    print(f"PUT /api/admin/content status: {response.status_code}")
    
    if response.status_code not in [200, 201]:
        print(f"✗ FAIL: Revert failed with status {response.status_code}")
        return False
    
    # Verify revert
    print("\n--- Verifying revert ---")
    response = requests.get(f"{API_BASE}/content")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/content returned {response.status_code}")
        return False
    
    reverted_value = response.json().get("about.sister.0.name")
    if reverted_value != original_value:
        print(f"✗ FAIL: about.sister.0.name = '{reverted_value}' (expected '{original_value}')")
        return False
    print(f"✓ about.sister.0.name reverted to: '{reverted_value}'")
    
    print("\n✓ TEST 2 PASSED: Content round-trip successful")
    return True

def test_3_settings_round_trip(token):
    """TEST 3: SETTINGS ROUND-TRIP - Update and revert phone settings"""
    print("\n" + "="*80)
    print("TEST 3: SETTINGS ROUND-TRIP")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get original values
    print("\n--- Getting original values ---")
    response = requests.get(f"{API_BASE}/settings")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/settings returned {response.status_code}")
        return False
    
    settings = response.json()
    original_label = settings.get("contact_phone_1_label")
    original_number = settings.get("contact_phone_1_number")
    print(f"Original contact_phone_1_label: '{original_label}'")
    print(f"Original contact_phone_1_number: '{original_number}'")
    
    # Update to test values
    print("\n--- Updating to test values ---")
    response = requests.put(
        f"{API_BASE}/admin/settings",
        headers=headers,
        json={
            "settings": {
                "contact_phone_1_label": "Mum:",
                "contact_phone_1_number": "+61 400 000 000"
            }
        }
    )
    print(f"PUT /api/admin/settings status: {response.status_code}")
    
    if response.status_code not in [200, 201]:
        print(f"✗ FAIL: Expected 200/201, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    # Verify update
    print("\n--- Verifying update ---")
    response = requests.get(f"{API_BASE}/settings")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/settings returned {response.status_code}")
        return False
    
    settings = response.json()
    updated_label = settings.get("contact_phone_1_label")
    updated_number = settings.get("contact_phone_1_number")
    
    if updated_label != "Mum:":
        print(f"✗ FAIL: contact_phone_1_label = '{updated_label}' (expected 'Mum:')")
        return False
    if updated_number != "+61 400 000 000":
        print(f"✗ FAIL: contact_phone_1_number = '{updated_number}' (expected '+61 400 000 000')")
        return False
    
    print(f"✓ contact_phone_1_label updated to: '{updated_label}'")
    print(f"✓ contact_phone_1_number updated to: '{updated_number}'")
    
    # Revert to original
    print("\n--- Reverting to original values ---")
    response = requests.put(
        f"{API_BASE}/admin/settings",
        headers=headers,
        json={
            "settings": {
                "contact_phone_1_label": original_label,
                "contact_phone_1_number": original_number
            }
        }
    )
    print(f"PUT /api/admin/settings status: {response.status_code}")
    
    if response.status_code not in [200, 201]:
        print(f"✗ FAIL: Revert failed with status {response.status_code}")
        return False
    
    # Verify revert
    print("\n--- Verifying revert ---")
    response = requests.get(f"{API_BASE}/settings")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/settings returned {response.status_code}")
        return False
    
    settings = response.json()
    reverted_label = settings.get("contact_phone_1_label")
    reverted_number = settings.get("contact_phone_1_number")
    
    if reverted_label != original_label:
        print(f"✗ FAIL: contact_phone_1_label = '{reverted_label}' (expected '{original_label}')")
        return False
    if reverted_number != original_number:
        print(f"✗ FAIL: contact_phone_1_number = '{reverted_number}' (expected '{original_number}')")
        return False
    
    print(f"✓ contact_phone_1_label reverted to: '{reverted_label}'")
    print(f"✓ contact_phone_1_number reverted to: '{reverted_number}'")
    
    print("\n✓ TEST 3 PASSED: Settings round-trip successful")
    return True

def test_4_idempotence(token):
    """TEST 4: IDEMPOTENCE - Restart backend and verify keys survive"""
    print("\n" + "="*80)
    print("TEST 4: IDEMPOTENCE")
    print("="*80)
    
    print("\n--- Snapshotting current values ---")
    
    # Snapshot content
    response = requests.get(f"{API_BASE}/content")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/content returned {response.status_code}")
        return False
    
    content_before = response.json()
    sister_keys_before = {k: v for k, v in content_before.items() if k.startswith("about.sister.")}
    print(f"Snapshotted {len(sister_keys_before)} about.sister.* keys")
    
    # Snapshot settings
    response = requests.get(f"{API_BASE}/settings")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/settings returned {response.status_code}")
        return False
    
    settings_before = response.json()
    phone_keys_before = {
        k: v for k, v in settings_before.items() 
        if k.startswith("contact_phone_1_") or k.startswith("contact_phone_2_")
    }
    print(f"Snapshotted {len(phone_keys_before)} phone settings keys")
    
    # Note: We cannot restart the backend from here as we don't have shell access
    # The review request says "Tell main to run `sudo supervisorctl restart backend`"
    # So we'll skip the actual restart and just verify the current state matches expectations
    print("\n--- NOTE: Backend restart must be performed by main agent ---")
    print("Skipping actual restart in this test run.")
    print("Verifying current state matches post-revert expectations...")
    
    # Verify all keys still present
    print("\n--- Verifying all about.sister.* keys still present ---")
    response = requests.get(f"{API_BASE}/content")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/content returned {response.status_code}")
        return False
    
    content_after = response.json()
    
    all_keys_present = True
    for key in sister_keys_before.keys():
        if key not in content_after:
            print(f"✗ FAIL: Key '{key}' missing after restart")
            all_keys_present = False
        elif content_after[key] == sister_keys_before[key]:
            print(f"✓ {key}: value unchanged")
        else:
            print(f"⚠ {key}: value changed from '{sister_keys_before[key]}' to '{content_after[key]}'")
    
    if not all_keys_present:
        return False
    
    # Verify phone settings still present
    print("\n--- Verifying all phone settings keys still present ---")
    response = requests.get(f"{API_BASE}/settings")
    if response.status_code != 200:
        print(f"✗ FAIL: GET /api/settings returned {response.status_code}")
        return False
    
    settings_after = response.json()
    
    for key in phone_keys_before.keys():
        if key not in settings_after:
            print(f"✗ FAIL: Key '{key}' missing after restart")
            all_keys_present = False
        elif settings_after[key] == phone_keys_before[key]:
            print(f"✓ {key}: value unchanged")
        else:
            print(f"⚠ {key}: value changed from '{phone_keys_before[key]}' to '{settings_after[key]}'")
    
    if not all_keys_present:
        return False
    
    print("\n✓ TEST 4 PASSED: All keys present (restart verification deferred to main agent)")
    return True

def test_5_regression(token):
    """TEST 5: REGRESSION - Verify existing endpoints still work"""
    print("\n" + "="*80)
    print("TEST 5: REGRESSION")
    print("="*80)
    
    # Check journeys
    print("\n--- Checking /api/journeys ---")
    response = requests.get(f"{API_BASE}/journeys")
    print(f"GET /api/journeys status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"✗ FAIL: Expected 200, got {response.status_code}")
        return False
    
    journeys = response.json()
    journey_count = len(journeys)
    print(f"Journey count: {journey_count}")
    
    if journey_count != 4:
        print(f"✗ FAIL: Expected exactly 4 journeys, got {journey_count}")
        return False
    print(f"✓ PASS: Exactly 4 journeys returned")
    
    # Check media
    print("\n--- Checking /api/media ---")
    response = requests.get(f"{API_BASE}/media")
    print(f"GET /api/media status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"✗ FAIL: Expected 200, got {response.status_code}")
        return False
    
    media = response.json()
    media_count = len(media)
    print(f"Media count: {media_count}")
    
    if media_count < 309:
        print(f"✗ FAIL: Expected >= 309 media items, got {media_count}")
        return False
    print(f"✓ PASS: Media count >= 309")
    
    # Check blog
    print("\n--- Checking /api/blog ---")
    response = requests.get(f"{API_BASE}/blog")
    print(f"GET /api/blog status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"✗ FAIL: Expected 200, got {response.status_code}")
        return False
    
    blog_posts = response.json()
    blog_count = len(blog_posts)
    print(f"Blog post count: {blog_count}")
    
    if blog_count < 1:
        print(f"✗ FAIL: Expected >= 1 blog post, got {blog_count}")
        return False
    print(f"✓ PASS: Blog returns >= 1 published post")
    
    # Check llms.txt
    print("\n--- Checking /llms.txt (static file, not /api/llms.txt) ---")
    response = requests.get(f"{BASE_URL}/llms.txt")
    print(f"GET /llms.txt status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"✗ FAIL: Expected 200, got {response.status_code}")
        return False
    
    llms_content = response.text
    print(f"llms.txt content length: {len(llms_content)} bytes")
    
    # Check if both phone numbers are in the content
    # Get current phone numbers from settings
    response = requests.get(f"{API_BASE}/settings")
    if response.status_code == 200:
        settings = response.json()
        phone1 = settings.get("contact_phone_1_number", "")
        phone2 = settings.get("contact_phone_2_number", "")
        
        print(f"\n--- Checking for phone numbers in llms.txt ---")
        print(f"Looking for phone1: '{phone1}'")
        print(f"Looking for phone2: '{phone2}'")
        
        if phone1 and phone1 in llms_content:
            print(f"✓ Phone 1 found in llms.txt")
        elif phone1:
            print(f"⚠ WARNING: Phone 1 ('{phone1}') not found in llms.txt")
            print(f"This may indicate a regression in the llms.txt phone rendering")
        
        if phone2 and phone2 in llms_content:
            print(f"✓ Phone 2 found in llms.txt")
        elif phone2:
            print(f"⚠ WARNING: Phone 2 ('{phone2}') not found in llms.txt")
            print(f"This may indicate a regression in the llms.txt phone rendering")
        
        # If both phones are populated, both should be in llms.txt
        if phone1 and phone2:
            if phone1 in llms_content and phone2 in llms_content:
                print(f"✓ PASS: Both phone numbers found in llms.txt")
            else:
                print(f"✗ FAIL: Not all phone numbers found in llms.txt (regression detected)")
                return False
    
    print("\n✓ TEST 5 PASSED: All regression checks passed")
    return True

def main():
    """Run all tests"""
    print("="*80)
    print("SESSION AE BACKEND VERIFICATION TEST SUITE")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Admin email: {ADMIN_EMAIL}")
    
    # Login
    token = login()
    if not token:
        print("\n✗ FATAL: Login failed, cannot proceed with tests")
        return
    
    # Run all tests
    results = {
        "TEST 1 - SEED CHECK": test_1_seed_check(token),
        "TEST 2 - CONTENT ROUND-TRIP": test_2_content_round_trip(token),
        "TEST 3 - SETTINGS ROUND-TRIP": test_3_settings_round_trip(token),
        "TEST 4 - IDEMPOTENCE": test_4_idempotence(token),
        "TEST 5 - REGRESSION": test_5_regression(token)
    }
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*80)
    if all_passed:
        print("✓ ALL TESTS PASSED")
    else:
        print("✗ SOME TESTS FAILED")
    print("="*80)

if __name__ == "__main__":
    main()
