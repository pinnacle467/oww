#!/usr/bin/env python3
"""
Phase 1 Backend Testing Script
Tests C4, C5, C7, and Corporate Retreats nav removal
"""
import requests
import json
import sys

# Backend URL - using localhost:8001 as per instructions
BASE_URL = "http://localhost:8001/api"

# Test credentials
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

# Standard excludes for C4
STANDARD_EXCLUDES = [
    "International and domestic airfares",
    "Travel insurance",
    "Visa fees (if applicable)",
    "Personal expenses",
    "Optional activities not listed in the itinerary"
]

def login():
    """Login and return access token"""
    print("\n🔐 Logging in...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        sys.exit(1)
    
    data = response.json()
    token = data.get("access_token")
    if not token:
        print(f"❌ No access token in response: {data}")
        sys.exit(1)
    
    print(f"✅ Login successful")
    return token

def test_c4_excludes_field(token):
    """Test C4 — Tour excludes field (What is Not Included)"""
    print("\n" + "="*80)
    print("TEST C4 — Tour excludes field (What is Not Included)")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    test_journey_ids = []
    
    try:
        # 1. Verify all 4 existing journeys have excludes field with 5 standard items
        print("\n📋 Step 1: Verify all 4 existing journeys have excludes field...")
        response = requests.get(f"{BASE_URL}/journeys")
        if response.status_code != 200:
            print(f"❌ GET /api/journeys failed: {response.status_code}")
            return False
        
        journeys = response.json()
        if len(journeys) != 4:
            print(f"❌ Expected 4 journeys, got {len(journeys)}")
            return False
        
        print(f"✅ Found 4 journeys")
        
        all_have_excludes = True
        for journey in journeys:
            name = journey.get("name", "Unknown")
            excludes = journey.get("excludes", [])
            
            if not isinstance(excludes, list):
                print(f"❌ Journey '{name}': excludes is not a list: {type(excludes)}")
                all_have_excludes = False
                continue
            
            if excludes != STANDARD_EXCLUDES:
                print(f"❌ Journey '{name}': excludes mismatch")
                print(f"   Expected: {STANDARD_EXCLUDES}")
                print(f"   Got: {excludes}")
                all_have_excludes = False
            else:
                print(f"✅ Journey '{name}': has correct excludes field with 5 standard items")
        
        if not all_have_excludes:
            return False
        
        # 2. POST a new test journey with custom excludes
        print("\n📋 Step 2: POST new journey with custom excludes...")
        custom_excludes = ["Custom item 1", "Custom item 2"]
        new_journey_data = {
            "name": "Test Journey C4 Excludes",
            "region": "Test Region",
            "excludes": custom_excludes,
            "status": "published",
            "type": "tour"
        }
        
        response = requests.post(
            f"{BASE_URL}/admin/journeys",
            headers=headers,
            json=new_journey_data
        )
        
        if response.status_code != 200:
            print(f"❌ POST /api/admin/journeys failed: {response.status_code} - {response.text}")
            return False
        
        created_journey = response.json()
        test_journey_id = created_journey.get("id")
        test_journey_ids.append(test_journey_id)
        
        if created_journey.get("excludes") != custom_excludes:
            print(f"❌ Created journey excludes mismatch")
            print(f"   Expected: {custom_excludes}")
            print(f"   Got: {created_journey.get('excludes')}")
            return False
        
        print(f"✅ Created journey with custom excludes: {custom_excludes}")
        
        # 3. Verify round-trip through GET
        print("\n📋 Step 3: Verify round-trip through GET /api/journeys...")
        response = requests.get(f"{BASE_URL}/journeys")
        if response.status_code != 200:
            print(f"❌ GET /api/journeys failed: {response.status_code}")
            return False
        
        journeys = response.json()
        found = False
        for journey in journeys:
            if journey.get("id") == test_journey_id:
                found = True
                if journey.get("excludes") != custom_excludes:
                    print(f"❌ Round-trip failed: excludes mismatch")
                    print(f"   Expected: {custom_excludes}")
                    print(f"   Got: {journey.get('excludes')}")
                    return False
                print(f"✅ Round-trip successful: excludes persisted correctly")
                break
        
        if not found:
            print(f"❌ Created journey not found in GET /api/journeys")
            return False
        
        # 4. PATCH the journey with different excludes
        print("\n📋 Step 4: PATCH journey with different excludes...")
        updated_excludes = ["Updated item A", "Updated item B", "Updated item C"]
        response = requests.patch(
            f"{BASE_URL}/admin/journeys/{test_journey_id}",
            headers=headers,
            json={"excludes": updated_excludes}
        )
        
        if response.status_code != 200:
            print(f"❌ PATCH /api/admin/journeys/{test_journey_id} failed: {response.status_code} - {response.text}")
            return False
        
        print(f"✅ PATCH successful")
        
        # 5. Verify PATCH persisted
        print("\n📋 Step 5: Verify PATCH persisted...")
        response = requests.get(f"{BASE_URL}/journeys")
        if response.status_code != 200:
            print(f"❌ GET /api/journeys failed: {response.status_code}")
            return False
        
        journeys = response.json()
        found = False
        for journey in journeys:
            if journey.get("id") == test_journey_id:
                found = True
                if journey.get("excludes") != updated_excludes:
                    print(f"❌ PATCH persistence failed: excludes mismatch")
                    print(f"   Expected: {updated_excludes}")
                    print(f"   Got: {journey.get('excludes')}")
                    return False
                print(f"✅ PATCH persisted: excludes updated correctly to {updated_excludes}")
                break
        
        if not found:
            print(f"❌ Journey not found after PATCH")
            return False
        
        # 6. Verify excludes appears on GET /api/tours/{slug}
        print("\n📋 Step 6: Verify excludes appears on GET /api/tours/{slug}...")
        # Get slug from one of the existing published tours
        response = requests.get(f"{BASE_URL}/journeys?type=tour")
        if response.status_code != 200:
            print(f"❌ GET /api/journeys?type=tour failed: {response.status_code}")
            return False
        
        tours = response.json()
        if not tours:
            print(f"❌ No tours found")
            return False
        
        # Use the first tour
        first_tour = tours[0]
        slug = first_tour.get("slug")
        if not slug:
            print(f"❌ First tour has no slug")
            return False
        
        response = requests.get(f"{BASE_URL}/tours/{slug}")
        if response.status_code != 200:
            print(f"❌ GET /api/tours/{slug} failed: {response.status_code}")
            return False
        
        tour_detail = response.json()
        if "excludes" not in tour_detail:
            print(f"❌ excludes field missing from GET /api/tours/{slug}")
            return False
        
        print(f"✅ excludes field present on GET /api/tours/{slug}: {tour_detail.get('excludes')}")
        
        print("\n✅ TEST C4 PASSED: All excludes field tests successful")
        return True
        
    finally:
        # Cleanup: delete test journeys
        print("\n🧹 Cleaning up test journeys...")
        for jid in test_journey_ids:
            try:
                response = requests.delete(
                    f"{BASE_URL}/admin/journeys/{jid}",
                    headers=headers
                )
                if response.status_code == 200:
                    print(f"✅ Deleted test journey {jid}")
                else:
                    print(f"⚠️  Failed to delete test journey {jid}: {response.status_code}")
            except Exception as e:
                print(f"⚠️  Error deleting test journey {jid}: {e}")

def test_c5_more_details_html(token):
    """Test C5 — Tour more_details_html field"""
    print("\n" + "="*80)
    print("TEST C5 — Tour more_details_html field")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    test_journey_ids = []
    
    try:
        # 1. Verify all 4 existing journeys have more_details_html field (default empty)
        print("\n📋 Step 1: Verify all 4 existing journeys have more_details_html field...")
        response = requests.get(f"{BASE_URL}/journeys")
        if response.status_code != 200:
            print(f"❌ GET /api/journeys failed: {response.status_code}")
            return False
        
        journeys = response.json()
        if len(journeys) != 4:
            print(f"❌ Expected 4 journeys, got {len(journeys)}")
            return False
        
        all_have_field = True
        for journey in journeys:
            name = journey.get("name", "Unknown")
            more_details_html = journey.get("more_details_html")
            
            if more_details_html is None:
                print(f"❌ Journey '{name}': more_details_html field missing")
                all_have_field = False
            elif not isinstance(more_details_html, str):
                print(f"❌ Journey '{name}': more_details_html is not a string: {type(more_details_html)}")
                all_have_field = False
            else:
                print(f"✅ Journey '{name}': has more_details_html field (value: '{more_details_html}')")
        
        if not all_have_field:
            return False
        
        # 2. POST a new test journey with more_details_html
        print("\n📋 Step 2: POST new journey with more_details_html...")
        test_html = "<p>Hello <strong>world</strong></p>"
        new_journey_data = {
            "name": "Test Journey C5 More Details",
            "region": "Test Region",
            "more_details_html": test_html,
            "status": "published",
            "type": "tour"
        }
        
        response = requests.post(
            f"{BASE_URL}/admin/journeys",
            headers=headers,
            json=new_journey_data
        )
        
        if response.status_code != 200:
            print(f"❌ POST /api/admin/journeys failed: {response.status_code} - {response.text}")
            return False
        
        created_journey = response.json()
        test_journey_id = created_journey.get("id")
        test_journey_ids.append(test_journey_id)
        
        if created_journey.get("more_details_html") != test_html:
            print(f"❌ Created journey more_details_html mismatch")
            print(f"   Expected: {test_html}")
            print(f"   Got: {created_journey.get('more_details_html')}")
            return False
        
        print(f"✅ Created journey with more_details_html: {test_html}")
        
        # 3. Verify round-trip through GET
        print("\n📋 Step 3: Verify round-trip through GET /api/journeys...")
        response = requests.get(f"{BASE_URL}/journeys")
        if response.status_code != 200:
            print(f"❌ GET /api/journeys failed: {response.status_code}")
            return False
        
        journeys = response.json()
        found = False
        for journey in journeys:
            if journey.get("id") == test_journey_id:
                found = True
                if journey.get("more_details_html") != test_html:
                    print(f"❌ Round-trip failed: more_details_html mismatch")
                    print(f"   Expected: {test_html}")
                    print(f"   Got: {journey.get('more_details_html')}")
                    return False
                print(f"✅ Round-trip successful: more_details_html persisted correctly")
                break
        
        if not found:
            print(f"❌ Created journey not found in GET /api/journeys")
            return False
        
        # 4. PATCH the journey with different more_details_html
        print("\n📋 Step 4: PATCH journey with different more_details_html...")
        updated_html = "<h2>Updated</h2><p>New content with <em>emphasis</em></p>"
        response = requests.patch(
            f"{BASE_URL}/admin/journeys/{test_journey_id}",
            headers=headers,
            json={"more_details_html": updated_html}
        )
        
        if response.status_code != 200:
            print(f"❌ PATCH /api/admin/journeys/{test_journey_id} failed: {response.status_code} - {response.text}")
            return False
        
        print(f"✅ PATCH successful")
        
        # 5. Verify PATCH persisted
        print("\n📋 Step 5: Verify PATCH persisted...")
        response = requests.get(f"{BASE_URL}/journeys")
        if response.status_code != 200:
            print(f"❌ GET /api/journeys failed: {response.status_code}")
            return False
        
        journeys = response.json()
        found = False
        for journey in journeys:
            if journey.get("id") == test_journey_id:
                found = True
                if journey.get("more_details_html") != updated_html:
                    print(f"❌ PATCH persistence failed: more_details_html mismatch")
                    print(f"   Expected: {updated_html}")
                    print(f"   Got: {journey.get('more_details_html')}")
                    return False
                print(f"✅ PATCH persisted: more_details_html updated correctly")
                break
        
        if not found:
            print(f"❌ Journey not found after PATCH")
            return False
        
        print("\n✅ TEST C5 PASSED: All more_details_html field tests successful")
        return True
        
    finally:
        # Cleanup: delete test journeys
        print("\n🧹 Cleaning up test journeys...")
        for jid in test_journey_ids:
            try:
                response = requests.delete(
                    f"{BASE_URL}/admin/journeys/{jid}",
                    headers=headers
                )
                if response.status_code == 200:
                    print(f"✅ Deleted test journey {jid}")
                else:
                    print(f"⚠️  Failed to delete test journey {jid}: {response.status_code}")
            except Exception as e:
                print(f"⚠️  Error deleting test journey {jid}: {e}")

def test_c7_hero_tagline(token):
    """Test C7 — home.hero.tagline content key"""
    print("\n" + "="*80)
    print("TEST C7 — home.hero.tagline content key")
    print("="*80)
    
    print("\n📋 Verify GET /api/content returns home.hero.tagline with value ''...")
    response = requests.get(f"{BASE_URL}/content")
    if response.status_code != 200:
        print(f"❌ GET /api/content failed: {response.status_code}")
        return False
    
    content = response.json()
    
    if "home.hero.tagline" not in content:
        print(f"❌ home.hero.tagline key not found in content")
        print(f"   Available keys: {list(content.keys())}")
        return False
    
    tagline_value = content.get("home.hero.tagline")
    if tagline_value != "":
        print(f"❌ home.hero.tagline value mismatch")
        print(f"   Expected: '' (empty string)")
        print(f"   Got: '{tagline_value}'")
        return False
    
    print(f"✅ home.hero.tagline exists with value '' (empty string)")
    print("\n✅ TEST C7 PASSED: home.hero.tagline content key verified")
    return True

def test_corporate_retreats_nav_removal(token):
    """Test Corporate Retreats nav removal"""
    print("\n" + "="*80)
    print("TEST — Corporate Retreats nav removal")
    print("="*80)
    
    print("\n📋 Verify GET /api/content does NOT return any nav.5.* keys...")
    response = requests.get(f"{BASE_URL}/content")
    if response.status_code != 200:
        print(f"❌ GET /api/content failed: {response.status_code}")
        return False
    
    content = response.json()
    
    # Check for any nav.5.* keys
    nav_5_keys = [key for key in content.keys() if key.startswith("nav.5.")]
    
    if nav_5_keys:
        print(f"❌ Found nav.5.* keys (should not exist): {nav_5_keys}")
        return False
    
    print(f"✅ No nav.5.* keys found (correct)")
    
    # Verify nav.0 through nav.4 exist
    print("\n📋 Verify nav.0.* through nav.4.* keys exist...")
    expected_nav_prefixes = ["nav.0.", "nav.1.", "nav.2.", "nav.3.", "nav.4."]
    found_prefixes = set()
    
    for key in content.keys():
        for prefix in expected_nav_prefixes:
            if key.startswith(prefix):
                found_prefixes.add(prefix)
                break
    
    if len(found_prefixes) != 5:
        print(f"⚠️  Expected 5 nav prefixes (nav.0 through nav.4), found {len(found_prefixes)}: {found_prefixes}")
    else:
        print(f"✅ All expected nav prefixes (nav.0 through nav.4) exist")
    
    # Check for nav.cta
    if "nav.cta" in content:
        print(f"✅ nav.cta exists")
    else:
        print(f"⚠️  nav.cta not found")
    
    print("\n✅ TEST PASSED: Corporate Retreats nav removal verified")
    return True

def test_regression(token):
    """Test regression: verify journey and media counts"""
    print("\n" + "="*80)
    print("REGRESSION TEST — Verify journey and media counts")
    print("="*80)
    
    # Test 1: GET /api/journeys returns exactly 4 rows
    print("\n📋 Step 1: Verify GET /api/journeys returns exactly 4 rows...")
    response = requests.get(f"{BASE_URL}/journeys")
    if response.status_code != 200:
        print(f"❌ GET /api/journeys failed: {response.status_code}")
        return False
    
    journeys = response.json()
    if len(journeys) != 4:
        print(f"❌ Expected 4 journeys, got {len(journeys)}")
        return False
    
    print(f"✅ GET /api/journeys returns exactly 4 rows")
    
    # Test 2: GET /api/media returns exactly 237 rows
    print("\n📋 Step 2: Verify GET /api/media returns exactly 237 rows...")
    response = requests.get(f"{BASE_URL}/media")
    if response.status_code != 200:
        print(f"❌ GET /api/media failed: {response.status_code}")
        return False
    
    media = response.json()
    if len(media) != 237:
        print(f"❌ Expected 237 media items, got {len(media)}")
        return False
    
    print(f"✅ GET /api/media returns exactly 237 rows")
    
    print("\n✅ REGRESSION TEST PASSED: All counts verified")
    return True

def main():
    print("="*80)
    print("PHASE 1 BACKEND TESTING — C4, C5, C7, Corporate Retreats nav removal")
    print("="*80)
    
    # Login
    token = login()
    
    # Run all tests
    results = {
        "C4 — Tour excludes field": test_c4_excludes_field(token),
        "C5 — Tour more_details_html field": test_c5_more_details_html(token),
        "C7 — home.hero.tagline content key": test_c7_hero_tagline(token),
        "Corporate Retreats nav removal": test_corporate_retreats_nav_removal(token),
        "Regression test": test_regression(token)
    }
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = 0
    failed = 0
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed} passed, {failed} failed out of {len(results)} tests")
    print("="*80)
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)

if __name__ == "__main__":
    main()
