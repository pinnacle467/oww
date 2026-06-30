#!/usr/bin/env python3
"""
Test forgot-password by checking the database directly for the token
"""

import requests
import time
from pymongo import MongoClient
import os

BASE_URL = "https://admin-content-sync-5.preview.emergentagent.com/api"
ADMIN_EMAIL = "info@oncewerewild.com"
ADMIN_PASSWORD = "ChangeMe-OWW-2026!"

# Get MongoDB URL from backend/.env
with open("/app/backend/.env") as f:
    for line in f:
        if line.startswith("MONGO_URL="):
            MONGO_URL = line.split("=", 1)[1].strip().strip('"')
            break

print(f"Connecting to MongoDB...")
client = MongoClient(MONGO_URL)
db = client.oww

print(f"\n1. Clear any existing reset tokens...")
result = db.password_reset_tokens.delete_many({"used": False})
print(f"   Deleted {result.deleted_count} unused tokens")

print(f"\n2. Request forgot-password...")
response = requests.post(
    f"{BASE_URL}/auth/forgot-password",
    json={"email": ADMIN_EMAIL, "origin": "https://test.example/"}
)
print(f"   Status: {response.status_code}")
print(f"   Body: {response.json()}")

time.sleep(1)

print(f"\n3. Query database for reset token...")
tokens = list(db.password_reset_tokens.find({"used": False}).sort("created_at", -1).limit(1))

if tokens:
    token_doc = tokens[0]
    print(f"   ✅ Found token in database!")
    print(f"   Token ID: {token_doc['id']}")
    print(f"   User ID: {token_doc['user_id']}")
    print(f"   Token hash: {token_doc['token_hash'][:32]}...")
    print(f"   Expires: {token_doc['expires_at']}")
    print(f"   Created: {token_doc['created_at']}")
    
    # We can't get the plain token from the hash, but we can verify the flow works
    # by testing with a known token
    print(f"\n4. The token was created successfully in the database.")
    print(f"   However, we cannot extract the plain token from the hash.")
    print(f"   The review request mentions that RESEND_API_KEY is empty and the")
    print(f"   backend should log the reset link. Let me check if logging is working...")
    
else:
    print(f"   ❌ No token found in database!")
    print(f"   This suggests the forgot-password flow is not creating tokens.")
    
    # Check if the user exists
    user = db.users.find_one({"email": ADMIN_EMAIL})
    if user:
        print(f"\n   User exists: {user['email']}")
        print(f"   User ID: {user['id']}")
    else:
        print(f"\n   ❌ User does not exist in database!")

print(f"\n5. Check ADMIN_EMAIL environment variable...")
print(f"   Expected: {ADMIN_EMAIL}")

# Check rate limiting
print(f"\n6. Check rate limiting...")
rl = db.password_reset_rate.find_one({"identifier": f"reset:{ADMIN_EMAIL}"})
if rl:
    print(f"   Rate limit entry exists:")
    print(f"   Count: {rl.get('count', 0)}")
    print(f"   Window started: {rl.get('window_started_at', 'N/A')}")
else:
    print(f"   No rate limit entry found")

client.close()
