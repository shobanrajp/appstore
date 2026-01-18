from fastapi.testclient import TestClient
import os

# Ensure backend package path
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    import backend.server as server_module
    app = server_module.app
except Exception:
    import server as server_module
    app = server_module.app

client = TestClient(app)

STORE = "60c1f01e-91af-4131-953d-c16e2c9c1ca7"

# Login
r = client.post('/api/auth/login', json={'email': 'admin@admin.com', 'password': 'admin123'})
print('LOGIN', r.status_code, r.text)
if r.status_code != 200:
    raise SystemExit('login failed')

token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

plans = client.get(f'/api/stores/{STORE}/subscription-plans', headers=headers).json()
print('plans', plans)
plan = plans[0]

# Create subscription
payload = {'plan_id': plan['id'], 'monthly_amount': 500}
r = client.post(f'/api/stores/{STORE}/subscribe', headers=headers, json=payload)
print('SUBSCRIBE', r.status_code)
print(r.json())
