import requests
import json
BASE = "http://localhost:8000/api"
STORE = "60c1f01e-91af-4131-953d-c16e2c9c1ca7"

# login
r = requests.post(f"{BASE}/auth/login", json={"email":"admin@admin.com","password":"admin123"})
print('LOGIN', r.status_code)
if r.status_code != 200:
    print(r.text)
    raise SystemExit('login failed')

token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

plans = requests.get(f"{BASE}/stores/{STORE}/subscription-plans").json()
plan = plans[0]
print('PLAN:', plan['id'])

r = requests.post(f"{BASE}/stores/{STORE}/subscribe", headers=headers, json={"plan_id": plan['id'], 'monthly_amount': 500})
print('SUBSCRIBE', r.status_code)
sub = r.json()
print('SUB:', json.dumps(sub, indent=2))

# without order_id
payload = {'amount': 500, 'description': 'test sub w/o order_id', 'store_id': STORE, 'subscription_id': sub['id']}
r1 = requests.post(f"{BASE}/payments/create-order", headers=headers, json=payload)
print('CREATE-ORDER w/o order_id:', r1.status_code, r1.text)

# with order_id
payload2 = {'amount': 500, 'description': 'test sub with order_id', 'store_id': STORE, 'subscription_id': sub['id'], 'order_id': sub.get('order_id')}
r2 = requests.post(f"{BASE}/payments/create-order", headers=headers, json=payload2)
print('CREATE-ORDER with order_id:', r2.status_code, r2.text)
