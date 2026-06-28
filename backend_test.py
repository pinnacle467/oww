#!/usr/bin/env python3
"""
Phase 2 Backend Testing - Embed Media Support + Regressions
Tests the new embed media POST endpoint with YouTube/Vimeo URLs
and verifies Phase 1 features still work.
"""

import requests
import base64
import json
from typing import Optional

# Backend URL - using internal port since we're running inside the container
BACKEND_URL = "http://localhost:8001/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

# Track test media IDs for cleanup
test_media_ids = []


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


def test_embed_youtube_watch(token: str):
    """Test a) POST with YouTube watch?v= URL"""
    print("\n📹 TEST a) YouTube watch?v= URL")
    payload = {
        "section": "about-travel",
        "file_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "file_type": "embed",
        "alt_text": "Test YouTube watch",
        "caption": "Test caption",
        "sort_order": 0
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/media",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    data = resp.json()
    test_media_ids.append(data.get("id"))
    
    # Verify response
    if data.get("embed_provider") != "youtube":
        print(f"❌ FAILED: embed_provider is '{data.get('embed_provider')}', expected 'youtube'")
        return False
    if data.get("embed_id") != "dQw4w9WgXcQ":
        print(f"❌ FAILED: embed_id is '{data.get('embed_id')}', expected 'dQw4w9WgXcQ'")
        return False
    if data.get("file_url") != payload["file_url"]:
        print(f"❌ FAILED: file_url not preserved")
        return False
    
    print(f"✅ PASSED: embed_provider='youtube', embed_id='dQw4w9WgXcQ', file_url preserved")
    return True


def test_embed_youtube_short(token: str):
    """Test b) POST with youtu.be short URL"""
    print("\n📹 TEST b) YouTube youtu.be short URL")
    payload = {
        "section": "about-travel",
        "file_url": "https://youtu.be/abc1234567",
        "file_type": "embed",
        "alt_text": "Test YouTube short",
        "caption": "T",
        "sort_order": 1
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/media",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    data = resp.json()
    test_media_ids.append(data.get("id"))
    
    if data.get("embed_provider") != "youtube":
        print(f"❌ FAILED: embed_provider is '{data.get('embed_provider')}', expected 'youtube'")
        return False
    if data.get("embed_id") != "abc1234567":
        print(f"❌ FAILED: embed_id is '{data.get('embed_id')}', expected 'abc1234567'")
        return False
    
    print(f"✅ PASSED: embed_provider='youtube', embed_id='abc1234567'")
    return True


def test_embed_vimeo_standard(token: str):
    """Test c) POST with vimeo.com/{id} URL"""
    print("\n📹 TEST c) Vimeo vimeo.com/{id} URL")
    payload = {
        "section": "about-travel",
        "file_url": "https://vimeo.com/76979871",
        "file_type": "embed",
        "alt_text": "Test Vimeo",
        "caption": "T",
        "sort_order": 2
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/media",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    data = resp.json()
    test_media_ids.append(data.get("id"))
    
    if data.get("embed_provider") != "vimeo":
        print(f"❌ FAILED: embed_provider is '{data.get('embed_provider')}', expected 'vimeo'")
        return False
    if data.get("embed_id") != "76979871":
        print(f"❌ FAILED: embed_id is '{data.get('embed_id')}', expected '76979871'")
        return False
    
    print(f"✅ PASSED: embed_provider='vimeo', embed_id='76979871'")
    return True


def test_embed_vimeo_player(token: str):
    """Test d) POST with player.vimeo.com/video/{id} URL"""
    print("\n📹 TEST d) Vimeo player.vimeo.com/video/{id} URL")
    payload = {
        "section": "about-travel",
        "file_url": "https://player.vimeo.com/video/76979871",
        "file_type": "embed",
        "alt_text": "Test Vimeo player",
        "caption": "T",
        "sort_order": 3
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/media",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    data = resp.json()
    test_media_ids.append(data.get("id"))
    
    if data.get("embed_provider") != "vimeo":
        print(f"❌ FAILED: embed_provider is '{data.get('embed_provider')}', expected 'vimeo'")
        return False
    if data.get("embed_id") != "76979871":
        print(f"❌ FAILED: embed_id is '{data.get('embed_id')}', expected '76979871'")
        return False
    
    print(f"✅ PASSED: embed_provider='vimeo', embed_id='76979871'")
    return True


def test_embed_unsupported_host(token: str):
    """Test e) POST with unsupported host (dailymotion) - should return 400"""
    print("\n📹 TEST e) Unsupported host (dailymotion) - expect 400")
    payload = {
        "section": "about-travel",
        "file_url": "https://www.dailymotion.com/video/xyz",
        "file_type": "embed",
        "alt_text": "Test",
        "caption": "T",
        "sort_order": 4
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/media",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 400:
        print(f"❌ FAILED: Expected 400, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    data = resp.json()
    detail = data.get("detail", "")
    if "YouTube" not in detail or "Vimeo" not in detail:
        print(f"❌ FAILED: Error message should mention YouTube/Vimeo, got: {detail}")
        return False
    
    print(f"✅ PASSED: Returned 400 with message: {detail}")
    return True


def test_embed_invalid_url(token: str):
    """Test f) POST with invalid URL string - should return 400"""
    print("\n📹 TEST f) Invalid URL string - expect 400")
    payload = {
        "section": "about-travel",
        "file_url": "not-a-url",
        "file_type": "embed",
        "alt_text": "Test",
        "caption": "T",
        "sort_order": 5
    }
    resp = requests.post(
        f"{BACKEND_URL}/admin/media",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 400:
        print(f"❌ FAILED: Expected 400, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    print(f"✅ PASSED: Returned 400 for invalid URL")
    return True


def test_get_media_section(token: str):
    """Test g) GET /api/media?section=about-travel returns embed rows"""
    print("\n📹 TEST g) GET /api/media?section=about-travel")
    resp = requests.get(
        f"{BACKEND_URL}/media",
        params={"section": "about-travel"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    if not isinstance(data, list):
        print(f"❌ FAILED: Expected list, got {type(data)}")
        return False
    
    # Should have 4 embed rows we created (tests a-d)
    if len(data) < 4:
        print(f"❌ FAILED: Expected at least 4 rows, got {len(data)}")
        return False
    
    # Verify embed_provider and embed_id are present
    embed_rows = [r for r in data if r.get("file_type") == "embed"]
    if len(embed_rows) < 4:
        print(f"❌ FAILED: Expected at least 4 embed rows, got {len(embed_rows)}")
        return False
    
    # Check first row has embed fields
    first = embed_rows[0]
    if not first.get("embed_provider") or not first.get("embed_id"):
        print(f"❌ FAILED: embed_provider or embed_id missing in response")
        return False
    
    print(f"✅ PASSED: GET returned {len(data)} rows, {len(embed_rows)} embed rows with provider/id")
    return True


def test_patch_media(token: str):
    """Test h) PATCH /api/admin/media/{mid} with alt_text update"""
    print("\n📹 TEST h) PATCH /api/admin/media/{mid} with alt_text")
    if not test_media_ids:
        print("❌ FAILED: No test media IDs to patch")
        return False
    
    mid = test_media_ids[0]
    payload = {"alt_text": "Updated alt text via PATCH"}
    resp = requests.patch(
        f"{BACKEND_URL}/admin/media/{mid}",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    # Verify by fetching the row again
    resp2 = requests.get(f"{BACKEND_URL}/media", params={"section": "about-travel"}, timeout=10)
    if resp2.status_code != 200:
        print(f"❌ FAILED: Could not verify PATCH")
        return False
    
    rows = resp2.json()
    updated_row = next((r for r in rows if r.get("id") == mid), None)
    if not updated_row:
        print(f"❌ FAILED: Could not find updated row")
        return False
    
    if updated_row.get("alt_text") != "Updated alt text via PATCH":
        print(f"❌ FAILED: alt_text not updated, got: {updated_row.get('alt_text')}")
        return False
    
    print(f"✅ PASSED: alt_text updated and persisted")
    return True


def test_delete_media(token: str):
    """Test i) DELETE each test row and verify empty list"""
    print("\n📹 TEST i) DELETE all test rows")
    if not test_media_ids:
        print("⚠️  No test media IDs to delete")
        return True
    
    for mid in test_media_ids:
        resp = requests.delete(
            f"{BACKEND_URL}/admin/media/{mid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ FAILED: DELETE {mid} returned {resp.status_code}")
            return False
    
    # Verify section is now empty
    resp = requests.get(f"{BACKEND_URL}/media", params={"section": "about-travel"}, timeout=10)
    if resp.status_code != 200:
        print(f"❌ FAILED: Could not verify deletion")
        return False
    
    rows = resp.json()
    if len(rows) != 0:
        print(f"❌ FAILED: Expected 0 rows after deletion, got {len(rows)}")
        return False
    
    print(f"✅ PASSED: All {len(test_media_ids)} test rows deleted, section empty")
    test_media_ids.clear()
    return True


def test_image_upload_regression(token: str):
    """Test 2) Regression - existing image upload pipeline"""
    print("\n🖼️  TEST 2) Image upload regression - POST /api/admin/media/upload")
    
    # Create a tiny 1x1 PNG
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    
    files = {"file": ("test.png", png_bytes, "image/png")}
    data = {
        "section": "gallery",
        "category": "",
        "alt_text": "Test image upload",
        "sort_order": 9999
    }
    
    resp = requests.post(
        f"{BACKEND_URL}/admin/media/upload",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10
    )
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        return False
    
    result = resp.json()
    media_id = result.get("id")
    
    # Verify response
    if result.get("file_type") != "image":
        print(f"❌ FAILED: file_type is '{result.get('file_type')}', expected 'image'")
        return False
    
    srcset = result.get("srcset", {})
    if not srcset or not isinstance(srcset, dict):
        print(f"❌ FAILED: srcset not populated or not a dict: {srcset}")
        return False
    
    # Should have 3 variants: 1600w, 1200w, 800w
    expected_keys = {"1600w", "1200w", "800w"}
    if set(srcset.keys()) != expected_keys:
        print(f"❌ FAILED: srcset keys are {set(srcset.keys())}, expected {expected_keys}")
        return False
    
    print(f"✅ PASSED: Image upload successful, file_type='image', srcset has 3 variants")
    
    # Clean up
    if media_id:
        print(f"   Cleaning up test image {media_id}...")
        resp = requests.delete(
            f"{BACKEND_URL}/admin/media/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code == 200:
            print(f"   ✅ Test image deleted")
        else:
            print(f"   ⚠️  Could not delete test image: {resp.status_code}")
    
    return True


def test_phase1_regression(token: str):
    """Test 3) Phase 1 regression - journeys and content"""
    print("\n🔄 TEST 3) Phase 1 regression checks")
    
    # Test 3a: GET /api/journeys - 4 rows with excludes and more_details_html
    print("   3a) GET /api/journeys - checking excludes and more_details_html")
    resp = requests.get(f"{BACKEND_URL}/journeys", timeout=10)
    if resp.status_code != 200:
        print(f"   ❌ FAILED: GET /api/journeys returned {resp.status_code}")
        return False
    
    journeys = resp.json()
    if len(journeys) != 4:
        print(f"   ❌ FAILED: Expected 4 journeys, got {len(journeys)}")
        return False
    
    for j in journeys:
        excludes = j.get("excludes")
        if not isinstance(excludes, list) or len(excludes) != 5:
            print(f"   ❌ FAILED: Journey '{j.get('name')}' excludes is not a list of 5 items: {excludes}")
            return False
        
        more_details = j.get("more_details_html")
        if not isinstance(more_details, str):
            print(f"   ❌ FAILED: Journey '{j.get('name')}' more_details_html is not a string: {type(more_details)}")
            return False
    
    print(f"   ✅ PASSED: All 4 journeys have excludes (5 items) and more_details_html (string)")
    
    # Test 3b: GET /api/content - home.hero.tagline present, no nav.5.*
    print("   3b) GET /api/content - checking home.hero.tagline and nav.5 removal")
    resp = requests.get(f"{BACKEND_URL}/content", timeout=10)
    if resp.status_code != 200:
        print(f"   ❌ FAILED: GET /api/content returned {resp.status_code}")
        return False
    
    content = resp.json()
    
    # Content is a dict, not a list
    if not isinstance(content, dict):
        print(f"   ❌ FAILED: Expected dict, got {type(content)}")
        return False
    
    # Check home.hero.tagline exists with value ''
    if "home.hero.tagline" not in content:
        print(f"   ❌ FAILED: home.hero.tagline key not found in content")
        return False
    if content["home.hero.tagline"] != "":
        print(f"   ❌ FAILED: home.hero.tagline value is '{content['home.hero.tagline']}', expected ''")
        return False
    
    # Check no nav.5.* keys exist
    nav5_keys = [k for k in content.keys() if k.startswith("nav.5.")]
    if nav5_keys:
        print(f"   ❌ FAILED: Found nav.5.* keys (should be removed): {nav5_keys}")
        return False
    
    print(f"   ✅ PASSED: home.hero.tagline='' present, no nav.5.* keys")
    
    return True


def main():
    print("=" * 70)
    print("PHASE 2 BACKEND TESTING - Embed Media Support + Regressions")
    print("=" * 70)
    
    try:
        token = login()
        
        results = []
        
        # Phase 2 embed tests
        print("\n" + "=" * 70)
        print("PHASE 2 - EMBED MEDIA TESTS")
        print("=" * 70)
        
        results.append(("a) YouTube watch?v=", test_embed_youtube_watch(token)))
        results.append(("b) YouTube youtu.be", test_embed_youtube_short(token)))
        results.append(("c) Vimeo vimeo.com/{id}", test_embed_vimeo_standard(token)))
        results.append(("d) Vimeo player.vimeo.com", test_embed_vimeo_player(token)))
        results.append(("e) Unsupported host (400)", test_embed_unsupported_host(token)))
        results.append(("f) Invalid URL (400)", test_embed_invalid_url(token)))
        results.append(("g) GET /api/media?section", test_get_media_section(token)))
        results.append(("h) PATCH alt_text", test_patch_media(token)))
        results.append(("i) DELETE all test rows", test_delete_media(token)))
        
        # Regression tests
        print("\n" + "=" * 70)
        print("REGRESSION TESTS")
        print("=" * 70)
        
        results.append(("2) Image upload pipeline", test_image_upload_regression(token)))
        results.append(("3) Phase 1 features", test_phase1_regression(token)))
        
        # Summary
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        print(f"\nTotal: {total} tests")
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
