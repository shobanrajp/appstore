import requests
import json

BASE = "http://localhost:8000/api"
STORE_ID = "60c1f01e-91af-4131-953d-c16e2c9c1ca7"
TIMEOUT = 10

# 1) Login as admin
r = requests.post(f"{BASE}/auth/login", json={"email":"admin@admin.com","password":"admin123"}, timeout=TIMEOUT)

print('LOGIN', r.status_code, r.text)
if r.status_code != 200:
    raise SystemExit('Login failed')

token = r.json().get('access_token')
print('TOKEN:', token)
headers = {"Authorization": f"Bearer {token}"}

# 2) Get or create a plan
plans = requests.get(f"{BASE}/stores/{STORE_ID}/subscription-plans").json()
print('PLANS:', plans)
if not plans:
    r = requests.post(f"{BASE}/stores/{STORE_ID}/subscription-plans", headers=headers, json={"name":"Test Plan","plan_type":"Test","duration_months":1,"min_amount":100,"max_amount":1000,"benefits":["test"],"description":"test"}, timeout=TIMEOUT)
    print('CREATE PLAN', r.status_code, r.text)
    plan = r.json()
else:
    plan = plans[0]

print('PLAN ID', plan.get('id'))

# 3) Subscribe
r = requests.post(f"{BASE}/stores/{STORE_ID}/subscribe", headers=headers, json={"plan_id": plan.get('id'), "monthly_amount": 500}, timeout=TIMEOUT)

print('SUBSCRIBE', r.status_code, r.text)
sub = r.json()
print('SUB:', json.dumps(sub, indent=2))

# 4) Create payment order
payload = {
    "amount": 500,
    "description": "Subscription payment - test",
    "subscription_id": sub['id'],
    "order_id": sub.get('order_id'),
    "store_id": STORE_ID
}
print('PAYLOAD:', json.dumps(payload))

try:
    r = requests.post(f"{BASE}/payments/create-order", headers=headers, json=payload, timeout=TIMEOUT)
    print('CREATE ORDER', r.status_code, r.text)
    if r.status_code == 200:
        print('ORDER RESPONSE:', json.dumps(r.json(), indent=2))
    else:
        print('ERROR RESPONSE:', r.text)
except Exception as e:
    print('CREATE ORDER FAILED:', str(e))
