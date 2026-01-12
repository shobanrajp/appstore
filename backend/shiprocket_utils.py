import httpx
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external"

async def get_shiprocket_token(email: str, password: str) -> str:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SHIPROCKET_BASE_URL}/auth/login",
                json={"email": email, "password": password}
            )
            response.raise_for_status()
            return response.json().get("token")
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
