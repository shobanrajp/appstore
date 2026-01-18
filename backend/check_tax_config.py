import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['appstore']
    
    store_id = '60c1f01e-91af-4131-953d-c16e2c9c1ca7'
    
    # Check tax config
    config = await db.store_tax_config.find_one({'store_id': store_id})
    print(f'Tax config found: {config is not None}')
    
    if config:
        print(f'Config ID: {config.get("id")}')
        print(f'Store ID: {config.get("store_id")}')
        metal_taxes = config.get('metal_taxes', [])
        print(f'Number of metal_taxes: {len(metal_taxes)}')
        for mt in metal_taxes:
            print(f'  - Metal: {mt.get("metal")}, CGST: {mt.get("cgst")}%, IGST: {mt.get("igst")}%, Enabled: {mt.get("is_enabled")}')
    else:
        print('❌ No tax config found in database!')
        print('Checking if any tax configs exist at all...')
        all_configs = await db.store_tax_config.find({}).to_list(10)
        print(f'Total tax configs in DB: {len(all_configs)}')
        if all_configs:
            print('Available store_ids:')
            for c in all_configs:
                print(f'  - {c.get("store_id")}')
    
    client.close()

asyncio.run(check())
