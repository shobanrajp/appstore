"""
Migration script: copy existing per-store `custom_domain` and `custom_domain_verified`
from `stores` collection into a new `store_domain_configs` collection. This is
idempotent: it will skip stores that already have a mapping.

Usage:
    python scripts/migrate_domains_to_super_admin.py

Requires environment variables in ../.env (MONGO_URL and DB_NAME) or system env.
"""

import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone
import uuid

ROOT = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(ROOT, '.env'))

MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME')

if not MONGO_URL or not DB_NAME:
    print("MONGO_URL and DB_NAME must be set in environment or .env")
    sys.exit(1)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def migrate():
    print("Starting migration: stores -> store_domain_configs")
    cursor = db.stores.find({"custom_domain": {"$exists": True, "$ne": None}})
    count = 0
    async for store in cursor:
        store_id = store.get('id')
        domain = store.get('custom_domain')
        verified = bool(store.get('custom_domain_verified', False))
        if not store_id or not domain:
            continue
        domain_norm = domain.lower().strip()
        existing = await db.store_domain_configs.find_one({"store_id": store_id})
        if existing:
            print(f"Skipping {store_id} (mapping exists)")
            continue
        conflict = await db.store_domain_configs.find_one({"domain": domain_norm})
        if conflict:
            print(f"Domain {domain_norm} already mapped to {conflict.get('store_id')}, skipping {store_id}")
            continue

        now = datetime.now(timezone.utc).isoformat()
        cfg = {
            "id": str(uuid.uuid4()),
            "store_id": store_id,
            "domain": domain_norm,
            "verified": verified,
            "created_at": now
        }
        await db.store_domain_configs.insert_one(cfg)
        # Optionally remove from store doc to avoid duplication
        await db.stores.update_one({"id": store_id}, {"$unset": {"custom_domain": "", "custom_domain_verified": ""}})
        print(f"Migrated domain for store {store_id} -> {domain_norm}")
        count += 1

    print(f"Migration complete. {count} mappings created.")

if __name__ == '__main__':
    asyncio.get_event_loop().run_until_complete(migrate())
    client.close()
