import httpx
import os
from datetime import datetime, timedelta
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external"

# In-memory token cache: email -> {token, expires_at}
_token_cache = {}

# Setup a lightweight Mongo client for logging Shiprocket API calls directly from this module.
_mongo_client = None
_mongo_db = None
_mongo_url = os.environ.get('MONGO_URL')
_mongo_db_name = os.environ.get('DB_NAME') or os.environ.get('DB_NAME')
if _mongo_url and _mongo_db_name:
    try:
        _mongo_client = AsyncIOMotorClient(_mongo_url)
        _mongo_db = _mongo_client[_mongo_db_name]
    except Exception:
        _mongo_client = None
        _mongo_db = None

async def get_shiprocket_token(email: str, password: str) -> str:
    now = datetime.now()
    # Check cache
    if email in _token_cache:
        cached = _token_cache[email]
        if cached["expires_at"] > now:
            return cached["token"]

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SHIPROCKET_BASE_URL}/auth/login",
                json={"email": email, "password": password}
            )
            response.raise_for_status()
            token = response.json().get("token")
            
            # Cache for 24 hours (safely under typical expiry)
            _token_cache[email] = {
                "token": token,
                "expires_at": now + timedelta(hours=24)
            }
            return token
        except httpx.HTTPError as e:
            logger.error(f"Shiprocket login failed: {e}")
            raise Exception("Failed to authenticate with Shiprocket")

async def check_serviceability(token: str, pickup_postcode: str, delivery_postcode: str, weight: float, cod: bool = False):
    """
    Get shipping rates and serviceability.
    weight: in kg
    """
    params = {
        "pickup_postcode": pickup_postcode,
        "delivery_postcode": delivery_postcode,
        "weight": weight,
        "cod": 1 if cod else 0
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SHIPROCKET_BASE_URL}/courier/serviceability",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == 200:
                # Get the best rate (usually the first recommended courier or cheapest)
                if data.get("data") and data["data"].get("available_courier_companies"):
                    couriers = data["data"]["available_courier_companies"]
                    # Calculate recommended courier
                    # For now simplistically return the cheapest rate
                    cheapest = min(couriers, key=lambda x: x.get("rate", 999999))
                    return {
                        "etd": cheapest.get("etd"),
                        "rate": cheapest.get("rate"),
                        "courier_name": cheapest.get("courier_name"),
                        "courier_id": cheapest.get("courier_company_id")
                    }
            return None
        except httpx.HTTPError as e:
            logger.error(f"Shiprocket serviceability check failed: {e}")
            return None

async def create_shiprocket_order(token: str, order_payload: dict):
    """
    Create an order in Shiprocket.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SHIPROCKET_BASE_URL}/orders/create/adhoc",
                json=order_payload,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Shiprocket create order failed: {e}")
            if e.response:
                logger.error(f"Response: {e.response.text}")
                # Return the error response so we can log it
                try:
                    return e.response.json()
                except:
                    pass
            raise Exception("Failed to create order in Shiprocket")


async def call_shiprocket_api(token: str, method: str, path: str, payload: dict = None, params: dict = None, store_id: str = None):
    """
    Generic caller to Shiprocket API. `path` should be the portion after the base URL,
    e.g., '/orders/get/\u003corder_id\u003e' or '/orders/cancel'.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    url = f"{SHIPROCKET_BASE_URL}{path}"
    # Insert a pending log to DB if available
    log_id = None
    try:
        if _mongo_db:
            log_doc = {
                "store_id": store_id,
                "action": f"{method.upper()} {path}",
                "status": "pending",
                "payload": payload or params,
                "response": None,
                "error": None,
                "created_at": datetime.now().isoformat()
            }
            res_ins = await _mongo_db.shiprocket_logs.insert_one(log_doc)
            log_id = res_ins.inserted_id
    except Exception as e:
        logger.warning(f"Could not write initial shiprocket log: {e}")

    async with httpx.AsyncClient() as client:
        try:
            method_upper = method.upper()
            if method_upper == 'GET':
                resp = await client.get(url, headers=headers, params=params)
            elif method_upper == 'POST':
                resp = await client.post(url, headers=headers, json=payload, params=params)
            elif method_upper == 'PUT':
                resp = await client.put(url, headers=headers, json=payload, params=params)
            elif method_upper == 'DELETE':
                resp = await client.delete(url, headers=headers, json=payload, params=params)
            else:
                raise Exception(f"Unsupported method {method}")

            resp.raise_for_status()
            try:
                resp_json = resp.json()
            except Exception:
                resp_json = {"raw_text": resp.text}

            # Update DB log as success
            try:
                if _mongo_db and log_id:
                    await _mongo_db.shiprocket_logs.update_one({"_id": log_id}, {"$set": {"response": resp_json, "status": "success", "updated_at": datetime.now().isoformat()}})
            except Exception as e:
                logger.warning(f"Failed to update shiprocket log: {e}")

            return resp_json
        except httpx.HTTPError as e:
            logger.error(f"Shiprocket API call failed ({method} {path}): {e}")
            err_resp = None
            if e.response:
                try:
                    err_resp = e.response.json()
                except Exception:
                    err_resp = {"raw_text": e.response.text}

            # Update DB log as error
            try:
                if _mongo_db and log_id:
                    await _mongo_db.shiprocket_logs.update_one({"_id": log_id}, {"$set": {"response": err_resp, "status": "error", "error": str(e), "updated_at": datetime.now().isoformat()}})
            except Exception as e2:
                logger.warning(f"Failed to update shiprocket log on error: {e2}")

            if err_resp is not None:
                return err_resp
            raise
