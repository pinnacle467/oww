#!/usr/bin/env python3
"""
Manually seed admin user and test forgot-password flow
"""

import asyncio
import os
import sys
import requests
import time
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

from server import seed, db
from pymongo import MongoClient

BASE_URL = "https://admin-content-sync-5.preview.emergentagent.com/api"
ADMIN_EMAIL = "info@oncewerewild.com"
MONGO_URL = os.environ['MONGO_URL']

async def main():
    print("1. Running seed to create admin user...")
    await seed()
    
    # Verify user exists
    user = await db.users.find_one({"email": ADMIN_EMAIL})
    if user:
        print(f"   ✅ Admin user exists: {user['email']}")
    else:
        print(f"   ❌ Admin user NOT created!")
        return
    
    print("\n2. Request forgot-password...")
    response = requests.post(
        f"{BASE_URL}/auth/forgot-password",
        json={"email": ADMIN_EMAIL, "origin": "https://test.example/"}
    )
    print(f"   Status: {response.status_code}")
    
    time.sleep(2)
    
    print("\n3. Check database for reset token...")
    tokens = list(await db.password_reset_tokens.find({"used": False}).sort("created_at", -1).limit(1).to_list(length=10))
    
    if tokens:
        token_doc = tokens[0]
        print(f"   ✅ Token created in database!")
        print(f"   Token ID: {token_doc['id']}")
        print(f"   User ID: {token_doc['user_id']}")
        print(f"   Expires: {token_doc['expires_at']}")
        
        # Since we can't get the plain token from the hash, let's test the reset flow
        # by creating a known token
        print("\n4. Creating a test token with known value...")
        import secrets
        import hashlib
        from datetime import datetime, timezone, timedelta
        import uuid
        
        plain_token = secrets.token_hex(32)
        token_hash = hashlib.sha256(plain_token.encode()).hexdigest()
        
        # Delete old tokens
        await db.password_reset_tokens.update_many(
            {"user_id": user["id"], "used": False},
            {"$set": {"used": True}}
        )
        
        # Insert new token
        now = datetime.now(timezone.utc)
        await db.password_reset_tokens.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "token_hash": token_hash,
            "expires_at": (now + timedelta(minutes=30)).isoformat(),
            "used": False,
            "created_at": now.isoformat(),
        })
        
        print(f"   Test token: {plain_token}")
        
        print("\n5. Test reset-password with test token...")
        response = requests.post(
            f"{BASE_URL}/auth/reset-password",
            json={"token": plain_token, "new_password": "TempTest123!"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Body: {response.json()}")
        
        if response.status_code == 200:
            print("\n6. Test login with new password...")
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json={"email": ADMIN_EMAIL, "password": "TempTest123!"}
            )
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                token = response.json()["access_token"]
                print(f"   ✅ Login successful!")
                
                print("\n7. Restore original password...")
                response = requests.post(
                    f"{BASE_URL}/auth/change-password",
                    json={"current_password": "TempTest123!", "new_password": "ChangeMe-OWW-2026!"},
                    headers={"Authorization": f"Bearer {token}"}
                )
                print(f"   Status: {response.status_code}")
                
                if response.status_code == 200:
                    print(f"   ✅ Password restored!")
                else:
                    print(f"   ❌ Failed to restore password!")
            else:
                print(f"   ❌ Login failed: {response.json()}")
        else:
            print(f"   ❌ Reset failed!")
    else:
        print(f"   ❌ No token found in database!")

asyncio.run(main())
