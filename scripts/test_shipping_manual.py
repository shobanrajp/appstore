
import requests
import json

BASE_URL = "http://localhost:8000/api"
STORE_ID = "60c1f01e-91af-4131-953d-c16e2c9c1ca7"

def test_shipping():
    payload = {
        "items": [
            {
                "product_id": "68e1695b-d9df-42b3-bedd-862b627b94ef",
                "quantity": 1
            }
        ],
        "postal_code": "560054"
    }

    try:
        print(f"Sending request to {BASE_URL}/stores/{STORE_ID}/shipping/estimate")
        response = requests.post(f"{BASE_URL}/stores/{STORE_ID}/shipping/estimate", json=payload)
        
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("Response:", json.dumps(response.json(), indent=2))
        else:
            print("Error:", response.text)
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_shipping()
