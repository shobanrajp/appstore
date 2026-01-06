"""
Create Demo Data for Store Management System
This script creates a sample store with products, inventory, and subscription plans
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


async def create_demo_data():
    """Create demo store with products and inventory"""

    print("=" * 60)
    print("Creating Demo Data")
    print("=" * 60 + "\n")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    now = datetime.now(timezone.utc).isoformat()

    # -----------------------------
    # Create Demo Store
    # -----------------------------
    print("Creating demo store...")
    store_id = str(uuid.uuid4())
    store = {
        "id": store_id,
        "name": "Golden Treasures Jewelry",
        "description": "Premium handcrafted jewelry and gold savings plans",
        "currency": "INR",
        "logo_url": None,
        "contact_email": "info@goldentreasures.com",
        "contact_phone": "+91-9876543210",
        "address": "123 Jewelry Street, Mumbai, Maharashtra 400001",
        "is_active": True,
        "created_at": now,
    }

    existing_store = await db.stores.find_one({"name": store["name"]})
    if existing_store:
        store_id = existing_store["id"]
        print("  - Demo store already exists")
    else:
        await db.stores.insert_one(store)
        print(f"  ✓ Store created: {store['name']}")
        print(f"    Store ID: {store_id}\n")

    # -----------------------------
    # Create Products
    # -----------------------------
    print("Creating products...")
    products_data = [
        {
            "name": "Classic Gold Necklace",
            "description": "22K gold necklace with traditional design",
            "price": 85000,
            "category": "Necklaces",
            "sku": "GN-001",
            "weight": 35.5,
            "metal_type": "22K Gold",
            "stock": 25,
        },
        {
            "name": "Diamond Solitaire Ring",
            "description": "1 carat diamond solitaire in platinum setting",
            "price": 185000,
            "category": "Rings",
            "sku": "DR-001",
            "weight": 4.2,
            "metal_type": "Platinum",
            "stock": 15,
        },
        {
            "name": "Pearl Drop Earrings",
            "description": "Natural pearl earrings with gold accents",
            "price": 25000,
            "category": "Earrings",
            "sku": "PE-001",
            "weight": 5.5,
            "metal_type": "18K Gold",
            "stock": 8,
        },
        {
            "name": "Ruby Pendant Set",
            "description": "Ruby pendant with matching earrings",
            "price": 95000,
            "category": "Pendants",
            "sku": "RP-001",
            "weight": 12.0,
            "metal_type": "22K Gold",
            "stock": 12,
        },
        {
            "name": "Gold Bangle Set",
            "description": "Set of 4 traditional gold bangles",
            "price": 145000,
            "category": "Bangles",
            "sku": "GB-001",
            "weight": 48.0,
            "metal_type": "22K Gold",
            "stock": 18,
        },
        {
            "name": "Emerald Bracelet",
            "description": "Emerald and diamond tennis bracelet",
            "price": 225000,
            "category": "Bracelets",
            "sku": "EB-001",
            "weight": 22.5,
            "metal_type": "18K White Gold",
            "stock": 0,
        },
        {
            "name": "Gold Chain",
            "description": "22K gold chain for men",
            "price": 65000,
            "category": "Chains",
            "sku": "GC-001",
            "weight": 28.0,
            "metal_type": "22K Gold",
            "stock": 35,
        },
        {
            "name": "Silver Anklet Pair",
            "description": "Traditional silver anklets",
            "price": 8500,
            "category": "Anklets",
            "sku": "SA-001",
            "weight": 45.0,
            "metal_type": "Silver 925",
            "stock": 42,
        },
    ]

    product_ids = []

    for product_data in products_data:
        stock = product_data.pop("stock")

        existing_product = await db.products.find_one(
            {"store_id": store_id, "sku": product_data["sku"]}
        )

        if existing_product:
            product_id = existing_product["id"]
            print(f"  - Product exists: {product_data['name']}")
        else:
            product_id = str(uuid.uuid4())
            product = {
                "id": product_id,
                "store_id": store_id,
                **product_data,
                "images": [],
                "is_active": True,
                "created_at": now,
            }
            await db.products.insert_one(product)
            print(f"  ✓ Product: {product_data['name']} (Stock: {stock})")

        product_ids.append((product_id, stock))

    print()

    # -----------------------------
    # Inventory
    # -----------------------------
    print("Setting up inventory...")
    for product_id, quantity in product_ids:
        existing_inv = await db.inventory.find_one(
            {"store_id": store_id, "product_id": product_id}
        )

        if existing_inv:
            await db.inventory.update_one(
                {"id": existing_inv["id"]},
                {"$set": {"quantity": quantity, "updated_at": now}},
            )
            print(f"  - Updated inventory: {quantity} units")
        else:
            inventory = {
                "id": str(uuid.uuid4()),
                "store_id": store_id,
                "product_id": product_id,
                "quantity": quantity,
                "min_stock_level": 5 if quantity > 0 else 0,
                "location": "Main Warehouse",
                "updated_at": now,
            }
            await db.inventory.insert_one(inventory)
            print(f"  ✓ Inventory set: {quantity} units")

    print()

    # -----------------------------
    # Subscription Plans
    # -----------------------------
    print("Creating subscription plans...")
    plans_data = [
        {
            "name": "Silver Savings Plan",
            "plan_type": "Silver",
            "duration_months": 11,
            "bonus_percentage": 5,
            "min_amount": 500,
            "max_amount": 10000,
            "benefits": [
                "5% bonus on maturity",
                "Flexible payment dates",
                "No penalty for early withdrawal",
            ],
            "description": "Perfect for small monthly savings",
        },
        {
            "name": "Gold Savings Plan",
            "plan_type": "Gold",
            "duration_months": 11,
            "bonus_percentage": 8,
            "min_amount": 5000,
            "max_amount": 50000,
            "benefits": [
                "8% bonus on maturity",
                "Priority customer service",
                "Free gold coin on completion",
                "Flexible payment dates",
            ],
            "description": "Popular choice for regular savers",
        },
        {
            "name": "Platinum Savings Plan",
            "plan_type": "Platinum",
            "duration_months": 11,
            "bonus_percentage": 12,
            "min_amount": 10000,
            "max_amount": 100000,
            "benefits": [
                "12% bonus on maturity",
                "VIP customer service",
                "Free jewelry making charges",
                "Exclusive design previews",
                "Flexible payment dates",
            ],
            "description": "Premium plan with maximum benefits",
        },
    ]

    for plan_data in plans_data:
        existing_plan = await db.subscription_plans.find_one(
            {"store_id": store_id, "plan_type": plan_data["plan_type"]}
        )

        if existing_plan:
            print(f"  - Plan exists: {plan_data['name']}")
        else:
            plan = {
                "id": str(uuid.uuid4()),
                "store_id": store_id,
                **plan_data,
                "is_active": True,
                "created_at": now,
            }
            await db.subscription_plans.insert_one(plan)
            print(
                f"  ✓ Plan: {plan_data['name']} ({plan_data['bonus_percentage']}% bonus)"
            )

    client.close()

    print("\n" + "=" * 60)
    print("✅ Demo data created successfully!")
    print("=" * 60)
    print(f"\n📍 Store ID: {store_id}")
    print(f"🔗 Access store at: /store/{store_id}")
    print("\nProducts created: 8")
    print("Subscription plans: 3 (Silver, Gold, Platinum)")
    print("\n💡 Login with: admin@admin.com / admin123\n")


if __name__ == "__main__":
    asyncio.run(create_demo_data())
