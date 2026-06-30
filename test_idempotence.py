#!/usr/bin/env python3
"""
Quick idempotence check after backend restart
"""

import requests

BASE_URL = "https://170bcf25-942f-44a3-b7ed-d560a9798f92.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

print("="*80)
print("POST-RESTART IDEMPOTENCE CHECK")
print("="*80)

# Check content keys
print("\n--- Checking /api/content for about.sister.* keys ---")
response = requests.get(f"{API_BASE}/content")
print(f"GET /api/content status: {response.status_code}")

if response.status_code == 200:
    content = response.json()
    total_keys = len(content)
    print(f"Total content keys: {total_keys}")
    
    sister_keys = [k for k in content.keys() if k.startswith("about.sister.")]
    print(f"about.sister.* keys found: {len(sister_keys)}")
    
    if len(sister_keys) == 10:
        print("✓ PASS: All 10 about.sister.* keys survived restart")
        for key in sorted(sister_keys):
            print(f"  ✓ {key}: '{content[key][:50]}...' " if len(content[key]) > 50 else f"  ✓ {key}: '{content[key]}'")
    else:
        print(f"✗ FAIL: Expected 10 about.sister.* keys, found {len(sister_keys)}")
else:
    print(f"✗ FAIL: GET /api/content returned {response.status_code}")

# Check settings
print("\n--- Checking /api/settings for phone keys ---")
response = requests.get(f"{API_BASE}/settings")
print(f"GET /api/settings status: {response.status_code}")

if response.status_code == 200:
    settings = response.json()
    
    phone_keys = [k for k in settings.keys() if k.startswith("contact_phone_1_") or k.startswith("contact_phone_2_")]
    print(f"Phone settings keys found: {len(phone_keys)}")
    
    if len(phone_keys) == 4:
        print("✓ PASS: All 4 phone settings keys survived restart")
        for key in sorted(phone_keys):
            print(f"  ✓ {key}: '{settings[key]}'")
    else:
        print(f"✗ FAIL: Expected 4 phone settings keys, found {len(phone_keys)}")
else:
    print(f"✗ FAIL: GET /api/settings returned {response.status_code}")

print("\n" + "="*80)
print("IDEMPOTENCE CHECK COMPLETE")
print("="*80)
