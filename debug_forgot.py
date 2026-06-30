#!/usr/bin/env python3
"""
Debug forgot-password flow
"""

import asyncio
import os
import sys
import requests
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

from server import db, seed

BASE_URL = "https://admin-content-sync-5.preview.emergentagent.com/api"
ADMIN_EMAIL = "info@oncewerewild.com"

async def debug_forgot():
    # Ensure admin user exists
    await seed()
    
    user = await db.users.find_one({"email": ADMIN_EMAIL})
    print(f"1. User in DB: {user is not None}")
    if user:
        print(f"   Email: {user['email']}")
        print(f"   ID: {user['id']}")
    
    admin_email_env = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    print(f"\n2. ADMIN_EMAIL from env: '{admin_email_env}'")
    print(f"   Match: {ADMIN_EMAIL == admin_email_env}")
    
    # Clear existing tokens
    await db.password_reset_tokens.delete_many({"user_id": user["id"] if user else "none"})
    
    print(f"\n3. Sending forgot-password request...")
    response = requests.post(
        f"{BASE_URL}/auth/forgot-password",
        json={"email": ADMIN_EMAIL, "origin": "https://test.example/"}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Body: {response.json()}")
    
    await asyncio.sleep(2)
    
    print(f"\n4. Checking database for tokens...")
    tokens = await db.password_reset_tokens.find({}).to_list(length=100)
    print(f"   Total tokens in DB: {len(tokens)}")
    
    if tokens:
        for token in tokens:
            print(f"   - Token ID: {token['id']}, User ID: {token['user_id']}, Used: {token['used']}")
    else:
        print(f"   No tokens found")
    
    # Check rate limiting
    print(f"\n5. Checking rate limiting...")
    rl = await db.password_reset_rate.find_one({"identifier": f"reset:{ADMIN_EMAIL}"})
    if rl:
        print(f"   Rate limit entry exists:")
        print(f"   Count: {rl.get('count', 0)}")
        print(f"   Window started: {rl.get('window_started_at')}")
    else:
        print(f"   No rate limit entry")

asyncio.run(debug_forgot())
