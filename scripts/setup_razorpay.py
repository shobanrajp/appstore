#!/usr/bin/env python3
"""
Setup script to configure Razorpay test keys for a store
Razorpay Test Keys (from https://dashboard.razorpay.com/)
- Key ID (Public): Use test key ID
- Key Secret (Private): Use test key secret

Usage:
    python setup_razorpay.py <store_id> <razorpay_key_id> <razorpay_key_secret>

Example with Razorpay test credentials:
    python setup_razorpay.py 60c1f01e-91af-4131-953d-c16e2c9c1ca7 rzp_test_XXXXXXXXXX your_test_secret_here
"""

import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://super_db_user:32vP1kxwlgo4y1tS@cluster0.esi7c1q.mongodb.net/?appName=Cluster0")
DB_NAME = os.getenv("DB_NAME", "test_database")


async def setup_razorpay_keys(store_id: str, key_id: str, key_secret: str):
    """Configure Razorpay keys for a store"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Update store with Razorpay keys
        result = await db.stores.update_one(
            {"id": store_id},
            {
                "$set": {
                    "razorpay_key_id": key_id,
                    "razorpay_key_secret": key_secret
                }
            }
        )
        
        if result.matched_count == 0:
            print(f"❌ Store not found: {store_id}")
            return False
        
        if result.modified_count > 0:
            print(f"✅ Razorpay keys configured for store: {store_id}")
            print(f"   Key ID: {key_id}")
            print(f"   Key Secret: {key_secret[:20]}...")
            return True
        else:
            print(f"⚠️  Store updated with same values")
            return True
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    finally:
        client.close()


def main():
    if len(sys.argv) < 4:
        print("Usage: python setup_razorpay.py <store_id> <razorpay_key_id> <razorpay_key_secret>")
        print("\nExample:")
        print("  python setup_razorpay.py 60c1f01e-91af-4131-953d-c16e2c9c1ca7 rzp_test_123456 test_secret_xyz")
        print("\nTo get Razorpay test keys:")
        print("  1. Visit https://dashboard.razorpay.com/")
        print("  2. Go to Settings > API Keys")
        print("  3. Copy the Test Key ID and Test Key Secret")
        sys.exit(1)
    
    store_id = sys.argv[1]
    key_id = sys.argv[2]
    key_secret = sys.argv[3]
    
    print(f"\n🔧 Setting up Razorpay for store: {store_id}\n")
    success = asyncio.run(setup_razorpay_keys(store_id, key_id, key_secret))
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
