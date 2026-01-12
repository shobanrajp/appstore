
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
# Try to find .env in backend/ or root
env_path = ROOT_DIR / 'backend' / '.env'
if not env_path.exists():
    env_path = ROOT_DIR / '.env'
    
print(f"Loading .env from {env_path}")
load_dotenv(env_path)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def check_data():
    print("--- Store Shipping Config ---")
    async for config in db.store_shipping_config.find({}):
        print(config)

    print("\n--- Addresses ---")
    async for addr in db.addresses.find({}).limit(5):
        print(addr)

    print("\n--- Products (First 3) ---")
    async for prod in db.products.find({}).limit(3):
        print(f"ID: {prod.get('id')}, Name: {prod.get('name')}, Weight: {prod.get('weight')}")
        
    print("\n--- Carts (First 1) ---")
    async for cart in db.carts.find({}).limit(1):
        print(cart)
    async for log in db.shiprocket_logs.find({}).sort("created_at", -1).limit(5):
        print(log)

if __name__ == "__main__":
    asyncio.run(check_data())
