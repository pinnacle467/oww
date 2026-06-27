#!/usr/bin/env python3
"""
Backend API test suite for B2 feature: Tour gallery + 3-section body + 
Corporate Retreats + duplicate + preview-token + Maleny re-tag.

Tests the journeys/tours/retreats/admin-journeys endpoints.
"""

import requests
import sys
import os

# Read backend URL from frontend .env
BACKEND_URL = None
env_path = "/app/frontend/.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BACKEND_URL = line.split("=", 1)[1].strip() + "/api"
                break

if not BACKEND_URL:
    print("❌ ERROR: Could not read REACT_APP_BACKEND_URL from /app/frontend/.env")
    sys.exit(1)

print(f"🔗 Backend URL: {BACKEND_URL}")

# Admin credentials
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

# Track test data for cleanup
test_journey_ids = []
test_duplicate_ids = []

def login():
    """Login and return Bearer token."""
    print("\n🔐 Logging in as admin...")
    resp = requests.post(
        f"{BACKEND_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    data = resp.json()
    token = data.get("access_token")
    if not token:
        print(f"❌ No access_token in login response: {data}")
        sys.exit(1)
    print(f"✅ Login successful")
    return token

def cleanup(token):
    """Delete all test journeys created during testing."""
    print("\n🧹 Cleaning up test data...")
    headers = {"Authorization": f"Bearer {token}"}
    deleted = 0
    for jid in test_journey_ids + test_duplicate_ids:
        try:
            resp = requests.delete(f"{BACKEND_URL}/admin/journeys/{jid}", headers=headers, timeout=10)
            if resp.status_code in (200, 404):
                deleted += 1
        except Exception as e:
            print(f"⚠️  Failed to delete journey {jid}: {e}")
    print(f"✅ Cleaned up {deleted} test journeys")

def test_maleny_retag():
    """Test 1: Maleny re-tag migration."""
    print("\n" + "="*80)
    print("TEST 1: Maleny re-tag migration")
    print("="*80)
    
    # GET /api/journeys should return 4 rows total
    resp = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp.status_code == 200, f"GET /api/journeys failed: {resp.status_code}"
    journeys = resp.json()
    print(f"✓ GET /api/journeys returns {len(journeys)} rows (expected 4)")
    assert len(journeys) == 4, f"Expected 4 journeys, got {len(journeys)}"
    
    # GET /api/journeys?type=tour should return 3 rows (no maleny)
    resp = requests.get(f"{BACKEND_URL}/journeys?type=tour", timeout=10)
    assert resp.status_code == 200, f"GET /api/journeys?type=tour failed: {resp.status_code}"
    tours = resp.json()
    print(f"✓ GET /api/journeys?type=tour returns {len(tours)} rows (expected 3)")
    assert len(tours) == 3, f"Expected 3 tours, got {len(tours)}"
    tour_names = [j.get("name", "") for j in tours]
    assert "Maleny Creative Immersion" not in tour_names, "Maleny should not be in tours list"
    print(f"✓ Maleny Creative Immersion NOT in tours list")
    
    # GET /api/journeys?type=retreat should return 1 row (only maleny)
    resp = requests.get(f"{BACKEND_URL}/journeys?type=retreat", timeout=10)
    assert resp.status_code == 200, f"GET /api/journeys?type=retreat failed: {resp.status_code}"
    retreats = resp.json()
    print(f"✓ GET /api/journeys?type=retreat returns {len(retreats)} row (expected 1)")
    assert len(retreats) == 1, f"Expected 1 retreat, got {len(retreats)}"
    assert retreats[0].get("name") == "Maleny Creative Immersion", "Expected Maleny in retreats"
    print(f"✓ Maleny Creative Immersion IS in retreats list")
    
    # GET /api/retreats should return 1 row (maleny)
    resp = requests.get(f"{BACKEND_URL}/retreats", timeout=10)
    assert resp.status_code == 200, f"GET /api/retreats failed: {resp.status_code}"
    retreats_public = resp.json()
    print(f"✓ GET /api/retreats returns {len(retreats_public)} row (expected 1)")
    assert len(retreats_public) == 1, f"Expected 1 retreat, got {len(retreats_public)}"
    
    # GET /api/retreats/maleny-creative-immersion should return 200
    resp = requests.get(f"{BACKEND_URL}/retreats/maleny-creative-immersion", timeout=10)
    assert resp.status_code == 200, f"GET /api/retreats/maleny-creative-immersion failed: {resp.status_code}"
    maleny = resp.json()
    assert maleny.get("type") == "retreat", f"Maleny type should be 'retreat', got {maleny.get('type')}"
    print(f"✓ GET /api/retreats/maleny-creative-immersion returns 200 with type='retreat'")
    
    # GET /api/tours/maleny-creative-immersion should return 404 (Maleny is no longer a tour)
    resp = requests.get(f"{BACKEND_URL}/tours/maleny-creative-immersion", timeout=10)
    assert resp.status_code == 404, f"GET /api/tours/maleny-creative-immersion should return 404, got {resp.status_code}"
    print(f"✓ GET /api/tours/maleny-creative-immersion returns 404 (Maleny is no longer a tour)")
    
    # GET /api/tours/tasmanian-slow-and-soulful-journeys should return 200 (still a tour)
    resp = requests.get(f"{BACKEND_URL}/tours/tasmanian-slow-and-soulful-journeys", timeout=10)
    assert resp.status_code == 200, f"GET /api/tours/tasmanian-slow-and-soulful-journeys failed: {resp.status_code}"
    tas = resp.json()
    assert tas.get("type") in ("tour", None), f"Tasmanian should be type='tour', got {tas.get('type')}"
    print(f"✓ GET /api/tours/tasmanian-slow-and-soulful-journeys returns 200 (still a tour)")
    
    print("\n✅ TEST 1 PASSED: Maleny re-tag migration working correctly")

def test_b2_schema_migration(token):
    """Test 2: B2 schema migration applied to every journey row."""
    print("\n" + "="*80)
    print("TEST 2: B2 schema migration applied to every journey row")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BACKEND_URL}/admin/journeys", headers=headers, timeout=10)
    assert resp.status_code == 200, f"GET /api/admin/journeys failed: {resp.status_code}"
    journeys = resp.json()
    
    print(f"✓ GET /api/admin/journeys returns {len(journeys)} rows")
    
    # Check that every row has the B2 fields
    required_fields = ["gallery_media_ids", "description_html", "itinerary_html", "practical_html", "preview_token"]
    for journey in journeys:
        name = journey.get("name", "Unknown")
        for field in required_fields:
            assert field in journey, f"Journey '{name}' missing field '{field}'"
        print(f"✓ Journey '{name}' has all B2 fields: {required_fields}")
        
        # Check that gallery_media_ids is a list
        assert isinstance(journey.get("gallery_media_ids"), list), f"gallery_media_ids should be a list"
        
        # Check that description_html, itinerary_html, practical_html, preview_token are strings
        for field in ["description_html", "itinerary_html", "practical_html", "preview_token"]:
            assert isinstance(journey.get(field), str), f"{field} should be a string"
    
    print("\n✅ TEST 2 PASSED: B2 schema migration applied to all journey rows")

def test_post_admin_journeys_b2_fields(token):
    """Test 3: POST /api/admin/journeys round-trips B2 fields."""
    print("\n" + "="*80)
    print("TEST 3: POST /api/admin/journeys round-trips B2 fields")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a new journey with B2 fields
    payload = {
        "name": "Test B2 Journey POST",
        "region": "Test Region",
        "nights": "5 nights",
        "dates": "Year-round",
        "priceFrom": "$5,000",
        "summary": "Test summary",
        "type": "tour",
        "status": "published",
        "gallery_media_ids": ["media-id-1", "media-id-2", "media-id-3"],
        "description_html": "<p>This is the description section.</p>",
        "itinerary_html": "<p>This is the itinerary section.</p>",
        "practical_html": "<p>This is the practical info section.</p>",
    }
    
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=payload, timeout=10)
    assert resp.status_code == 200, f"POST /api/admin/journeys failed: {resp.status_code} {resp.text}"
    created = resp.json()
    journey_id = created.get("id")
    assert journey_id, "No id in created journey"
    test_journey_ids.append(journey_id)
    
    print(f"✓ Created journey with id={journey_id}")
    
    # Verify all B2 fields were persisted
    assert created.get("gallery_media_ids") == ["media-id-1", "media-id-2", "media-id-3"], "gallery_media_ids mismatch"
    assert created.get("description_html") == "<p>This is the description section.</p>", "description_html mismatch"
    assert created.get("itinerary_html") == "<p>This is the itinerary section.</p>", "itinerary_html mismatch"
    assert created.get("practical_html") == "<p>This is the practical info section.</p>", "practical_html mismatch"
    
    print(f"✓ All B2 fields persisted correctly in POST response")
    
    # Fetch the journey again to confirm persistence
    resp = requests.get(f"{BACKEND_URL}/admin/journeys", headers=headers, timeout=10)
    assert resp.status_code == 200
    journeys = resp.json()
    fetched = next((j for j in journeys if j.get("id") == journey_id), None)
    assert fetched, f"Journey {journey_id} not found in GET /api/admin/journeys"
    
    assert fetched.get("gallery_media_ids") == ["media-id-1", "media-id-2", "media-id-3"], "gallery_media_ids mismatch on fetch"
    assert fetched.get("description_html") == "<p>This is the description section.</p>", "description_html mismatch on fetch"
    assert fetched.get("itinerary_html") == "<p>This is the itinerary section.</p>", "itinerary_html mismatch on fetch"
    assert fetched.get("practical_html") == "<p>This is the practical info section.</p>", "practical_html mismatch on fetch"
    
    print(f"✓ All B2 fields confirmed on GET after POST")
    
    print("\n✅ TEST 3 PASSED: POST /api/admin/journeys round-trips B2 fields")

def test_patch_admin_journeys_b2_fields(token):
    """Test 4: PATCH /api/admin/journeys round-trips B2 fields."""
    print("\n" + "="*80)
    print("TEST 4: PATCH /api/admin/journeys round-trips B2 fields")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a journey first
    payload = {
        "name": "Test B2 Journey PATCH",
        "type": "tour",
        "status": "published",
    }
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=payload, timeout=10)
    assert resp.status_code == 200
    created = resp.json()
    journey_id = created.get("id")
    test_journey_ids.append(journey_id)
    
    print(f"✓ Created journey with id={journey_id}")
    
    # PATCH with B2 fields
    patch_payload = {
        "gallery_media_ids": ["updated-1", "updated-2"],
        "description_html": "<p>Updated description.</p>",
        "itinerary_html": "<p>Updated itinerary.</p>",
        "practical_html": "<p>Updated practical.</p>",
    }
    
    resp = requests.patch(f"{BACKEND_URL}/admin/journeys/{journey_id}", headers=headers, json=patch_payload, timeout=10)
    assert resp.status_code == 200, f"PATCH /api/admin/journeys/{journey_id} failed: {resp.status_code} {resp.text}"
    
    print(f"✓ PATCH request successful")
    
    # Fetch the journey to verify updates
    resp = requests.get(f"{BACKEND_URL}/admin/journeys", headers=headers, timeout=10)
    assert resp.status_code == 200
    journeys = resp.json()
    fetched = next((j for j in journeys if j.get("id") == journey_id), None)
    assert fetched, f"Journey {journey_id} not found"
    
    assert fetched.get("gallery_media_ids") == ["updated-1", "updated-2"], "gallery_media_ids not updated"
    assert fetched.get("description_html") == "<p>Updated description.</p>", "description_html not updated"
    assert fetched.get("itinerary_html") == "<p>Updated itinerary.</p>", "itinerary_html not updated"
    assert fetched.get("practical_html") == "<p>Updated practical.</p>", "practical_html not updated"
    
    print(f"✓ All B2 fields updated correctly via PATCH")
    
    print("\n✅ TEST 4 PASSED: PATCH /api/admin/journeys round-trips B2 fields")

def test_duplicate_endpoint(token):
    """Test 5: POST /api/admin/journeys/{id}/duplicate."""
    print("\n" + "="*80)
    print("TEST 5: POST /api/admin/journeys/{id}/duplicate")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a source journey with B2 fields
    payload = {
        "name": "Source Journey for Duplicate",
        "type": "tour",
        "status": "published",
        "popular": True,
        "gallery_media_ids": ["src-1", "src-2"],
        "description_html": "<p>Source description.</p>",
        "itinerary_html": "<p>Source itinerary.</p>",
        "practical_html": "<p>Source practical.</p>",
    }
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=payload, timeout=10)
    assert resp.status_code == 200
    source = resp.json()
    source_id = source.get("id")
    source_slug = source.get("slug")
    test_journey_ids.append(source_id)
    
    print(f"✓ Created source journey with id={source_id}, slug={source_slug}")
    
    # Duplicate the journey
    resp = requests.post(f"{BACKEND_URL}/admin/journeys/{source_id}/duplicate", headers=headers, timeout=10)
    assert resp.status_code == 200, f"POST /api/admin/journeys/{source_id}/duplicate failed: {resp.status_code} {resp.text}"
    duplicate = resp.json()
    dup_id = duplicate.get("id")
    dup_slug = duplicate.get("slug")
    dup_name = duplicate.get("name")
    dup_status = duplicate.get("status")
    dup_popular = duplicate.get("popular")
    dup_preview_token = duplicate.get("preview_token")
    
    test_duplicate_ids.append(dup_id)
    
    print(f"✓ Duplicated journey with id={dup_id}, slug={dup_slug}")
    
    # Verify duplicate properties
    assert dup_id != source_id, "Duplicate should have a new id"
    assert dup_slug != source_slug, "Duplicate should have a unique slug"
    assert dup_slug.endswith("-copy") or "-copy-" in dup_slug, f"Duplicate slug should end with -copy, got {dup_slug}"
    assert dup_name == "Source Journey for Duplicate (copy)", f"Duplicate name should have ' (copy)' appended, got {dup_name}"
    assert dup_status == "draft", f"Duplicate status should be 'draft', got {dup_status}"
    assert dup_popular == False, f"Duplicate popular should be False, got {dup_popular}"
    assert dup_preview_token and len(dup_preview_token) > 0, "Duplicate should have a preview_token"
    
    print(f"✓ Duplicate has correct properties: status=draft, popular=false, preview_token={dup_preview_token[:8]}...")
    
    # Verify B2 fields were copied
    assert duplicate.get("gallery_media_ids") == ["src-1", "src-2"], "gallery_media_ids not copied"
    assert duplicate.get("description_html") == "<p>Source description.</p>", "description_html not copied"
    assert duplicate.get("itinerary_html") == "<p>Source itinerary.</p>", "itinerary_html not copied"
    assert duplicate.get("practical_html") == "<p>Source practical.</p>", "practical_html not copied"
    
    print(f"✓ All B2 fields copied correctly to duplicate")
    
    # Verify duplicate appears in admin list but NOT in public list
    resp = requests.get(f"{BACKEND_URL}/admin/journeys", headers=headers, timeout=10)
    assert resp.status_code == 200
    admin_journeys = resp.json()
    assert any(j.get("id") == dup_id for j in admin_journeys), "Duplicate not in admin list"
    print(f"✓ Duplicate appears in GET /api/admin/journeys")
    
    resp = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    assert resp.status_code == 200
    public_journeys = resp.json()
    assert not any(j.get("id") == dup_id for j in public_journeys), "Duplicate should NOT be in public list (draft)"
    print(f"✓ Duplicate does NOT appear in GET /api/journeys (draft hidden)")
    
    print("\n✅ TEST 5 PASSED: POST /api/admin/journeys/{id}/duplicate working correctly")

def test_preview_token_endpoint(token):
    """Test 6: POST /api/admin/journeys/{id}/preview-token."""
    print("\n" + "="*80)
    print("TEST 6: POST /api/admin/journeys/{id}/preview-token")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a draft journey
    payload = {
        "name": "Test Preview Token Journey",
        "type": "tour",
        "status": "draft",
        "slug": "test-preview-token-journey",
    }
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=payload, timeout=10)
    assert resp.status_code == 200
    journey = resp.json()
    journey_id = journey.get("id")
    journey_slug = journey.get("slug")
    test_journey_ids.append(journey_id)
    
    print(f"✓ Created draft journey with id={journey_id}, slug={journey_slug}")
    
    # Generate preview token
    resp = requests.post(f"{BACKEND_URL}/admin/journeys/{journey_id}/preview-token", headers=headers, timeout=10)
    assert resp.status_code == 200, f"POST /api/admin/journeys/{journey_id}/preview-token failed: {resp.status_code} {resp.text}"
    token_data = resp.json()
    preview_token = token_data.get("preview_token")
    returned_slug = token_data.get("slug")
    returned_type = token_data.get("type")
    
    assert preview_token and len(preview_token) > 0, "preview_token should be non-empty"
    assert returned_slug == journey_slug, f"Returned slug should match journey slug"
    assert returned_type == "tour", f"Returned type should be 'tour'"
    
    print(f"✓ Preview token generated: {preview_token[:8]}...")
    
    # Verify token persists on the row
    resp = requests.get(f"{BACKEND_URL}/admin/journeys", headers=headers, timeout=10)
    assert resp.status_code == 200
    journeys = resp.json()
    fetched = next((j for j in journeys if j.get("id") == journey_id), None)
    assert fetched, f"Journey {journey_id} not found"
    assert fetched.get("preview_token") == preview_token, "preview_token not persisted"
    
    print(f"✓ Preview token persisted on journey row")
    
    # Test preview access: without token should return 404
    resp = requests.get(f"{BACKEND_URL}/tours/{journey_slug}", timeout=10)
    assert resp.status_code == 404, f"GET /api/tours/{journey_slug} without token should return 404, got {resp.status_code}"
    print(f"✓ GET /api/tours/{journey_slug} without token returns 404 (draft hidden)")
    
    # Test preview access: with correct token should return 200
    resp = requests.get(f"{BACKEND_URL}/tours/{journey_slug}?preview={preview_token}", timeout=10)
    assert resp.status_code == 200, f"GET /api/tours/{journey_slug}?preview={preview_token} should return 200, got {resp.status_code}"
    print(f"✓ GET /api/tours/{journey_slug}?preview={preview_token} returns 200 (draft visible with token)")
    
    # Test preview access: with wrong token should return 404
    resp = requests.get(f"{BACKEND_URL}/tours/{journey_slug}?preview=wrong-token", timeout=10)
    assert resp.status_code == 404, f"GET /api/tours/{journey_slug}?preview=wrong-token should return 404, got {resp.status_code}"
    print(f"✓ GET /api/tours/{journey_slug}?preview=wrong-token returns 404 (wrong token)")
    
    # Test same for retreats
    payload_retreat = {
        "name": "Test Preview Token Retreat",
        "type": "retreat",
        "status": "draft",
        "slug": "test-preview-token-retreat",
    }
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=payload_retreat, timeout=10)
    assert resp.status_code == 200
    retreat = resp.json()
    retreat_id = retreat.get("id")
    retreat_slug = retreat.get("slug")
    test_journey_ids.append(retreat_id)
    
    resp = requests.post(f"{BACKEND_URL}/admin/journeys/{retreat_id}/preview-token", headers=headers, timeout=10)
    assert resp.status_code == 200
    retreat_token_data = resp.json()
    retreat_preview_token = retreat_token_data.get("preview_token")
    
    print(f"✓ Created draft retreat with preview token")
    
    # Test retreat preview access
    resp = requests.get(f"{BACKEND_URL}/retreats/{retreat_slug}", timeout=10)
    assert resp.status_code == 404, "Retreat without token should return 404"
    
    resp = requests.get(f"{BACKEND_URL}/retreats/{retreat_slug}?preview={retreat_preview_token}", timeout=10)
    assert resp.status_code == 200, "Retreat with correct token should return 200"
    print(f"✓ GET /api/retreats/{retreat_slug}?preview={retreat_preview_token} returns 200")
    
    print("\n✅ TEST 6 PASSED: POST /api/admin/journeys/{id}/preview-token working correctly")

def test_type_validation(token):
    """Test 7: Type validation (tour vs retreat)."""
    print("\n" + "="*80)
    print("TEST 7: Type validation (tour vs retreat)")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a tour
    tour_payload = {
        "name": "Test Type Validation Tour",
        "type": "tour",
        "status": "published",
        "slug": "test-type-validation-tour",
    }
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=tour_payload, timeout=10)
    assert resp.status_code == 200
    tour = resp.json()
    tour_id = tour.get("id")
    tour_slug = tour.get("slug")
    test_journey_ids.append(tour_id)
    
    print(f"✓ Created tour with slug={tour_slug}")
    
    # GET /api/tours/{slug} should return 200
    resp = requests.get(f"{BACKEND_URL}/tours/{tour_slug}", timeout=10)
    assert resp.status_code == 200, f"GET /api/tours/{tour_slug} should return 200, got {resp.status_code}"
    print(f"✓ GET /api/tours/{tour_slug} returns 200")
    
    # GET /api/retreats/{slug} should return 404 (cross-type lookup blocked)
    resp = requests.get(f"{BACKEND_URL}/retreats/{tour_slug}", timeout=10)
    assert resp.status_code == 404, f"GET /api/retreats/{tour_slug} should return 404, got {resp.status_code}"
    print(f"✓ GET /api/retreats/{tour_slug} returns 404 (cross-type lookup blocked)")
    
    # Create a retreat
    retreat_payload = {
        "name": "Test Type Validation Retreat",
        "type": "retreat",
        "status": "published",
        "slug": "test-type-validation-retreat",
    }
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=retreat_payload, timeout=10)
    assert resp.status_code == 200
    retreat = resp.json()
    retreat_id = retreat.get("id")
    retreat_slug = retreat.get("slug")
    test_journey_ids.append(retreat_id)
    
    print(f"✓ Created retreat with slug={retreat_slug}")
    
    # GET /api/retreats/{slug} should return 200
    resp = requests.get(f"{BACKEND_URL}/retreats/{retreat_slug}", timeout=10)
    assert resp.status_code == 200, f"GET /api/retreats/{retreat_slug} should return 200, got {resp.status_code}"
    print(f"✓ GET /api/retreats/{retreat_slug} returns 200")
    
    # GET /api/tours/{slug} should return 404 (cross-type lookup blocked)
    resp = requests.get(f"{BACKEND_URL}/tours/{retreat_slug}", timeout=10)
    assert resp.status_code == 404, f"GET /api/tours/{retreat_slug} should return 404, got {resp.status_code}"
    print(f"✓ GET /api/tours/{retreat_slug} returns 404 (cross-type lookup blocked)")
    
    print("\n✅ TEST 7 PASSED: Type validation working correctly")

def test_regression(token):
    """Test 8: Regression checks."""
    print("\n" + "="*80)
    print("TEST 8: Regression checks")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # GET /api/media count should be 237
    resp = requests.get(f"{BACKEND_URL}/media", timeout=10)
    assert resp.status_code == 200, f"GET /api/media failed: {resp.status_code}"
    media = resp.json()
    media_count = len(media)
    print(f"✓ GET /api/media returns {media_count} items (expected 237)")
    assert media_count == 237, f"Expected 237 media items, got {media_count}"
    
    # GET /api/admin/journeys should return all rows
    resp = requests.get(f"{BACKEND_URL}/admin/journeys", headers=headers, timeout=10)
    assert resp.status_code == 200, f"GET /api/admin/journeys failed: {resp.status_code}"
    admin_journeys = resp.json()
    print(f"✓ GET /api/admin/journeys returns {len(admin_journeys)} rows (includes all types and statuses)")
    
    # B1 flags should still work: include_drafts=true
    resp = requests.get(f"{BACKEND_URL}/journeys?include_drafts=true", timeout=10)
    assert resp.status_code == 200, f"GET /api/journeys?include_drafts=true failed: {resp.status_code}"
    journeys_with_drafts = resp.json()
    print(f"✓ GET /api/journeys?include_drafts=true returns {len(journeys_with_drafts)} rows")
    
    # Slug uniqueness on POST
    payload = {
        "name": "Unique Slug Test",
        "slug": "unique-slug-test-regression",
        "type": "tour",
        "status": "published",
    }
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=payload, timeout=10)
    assert resp.status_code == 200
    j1 = resp.json()
    j1_id = j1.get("id")
    j1_slug = j1.get("slug")
    test_journey_ids.append(j1_id)
    
    # Try to create another with the same slug
    resp = requests.post(f"{BACKEND_URL}/admin/journeys", headers=headers, json=payload, timeout=10)
    assert resp.status_code == 200
    j2 = resp.json()
    j2_id = j2.get("id")
    j2_slug = j2.get("slug")
    test_journey_ids.append(j2_id)
    
    assert j2_slug != j1_slug, f"Slug uniqueness failed: both have slug={j1_slug}"
    assert j2_slug.startswith(j1_slug), f"Second slug should be based on first: {j2_slug}"
    print(f"✓ Slug uniqueness working: {j1_slug} vs {j2_slug}")
    
    print("\n✅ TEST 8 PASSED: Regression checks passed")

def main():
    """Run all B2 backend tests."""
    print("\n" + "="*80)
    print("B2 BACKEND FEATURE TEST SUITE")
    print("="*80)
    
    token = login()
    
    try:
        # Run all tests
        test_maleny_retag()
        test_b2_schema_migration(token)
        test_post_admin_journeys_b2_fields(token)
        test_patch_admin_journeys_b2_fields(token)
        test_duplicate_endpoint(token)
        test_preview_token_endpoint(token)
        test_type_validation(token)
        test_regression(token)
        
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED")
        print("="*80)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        cleanup(token)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
