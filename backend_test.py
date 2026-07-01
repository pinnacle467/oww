#!/usr/bin/env python3
"""
AG3 Backend Test: DELETE /api/admin/media/{id} cascade cleanup verification

Test plan:
1. Upload a fresh media doc via POST /api/admin/media/upload
2. Attach it to the Maleny journey's gallery_media_ids via PUT /api/admin/journeys/{jid}
3. DELETE /api/admin/media/{id}
4. Verify the journey's gallery_media_ids no longer contains the deleted id
5. Verify hero_media_id is cleared if it pointed to the deleted media
6. Regression checks on API endpoints
"""

import requests
import io
import sys
from PIL import Image

BASE_URL = "http://localhost:8001"
ADMIN_EMAIL = "adele@oncewerewild.com"
ADMIN_PASSWORD = "OnceWereWild!2026"

def log(msg):
    print(f"[TEST] {msg}")

def login():
    """Login and return Bearer token"""
    log("Step 0: Logging in as admin...")
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        log(f"❌ Login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    data = resp.json()
    token = data.get("access_token")
    if not token:
        log(f"❌ No access_token in response: {data}")
        sys.exit(1)
    log(f"✓ Login successful")
    return token

def create_test_image():
    """Create a small test image in memory"""
    img = Image.new('RGB', (100, 100), color='red')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

def test_ag3_cascade_cleanup():
    """Main test for AG3 cascade cleanup"""
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    
    # STEP 1: Upload a fresh media doc
    log("\nStep 1: Uploading test media to section=tour-gallery...")
    test_image = create_test_image()
    files = {'file': ('test_ag3.png', test_image, 'image/png')}
    data = {
        'section': 'tour-gallery',
        'category': '',
        'alt_text': 'AG3 test image',
        'sort_order': 0
    }
    resp = requests.post(f"{BASE_URL}/api/admin/media/upload", headers=headers, files=files, data=data)
    if resp.status_code != 200:
        log(f"❌ Media upload failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    
    media_doc = resp.json()
    media_id = media_doc.get("id")
    if not media_id:
        log(f"❌ No id in media response: {media_doc}")
        sys.exit(1)
    log(f"✓ Media uploaded successfully: id={media_id}")
    log(f"  file_url: {media_doc.get('file_url')}")
    
    # STEP 2: Find Maleny journey and attach the media id to gallery_media_ids
    log("\nStep 2: Finding Maleny journey and attaching media...")
    resp = requests.get(f"{BASE_URL}/api/journeys")
    if resp.status_code != 200:
        log(f"❌ Failed to fetch journeys: {resp.status_code}")
        sys.exit(1)
    
    journeys = resp.json()
    maleny = None
    for j in journeys:
        if "maleny" in j.get("slug", "").lower():
            maleny = j
            break
    
    if not maleny:
        log(f"❌ Could not find Maleny journey in {len(journeys)} journeys")
        log(f"Available slugs: {[j.get('slug') for j in journeys]}")
        sys.exit(1)
    
    maleny_id = maleny.get("id")
    maleny_slug = maleny.get("slug")
    original_gallery = maleny.get("gallery_media_ids", [])
    original_count = len(original_gallery)
    log(f"✓ Found Maleny journey: id={maleny_id}, slug={maleny_slug}")
    log(f"  Original gallery_media_ids count: {original_count}")
    
    # Attach the new media id to the gallery
    updated_gallery = original_gallery + [media_id]
    log(f"  Updating gallery_media_ids to include new media (count: {len(updated_gallery)})...")
    
    # Use PATCH with only the gallery_media_ids field to preserve other fields
    patch_payload = {"gallery_media_ids": updated_gallery}
    
    resp = requests.patch(f"{BASE_URL}/api/admin/journeys/{maleny_id}", headers=headers, json=patch_payload)
    if resp.status_code != 200:
        log(f"❌ Failed to update journey: {resp.status_code} {resp.text}")
        sys.exit(1)
    log(f"✓ Journey updated successfully")
    
    # Verify the media id is now in the gallery
    resp = requests.get(f"{BASE_URL}/api/journeys")
    if resp.status_code != 200:
        log(f"❌ Failed to re-fetch journeys: {resp.status_code}")
        sys.exit(1)
    
    journeys = resp.json()
    maleny_updated = None
    for j in journeys:
        if j.get("id") == maleny_id:
            maleny_updated = j
            break
    
    if not maleny_updated:
        log(f"❌ Could not find Maleny journey after update")
        sys.exit(1)
    
    updated_gallery_check = maleny_updated.get("gallery_media_ids", [])
    if media_id not in updated_gallery_check:
        log(f"❌ Media id {media_id} not found in gallery after update")
        log(f"  Gallery: {updated_gallery_check}")
        sys.exit(1)
    
    if len(updated_gallery_check) != original_count + 1:
        log(f"❌ Gallery count mismatch: expected {original_count + 1}, got {len(updated_gallery_check)}")
        sys.exit(1)
    
    log(f"✓ Media id {media_id} confirmed in gallery (count: {len(updated_gallery_check)})")
    
    # STEP 3: DELETE the media doc
    log(f"\nStep 3: Deleting media id={media_id}...")
    resp = requests.delete(f"{BASE_URL}/api/admin/media/{media_id}", headers=headers)
    if resp.status_code != 200:
        log(f"❌ Media delete failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    
    delete_response = resp.json()
    if delete_response.get("message") != "Removed":
        log(f"❌ Unexpected delete response: {delete_response}")
        sys.exit(1)
    log(f"✓ Media deleted successfully: {delete_response}")
    
    # STEP 4: Verify cascade cleanup
    log(f"\nStep 4: Verifying cascade cleanup...")
    resp = requests.get(f"{BASE_URL}/api/journeys")
    if resp.status_code != 200:
        log(f"❌ Failed to fetch journeys after delete: {resp.status_code}")
        sys.exit(1)
    
    journeys = resp.json()
    maleny_after_delete = None
    for j in journeys:
        if j.get("id") == maleny_id:
            maleny_after_delete = j
            break
    
    if not maleny_after_delete:
        log(f"❌ Could not find Maleny journey after delete")
        sys.exit(1)
    
    final_gallery = maleny_after_delete.get("gallery_media_ids", [])
    
    # CRITICAL CHECK: The deleted media id should NOT be in the gallery
    if media_id in final_gallery:
        log(f"❌ FAILED: Media id {media_id} still present in gallery after delete!")
        log(f"  Gallery: {final_gallery}")
        sys.exit(1)
    
    # Count should be back to original
    if len(final_gallery) != original_count:
        log(f"❌ Gallery count mismatch: expected {original_count}, got {len(final_gallery)}")
        log(f"  Original: {original_count}, After attach: {len(updated_gallery_check)}, After delete: {len(final_gallery)}")
        sys.exit(1)
    
    log(f"✓ CASCADE CLEANUP VERIFIED: Media id removed from gallery")
    log(f"  Gallery count restored: {len(final_gallery)} (original: {original_count})")
    
    # Verify no other journey was affected
    log(f"  Checking other journeys were not affected...")
    for j in journeys:
        if j.get("id") != maleny_id:
            if media_id in j.get("gallery_media_ids", []):
                log(f"❌ Media id {media_id} found in unexpected journey: {j.get('slug')}")
                sys.exit(1)
            if j.get("hero_media_id") == media_id:
                log(f"❌ Media id {media_id} found as hero in unexpected journey: {j.get('slug')}")
                sys.exit(1)
    log(f"✓ No other journeys affected")
    
    # STEP 5: Regression check - media count
    log(f"\nStep 5: Regression checks...")
    resp = requests.get(f"{BASE_URL}/api/media")
    if resp.status_code != 200:
        log(f"❌ Failed to fetch media: {resp.status_code}")
        sys.exit(1)
    
    media_list = resp.json()
    media_count = len(media_list)
    log(f"✓ GET /api/media returns {media_count} items")
    
    # Verify the deleted media is not in the list
    for m in media_list:
        if m.get("id") == media_id:
            log(f"❌ Deleted media id {media_id} still in /api/media response!")
            sys.exit(1)
    log(f"✓ Deleted media not in /api/media response")
    
    # STEP 6: Regression sanity checks
    log(f"\nStep 6: API regression sanity checks...")
    
    # Journeys
    resp = requests.get(f"{BASE_URL}/api/journeys")
    if resp.status_code != 200:
        log(f"❌ GET /api/journeys failed: {resp.status_code}")
        sys.exit(1)
    journeys_count = len(resp.json())
    if journeys_count < 4:
        log(f"❌ Expected at least 4 journeys, got {journeys_count}")
        sys.exit(1)
    log(f"✓ GET /api/journeys: {journeys_count} items (expected >= 4)")
    
    # Content
    resp = requests.get(f"{BASE_URL}/api/content")
    if resp.status_code != 200:
        log(f"❌ GET /api/content failed: {resp.status_code}")
        sys.exit(1)
    content_keys = len(resp.json())
    if content_keys < 220:
        log(f"❌ Expected at least 220 content keys, got {content_keys}")
        sys.exit(1)
    log(f"✓ GET /api/content: {content_keys} keys (expected >= 220)")
    
    # Settings
    resp = requests.get(f"{BASE_URL}/api/settings")
    if resp.status_code != 200:
        log(f"❌ GET /api/settings failed: {resp.status_code}")
        sys.exit(1)
    settings_keys = len(resp.json())
    if settings_keys < 15:
        log(f"❌ Expected at least 15 settings keys, got {settings_keys}")
        sys.exit(1)
    log(f"✓ GET /api/settings: {settings_keys} keys (expected >= 15)")
    
    log(f"\n{'='*60}")
    log(f"✅ ALL AG3 TESTS PASSED")
    log(f"{'='*60}")
    log(f"Summary:")
    log(f"  - Media upload: ✓")
    log(f"  - Journey gallery attachment: ✓")
    log(f"  - Media deletion: ✓")
    log(f"  - Cascade cleanup (gallery_media_ids): ✓")
    log(f"  - No collateral damage to other journeys: ✓")
    log(f"  - Deleted media removed from /api/media: ✓")
    log(f"  - API regression checks: ✓")
    log(f"\nAG3 cascade cleanup is working correctly!")

if __name__ == "__main__":
    try:
        test_ag3_cascade_cleanup()
    except KeyboardInterrupt:
        log("\n❌ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        log(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
