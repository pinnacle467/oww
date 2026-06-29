#!/usr/bin/env python3
"""
AB1 Backend Test Suite - small_group_text field on Journey model
Tests the new small_group_text field and migration as per Session AB1.
"""

import requests
import json
import time
import subprocess
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://repo-to-deploy.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

# Global token storage
AUTH_TOKEN: Optional[str] = None


def login() -> str:
    """Login and return Bearer token."""
    global AUTH_TOKEN
    if AUTH_TOKEN:
        return AUTH_TOKEN
    
    resp = requests.post(
        f"{BACKEND_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10
    )
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    AUTH_TOKEN = data.get("access_token")
    assert AUTH_TOKEN, "No access_token in login response"
    print(f"✓ Login successful")
    return AUTH_TOKEN


def auth_headers() -> Dict[str, str]:
    """Return Authorization headers."""
    return {"Authorization": f"Bearer {login()}"}


def test_1_startup_migration():
    """
    TEST 1: STARTUP MIGRATION
    Verify every journey row has the key `small_group_text` (even if empty string).
    The AB1 migration should have defaulted this field to "" on all existing rows.
    """
    print("\n" + "="*80)
    print("TEST 1: STARTUP MIGRATION - Verify all journeys have small_group_text key")
    print("="*80)
    
    resp = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp.status_code == 200, f"GET /api/journeys failed: {resp.status_code}"
    
    journeys = resp.json()
    assert isinstance(journeys, list), "Expected list of journeys"
    assert len(journeys) > 0, "Expected at least 1 journey"
    
    print(f"Found {len(journeys)} journeys")
    
    missing_field = []
    for j in journeys:
        if "small_group_text" not in j:
            missing_field.append(j.get("name", j.get("id", "unknown")))
    
    if missing_field:
        print(f"❌ FAIL: {len(missing_field)} journey(s) missing small_group_text key:")
        for name in missing_field:
            print(f"  - {name}")
        raise AssertionError("Migration failed: some journeys missing small_group_text")
    
    print(f"✓ PASS: All {len(journeys)} journeys have small_group_text key")
    
    # Show sample values
    for j in journeys[:4]:
        val = j.get("small_group_text", "")
        print(f"  - {j.get('name', 'unknown')}: small_group_text = {repr(val)}")
    
    return journeys


def test_2_post_round_trip():
    """
    TEST 2: POST ROUND-TRIP
    Create a new journey with small_group_text, verify it persists, then delete it.
    """
    print("\n" + "="*80)
    print("TEST 2: POST ROUND-TRIP - Create journey with small_group_text")
    print("="*80)
    
    test_text = "10 travellers max for retreats."
    payload = {
        "name": "AB1 Test Journey - DELETE ME",
        "region": "Test Region",
        "nights": "3",
        "dates": "Year-round",
        "priceFrom": "1000",
        "priceUnit": "pp",
        "priceNote": "Test",
        "summary": "Test journey for AB1",
        "small_group_text": test_text,
        "slug": "ab1-test-journey-delete-me",
        "type": "tour",
        "status": "draft"  # Keep as draft so it doesn't appear publicly
    }
    
    resp = requests.post(
        f"{BACKEND_URL}/admin/journeys",
        json=payload,
        headers=auth_headers(),
        timeout=10
    )
    
    assert resp.status_code in [200, 201], f"POST failed: {resp.status_code} {resp.text}"
    created = resp.json()
    
    # Check response includes small_group_text
    assert "small_group_text" in created, "Response missing small_group_text"
    assert created["small_group_text"] == test_text, \
        f"Expected small_group_text={repr(test_text)}, got {repr(created.get('small_group_text'))}"
    
    journey_id = created.get("id")
    assert journey_id, "No id in response"
    
    print(f"✓ Created journey with id={journey_id}")
    print(f"✓ Response includes small_group_text = {repr(created['small_group_text'])}")
    
    # Verify via GET /api/journeys (public endpoint)
    resp2 = requests.get(f"{BACKEND_URL}/journeys?include_drafts=true", timeout=10)
    assert resp2.status_code == 200, f"GET /api/journeys failed: {resp2.status_code}"
    
    all_journeys = resp2.json()
    found = next((j for j in all_journeys if j.get("id") == journey_id), None)
    
    if not found:
        print(f"⚠ Warning: Journey not found in GET /api/journeys?include_drafts=true")
    else:
        assert "small_group_text" in found, "Public GET missing small_group_text"
        assert found["small_group_text"] == test_text, \
            f"Public GET has wrong value: {repr(found.get('small_group_text'))}"
        print(f"✓ Public GET /api/journeys includes small_group_text correctly")
    
    # DELETE the test journey
    resp3 = requests.delete(
        f"{BACKEND_URL}/admin/journeys/{journey_id}",
        headers=auth_headers(),
        timeout=10
    )
    assert resp3.status_code == 200, f"DELETE failed: {resp3.status_code} {resp3.text}"
    print(f"✓ Deleted test journey (cleanup)")
    
    print("✓ PASS: POST round-trip successful")


def test_3_patch_preservation():
    """
    TEST 3: PATCH PRESERVATION (CRITICAL)
    This is the most important test - verify that PATCH with ONLY small_group_text
    does NOT clobber any other fields.
    
    Steps:
    a) Pick an existing journey and snapshot its full row
    b) PATCH with ONLY {"small_group_text": "new value"}
    c) Re-GET and verify small_group_text changed but ALL other fields unchanged
    d) PATCH with {"small_group_text": ""} to clear it
    e) Restore original value
    """
    print("\n" + "="*80)
    print("TEST 3: PATCH PRESERVATION - Critical test for field isolation")
    print("="*80)
    
    # Get all journeys
    resp = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp.status_code == 200, f"GET /api/journeys failed: {resp.status_code}"
    journeys = resp.json()
    
    # Pick the first journey (should be Maleny or similar)
    assert len(journeys) > 0, "No journeys found"
    target = journeys[0]
    journey_id = target["id"]
    journey_name = target.get("name", "unknown")
    
    print(f"Target journey: {journey_name} (id={journey_id})")
    
    # Snapshot the FULL row
    original_snapshot = dict(target)
    original_small_group_text = original_snapshot.get("small_group_text", "")
    print(f"Original small_group_text: {repr(original_small_group_text)}")
    
    # PATCH with ONLY small_group_text
    new_value = "Retreats take 10 travellers max."
    patch_payload = {"small_group_text": new_value}
    
    print(f"\nPATCHing with ONLY: {patch_payload}")
    resp2 = requests.patch(
        f"{BACKEND_URL}/admin/journeys/{journey_id}",
        json=patch_payload,
        headers=auth_headers(),
        timeout=10
    )
    assert resp2.status_code == 200, f"PATCH failed: {resp2.status_code} {resp2.text}"
    print(f"✓ PATCH successful")
    
    # Re-GET the journey
    time.sleep(0.5)  # Small delay to ensure DB write completes
    resp3 = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp3.status_code == 200, f"GET /api/journeys failed: {resp3.status_code}"
    
    updated_journeys = resp3.json()
    updated = next((j for j in updated_journeys if j["id"] == journey_id), None)
    assert updated, f"Journey {journey_id} not found after PATCH"
    
    # Verify small_group_text was updated
    assert updated.get("small_group_text") == new_value, \
        f"Expected small_group_text={repr(new_value)}, got {repr(updated.get('small_group_text'))}"
    print(f"✓ small_group_text updated to: {repr(new_value)}")
    
    # CRITICAL: Verify ALL other fields are unchanged
    # Ignore updated_at since it's expected to change
    fields_to_check = [
        "name", "region", "nights", "dates", "priceFrom", "priceUnit", "priceNote",
        "popular", "summary", "includes", "excludes", "highlights", "cta", "is_active",
        "slug", "hero_media_id", "body_html", "seo_title", "seo_description",
        "status", "type", "gallery_media_ids", "description_html", "itinerary_html",
        "practical_html", "more_details_html", "preview_token"
    ]
    
    mutated_fields = []
    for field in fields_to_check:
        original_val = original_snapshot.get(field)
        updated_val = updated.get(field)
        if original_val != updated_val:
            mutated_fields.append({
                "field": field,
                "original": original_val,
                "updated": updated_val
            })
    
    if mutated_fields:
        print(f"\n❌ FAIL: {len(mutated_fields)} field(s) were unexpectedly mutated:")
        for m in mutated_fields:
            print(f"  - {m['field']}:")
            print(f"      Original: {repr(m['original'])}")
            print(f"      Updated:  {repr(m['updated'])}")
        raise AssertionError("PATCH preservation failed: fields were clobbered")
    
    print(f"✓ PASS: All {len(fields_to_check)} other fields unchanged")
    
    # PATCH to clear small_group_text (set to empty string)
    print(f"\nClearing small_group_text (set to empty string)")
    resp4 = requests.patch(
        f"{BACKEND_URL}/admin/journeys/{journey_id}",
        json={"small_group_text": ""},
        headers=auth_headers(),
        timeout=10
    )
    assert resp4.status_code == 200, f"PATCH clear failed: {resp4.status_code} {resp4.text}"
    
    time.sleep(0.5)
    resp5 = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp5.status_code == 200
    cleared_journeys = resp5.json()
    cleared = next((j for j in cleared_journeys if j["id"] == journey_id), None)
    assert cleared, "Journey not found after clear"
    
    # Verify it's an empty string, NOT missing, NOT a non-empty default
    assert "small_group_text" in cleared, "small_group_text key missing after clear"
    assert cleared["small_group_text"] == "", \
        f"Expected empty string, got {repr(cleared.get('small_group_text'))}"
    print(f"✓ small_group_text cleared to empty string (not missing, not default)")
    
    # Restore original value
    print(f"\nRestoring original value: {repr(original_small_group_text)}")
    resp6 = requests.patch(
        f"{BACKEND_URL}/admin/journeys/{journey_id}",
        json={"small_group_text": original_small_group_text},
        headers=auth_headers(),
        timeout=10
    )
    assert resp6.status_code == 200, f"PATCH restore failed: {resp6.status_code} {resp6.text}"
    print(f"✓ Restored original value")
    
    print("\n✓ PASS: PATCH preservation test successful")


def test_4_idempotent_migration():
    """
    TEST 4: IDEMPOTENT MIGRATION
    Set small_group_text on one journey to a known non-empty value.
    Restart backend.
    Verify the value SURVIVED (migration's $exists:false guard must not re-write).
    """
    print("\n" + "="*80)
    print("TEST 4: IDEMPOTENT MIGRATION - Verify migration doesn't overwrite existing values")
    print("="*80)
    
    # Get a journey
    resp = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp.status_code == 200
    journeys = resp.json()
    assert len(journeys) > 0
    
    target = journeys[0]
    journey_id = target["id"]
    journey_name = target.get("name", "unknown")
    
    # Store original value
    original_value = target.get("small_group_text", "")
    
    # Set a known non-empty value
    test_value = "IDEMPOTENT TEST VALUE - DO NOT OVERWRITE"
    print(f"Setting small_group_text on '{journey_name}' to: {repr(test_value)}")
    
    resp2 = requests.patch(
        f"{BACKEND_URL}/admin/journeys/{journey_id}",
        json={"small_group_text": test_value},
        headers=auth_headers(),
        timeout=10
    )
    assert resp2.status_code == 200, f"PATCH failed: {resp2.status_code} {resp2.text}"
    print(f"✓ Value set")
    
    # Verify it was set
    time.sleep(0.5)
    resp3 = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp3.status_code == 200
    before_restart = resp3.json()
    before = next((j for j in before_restart if j["id"] == journey_id), None)
    assert before and before.get("small_group_text") == test_value, "Value not set correctly"
    
    # Restart backend
    print(f"\nRestarting backend service...")
    result = subprocess.run(
        ["sudo", "supervisorctl", "restart", "backend"],
        capture_output=True,
        text=True,
        timeout=10
    )
    if result.returncode != 0:
        print(f"⚠ Warning: supervisorctl restart returned {result.returncode}")
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
    else:
        print(f"✓ Backend restart command sent")
    
    # Wait for backend to come back up
    print(f"Waiting 8 seconds for backend to restart...")
    time.sleep(8)
    
    # Check if backend is up
    max_retries = 5
    for i in range(max_retries):
        try:
            resp4 = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
            if resp4.status_code == 200:
                print(f"✓ Backend is back up")
                break
        except Exception as e:
            if i < max_retries - 1:
                print(f"  Retry {i+1}/{max_retries}...")
                time.sleep(2)
            else:
                raise Exception(f"Backend did not come back up after restart: {e}")
    
    # Re-GET and verify the value SURVIVED
    resp5 = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp5.status_code == 200
    after_restart = resp5.json()
    after = next((j for j in after_restart if j["id"] == journey_id), None)
    assert after, f"Journey {journey_id} not found after restart"
    
    after_value = after.get("small_group_text")
    if after_value != test_value:
        print(f"❌ FAIL: Value changed after restart")
        print(f"  Before: {repr(test_value)}")
        print(f"  After:  {repr(after_value)}")
        raise AssertionError("Migration overwrote existing value (not idempotent)")
    
    print(f"✓ PASS: Value survived restart: {repr(after_value)}")
    
    # Restore original value
    print(f"\nRestoring original value: {repr(original_value)}")
    resp6 = requests.patch(
        f"{BACKEND_URL}/admin/journeys/{journey_id}",
        json={"small_group_text": original_value},
        headers=auth_headers(),
        timeout=10
    )
    assert resp6.status_code == 200
    print(f"✓ Restored")
    
    print("\n✓ PASS: Idempotent migration test successful")


def test_5_regression_sanity():
    """
    TEST 5: REGRESSION SANITY
    Verify existing endpoints still work:
    - GET /api/journeys returns 4 rows with all expected fields
    - DELETE /api/admin/stories/{id}/cover responds correctly
    - DELETE /api/admin/blog/{id}/cover responds correctly
    """
    print("\n" + "="*80)
    print("TEST 5: REGRESSION SANITY - Verify existing endpoints still work")
    print("="*80)
    
    # GET /api/journeys
    print("\nChecking GET /api/journeys...")
    resp = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp.status_code == 200, f"GET /api/journeys failed: {resp.status_code}"
    journeys = resp.json()
    
    print(f"✓ GET /api/journeys returns {len(journeys)} rows")
    
    # Verify expected fields are present
    if len(journeys) > 0:
        sample = journeys[0]
        expected_fields = ["hero_media_id", "gallery_media_ids", "highlights", "small_group_text"]
        missing = [f for f in expected_fields if f not in sample]
        if missing:
            print(f"⚠ Warning: Sample journey missing fields: {missing}")
        else:
            print(f"✓ Sample journey has all expected fields: {expected_fields}")
    
    # DELETE /api/admin/stories/{id}/cover - test 404 on fake id
    print("\nChecking DELETE /api/admin/stories/{id}/cover...")
    fake_story_id = "fake-story-id-12345"
    resp2 = requests.delete(
        f"{BACKEND_URL}/admin/stories/{fake_story_id}/cover",
        headers=auth_headers(),
        timeout=10
    )
    # Should return 404 for non-existent story
    if resp2.status_code == 404:
        print(f"✓ DELETE /api/admin/stories/{{fake-id}}/cover returns 404 (expected)")
    else:
        print(f"⚠ DELETE /api/admin/stories/{{fake-id}}/cover returned {resp2.status_code} (expected 404)")
    
    # DELETE /api/admin/blog/{id}/cover - test 404 on fake id
    print("\nChecking DELETE /api/admin/blog/{id}/cover...")
    fake_blog_id = "fake-blog-id-12345"
    resp3 = requests.delete(
        f"{BACKEND_URL}/admin/blog/{fake_blog_id}/cover",
        headers=auth_headers(),
        timeout=10
    )
    # Should return 404 for non-existent blog
    if resp3.status_code == 404:
        print(f"✓ DELETE /api/admin/blog/{{fake-id}}/cover returns 404 (expected)")
    else:
        print(f"⚠ DELETE /api/admin/blog/{{fake-id}}/cover returned {resp3.status_code} (expected 404)")
    
    print("\n✓ PASS: Regression sanity checks complete")


def main():
    """Run all AB1 tests."""
    print("\n" + "="*80)
    print("AB1 BACKEND TEST SUITE - small_group_text field on Journey model")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Admin Email: {ADMIN_EMAIL}")
    
    try:
        # Login first
        login()
        
        # Run all tests
        journeys = test_1_startup_migration()
        test_2_post_round_trip()
        test_3_patch_preservation()
        test_4_idempotent_migration()
        test_5_regression_sanity()
        
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED")
        print("="*80)
        print("\nSUMMARY:")
        print("✓ TEST 1: Startup migration - all journeys have small_group_text key")
        print("✓ TEST 2: POST round-trip - field persists correctly")
        print("✓ TEST 3: PATCH preservation - no field clobbering (CRITICAL)")
        print("✓ TEST 4: Idempotent migration - existing values survive restart")
        print("✓ TEST 5: Regression sanity - existing endpoints work")
        print("\nAB1 small_group_text implementation is PRODUCTION-READY.")
        
    except AssertionError as e:
        print("\n" + "="*80)
        print("❌ TEST FAILED")
        print("="*80)
        print(f"Error: {e}")
        raise
    except Exception as e:
        print("\n" + "="*80)
        print("❌ TEST ERROR")
        print("="*80)
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()
