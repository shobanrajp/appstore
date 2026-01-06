"""
MongoDB Setup Script for Store Management System

This script initializes the MongoDB database with required collections,
indexes, and creates a default super admin user.
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# -----------------------------
# Configuration
# -----------------------------

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# -----------------------------
# MongoDB Setup
# -----------------------------

async def setup_mongodb():
    print("=" * 60)
    print("MongoDB Setup for Store Management System")
    print("=" * 60)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"\n✓ Connected to MongoDB: {MONGO_URL}")
    print(f"✓ Database: {DB_NAME}\n")

    collections = [
        "users",
        "stores",
        "products",
        "inventory",
        "orders",
        "addresses",
        "vendors",
        "purchase_orders",
        "pos_transactions",
        "subscription_plans",
        "user_subscriptions",
        "subscription_payments",
        "page_configs",
        "activity_logs",
        "counters",
        "payments",
    ]

    print("Creating collections...")
    existing_collections = await db.list_collection_names()

    for name in collections:
        if name not in existing_collections:
            await db.create_collection(name)
            print(f"  ✓ Created: {name}")
        else:
            print(f"  - Already exists: {name}")

    print("\n" + "=" * 60)
    print("Creating indexes for performance...")
    print("=" * 60 + "\n")

    # Users
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("store_id")

    # Stores
    await db.stores.create_index("id", unique=True)
    await db.stores.create_index("is_active")

    # Products
    await db.products.create_index("id", unique=True)
    await db.products.create_index("store_id")
    await db.products.create_index([("store_id", 1), ("category", 1)])
    await db.products.create_index([("store_id", 1), ("is_active", 1)])
    await db.products.create_index("sku")

    # Inventory
    await db.inventory.create_index("id", unique=True)
    await db.inventory.create_index("store_id")
    await db.inventory.create_index([("store_id", 1), ("product_id", 1)])
    await db.inventory.create_index("product_id")

    # Orders
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("store_id")
    await db.orders.create_index("user_id")
    await db.orders.create_index([("store_id", 1), ("status", 1)])
    await db.orders.create_index("created_at")

    # Addresses
    await db.addresses.create_index("id", unique=True)
    await db.addresses.create_index("user_id")
    await db.addresses.create_index([("user_id", 1), ("is_default", 1)])

    # Vendors
    await db.vendors.create_index("id", unique=True)
    await db.vendors.create_index("store_id")
    await db.vendors.create_index([("store_id", 1), ("is_active", 1)])

    # Purchase Orders
    await db.purchase_orders.create_index("id", unique=True)
    await db.purchase_orders.create_index("store_id")
    await db.purchase_orders.create_index("vendor_id")
    await db.purchase_orders.create_index([("store_id", 1), ("status", 1)])

    # POS Transactions
    await db.pos_transactions.create_index("id", unique=True)
    await db.pos_transactions.create_index("store_id")
    await db.pos_transactions.create_index("created_at")

    # Subscription Plans
    await db.subscription_plans.create_index("id", unique=True)
    await db.subscription_plans.create_index("store_id")
    await db.subscription_plans.create_index([("store_id", 1), ("is_active", 1)])

    # User Subscriptions
    await db.user_subscriptions.create_index("id", unique=True)
    await db.user_subscriptions.create_index("user_id")
    await db.user_subscriptions.create_index("store_id")
    await db.user_subscriptions.create_index([("store_id", 1), ("status", 1)])

    # Subscription Payments
    await db.subscription_payments.create_index("id", unique=True)
    await db.subscription_payments.create_index("subscription_id")
    await db.subscription_payments.create_index("user_id")

    # Page Configs
    await db.page_configs.create_index("id", unique=True)
    await db.page_configs.create_index([("store_id", 1), ("page_name", 1)])

    # Activity Logs
    await db.activity_logs.create_index("id", unique=True)
    await db.activity_logs.create_index("user_id")
    await db.activity_logs.create_index("store_id")
    await db.activity_logs.create_index("created_at")

    # Counters
    await db.counters.create_index("_id", unique=True)

    # Payments
    await db.payments.create_index("id", unique=True)
    await db.payments.create_index("user_id")
    await db.payments.create_index("created_at")

    print("✓ All indexes created successfully\n")

    print("=" * 60)
    print("Creating default super admin user...")
    print("=" * 60 + "\n")

    existing_admin = await db.users.find_one({"email": "admin@admin.com"})

    if not existing_admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@admin.com",
            "password_hash": pwd_context.hash("admin123"),
            "name": "Super Admin",
            "role": "super_admin",
            "store_id": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin_user)
        print("✓ Super admin created")
        print("  Email: admin@admin.com")
        print("  Password: admin123")
        print("  ⚠️  Change this password after first login\n")
    else:
        print("- Super admin already exists\n")

    print("=" * 60)
    print("✅ MongoDB setup completed successfully!")
    print("=" * 60)

    client.close()


if __name__ == "__main__":
    asyncio.run(setup_mongodb())
