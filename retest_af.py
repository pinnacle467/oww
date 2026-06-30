#!/usr/bin/env python3
"""
Re-test failed AF tests
"""

import requests
import json
import time
import re
import subprocess

BASE_URL = "https://admin-content-sync-5.preview.emergentagent.com/api"
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

def get_admin_token():
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    return response.json()["access_token"]

def get_backend_logs(lines=200):
    try:
        result = subprocess.run(
            ["tail", "-n", str(lines), "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout
    except Exception as e:
        return f"Error: {e}"

def extract_reset_token(email, logs):
    pattern = rf"Reset link for {re.escape(email)} would be:.*?token=([a-f0-9]{{64}})"
    matches = re.findall(pattern, logs, re.IGNORECASE)
    return matches[-1] if matches else None

def clear_logs():
    try:
        subprocess.run(["sudo", "truncate", "-s", "0", "/var/log/supervisor/backend.err.log"], timeout=5)
    except:
        pass

print("="*80)
print("RE-TEST GROUP A: Password reset flow")
print("="*80)

# Clear logs and generate a fresh token
clear_logs()
time.sleep(1)

print("\n1. Request forgot-password...")
response = requests.post(
    f"{BASE_URL}/auth/forgot-password",
    json={"email": ADMIN_EMAIL, "origin": "https://oww.example/"}
)
print(f"   Status: {response.status_code}")

time.sleep(3)

logs = get_backend_logs(100)
token = extract_reset_token(ADMIN_EMAIL, logs)

if token:
    print(f"   ✅ Token extracted: {token[:16]}...")
else:
    print(f"   ❌ No token found in logs")
    print(f"   Recent logs:\n{logs[-1000:]}")
    exit(1)

print("\n2. Test reset with valid token and strong password...")
response = requests.post(
    f"{BASE_URL}/auth/reset-password",
    json={"token": token, "new_password": "TempA12345!"}
)
print(f"   Status: {response.status_code}")
print(f"   Body: {response.json()}")

if response.status_code == 200:
    print("   ✅ PASS: Password reset successful")
else:
    print(f"   ❌ FAIL: Expected 200, got {response.status_code}")

print("\n3. Test token re-use (should fail)...")
response = requests.post(
    f"{BASE_URL}/auth/reset-password",
    json={"token": token, "new_password": "TempA12345!"}
)
print(f"   Status: {response.status_code}")
print(f"   Body: {response.json()}")

if response.status_code in [400, 422]:
    print("   ✅ PASS: Token re-use rejected")
else:
    print(f"   ❌ FAIL: Expected 400/422, got {response.status_code}")

print("\n4. Login with new password...")
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": ADMIN_EMAIL, "password": "TempA12345!"}
)
print(f"   Status: {response.status_code}")

if response.status_code == 200:
    new_token = response.json()["access_token"]
    print(f"   ✅ PASS: Login successful")
else:
    print(f"   ❌ FAIL: Login failed - {response.json()}")
    exit(1)

print("\n5. Change password back to original...")
response = requests.post(
    f"{BASE_URL}/auth/change-password",
    json={"current_password": "TempA12345!", "new_password": ADMIN_PASSWORD},
    headers={"Authorization": f"Bearer {new_token}"}
)
print(f"   Status: {response.status_code}")

if response.status_code == 200:
    print("   ✅ PASS: Password restored")
else:
    print(f"   ❌ FAIL: Restore failed - {response.json()}")

print("\n6. Verify original password works...")
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)
print(f"   Status: {response.status_code}")

if response.status_code == 200:
    print("   ✅ PASS: Original password verified")
else:
    print(f"   ❌ FAIL: Original password doesn't work!")

print("\n" + "="*80)
print("RE-TEST GROUP B: Content update round-trip")
print("="*80)

token = get_admin_token()
headers = {"Authorization": f"Bearer {token}"}

print("\n1. Get baseline values...")
response = requests.get(f"{BASE_URL}/content")
baseline = response.json()
original_read_cta = baseline.get("about.stories.read_cta", "")
original_kind_tour = baseline.get("tour_detail.kind.tour", "")
print(f"   about.stories.read_cta: '{original_read_cta}'")
print(f"   tour_detail.kind.tour: '{original_kind_tour}'")

print("\n2. Update values...")
update_payload = {
    "items": [
        {"key": "about.stories.read_cta", "value": "Open story"},
        {"key": "tour_detail.kind.tour", "value": "Group Journey"}
    ]
}
response = requests.put(f"{BASE_URL}/admin/content", json=update_payload, headers=headers)
print(f"   Status: {response.status_code}")
print(f"   Body: {response.json()}")

if response.status_code == 200:
    print("   ✅ PASS: Update successful")
else:
    print(f"   ❌ FAIL: Update failed")

print("\n3. Verify new values...")
response = requests.get(f"{BASE_URL}/content")
updated = response.json()
print(f"   about.stories.read_cta: '{updated.get('about.stories.read_cta')}'")
print(f"   tour_detail.kind.tour: '{updated.get('tour_detail.kind.tour')}'")

if updated.get("about.stories.read_cta") == "Open story":
    print("   ✅ PASS: about.stories.read_cta updated correctly")
else:
    print(f"   ❌ FAIL: Expected 'Open story', got '{updated.get('about.stories.read_cta')}'")

if updated.get("tour_detail.kind.tour") == "Group Journey":
    print("   ✅ PASS: tour_detail.kind.tour updated correctly")
else:
    print(f"   ❌ FAIL: Expected 'Group Journey', got '{updated.get('tour_detail.kind.tour')}'")

print("\n4. Restore original values...")
restore_payload = {
    "items": [
        {"key": "about.stories.read_cta", "value": original_read_cta or "Read story"},
        {"key": "tour_detail.kind.tour", "value": original_kind_tour or "Small Group Tour"}
    ]
}
response = requests.put(f"{BASE_URL}/admin/content", json=restore_payload, headers=headers)
print(f"   Status: {response.status_code}")

if response.status_code == 200:
    print("   ✅ PASS: Restore successful")
else:
    print(f"   ❌ FAIL: Restore failed")

print("\n5. Verify restoration...")
response = requests.get(f"{BASE_URL}/content")
restored = response.json()
print(f"   about.stories.read_cta: '{restored.get('about.stories.read_cta')}'")
print(f"   tour_detail.kind.tour: '{restored.get('tour_detail.kind.tour')}'")

if restored.get("about.stories.read_cta") == (original_read_cta or "Read story"):
    print("   ✅ PASS: about.stories.read_cta restored")
else:
    print(f"   ❌ FAIL: Restoration mismatch")

print("\n" + "="*80)
print("ALL RE-TESTS COMPLETE")
print("="*80)
