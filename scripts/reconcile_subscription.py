"""Utility: Reconcile a subscription's payments and accumulated grams
Usage:
    python scripts/reconcile_subscription.py <store_id> <subscription_id>

It will connect to MongoDB using MONGO_URL and DB_NAME env vars and compute:
- total_paid: sum of completed payments for subscription
- payments_made: count of completed payments
- accumulated_weight_grams: sum(net_amount / market_price_per_gram)

It prints the update and applies it to the subscription document.
"""
import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from dotenv import load_dotenv

# Load .env from repository root if present (helps when running script locally)
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')

async def reconcile(store_id, subscription_id):
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    if not mongo_url or not db_name:
        print('MONGO_URL or DB_NAME not set in environment')
        return 1
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    sub = await db.user_subscriptions.find_one({'id': subscription_id, 'store_id': store_id})
    if not sub:
        print('Subscription not found')
        return 1

    payments = await db.payments.find({'subscription_id': subscription_id, 'status': 'completed'}).to_list(None)
    total_paid = sum(p.get('amount', 0) for p in payments)
    payments_made = len(payments)

    accumulated = 0.0
    for p in payments:
        amt = p.get('amount', 0)
        if p.get('net_amount') is not None:
            net_amt = p.get('net_amount')
        else:
            tax_rate = p.get('tax_rate') or 0
            net_amt = amt * (1 - tax_rate)
        price = p.get('market_price_per_gram') or 0
        if price and price > 0:
            accumulated += net_amt / price

    update = {
        'payments_made': payments_made,
        'total_paid': total_paid,
        'accumulated_weight_grams': accumulated
    }

    await db.user_subscriptions.update_one({'id': subscription_id}, {'$set': update})
    print('Reconciled subscription:', subscription_id)
    print('Update:', update)
    return 0

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Reconcile subscription payments')
    parser.add_argument('store_id')
    parser.add_argument('subscription_id')
    parser.add_argument('--mongo-url', dest='mongo_url', help='MongoDB connection string (overrides MONGO_URL env)')
    parser.add_argument('--db-name', dest='db_name', help='Database name (overrides DB_NAME env)')
    args = parser.parse_args()

    if args.mongo_url:
        os.environ['MONGO_URL'] = args.mongo_url
    if args.db_name:
        os.environ['DB_NAME'] = args.db_name

    sys.exit(asyncio.run(reconcile(args.store_id, args.subscription_id)))