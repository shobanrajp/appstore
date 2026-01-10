#!/usr/bin/env python3
"""
Quick setup to configure Razorpay test keys for demo/test stores.

This script updates an existing store with Razorpay test credentials.
You need to provide actual test keys from your Razorpay account.

For testing purposes, you can use Razorpay's default test credentials:
- Razorpay Test Key ID: rzp_test_1Aa00000000001
- Razorpay Test Key Secret: (ask Razorpay support or generate in dashboard)

Steps to get your Razorpay keys:
1. Go to https://dashboard.razorpay.com/
2. Sign in with your Razorpay account
3. Navigate to Settings > API Keys
4. Under "Test Keys" tab, you'll find:
   - Key ID (Your public key)
   - Key Secret (Your secret key)
5. Copy both and use them below

Or run the setup_razorpay.py script with your credentials:
    python scripts/setup_razorpay.py <store_id> <key_id> <key_secret>
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

# Configuration
MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://super_db_user:32vP1kxwlgo4y1tS@cluster0.esi7c1q.mongodb.net/?appName=Cluster0")
DB_NAME = os.getenv("DB_NAME", "test_database")

# Demo store configuration
DEMO_STORE_ID = "60c1f01e-91af-4131-953d-c16e2c9c1ca7"

# Razorpay TEST keys - Replace these with your actual test keys from Razorpay dashboard
# These are placeholder values; you need to get real ones from Razorpay
RAZORPAY_TEST_KEY_ID = "rzp_test_1Aa00000000001"  # Replace with your test key ID
RAZORPAY_TEST_KEY_SECRET = "OyV7qq2rrjrjhjrjhHHH"  # Replace with your test key secret


async def setup_demo_razorpay():
    """Configure Razorpay keys for demo store"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        print("🔧 Setting up Razorpay for demo store...\n")
        
        # Get the store first
        store = await db.stores.find_one({"id": DEMO_STORE_ID}, {"_id": 0})
        if not store:
            print(f"❌ Demo store not found: {DEMO_STORE_ID}")
            return False
        
        print(f"✓ Found store: {store.get('name')}")
        
        # Update with Razorpay keys
        result = await db.stores.update_one(
            {"id": DEMO_STORE_ID},
            {
                "$set": {
                    "razorpay_key_id": RAZORPAY_TEST_KEY_ID,
                    "razorpay_key_secret": RAZORPAY_TEST_KEY_SECRET
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"✅ Razorpay configured successfully!")
            print(f"   Store ID: {DEMO_STORE_ID}")
            print(f"   Key ID: {RAZORPAY_TEST_KEY_ID}")
            print(f"\n✨ You can now test subscriptions with payment!\n")
            return True
        else:
            print(f"⚠️  No changes made (might already be configured)")
            return True
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    finally:
        client.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Razorpay Setup for Demo Store")
    print("=" * 60 + "\n")
    
    print("⚠️  IMPORTANT: Before running this, update the following in this script:")
    print(f"   1. RAZORPAY_TEST_KEY_ID (current: {RAZORPAY_TEST_KEY_ID})")
    print(f"   2. RAZORPAY_TEST_KEY_SECRET (current: {RAZORPAY_TEST_KEY_SECRET[:10]}...)\n")
    print("   Get these from: https://dashboard.razorpay.com/ > Settings > API Keys\n")
    
    # Uncomment the next line after setting your actual keys above
    # success = asyncio.run(setup_demo_razorpay())
    # For now, just show instructions
    print("Instructions:")
    print("1. Get your Razorpay test keys from https://dashboard.razorpay.com/")
    print("2. Update RAZORPAY_TEST_KEY_ID and RAZORPAY_TEST_KEY_SECRET in this file")
    print("3. Uncomment the asyncio.run() line above")
    print("4. Run: python scripts/setup_razorpay_demo.py")
