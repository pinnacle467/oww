#!/usr/bin/env python3
"""
Backend test for Once Were Wild Travel - Media ADD and REPLACE flow
Tests the admin media upload and replace endpoints with real image/video data.
"""
import requests
import base64
import io
import json
from PIL import Image

# Base URL from frontend/.env
BASE_URL = "https://oww-stage.preview.emergentagent.com/api"

# Admin credentials from test_credentials.md
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "WildAtHeart2026"

# Test section to use
TEST_SECTION = "immersive"

def create_test_image_png(width=100, height=100, color=(255, 0, 0)):
    """Create a small test PNG image and return as bytes"""
    img = Image.new('RGB', (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def create_test_image_data_url(width=100, height=100, color=(0, 255, 0)):
    """Create a different test image as data URL"""
    img_bytes = create_test_image_png(width, height, color)
    b64 = base64.b64encode(img_bytes).decode('ascii')
    return f"data:image/png;base64,{b64}"

def create_test_video_data_url():
    """Create a minimal valid MP4 video as data URL.
    This is a tiny valid MP4 file (ftyp + mdat boxes)"""
    # Minimal MP4: ftyp box + mdat box with minimal data
    ftyp = bytes.fromhex('0000001c667479706d703432000000006d7034326d703431')
    mdat = bytes.fromhex('0000001c6d646174') + b'\x00' * 12
    mp4_bytes = ftyp + mdat
    b64 = base64.b64encode(mp4_bytes).decode('ascii')
    return f"data:video/mp4;base64,{b64}"

def login_admin():
    """Login as admin and return access token"""
    print("\n1. Logging in as admin...")
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"   ERROR: {resp.text}")
        return None
    
    data = resp.json()
    if data.get("status") == "success":
        token = data.get("access_token")
        print(f"   ✓ Login successful, got access token")
        return token
    else:
        print(f"   ERROR: Unexpected response: {data}")
        return None

def test_add_media(token):
    """Test 1: ADD media via multipart upload"""
    print("\n2. TEST 1: ADD media via POST /api/admin/media/upload")
    
    # Create a small test image
    img_bytes = create_test_image_png(200, 200, (255, 100, 50))
    
    files = {
        'file': ('test_image.png', img_bytes, 'image/png')
    }
    data = {
        'section': TEST_SECTION,
        'category': '',
        'alt_text': 'Test image for media flow',
        'sort_order': '99'
    }
    headers = {'Authorization': f'Bearer {token}'}
    
    resp = requests.post(
        f"{BASE_URL}/admin/media/upload",
        files=files,
        data=data,
        headers=headers,
        timeout=30
    )
    
    print(f"   Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"   ✗ FAILED: {resp.text}")
        return None
    
    media = resp.json()
    media_id = media.get('id')
    file_url = media.get('file_url')
    srcset = media.get('srcset', {})
    
    print(f"   Created media ID: {media_id}")
    print(f"   file_url: {file_url}")
    print(f"   srcset: {srcset}")
    
    # Verify file_url starts with correct prefix
    if not file_url.startswith(f"/api/uploads/{TEST_SECTION}/"):
        print(f"   ✗ FAILED: file_url does not start with /api/uploads/{TEST_SECTION}/")
        return None
    
    # Verify srcset is not empty
    if not srcset or not isinstance(srcset, dict):
        print(f"   ✗ FAILED: srcset is empty or not a dict")
        return None
    
    # Verify srcset has expected keys
    expected_keys = ['1600w', '1200w', '800w']
    for key in expected_keys:
        if key not in srcset:
            print(f"   ✗ FAILED: srcset missing key {key}")
            return None
    
    print(f"   ✓ PASSED: Media added correctly with file_url and srcset")
    
    # Verify it appears in GET /api/media?section=immersive
    print(f"\n   Verifying media appears in GET /api/media?section={TEST_SECTION}")
    resp = requests.get(f"{BASE_URL}/media?section={TEST_SECTION}", timeout=30)
    if resp.status_code != 200:
        print(f"   ✗ FAILED: GET /api/media returned {resp.status_code}")
        return None
    
    media_list = resp.json()
    found = False
    for item in media_list:
        if item.get('id') == media_id:
            found = True
            print(f"   ✓ Media found in public GET /api/media")
            break
    
    if not found:
        print(f"   ✗ FAILED: Media not found in public GET /api/media")
        return None
    
    return media_id, file_url, srcset

def test_replace_image(token, media_id, old_file_url, old_srcset):
    """Test 2: REPLACE IMAGE via PATCH with data URL"""
    print("\n3. TEST 2: REPLACE IMAGE via PATCH /api/admin/media/{id}")
    
    # Create a DIFFERENT image (green instead of red/orange)
    new_image_data_url = create_test_image_data_url(200, 200, (0, 255, 100))
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    payload = {
        'file_url': new_image_data_url,
        'file_type': 'image'
    }
    
    resp = requests.patch(
        f"{BASE_URL}/admin/media/{media_id}",
        json=payload,
        headers=headers,
        timeout=30
    )
    
    print(f"   Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"   ✗ FAILED: {resp.text}")
        return False
    
    print(f"   ✓ PATCH successful")
    
    # GET the media item again to verify changes
    print(f"\n   Verifying changes via GET /api/media?section={TEST_SECTION}")
    resp = requests.get(f"{BASE_URL}/media?section={TEST_SECTION}", timeout=30)
    if resp.status_code != 200:
        print(f"   ✗ FAILED: GET returned {resp.status_code}")
        return False
    
    media_list = resp.json()
    updated_media = None
    for item in media_list:
        if item.get('id') == media_id:
            updated_media = item
            break
    
    if not updated_media:
        print(f"   ✗ FAILED: Media not found after update")
        return False
    
    new_file_url = updated_media.get('file_url')
    new_srcset = updated_media.get('srcset', {})
    
    print(f"   Old file_url: {old_file_url}")
    print(f"   New file_url: {new_file_url}")
    print(f"   New srcset: {new_srcset}")
    
    # CRITICAL ASSERTIONS:
    # 1. file_url CHANGED to a new path
    if new_file_url == old_file_url:
        print(f"   ✗ FAILED: file_url did NOT change (still {old_file_url})")
        return False
    print(f"   ✓ file_url changed from old to new")
    
    # 2. file_url is NOT a data: URL
    if new_file_url.startswith('data:'):
        print(f"   ✗ FAILED: file_url is still a data: URL")
        return False
    print(f"   ✓ file_url is NOT a data: URL")
    
    # 3. file_url starts with correct prefix
    if not new_file_url.startswith(f"/api/uploads/{TEST_SECTION}/"):
        print(f"   ✗ FAILED: file_url does not start with /api/uploads/{TEST_SECTION}/")
        return False
    print(f"   ✓ file_url starts with /api/uploads/{TEST_SECTION}/")
    
    # 4. srcset values point to NEW file (not old one)
    # Extract basename from old and new file_url
    old_basename = old_file_url.split('/')[-1].split('.')[0]  # UUID part
    new_basename = new_file_url.split('/')[-1].split('.')[0]  # UUID part
    
    if old_basename == new_basename:
        print(f"   ✗ FAILED: srcset still uses old basename {old_basename}")
        return False
    
    # Check that all srcset values use the new basename
    for width, url in new_srcset.items():
        if old_basename in url:
            print(f"   ✗ FAILED: srcset[{width}] still contains old basename: {url}")
            return False
        if new_basename not in url:
            print(f"   ✗ FAILED: srcset[{width}] does not contain new basename: {url}")
            return False
    
    print(f"   ✓ srcset values point to NEW file (basename: {new_basename})")
    
    # 5. lqip is present
    lqip = updated_media.get('lqip', '')
    if not lqip:
        print(f"   ✗ FAILED: lqip is empty")
        return False
    print(f"   ✓ lqip is present")
    
    print(f"\n   ✓ PASSED: Image replacement works correctly")
    return True

def test_replace_video(token, media_id):
    """Test 3: REPLACE VIDEO via PATCH with data URL"""
    print("\n4. TEST 3: REPLACE VIDEO via PATCH /api/admin/media/{id}")
    
    # Create a tiny valid MP4 video
    video_data_url = create_test_video_data_url()
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    payload = {
        'file_url': video_data_url,
        'file_type': 'video'
    }
    
    resp = requests.patch(
        f"{BASE_URL}/admin/media/{media_id}",
        json=payload,
        headers=headers,
        timeout=30
    )
    
    print(f"   Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"   ✗ FAILED: {resp.text}")
        return False
    
    print(f"   ✓ PATCH successful")
    
    # GET the media item again to verify changes
    print(f"\n   Verifying changes via GET /api/media?section={TEST_SECTION}")
    resp = requests.get(f"{BASE_URL}/media?section={TEST_SECTION}", timeout=30)
    if resp.status_code != 200:
        print(f"   ✗ FAILED: GET returned {resp.status_code}")
        return False
    
    media_list = resp.json()
    updated_media = None
    for item in media_list:
        if item.get('id') == media_id:
            updated_media = item
            break
    
    if not updated_media:
        print(f"   ✗ FAILED: Media not found after update")
        return False
    
    file_url = updated_media.get('file_url')
    file_type = updated_media.get('file_type')
    thumb_url = updated_media.get('thumb_url', '')
    
    print(f"   file_url: {file_url}")
    print(f"   file_type: {file_type}")
    print(f"   thumb_url: {thumb_url}")
    
    # CRITICAL ASSERTIONS:
    # 1. file_url is a real path (NOT a data: URL)
    if file_url.startswith('data:'):
        print(f"   ✗ FAILED: file_url is still a data: URL (NOT written to disk)")
        return False
    print(f"   ✓ file_url is NOT a data: URL")
    
    # 2. file_url is a real /api/uploads path ending in .mp4 (or similar)
    if not file_url.startswith(f"/api/uploads/{TEST_SECTION}/"):
        print(f"   ✗ FAILED: file_url does not start with /api/uploads/{TEST_SECTION}/")
        return False
    
    if not (file_url.endswith('.mp4') or file_url.endswith('.webm') or 
            file_url.endswith('.mov') or file_url.endswith('.m4v')):
        print(f"   ✗ FAILED: file_url does not end with video extension")
        return False
    
    print(f"   ✓ file_url is a real disk path: {file_url}")
    
    # 3. file_type is "video"
    if file_type != 'video':
        print(f"   ✗ FAILED: file_type is '{file_type}', expected 'video'")
        return False
    print(f"   ✓ file_type is 'video'")
    
    # 4. thumb_url MAY be empty if ffmpeg can't extract from tiny clip - that's acceptable
    if thumb_url:
        print(f"   ✓ thumb_url generated: {thumb_url}")
    else:
        print(f"   ⚠ thumb_url is empty (acceptable for tiny test video)")
    
    print(f"\n   ✓ PASSED: Video replacement works correctly (writes to disk, NOT data URL)")
    return True

def test_immediate_reflection(token, media_id):
    """Test 4: Verify immediate reflection and no caching"""
    print("\n5. TEST 4: IMMEDIATE REFLECTION / no caching")
    
    # Make a public GET request (no auth)
    resp = requests.get(f"{BASE_URL}/media?section={TEST_SECTION}", timeout=30)
    
    print(f"   Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"   ✗ FAILED: GET returned {resp.status_code}")
        return False
    
    # Check Cache-Control header
    cache_control = resp.headers.get('Cache-Control', '')
    print(f"   Cache-Control: {cache_control}")
    
    # Should be no-store or no-cache
    if 'no-store' not in cache_control.lower() and 'no-cache' not in cache_control.lower():
        print(f"   ✗ FAILED: Cache-Control does not contain no-store or no-cache")
        return False
    
    print(f"   ✓ Cache-Control contains no-store/no-cache")
    
    # Verify the media item is present
    media_list = resp.json()
    found = False
    for item in media_list:
        if item.get('id') == media_id:
            found = True
            print(f"   ✓ Media found in public GET (immediate reflection)")
            break
    
    if not found:
        print(f"   ✗ FAILED: Media not found in public GET")
        return False
    
    print(f"\n   ✓ PASSED: Changes reflect immediately, no caching")
    return True

def cleanup_media(token, media_id):
    """Test 5: CLEANUP - delete test media"""
    print("\n6. TEST 5: CLEANUP - DELETE test media")
    
    headers = {'Authorization': f'Bearer {token}'}
    
    resp = requests.delete(
        f"{BASE_URL}/admin/media/{media_id}",
        headers=headers,
        timeout=30
    )
    
    print(f"   Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"   ✗ FAILED: {resp.text}")
        return False
    
    print(f"   ✓ DELETE successful")
    
    # Verify deletion via GET
    print(f"\n   Verifying deletion via GET /api/media?section={TEST_SECTION}")
    resp = requests.get(f"{BASE_URL}/media?section={TEST_SECTION}", timeout=30)
    if resp.status_code != 200:
        print(f"   ✗ FAILED: GET returned {resp.status_code}")
        return False
    
    media_list = resp.json()
    found = False
    for item in media_list:
        if item.get('id') == media_id:
            found = True
            break
    
    if found:
        print(f"   ✗ FAILED: Media still present after deletion")
        return False
    
    print(f"   ✓ Media successfully deleted and not present in GET")
    print(f"\n   ✓ PASSED: Cleanup successful")
    return True

def main():
    print("=" * 70)
    print("Backend Test: Media ADD and REPLACE flow")
    print("Once Were Wild Travel")
    print("=" * 70)
    
    # Login
    token = login_admin()
    if not token:
        print("\n✗ OVERALL RESULT: FAILED (login failed)")
        return
    
    # Test 1: ADD media
    result = test_add_media(token)
    if not result:
        print("\n✗ OVERALL RESULT: FAILED (ADD media failed)")
        return
    
    media_id, old_file_url, old_srcset = result
    
    # Test 2: REPLACE IMAGE
    if not test_replace_image(token, media_id, old_file_url, old_srcset):
        print("\n✗ OVERALL RESULT: FAILED (REPLACE IMAGE failed)")
        # Still try to cleanup
        cleanup_media(token, media_id)
        return
    
    # Test 3: REPLACE VIDEO
    if not test_replace_video(token, media_id):
        print("\n✗ OVERALL RESULT: FAILED (REPLACE VIDEO failed)")
        # Still try to cleanup
        cleanup_media(token, media_id)
        return
    
    # Test 4: IMMEDIATE REFLECTION
    if not test_immediate_reflection(token, media_id):
        print("\n✗ OVERALL RESULT: FAILED (IMMEDIATE REFLECTION failed)")
        # Still try to cleanup
        cleanup_media(token, media_id)
        return
    
    # Test 5: CLEANUP
    if not cleanup_media(token, media_id):
        print("\n✗ OVERALL RESULT: FAILED (CLEANUP failed)")
        return
    
    print("\n" + "=" * 70)
    print("✓ ALL TESTS PASSED")
    print("=" * 70)

if __name__ == "__main__":
    main()
