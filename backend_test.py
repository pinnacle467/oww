#!/usr/bin/env python3
"""
Backend testing for Z1 (Tours redesign) - highlights field on journeys collection.
Tests the new optional highlights: List[str] field added to backend/server.py.
"""

import requests
import sys
import json

# Use internal localhost URL as specified in review request
BASE_URL = "http://localhost:8001/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

def get_auth_token():
    """Login and get Bearer token"""
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    data = resp.json()
    if data.get("status") == "otp_required":
        print("❌ OTP is enabled - cannot proceed with automated testing")
        sys.exit(1)
    token = data.get("access_token")
    if not token:
        print(f"❌ No access_token in login response: {data}")
        sys.exit(1)
    print("✅ Login successful")
    return token

def test_1_post_with_highlights(token):
    """TEST 1: POST /api/admin/journeys with highlights: ["a","b","c"]"""
    print("\n=== TEST 1: POST /api/admin/journeys with highlights ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Test Journey Z1 Highlights",
        "region": "Test Region",
        "highlights": ["a", "b", "c"],
        "slug": "test-z1-highlights-post",
        "status": "published",
        "type": "tour"
    }
    
    resp = requests.post(f"{BASE_URL}/admin/journeys", json=payload, headers=headers)
    if resp.status_code != 200:
        print(f"❌ POST failed: {resp.status_code} {resp.text}")
        return None
    
    data = resp.json()
    journey_id = data.get("id")
    
    # Check response includes highlights in same order
    if data.get("highlights") != ["a", "b", "c"]:
        print(f"❌ Response highlights mismatch: expected ['a','b','c'], got {data.get('highlights')}")
        return journey_id
    print(f"✅ POST response includes highlights in correct order: {data.get('highlights')}")
    
    # Follow-up GET to confirm persistence
    resp_get = requests.get(f"{BASE_URL}/admin/journeys", headers=headers)
    if resp_get.status_code != 200:
        print(f"❌ GET /api/admin/journeys failed: {resp_get.status_code}")
        return journey_id
    
    journeys = resp_get.json()
    test_journey = next((j for j in journeys if j.get("id") == journey_id), None)
    if not test_journey:
        print(f"❌ Test journey not found in GET response")
        return journey_id
    
    if test_journey.get("highlights") != ["a", "b", "c"]:
        print(f"❌ GET highlights mismatch: expected ['a','b','c'], got {test_journey.get('highlights')}")
        return journey_id
    print(f"✅ GET confirms highlights persisted: {test_journey.get('highlights')}")
    
    # Clean up - DELETE the test row
    resp_del = requests.delete(f"{BASE_URL}/admin/journeys/{journey_id}", headers=headers)
    if resp_del.status_code != 200:
        print(f"⚠️  DELETE failed: {resp_del.status_code} {resp_del.text}")
        return journey_id
    print(f"✅ Test journey deleted (cleanup successful)")
    
    return None

def test_2_patch_highlights(token):
    """TEST 2: PATCH /api/admin/journeys with highlights updates"""
    print("\n=== TEST 2: PATCH /api/admin/journeys with highlights ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get one of the 4 seeded journeys (use Tasmanian)
    resp = requests.get(f"{BASE_URL}/admin/journeys", headers=headers)
    if resp.status_code != 200:
        print(f"❌ GET /api/admin/journeys failed: {resp.status_code}")
        return False
    
    journeys = resp.json()
    tasmanian = next((j for j in journeys if "tasmanian" in j.get("slug", "").lower()), None)
    if not tasmanian:
        print(f"❌ Tasmanian journey not found")
        return False
    
    journey_id = tasmanian["id"]
    original_highlights = tasmanian.get("highlights", [])
    print(f"📝 Using journey: {tasmanian.get('name')} (id: {journey_id})")
    print(f"📝 Original highlights: {original_highlights}")
    
    # Test 2a: PATCH with highlights=["x","y"]
    print("\n--- Test 2a: PATCH with highlights=['x','y'] ---")
    resp_patch = requests.patch(f"{BASE_URL}/admin/journeys/{journey_id}", 
                                json={"highlights": ["x", "y"]}, 
                                headers=headers)
    if resp_patch.status_code != 200:
        print(f"❌ PATCH failed: {resp_patch.status_code} {resp_patch.text}")
        return False
    
    # GET to verify
    resp_get = requests.get(f"{BASE_URL}/tours/{tasmanian['slug']}")
    if resp_get.status_code != 200:
        print(f"❌ GET /api/tours/{tasmanian['slug']} failed: {resp_get.status_code}")
        return False
    
    data = resp_get.json()
    if data.get("highlights") != ["x", "y"]:
        print(f"❌ GET highlights mismatch: expected ['x','y'], got {data.get('highlights')}")
        return False
    print(f"✅ PATCH with ['x','y'] successful, GET reflects it")
    
    # Test 2b: PATCH with highlights=[]
    print("\n--- Test 2b: PATCH with highlights=[] ---")
    resp_patch = requests.patch(f"{BASE_URL}/admin/journeys/{journey_id}", 
                                json={"highlights": []}, 
                                headers=headers)
    if resp_patch.status_code != 200:
        print(f"❌ PATCH failed: {resp_patch.status_code} {resp_patch.text}")
        return False
    
    resp_get = requests.get(f"{BASE_URL}/tours/{tasmanian['slug']}")
    if resp_get.status_code != 200:
        print(f"❌ GET failed: {resp_get.status_code}")
        return False
    
    data = resp_get.json()
    if data.get("highlights") != []:
        print(f"❌ GET highlights mismatch: expected [], got {data.get('highlights')}")
        return False
    print(f"✅ PATCH with [] successful, GET returns []")
    
    # Test 2c: PATCH WITHOUT highlights key (partial update) - MOST IMPORTANT
    print("\n--- Test 2c: PATCH without highlights key (partial update) ---")
    # First set highlights to a known value
    resp_patch = requests.patch(f"{BASE_URL}/admin/journeys/{journey_id}", 
                                json={"highlights": ["preserved-1", "preserved-2"]}, 
                                headers=headers)
    if resp_patch.status_code != 200:
        print(f"❌ Setup PATCH failed: {resp_patch.status_code}")
        return False
    
    # Now PATCH with only summary (no highlights key)
    resp_patch = requests.patch(f"{BASE_URL}/admin/journeys/{journey_id}", 
                                json={"summary": "Updated summary without touching highlights"}, 
                                headers=headers)
    if resp_patch.status_code != 200:
        print(f"❌ PATCH failed: {resp_patch.status_code} {resp_patch.text}")
        return False
    
    resp_get = requests.get(f"{BASE_URL}/tours/{tasmanian['slug']}")
    if resp_get.status_code != 200:
        print(f"❌ GET failed: {resp_get.status_code}")
        return False
    
    data = resp_get.json()
    if data.get("highlights") != ["preserved-1", "preserved-2"]:
        print(f"❌ CRITICAL: Partial update cleared highlights! Expected ['preserved-1','preserved-2'], got {data.get('highlights')}")
        return False
    print(f"✅ CRITICAL TEST PASSED: Partial update preserved highlights: {data.get('highlights')}")
    
    # Restore original highlights
    print(f"\n📝 Restoring original highlights: {original_highlights}")
    resp_patch = requests.patch(f"{BASE_URL}/admin/journeys/{journey_id}", 
                                json={"highlights": original_highlights}, 
                                headers=headers)
    if resp_patch.status_code != 200:
        print(f"⚠️  Failed to restore original highlights: {resp_patch.status_code}")
    else:
        print(f"✅ Original highlights restored")
    
    return True

def test_3_public_get_includes_highlights(token):
    """TEST 3: Public GET /api/tours/{slug} includes highlights"""
    print("\n=== TEST 3: Public GET /api/tours/{slug} includes highlights ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get all journeys to find one with highlights and one without
    resp = requests.get(f"{BASE_URL}/admin/journeys", headers=headers)
    if resp.status_code != 200:
        print(f"❌ GET /api/admin/journeys failed: {resp.status_code}")
        return False
    
    journeys = resp.json()
    tours = [j for j in journeys if j.get("type") in ("tour", None) and j.get("status") == "published"]
    
    if not tours:
        print(f"❌ No published tours found")
        return False
    
    # Test with first tour (should have highlights key even if empty)
    test_tour = tours[0]
    print(f"📝 Testing with tour: {test_tour.get('name')} (slug: {test_tour.get('slug')})")
    
    resp = requests.get(f"{BASE_URL}/tours/{test_tour['slug']}")
    if resp.status_code != 200:
        print(f"❌ GET /api/tours/{test_tour['slug']} failed: {resp.status_code}")
        return False
    
    data = resp.json()
    if "highlights" not in data:
        print(f"❌ highlights key missing from response")
        return False
    
    print(f"✅ Public GET includes highlights key: {data.get('highlights')}")
    
    # Test with another tour if available
    if len(tours) > 1:
        test_tour2 = tours[1]
        print(f"📝 Testing with tour: {test_tour2.get('name')} (slug: {test_tour2.get('slug')})")
        resp = requests.get(f"{BASE_URL}/tours/{test_tour2['slug']}")
        if resp.status_code != 200:
            print(f"❌ GET /api/tours/{test_tour2['slug']} failed: {resp.status_code}")
            return False
        data = resp.json()
        if "highlights" not in data:
            print(f"❌ highlights key missing from response")
            return False
        print(f"✅ Public GET includes highlights key: {data.get('highlights')}")
    
    return True

def test_4_startup_migration(token):
    """TEST 4: Startup migration - every row has highlights field"""
    print("\n=== TEST 4: Startup migration check ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = requests.get(f"{BASE_URL}/admin/journeys", headers=headers)
    if resp.status_code != 200:
        print(f"❌ GET /api/admin/journeys failed: {resp.status_code}")
        return False
    
    journeys = resp.json()
    print(f"📝 Found {len(journeys)} total journeys")
    
    missing_highlights = []
    for j in journeys:
        if "highlights" not in j:
            missing_highlights.append(j.get("name", j.get("id")))
    
    if missing_highlights:
        print(f"❌ {len(missing_highlights)} journeys missing highlights field: {missing_highlights}")
        return False
    
    print(f"✅ All {len(journeys)} journeys have highlights field (migration successful)")
    
    # Check default value is []
    for j in journeys:
        highlights = j.get("highlights")
        if not isinstance(highlights, list):
            print(f"❌ Journey {j.get('name')} has non-list highlights: {type(highlights)}")
            return False
    
    print(f"✅ All highlights fields are lists (correct type)")
    
    return True

def test_5_regression_checks(token):
    """TEST 5: Regression checks - existing fields still work"""
    print("\n=== TEST 5: Regression checks ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get a journey to test with
    resp = requests.get(f"{BASE_URL}/admin/journeys", headers=headers)
    if resp.status_code != 200:
        print(f"❌ GET /api/admin/journeys failed: {resp.status_code}")
        return False
    
    journeys = resp.json()
    if not journeys:
        print(f"❌ No journeys found")
        return False
    
    test_journey = journeys[0]
    journey_id = test_journey["id"]
    print(f"📝 Testing regression with journey: {test_journey.get('name')}")
    
    # Store original values
    original_values = {
        "includes": test_journey.get("includes", []),
        "excludes": test_journey.get("excludes", []),
        "more_details_html": test_journey.get("more_details_html", ""),
        "gallery_media_ids": test_journey.get("gallery_media_ids", []),
        "description_html": test_journey.get("description_html", ""),
        "itinerary_html": test_journey.get("itinerary_html", ""),
        "practical_html": test_journey.get("practical_html", "")
    }
    
    # PATCH with test values
    test_values = {
        "includes": ["Test include 1", "Test include 2"],
        "excludes": ["Test exclude 1", "Test exclude 2"],
        "more_details_html": "<p>Test more details HTML</p>",
        "gallery_media_ids": ["test-media-id-1", "test-media-id-2"],
        "description_html": "<p>Test description HTML</p>",
        "itinerary_html": "<p>Test itinerary HTML</p>",
        "practical_html": "<p>Test practical HTML</p>"
    }
    
    resp_patch = requests.patch(f"{BASE_URL}/admin/journeys/{journey_id}", 
                                json=test_values, 
                                headers=headers)
    if resp_patch.status_code != 200:
        print(f"❌ PATCH failed: {resp_patch.status_code} {resp_patch.text}")
        return False
    
    # GET and verify
    resp_get = requests.get(f"{BASE_URL}/admin/journeys", headers=headers)
    if resp_get.status_code != 200:
        print(f"❌ GET failed: {resp_get.status_code}")
        return False
    
    updated_journey = next((j for j in resp_get.json() if j.get("id") == journey_id), None)
    if not updated_journey:
        print(f"❌ Journey not found after PATCH")
        return False
    
    # Verify each field
    all_passed = True
    for field, expected_value in test_values.items():
        actual_value = updated_journey.get(field)
        if actual_value != expected_value:
            print(f"❌ Field {field} mismatch: expected {expected_value}, got {actual_value}")
            all_passed = False
        else:
            print(f"✅ Field {field} round-tripped correctly")
    
    # Restore original values
    print(f"\n📝 Restoring original values...")
    resp_patch = requests.patch(f"{BASE_URL}/admin/journeys/{journey_id}", 
                                json=original_values, 
                                headers=headers)
    if resp_patch.status_code != 200:
        print(f"⚠️  Failed to restore original values: {resp_patch.status_code}")
    else:
        print(f"✅ Original values restored")
    
    return all_passed

def test_6_counts_unchanged(token):
    """TEST 6: Counts unchanged - verify data integrity"""
    print("\n=== TEST 6: Counts unchanged ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # GET /api/journeys?type=tour should return 4 entries
    resp = requests.get(f"{BASE_URL}/journeys?type=tour")
    if resp.status_code != 200:
        print(f"❌ GET /api/journeys?type=tour failed: {resp.status_code}")
        return False
    
    tours = resp.json()
    if len(tours) != 4:
        print(f"❌ Expected 4 tours, got {len(tours)}")
        return False
    print(f"✅ GET /api/journeys?type=tour returns 4 entries")
    
    # GET /api/media should return ≥ 237 entries
    resp = requests.get(f"{BASE_URL}/media")
    if resp.status_code != 200:
        print(f"❌ GET /api/media failed: {resp.status_code}")
        return False
    
    media = resp.json()
    if len(media) < 237:
        print(f"❌ Expected ≥237 media entries, got {len(media)}")
        return False
    print(f"✅ GET /api/media returns {len(media)} entries (≥237)")
    
    # Test other endpoints still work
    endpoints = [
        "/about-blocks",
        "/stories",
        "/home-faqs",
        "/home-sections",
        "/blog"
    ]
    
    for endpoint in endpoints:
        resp = requests.get(f"{BASE_URL}{endpoint}")
        if resp.status_code != 200:
            print(f"❌ GET {endpoint} failed: {resp.status_code}")
            return False
        data = resp.json()
        print(f"✅ GET {endpoint} works, returns {len(data)} entries")
    
    return True

def test_7_auth_regression(token):
    """TEST 7: Auth regression - anonymous requests blocked"""
    print("\n=== TEST 7: Auth regression ===")
    
    # Anonymous POST to /api/admin/journeys should return 401
    resp = requests.post(f"{BASE_URL}/admin/journeys", json={"name": "Test"})
    if resp.status_code not in (401, 403):
        print(f"❌ Anonymous POST returned {resp.status_code}, expected 401 or 403")
        return False
    print(f"✅ Anonymous POST returns {resp.status_code} (auth required)")
    
    # Anonymous PATCH should return 401
    resp = requests.patch(f"{BASE_URL}/admin/journeys/fake-id", json={"name": "Test"})
    if resp.status_code not in (401, 403):
        print(f"❌ Anonymous PATCH returned {resp.status_code}, expected 401 or 403")
        return False
    print(f"✅ Anonymous PATCH returns {resp.status_code} (auth required)")
    
    # Anonymous DELETE should return 401
    resp = requests.delete(f"{BASE_URL}/admin/journeys/fake-id")
    if resp.status_code not in (401, 403):
        print(f"❌ Anonymous DELETE returned {resp.status_code}, expected 401 or 403")
        return False
    print(f"✅ Anonymous DELETE returns {resp.status_code} (auth required)")
    
    return True

def main():
    print("=" * 70)
    print("Z1 Backend Testing: highlights field on journeys collection")
    print("=" * 70)
    
    # Get auth token
    token = get_auth_token()
    
    # Run all tests
    results = {}
    
    results["test_1_post_with_highlights"] = test_1_post_with_highlights(token) is None
    results["test_2_patch_highlights"] = test_2_patch_highlights(token)
    results["test_3_public_get_includes_highlights"] = test_3_public_get_includes_highlights(token)
    results["test_4_startup_migration"] = test_4_startup_migration(token)
    results["test_5_regression_checks"] = test_5_regression_checks(token)
    results["test_6_counts_unchanged"] = test_6_counts_unchanged(token)
    results["test_7_auth_regression"] = test_7_auth_regression(token)
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
