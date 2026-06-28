#!/usr/bin/env python3
"""
Phase 3 Backend Testing - media_ids field on blog_posts and home_sections
Tests the new media_ids field round-trip and migration coverage.
"""

import requests
import json
from typing import List, Optional

# Backend URL - using internal port since we're running inside the container
BACKEND_URL = "http://localhost:8001/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

# Track test IDs for cleanup
test_blog_ids = []
test_home_section_ids = []


def login() -> str:
    """Login and return Bearer token"""
    print("\n🔐 Logging in as admin...")
    resp = requests.post(
        f"{BACKEND_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10
    )
    if resp.status_code != 200:
        raise Exception(f"Login failed: {resp.status_code} {resp.text}")
    data = resp.json()
    token = data.get("access_token")
    if not token:
        raise Exception(f"No access_token in login response: {data}")
    print(f"✅ Login successful")
    return token


def test_blog_media_ids_roundtrip(token: str):
    """Test 1) BLOG: media_ids round-trip"""
    print("\n" + "=" * 70)
    print("TEST 1: BLOG media_ids ROUND-TRIP")
    print("=" * 70)
    
    # 1a) Get a real media.id from GET /api/media
    print("\n1a) Getting real media IDs from GET /api/media")
    resp = requests.get(f"{BACKEND_URL}/media", timeout=10)
    if resp.status_code != 200:
        print(f"❌ FAILED: GET /api/media returned {resp.status_code}")
        return False
    
    media_list = resp.json()
    if not media_list or len(media_list) == 0:
        print(f"❌ FAILED: No media found in GET /api/media")
        return False
    
    media_id_1 = media_list[0]["id"]
    media_id_2 = media_list[1]["id"] if len(media_list) > 1 else media_id_1
    print(f"✅ Got media IDs: {media_id_1}, {media_id_2}")
    
    # 1b) POST /api/admin/blog with media_ids
    print("\n1b) POST /api/admin/blog with media_ids=[{media_id_1}]")
    payload = {
        "title": "Phase3 blog test",
        "media_ids": [media_id_1]
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/blog",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code not in [200, 201]:
        print(f"❌ FAILED: POST returned {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    blog_data = resp.json()
    blog_id = blog_data.get("id")
    test_blog_ids.append(blog_id)
    
    # Verify response
    if blog_data.get("media_ids") != [media_id_1]:
        print(f"❌ FAILED: media_ids in response is {blog_data.get('media_ids')}, expected [{media_id_1}]")
        return False
    
    if blog_data.get("status") != "draft":
        print(f"❌ FAILED: status is {blog_data.get('status')}, expected 'draft'")
        return False
    
    print(f"✅ PASSED: POST returned media_ids=[{media_id_1}], status='draft'")
    
    # 1c) GET /api/admin/blog/{id} returns the same media_ids
    print(f"\n1c) GET /api/admin/blog/{blog_id}")
    resp = requests.get(
        f"{BACKEND_URL}/admin/blog/{blog_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    blog_data = resp.json()
    if blog_data.get("media_ids") != [media_id_1]:
        print(f"❌ FAILED: media_ids is {blog_data.get('media_ids')}, expected [{media_id_1}]")
        return False
    
    print(f"✅ PASSED: GET returned media_ids=[{media_id_1}]")
    
    # 1d) PATCH with media_ids=[] then GET returns media_ids=[]
    print(f"\n1d) PATCH /api/admin/blog/{blog_id} with media_ids=[]")
    resp = requests.patch(
        f"{BACKEND_URL}/admin/blog/{blog_id}",
        json={"media_ids": []},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: PATCH returned {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    # Verify with GET
    resp = requests.get(
        f"{BACKEND_URL}/admin/blog/{blog_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: GET after PATCH returned {resp.status_code}")
        return False
    
    blog_data = resp.json()
    if blog_data.get("media_ids") != []:
        print(f"❌ FAILED: media_ids is {blog_data.get('media_ids')}, expected []")
        return False
    
    print(f"✅ PASSED: PATCH with media_ids=[] successful, GET returns []")
    
    # 1e) PATCH with media_ids=[two real ids in order] then GET returns same ordered list
    print(f"\n1e) PATCH /api/admin/blog/{blog_id} with media_ids=[{media_id_2}, {media_id_1}]")
    ordered_ids = [media_id_2, media_id_1]
    resp = requests.patch(
        f"{BACKEND_URL}/admin/blog/{blog_id}",
        json={"media_ids": ordered_ids},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: PATCH returned {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    # Verify with GET
    resp = requests.get(
        f"{BACKEND_URL}/admin/blog/{blog_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: GET after PATCH returned {resp.status_code}")
        return False
    
    blog_data = resp.json()
    if blog_data.get("media_ids") != ordered_ids:
        print(f"❌ FAILED: media_ids is {blog_data.get('media_ids')}, expected {ordered_ids}")
        return False
    
    print(f"✅ PASSED: PATCH with ordered media_ids successful, GET returns same order")
    
    # 1f) DELETE /api/admin/blog/{id} returns ok, GET returns 404
    print(f"\n1f) DELETE /api/admin/blog/{blog_id}")
    resp = requests.delete(
        f"{BACKEND_URL}/admin/blog/{blog_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: DELETE returned {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    # Verify with GET - should return 404
    resp = requests.get(
        f"{BACKEND_URL}/admin/blog/{blog_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 404:
        print(f"❌ FAILED: GET after DELETE returned {resp.status_code}, expected 404")
        return False
    
    print(f"✅ PASSED: DELETE successful, GET returns 404")
    test_blog_ids.remove(blog_id)
    
    return True


def test_home_sections_media_ids_roundtrip(token: str):
    """Test 2) HOME SECTIONS: media_ids round-trip"""
    print("\n" + "=" * 70)
    print("TEST 2: HOME SECTIONS media_ids ROUND-TRIP")
    print("=" * 70)
    
    # Get a real media.id
    print("\n2a) Getting real media ID from GET /api/media")
    resp = requests.get(f"{BACKEND_URL}/media", timeout=10)
    if resp.status_code != 200:
        print(f"❌ FAILED: GET /api/media returned {resp.status_code}")
        return False
    
    media_list = resp.json()
    if not media_list or len(media_list) == 0:
        print(f"❌ FAILED: No media found")
        return False
    
    media_id = media_list[0]["id"]
    print(f"✅ Got media ID: {media_id}")
    
    # Get existing home_section id
    print("\n2b) GET /api/admin/home-sections to find existing section")
    resp = requests.get(
        f"{BACKEND_URL}/admin/home-sections",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    sections = resp.json()
    if not sections or len(sections) == 0:
        print(f"❌ FAILED: No home sections found")
        return False
    
    section_id = sections[0]["id"]
    print(f"✅ Found {len(sections)} home sections, using ID: {section_id}")
    
    # PATCH with media_ids=[media_id]
    print(f"\n2c) PATCH /api/admin/home-sections/{section_id} with media_ids=[{media_id}]")
    resp = requests.patch(
        f"{BACKEND_URL}/admin/home-sections/{section_id}",
        json={"media_ids": [media_id]},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: PATCH returned {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    print(f"✅ PASSED: PATCH returned 200")
    
    # Verify with public GET /api/home-sections
    print(f"\n2d) GET /api/home-sections (public) to verify media_ids")
    resp = requests.get(f"{BACKEND_URL}/home-sections", timeout=10)
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    sections = resp.json()
    section = next((s for s in sections if s["id"] == section_id), None)
    if not section:
        print(f"❌ FAILED: Section {section_id} not found in public list")
        return False
    
    if section.get("media_ids") != [media_id]:
        print(f"❌ FAILED: media_ids is {section.get('media_ids')}, expected [{media_id}]")
        return False
    
    print(f"✅ PASSED: Public GET returns media_ids=[{media_id}]")
    
    # PATCH with media_ids=[] to revert
    print(f"\n2e) PATCH /api/admin/home-sections/{section_id} with media_ids=[] to revert")
    resp = requests.patch(
        f"{BACKEND_URL}/admin/home-sections/{section_id}",
        json={"media_ids": []},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: PATCH returned {resp.status_code}")
        return False
    
    # Verify
    resp = requests.get(f"{BACKEND_URL}/home-sections", timeout=10)
    sections = resp.json()
    section = next((s for s in sections if s["id"] == section_id), None)
    if section.get("media_ids") != []:
        print(f"❌ FAILED: media_ids is {section.get('media_ids')}, expected []")
        return False
    
    print(f"✅ PASSED: PATCH with media_ids=[] successful")
    
    # POST new home section with media_ids
    print(f"\n2f) POST /api/admin/home-sections with media_ids=[{media_id}]")
    payload = {
        "heading": "Phase3 section test",
        "body": "<p>x</p>",
        "media_ids": [media_id]
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/home-sections",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: POST returned {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    new_section = resp.json()
    new_section_id = new_section.get("id")
    test_home_section_ids.append(new_section_id)
    
    if new_section.get("media_ids") != [media_id]:
        print(f"❌ FAILED: media_ids is {new_section.get('media_ids')}, expected [{media_id}]")
        return False
    
    print(f"✅ PASSED: POST returned section with media_ids=[{media_id}]")
    
    # Delete the test section
    print(f"\n   Cleaning up test section {new_section_id}")
    resp = requests.delete(
        f"{BACKEND_URL}/admin/home-sections/{new_section_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code == 200:
        print(f"   ✅ Test section deleted")
        test_home_section_ids.remove(new_section_id)
    else:
        print(f"   ⚠️  Could not delete test section: {resp.status_code}")
    
    return True


def test_migration_coverage(token: str):
    """Test 3) MIGRATION COVERAGE: all rows have media_ids field"""
    print("\n" + "=" * 70)
    print("TEST 3: MIGRATION COVERAGE")
    print("=" * 70)
    
    # Check blog_posts
    print("\n3a) GET /api/admin/blog - verify all rows have media_ids")
    resp = requests.get(
        f"{BACKEND_URL}/admin/blog",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    blog_posts = resp.json()
    print(f"   Found {len(blog_posts)} blog posts")
    
    for post in blog_posts:
        if "media_ids" not in post:
            print(f"❌ FAILED: Blog post '{post.get('title')}' (id={post.get('id')}) missing media_ids field")
            return False
        if not isinstance(post.get("media_ids"), list):
            print(f"❌ FAILED: Blog post '{post.get('title')}' media_ids is not a list: {type(post.get('media_ids'))}")
            return False
    
    print(f"✅ PASSED: All {len(blog_posts)} blog posts have media_ids field (list)")
    
    # Check home_sections
    print("\n3b) GET /api/admin/home-sections - verify all rows have media_ids")
    resp = requests.get(
        f"{BACKEND_URL}/admin/home-sections",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    sections = resp.json()
    print(f"   Found {len(sections)} home sections")
    
    for section in sections:
        if "media_ids" not in section:
            print(f"❌ FAILED: Home section '{section.get('heading')}' (id={section.get('id')}) missing media_ids field")
            return False
        if not isinstance(section.get("media_ids"), list):
            print(f"❌ FAILED: Home section '{section.get('heading')}' media_ids is not a list: {type(section.get('media_ids'))}")
            return False
    
    print(f"✅ PASSED: All {len(sections)} home sections have media_ids field (list)")
    
    return True


def test_phase1_phase2_regression(token: str):
    """Test 4) REGRESSION: Phase 1 + Phase 2 features still work"""
    print("\n" + "=" * 70)
    print("TEST 4: PHASE 1 + PHASE 2 REGRESSION")
    print("=" * 70)
    
    # Test journeys with excludes and more_details_html
    print("\n4a) GET /api/journeys - verify 4 rows with excludes and more_details_html")
    resp = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    journeys = resp.json()
    if len(journeys) != 4:
        print(f"❌ FAILED: Expected 4 journeys, got {len(journeys)}")
        return False
    
    for j in journeys:
        if "excludes" not in j or not isinstance(j["excludes"], list):
            print(f"❌ FAILED: Journey '{j.get('name')}' missing or invalid excludes field")
            return False
        if "more_details_html" not in j or not isinstance(j["more_details_html"], str):
            print(f"❌ FAILED: Journey '{j.get('name')}' missing or invalid more_details_html field")
            return False
    
    print(f"✅ PASSED: All 4 journeys have excludes (list) and more_details_html (string)")
    
    # Test GET /api/tours/maleny-creative-immersion
    print("\n4b) GET /api/tours/maleny-creative-immersion")
    resp = requests.get(f"{BACKEND_URL}/tours/maleny-creative-immersion", timeout=10)
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    tour = resp.json()
    if tour.get("type") != "tour":
        print(f"❌ FAILED: type is '{tour.get('type')}', expected 'tour'")
        return False
    
    print(f"✅ PASSED: GET /api/tours/maleny-creative-immersion returns 200 with type=tour")
    
    # Test GET /api/media count
    print("\n4c) GET /api/media - verify >= 237 rows")
    resp = requests.get(f"{BACKEND_URL}/media", timeout=10)
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    media = resp.json()
    if len(media) < 237:
        print(f"❌ FAILED: Expected >= 237 media rows, got {len(media)}")
        return False
    
    print(f"✅ PASSED: GET /api/media returns {len(media)} rows (>= 237)")
    
    # Test POST embed media with YouTube URL
    print("\n4d) POST /api/admin/media with YouTube embed")
    payload = {
        "section": "test-phase3",
        "file_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "file_type": "embed",
        "alt_text": "Test YouTube",
        "sort_order": 0
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/media",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: POST returned {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    embed_data = resp.json()
    embed_id = embed_data.get("id")
    
    if embed_data.get("embed_provider") != "youtube":
        print(f"❌ FAILED: embed_provider is '{embed_data.get('embed_provider')}', expected 'youtube'")
        return False
    
    if embed_data.get("embed_id") != "dQw4w9WgXcQ":
        print(f"❌ FAILED: embed_id is '{embed_data.get('embed_id')}', expected 'dQw4w9WgXcQ'")
        return False
    
    print(f"✅ PASSED: POST embed media with YouTube URL successful")
    
    # Delete the test embed
    print(f"   Cleaning up test embed {embed_id}")
    resp = requests.delete(
        f"{BACKEND_URL}/admin/media/{embed_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code == 200:
        print(f"   ✅ Test embed deleted")
    else:
        print(f"   ⚠️  Could not delete test embed: {resp.status_code}")
    
    # Test POST embed with invalid URL (dailymotion)
    print("\n4e) POST /api/admin/media with invalid embed URL (dailymotion) - expect 400")
    payload = {
        "section": "test-phase3",
        "file_url": "https://www.dailymotion.com/video/xxx",
        "file_type": "embed",
        "alt_text": "Test",
        "sort_order": 0
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/media",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 400:
        print(f"❌ FAILED: Expected 400, got {resp.status_code}")
        return False
    
    print(f"✅ PASSED: POST with invalid embed URL returns 400")
    
    # Test GET /api/content
    print("\n4f) GET /api/content - verify >= 176 entries and home.hero.tagline exists")
    resp = requests.get(f"{BACKEND_URL}/content", timeout=10)
    if resp.status_code != 200:
        print(f"❌ FAILED: GET returned {resp.status_code}")
        return False
    
    content = resp.json()
    if len(content) < 176:
        print(f"❌ FAILED: Expected >= 176 content entries, got {len(content)}")
        return False
    
    if "home.hero.tagline" not in content:
        print(f"❌ FAILED: home.hero.tagline key not found in content")
        return False
    
    # Check no nav.5.* keys (Corporate Retreats removed)
    nav5_keys = [k for k in content.keys() if k.startswith("nav.5.")]
    if nav5_keys:
        print(f"❌ FAILED: Found nav.5.* keys (should be removed): {nav5_keys}")
        return False
    
    print(f"✅ PASSED: GET /api/content returns {len(content)} entries, home.hero.tagline exists, no nav.5.* keys")
    
    return True


def cleanup(token: str):
    """Clean up any remaining test data"""
    print("\n" + "=" * 70)
    print("CLEANUP")
    print("=" * 70)
    
    # Clean up blog posts
    for blog_id in test_blog_ids[:]:
        print(f"   Cleaning up blog post {blog_id}")
        resp = requests.delete(
            f"{BACKEND_URL}/admin/blog/{blog_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code == 200:
            print(f"   ✅ Deleted")
            test_blog_ids.remove(blog_id)
        else:
            print(f"   ⚠️  Could not delete: {resp.status_code}")
    
    # Clean up home sections
    for section_id in test_home_section_ids[:]:
        print(f"   Cleaning up home section {section_id}")
        resp = requests.delete(
            f"{BACKEND_URL}/admin/home-sections/{section_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code == 200:
            print(f"   ✅ Deleted")
            test_home_section_ids.remove(section_id)
        else:
            print(f"   ⚠️  Could not delete: {resp.status_code}")


def main():
    print("=" * 70)
    print("PHASE 3 BACKEND TESTING - media_ids on blog_posts & home_sections")
    print("=" * 70)
    
    try:
        token = login()
        
        results = []
        
        # Phase 3 tests
        results.append(("1) BLOG media_ids round-trip", test_blog_media_ids_roundtrip(token)))
        results.append(("2) HOME SECTIONS media_ids round-trip", test_home_sections_media_ids_roundtrip(token)))
        results.append(("3) MIGRATION COVERAGE", test_migration_coverage(token)))
        results.append(("4) PHASE 1 + PHASE 2 REGRESSION", test_phase1_phase2_regression(token)))
        
        # Cleanup
        cleanup(token)
        
        # Summary
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        print(f"\nTotal: {total} test groups")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {total - passed} ❌")
        
        if total - passed > 0:
            print("\nFailed tests:")
            for name, result in results:
                if not result:
                    print(f"  ❌ {name}")
        
        print("\n" + "=" * 70)
        if passed == total:
            print("🎉 ALL TESTS PASSED!")
        else:
            print("⚠️  SOME TESTS FAILED")
        print("=" * 70)
        
        return 0 if passed == total else 1
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
