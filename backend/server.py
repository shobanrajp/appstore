# ==================== IMPORTS ====================
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, model_validator
from typing import List, Optional, Any, Union
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import requests
import hmac
import hashlib
import re

from shiprocket_utils import get_shiprocket_token, check_serviceability, create_shiprocket_order
from math import ceil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')

if not mongo_url or not db_name:
    logging.warning("MONGO_URL or DB_NAME not set. Database connection will fail.")
    client = None
    db = None
else:
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

app = FastAPI(title="Dynamic Web App Configurator")
api_router = APIRouter(prefix="/api")

# ==================== RAZORPAY LOGGING ====================

class RazorpayLog(BaseModel):
    id: str
    store_id: str
    action: str
    status: str
    url: Optional[str] = None
    request: Optional[dict] = None
    response: Optional[dict] = None
    error: Optional[str] = None
    created_at: str

class PaginatedRazorpayLogResponse(BaseModel):
    items: List[RazorpayLog]
    total: int
    page: int
    limit: int
    pages: int

async def log_razorpay(store_id: str, action: str, status: str, url: str = None, request: dict = None, response: dict = None, error: str = None):
    try:
        safe_request = request.copy() if request else None
        await db.razorpay_logs.insert_one({
            "store_id": store_id,
            "action": action,
            "status": status,
            "url": url,
            "request": safe_request,
            "response": response,
            "error": error,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        print(f"Failed to write razorpay log: {e}")

# ==================== MODELS ====================

@api_router.get("/health")
async def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

class UserRole:
    SUPER_ADMIN = "super_admin"
    STORE_ADMIN = "store_admin"
    STORE_USER = "store_user"
    END_USER = "end_user"

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = UserRole.END_USER
    store_id: Optional[str] = None
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = UserRole.END_USER
    store_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    store_id: Optional[str] = None
    is_active: bool
    created_at: str
    menu_access: Optional[List[str]] = None


class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class StoreCreate(BaseModel):
    name: str
    description: Optional[str] = None
    currency: str = "INR"
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    address_map_url: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    custom_domain: Optional[str] = None
    custom_domain_verified: bool = False
    order_prefix: Optional[str] = "VEL"  # 3-character prefix for order IDs
    market_prices: Optional[dict] = None

class StoreResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    currency: str
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    address_map_url: Optional[str] = None
    is_active: bool
    custom_domain: Optional[str] = None
    custom_domain_verified: bool = False
    order_prefix: Optional[str] = "VEL"
    created_at: str
    razorpay_key_id: Optional[str] = None

class TaxRate(BaseModel):
    cgst: float = 0.0
    igst: float = 0.0

class CategoryTaxConfig(BaseModel):
    category: str
    tax_rate: TaxRate

class MetalTaxConfig(BaseModel):
    metal: str # gold, silver, platinum
    tax_rate: TaxRate
    is_enabled: bool = False

class StoreTaxConfig(BaseModel):
    store_id: str
    category_taxes: List[CategoryTaxConfig] = []
    metal_taxes: List[MetalTaxConfig] = []
    updated_at: str

class StoreTaxConfigUpdate(BaseModel):
    category_taxes: List[CategoryTaxConfig]
    metal_taxes: List[MetalTaxConfig]

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: Optional[str] = None
    sku: Optional[str] = None
    images: List[str] = []
    is_active: bool = True
    weight: Optional[float] = None
    metal_type: Optional[str] = None
    featured: bool = False

class ProductResponse(BaseModel):
    id: str
    store_id: str
    name: str
    description: Optional[str] = None
    price: float
    category: Optional[str] = None
    sku: Optional[str] = None
    images: List[str] = []
    is_active: bool
    weight: Optional[float] = None
    metal_type: Optional[str] = None
    featured: bool = False
    created_at: str

class PaginatedProductResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    limit: int
    pages: int

class InventoryCreate(BaseModel):
    product_id: str
    quantity: int
    min_stock_level: int = 5
    location: Optional[str] = None

class InventoryResponse(BaseModel):
    id: str
    store_id: str
    product_id: str
    quantity: int
    min_stock_level: int
    location: Optional[str] = None
    updated_at: str

class PaginatedInventoryResponse(BaseModel):
    items: List[InventoryResponse]
    total: int
    page: int
    limit: int
    pages: int

class AddressCreate(BaseModel):
    label: str = "Home"
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str = "India"
    special_instructions: Optional[str] = None
    is_default: bool = False

class AddressResponse(BaseModel):
    id: str
    user_id: str
    label: str
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str
    special_instructions: Optional[str] = None
    is_default: bool

class CartItemCreate(BaseModel):
    product_id: str
    quantity: int
    price: float

class CartItemUpdate(BaseModel):
    quantity: int

class CartMergeRequest(BaseModel):
    session_id: str

class CartItemResponse(BaseModel):
    id: str
    product_id: str
    quantity: int
    price: float
    tax_info: Optional[dict] = None  # {cgst: amt, igst: amt, rate_cgst: %, rate_igst: %}

class CartResponse(BaseModel):
    id: str
    store_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    items: List[CartItemResponse] = []
    created_at: str
    updated_at: str
    total_tax: Optional[float] = 0.0
    tax_breakdown: Optional[dict] = None

class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int
    price: float

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    shipping_address_id: str
    shipping_charges: Optional[float] = 0.0
    notes: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    store_id: str
    user_id: str
    items: List[dict]
    shipping_address: Optional[dict] = None
    total_amount: float
    status: str
    tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    carrier_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class PaginatedOrderResponse(BaseModel):
    items: List[OrderResponse]
    total: int
    page: int
    limit: int
    pages: int

class OrderStatusUpdate(BaseModel):
    status: str
    tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    carrier_url: Optional[str] = None

class VendorCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None

class VendorResponse(BaseModel):
    id: str
    store_id: str
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: bool
    created_at: str

class PaginatedVendorResponse(BaseModel):
    items: List[VendorResponse]
    total: int
    page: int
    limit: int
    pages: int

class PurchaseOrderItemCreate(BaseModel):
    product_id: str
    quantity: int
    unit_price: float

class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    items: List[PurchaseOrderItemCreate]
    notes: Optional[str] = None

class PurchaseOrderResponse(BaseModel):
    id: str
    store_id: str
    vendor_id: str
    items: List[dict]
    total_amount: float
    status: str
    notes: Optional[str] = None
    created_at: str

class PaginatedPurchaseOrderResponse(BaseModel):
    items: List[PurchaseOrderResponse]
    total: int
    page: int
    limit: int
    pages: int

class POSTransactionCreate(BaseModel):
    items: List[OrderItemCreate]
    payment_method: str = "cash"
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None

class POSTransactionResponse(BaseModel):
    id: str
    store_id: str
    items: List[dict]
    total_amount: float
    payment_method: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    created_at: str

class PaginatedPOSTransactionResponse(BaseModel):
    items: List[POSTransactionResponse]
    total: int
    page: int
    limit: int
    pages: int

class SubscriptionPlanCreate(BaseModel):
    name: str
    plan_type: str  # Text input - e.g., "Gold", "Silver", "Platinum"
    scheme_type: str = "fixed" # "fixed" or "flexible"
    target_metal: Optional[str] = None # "gold", "silver", "platinum" (Required for flexible)
    duration_months: int = 11
    bonus_percentage: float = 0
    min_amount: float = 500  # Minimum monthly amount
    max_amount: float = 100000  # Maximum monthly amount
    benefits: List[str] = []
    description: Optional[str] = None
    is_active: bool = True

class SubscriptionPlanResponse(BaseModel):
    id: str
    store_id: str
    name: str
    plan_type: str
    scheme_type: str = "fixed"
    target_metal: Optional[str] = None
    duration_months: int
    min_amount: float = 500
    max_amount: float = 100000
    bonus_percentage: float
    benefits: List[str] = []
    description: Optional[str] = None
    is_active: bool
    created_at: str

class UserSubscriptionCreate(BaseModel):
    plan_id: str
    monthly_amount: float  # User chooses the amount within plan limits

class UserSubscriptionResponse(BaseModel):
    id: str
    order_id: str  # REQUIRED - Must be generated during subscription creation
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    store_id: str
    plan_id: str
    plan_name: str
    plan_type: Optional[str] = ""
    scheme_type: Optional[str] = "fixed" # "fixed" or "flexible"
    monthly_amount: float
    accumulated_weight_grams: Optional[float] = 0.0 # For flexible plans
    payments_made: int
    total_paid: float
    status: str
    start_date: str
    maturity_date: str
    created_at: str
    
    @model_validator(mode='after')
    def validate_order_id(self):
        """Enforce order_id is present and not None"""
        if not self.order_id:
            raise ValueError(f"order_id is required and cannot be None")
        return self

# Store Payment Config (Razorpay)
class StorePaymentConfigUpdate(BaseModel):
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None

class StorePaymentConfigResponse(BaseModel):
    store_id: str
    razorpay_key_id: Optional[str] = None
    has_razorpay_configured: bool = False

# Subscription Payment
class SubscriptionPaymentCreate(BaseModel):
    subscription_id: str
    amount: float

class SubscriptionPaymentResponse(BaseModel):
    id: str
    subscription_id: str
    user_id: str
    amount: float
    payment_date: str
    status: str

class PageComponentCreate(BaseModel):
    type: str
    props: dict = {}
    children: List[Any] = []
    order: int = 0

class PageConfigCreate(BaseModel):
    page_name: str
    components: List[dict] = []
    is_published: bool = False

class PageConfigResponse(BaseModel):
    id: str
    store_id: str
    page_name: str
    components: List[dict]
    is_published: bool
    updated_at: str


class StoreDomainConfigCreate(BaseModel):
    domain: str


class StoreDomainConfigResponse(BaseModel):
    id: str
    store_id: str
    domain: str
    verified: bool
    created_at: str


class MarketPricesUpdate(BaseModel):
    enabled: bool = True
    prices: dict = {}


class MarketPricesResponse(BaseModel):
    store_id: str
    enabled: bool
    prices: dict
    updated_at: Optional[str] = None

# Mock Payment
class MockPaymentCreate(BaseModel):
    amount: float
    description: str
    subscription_id: Optional[str] = None
    order_id: Optional[str] = None
    store_id: Optional[str] = None

class MockPaymentResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    razorpay_amount: int
    description: str
    status: str
    razorpay_order_id: str
    razorpay_key_id: Optional[str] = None
    created_at: str

class PaymentVerification(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    payment_id: str

# Staff/Worker Management
class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    menu_access: List[str] = []  # List of menu keys the staff can access

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    menu_access: Optional[List[str]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class StaffResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    store_id: str
    menu_access: List[str] = []
    is_active: bool
    created_at: str

class PaginatedStaffResponse(BaseModel):
    items: List[StaffResponse]
    total: int
    page: int
    limit: int
    pages: int

class ActivityLog(BaseModel):
    id: str
    user_id: str
    store_id: str
    action: str
    details: Optional[dict] = None
    created_at: str

# Customer (Website User) Management
class CustomerResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    is_active: bool
    created_at: str
    order_count: int = 0
    total_spent: float = 0
    subscription_count: int = 0

class PaginatedCustomerResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
    page: int
    limit: int
    pages: int

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_token(user_id: str, email: str, role: str, store_id: Optional[str] = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "store_id": store_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        print(f"DEBUG: Received credentials: {credentials}")
        if not credentials or not credentials.credentials:
            print("DEBUG: No credentials provided")
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            print("DEBUG: No user_id in token")
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            print("DEBUG: User not found in database")
            raise HTTPException(status_code=401, detail="User not found")
        print(f"DEBUG: Authenticated user: {user.get('email')}")
        return user
    except jwt.ExpiredSignatureError:
        print("DEBUG: Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        print(f"DEBUG: Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"DEBUG: Unexpected error in get_current_user: {e}")
        raise HTTPException(status_code=401, detail="Not authenticated")

async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        return user
    except:
        return None

def require_roles(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

@api_router.get("/stores/{store_id}/razorpay-logs", response_model=PaginatedRazorpayLogResponse)
async def get_razorpay_logs(store_id: str, page: int = 1, limit: int = 20, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    skip = (page - 1) * limit
    total = await db.razorpay_logs.count_documents({"store_id": store_id})
    logs = await db.razorpay_logs.find({"store_id": store_id}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    items = [RazorpayLog(id=str(l["_id"]), **{k:v for k,v in l.items() if k != "_id"}) for l in logs]
    pages = ceil(total / limit)
    return PaginatedRazorpayLogResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "store_id": user_data.store_id,
        "is_active": True,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, user_data.role, user_data.store_id)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            store_id=user_data.store_id,
            is_active=True,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    token = create_token(user["id"], user["email"], user["role"], user.get("store_id"))
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            store_id=user.get("store_id"),
            is_active=user.get("is_active", True),
            created_at=user["created_at"],
            menu_access=user.get("menu_access")
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        store_id=user.get("store_id"),
        is_active=user.get("is_active", True),
        created_at=user["created_at"],
        menu_access=user.get("menu_access")
    )

# ==================== STORE ENDPOINTS ====================

@api_router.post("/stores", response_model=StoreResponse)
async def create_store(store_data: StoreCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    store_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Domain configuration is managed by super-admin in a separate collection
    # `store_domain_configs` (store_id -> custom_domain). Do not set per-store domain here.
    # Validate order_prefix if provided
    if getattr(store_data, "order_prefix", None):
        prefix_val = store_data.order_prefix.upper().strip()
        if not re.match(r'^[A-Z0-9]{3}$', prefix_val):
            raise HTTPException(status_code=400, detail="order_prefix must be exactly 3 alphanumeric characters")
        store_data.order_prefix = prefix_val
    
    store_doc = {
        "id": store_id,
        "name": store_data.name,
        "description": store_data.description,
        "currency": store_data.currency,
        "logo_url": store_data.logo_url,
        "contact_email": store_data.contact_email,
        "contact_phone": store_data.contact_phone,
        "address": store_data.address,
        "is_active": True,
        # custom domains are managed centrally in `store_domain_configs`
        "order_prefix": getattr(store_data, "order_prefix", "VEL"),
        "created_at": now
    }
    
    # Add Razorpay keys if provided
    if store_data.razorpay_key_id:
        store_doc["razorpay_key_id"] = store_data.razorpay_key_id
    if store_data.razorpay_key_secret:
        store_doc["razorpay_key_secret"] = store_data.razorpay_key_secret
    
    await db.stores.insert_one(store_doc)
    
    # Create default page config for the store
    default_page = {
        "id": str(uuid.uuid4()),
        "store_id": store_id,
        "page_name": "home",
        "components": [],
        "is_published": False,
        "updated_at": now
    }
    await db.page_configs.insert_one(default_page)
    
    return StoreResponse(**{k: v for k, v in store_doc.items() if k != "_id"})

@api_router.get("/stores", response_model=List[StoreResponse])
async def get_stores(user: dict = Depends(get_current_user)):
    if user["role"] == UserRole.SUPER_ADMIN:
        stores = await db.stores.find({}, {"_id": 0}).to_list(1000)
    elif user.get("store_id"):
        stores = await db.stores.find({"id": user["store_id"]}, {"_id": 0}).to_list(1)
    else:
        stores = await db.stores.find({"is_active": True}, {"_id": 0}).to_list(1000)
    return [StoreResponse(**s) for s in stores]

@api_router.get("/stores/{store_id}", response_model=StoreResponse)
async def get_store(store_id: str):
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return StoreResponse(**store)

@api_router.put("/stores/{store_id}", response_model=StoreResponse)
async def update_store(store_id: str, store_data: StoreCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update other stores")
    
    # Validate order_prefix if provided
    if getattr(store_data, "order_prefix", None):
        prefix_val = store_data.order_prefix.upper().strip()
        if not re.match(r'^[A-Z0-9]{3}$', prefix_val):
            raise HTTPException(status_code=400, detail="order_prefix must be exactly 3 alphanumeric characters")
        store_data.order_prefix = prefix_val

    update_data = store_data.model_dump()
    # Extract market_prices if provided and write to separate collection
    market_prices_payload = update_data.pop('market_prices', None)
    await db.stores.update_one({"id": store_id}, {"$set": update_data})
    if market_prices_payload is not None:
        now = datetime.now(timezone.utc).isoformat()
        mp_doc = {
            "store_id": store_id,
            "enabled": bool(market_prices_payload.get('enabled', True)),
            "prices": market_prices_payload.get('prices', {}),
            "updated_at": now
        }
        await db.store_market_prices.update_one({"store_id": store_id}, {"$set": mp_doc}, upsert=True)
    
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    return StoreResponse(**store)

@api_router.delete("/stores/{store_id}")
async def delete_store(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    await db.stores.update_one({"id": store_id}, {"$set": {"is_active": False}})
    return {"message": "Store deactivated"}


# --------------------
# Super-admin managed domain -> store mappings
# --------------------

def _normalize_domain(d: str) -> str:
    return d.lower().strip()


@api_router.post("/admin/stores/{store_id}/domain", response_model=StoreDomainConfigResponse)
async def set_store_domain(store_id: str, payload: StoreDomainConfigCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    domain = _normalize_domain(payload.domain)
    # Basic validation
    domain_pattern = r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
    if not re.match(domain_pattern, domain):
        raise HTTPException(status_code=400, detail="Invalid domain name format")

    existing = await db.store_domain_configs.find_one({"domain": domain})
    if existing and existing.get("store_id") != store_id:
        raise HTTPException(status_code=400, detail="Domain already assigned to another store")

    now = datetime.now(timezone.utc).isoformat()
    existing_by_store = await db.store_domain_configs.find_one({"store_id": store_id})
    if existing_by_store:
        await db.store_domain_configs.update_one({"store_id": store_id}, {"$set": {"domain": domain, "verified": False, "created_at": now}})
        doc = await db.store_domain_configs.find_one({"store_id": store_id}, {"_id": 0})
    else:
        cfg = {
            "id": str(uuid.uuid4()),
            "store_id": store_id,
            "domain": domain,
            "verified": False,
            "created_at": now
        }
        await db.store_domain_configs.insert_one(cfg)
        doc = {k: v for k, v in cfg.items()}
    return StoreDomainConfigResponse(**doc)


@api_router.delete("/admin/stores/{store_id}/domain")
async def remove_store_domain(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    await db.store_domain_configs.delete_one({"store_id": store_id})
    return {"message": "Domain mapping removed"}


@api_router.get("/admin/store-domain-configs", response_model=List[StoreDomainConfigResponse])
async def list_store_domain_configs(user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    configs = await db.store_domain_configs.find({}, {"_id": 0}).to_list(1000)
    return [StoreDomainConfigResponse(**c) for c in configs]


@api_router.get("/stores/by-domain/{domain}", response_model=StoreResponse)
async def get_store_by_domain(domain: str):
    d = _normalize_domain(domain)
    cfg = await db.store_domain_configs.find_one({"domain": d})
    if not cfg:
        raise HTTPException(status_code=404, detail="Store not found for domain")
    store = await db.stores.find_one({"id": cfg["store_id"]}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return StoreResponse(**store)


@api_router.get("/admin/stores/{store_id}/domain", response_model=Optional[StoreDomainConfigResponse])
async def get_store_domain_config(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    cfg = await db.store_domain_configs.find_one({"store_id": store_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(status_code=404, detail="Domain config not found")
    return StoreDomainConfigResponse(**cfg)


@api_router.post("/admin/stores/{store_id}/verify-domain")
async def verify_store_domain_admin(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    cfg = await db.store_domain_configs.find_one({"store_id": store_id})
    if not cfg:
        raise HTTPException(status_code=404, detail="Domain config not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.store_domain_configs.update_one({"store_id": store_id}, {"$set": {"verified": True, "verified_at": now}})
    return {"message": "Domain marked as verified", "domain": cfg.get("domain")}


@api_router.get("/stores/{store_id}/domain-verification-status")
async def get_domain_verification_status(store_id: str, user: Optional[dict] = Depends(get_optional_user)):
    # Return domain verification status for a store (accessible to store admins and super-admins)
    cfg = await db.store_domain_configs.find_one({"store_id": store_id}, {"_id": 0})
    if not cfg:
        return {"status": "no_domain", "message": "No custom domain configured"}

    status = "verified" if cfg.get("verified") else "pending"
    instructions = {
        "step_1": "Add DNS CNAME record",
        "dns_cname": "CNAME appstores-pink.vercel.app",
        "step_2": "Configure domain in Vercel project settings",
        "step_3": "Wait 5-30 minutes for DNS propagation",
        "step_4": "Contact super-admin to verify the domain using the admin dashboard",
        "docs": "See DOMAIN_SETUP_GUIDE.md for detailed instructions"
    }

    return {
        "status": status,
        "domain": cfg.get("domain"),
        "verified": cfg.get("verified", False),
        "instructions": instructions
    }


# --------------------
# Market prices endpoints (store-configurable)
# --------------------


@api_router.get("/stores/{store_id}/market-prices", response_model=MarketPricesResponse)
async def get_market_prices(store_id: str):
    cfg = await db.store_market_prices.find_one({"store_id": store_id}, {"_id": 0})
    if not cfg:
        # default empty
        return MarketPricesResponse(store_id=store_id, enabled=False, prices={}, updated_at=None)
    return MarketPricesResponse(store_id=cfg.get("store_id"), enabled=cfg.get("enabled", False), prices=cfg.get("prices", {}), updated_at=cfg.get("updated_at"))


@api_router.put("/stores/{store_id}/market-prices", response_model=MarketPricesResponse)
async def update_market_prices(store_id: str, payload: MarketPricesUpdate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    # Store admins can only update their store
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update other stores")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "store_id": store_id,
        "enabled": bool(payload.enabled),
        "prices": payload.prices or {},
        "updated_at": now
    }
    await db.store_market_prices.update_one({"store_id": store_id}, {"$set": doc}, upsert=True)
    return MarketPricesResponse(**doc)

# ==================== USER MANAGEMENT ENDPOINTS ====================

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    # Store admins can only create store users for their store
    if current_user["role"] == UserRole.STORE_ADMIN:
        if user_data.role not in [UserRole.STORE_USER]:
            raise HTTPException(status_code=403, detail="Store admins can only create store users")
        user_data.store_id = current_user["store_id"]
    
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    store_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "store_id": user_data.store_id,
        "is_active": True,
        "created_at": now
    }
        # custom domains are stored in `store_domain_configs` collection
    
    return UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        store_id=user_data.store_id,
        is_active=True,
        created_at=now
    )

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    query = {}
    if current_user["role"] == UserRole.STORE_ADMIN:
        query["store_id"] = current_user["store_id"]
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserCreate, current_user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if current_user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != current_user["store_id"]:
        raise HTTPException(status_code=403, detail="Cannot update users from other stores")
    
    update_data = {
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "store_id": user_data.store_id
    }
    if user_data.password:
        update_data["password_hash"] = hash_password(user_data.password)
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return UserResponse(**updated)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    return {"message": "User deactivated"}

# ==================== PRODUCT ENDPOINTS ====================

@api_router.post("/stores/{store_id}/products", response_model=ProductResponse)
async def create_product(store_id: str, product_data: ProductCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot add products to other stores")
    
    product_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    product_doc = {
        "id": product_id,
        "store_id": store_id,
        **product_data.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    
    await db.products.insert_one(product_doc)
    return product_doc

@api_router.get("/stores/{store_id}/products", response_model=Union[List[ProductResponse], PaginatedProductResponse])
async def get_products(
    store_id: str,
    category: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    featured: Optional[bool] = None,
    limit: int = 100,
    page: Optional[int] = Query(None, ge=1)
):
    query = {"store_id": store_id}
    if active_only:
        query["is_active"] = True
    if category:
        query["category"] = category
    if featured is not None:
        query["featured"] = bool(featured)
    if search:
        # Case-insensitive search on name or description
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]

    # Clamp limit to a safe maximum (100)
    try:
        limit_val = int(limit)
    except Exception:
        limit_val = 100
    limit_val = max(1, min(100, limit_val))

    if page is not None:
        skip = (page - 1) * limit_val
        total = await db.products.count_documents(query)
        products = await db.products.find(query, {"_id": 0}).skip(skip).limit(limit_val).to_list(limit_val)
        
        return PaginatedProductResponse(
            items=[ProductResponse(**p) for p in products],
            total=total,
            page=page,
            limit=limit_val,
            pages=ceil(total / limit_val)
        )
    else:
        products = await db.products.find(query, {"_id": 0}).to_list(limit_val)
        return [ProductResponse(**p) for p in products]

@api_router.get("/stores/{store_id}/products/{product_id}", response_model=ProductResponse)
async def get_product(store_id: str, product_id: str):
    product = await db.products.find_one({"id": product_id, "store_id": store_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse(**product)

@api_router.put("/stores/{store_id}/products/{product_id}", response_model=ProductResponse)
async def update_product(store_id: str, product_id: str, product_data: ProductCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update products from other stores")
    
    await db.products.update_one({"id": product_id, "store_id": store_id}, {"$set": product_data.model_dump()})
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    return ProductResponse(**product)

@api_router.delete("/stores/{store_id}/products/{product_id}")
async def delete_product(store_id: str, product_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot delete products from other stores")
    
    await db.products.update_one({"id": product_id, "store_id": store_id}, {"$set": {"is_active": False}})
    return {"message": "Product deactivated"}

# ==================== INVENTORY ENDPOINTS ====================

@api_router.post("/stores/{store_id}/inventory", response_model=InventoryResponse)
async def create_inventory(store_id: str, inv_data: InventoryCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot manage inventory for other stores")
    
    inv_id = str(ObjectId())
    now = datetime.now(timezone.utc).isoformat()
    inv_doc = {
        "id": inv_id,
        "store_id": store_id,
        **inv_data.model_dump(),
        "updated_at": now
    }
    
    await db.inventory.insert_one(inv_doc)
    return InventoryResponse(**{k: v for k, v in inv_doc.items() if k != "_id"})

@api_router.get("/stores/{store_id}/inventory", response_model=Union[List[InventoryResponse], PaginatedInventoryResponse])
async def get_inventory(store_id: str, page: Optional[int] = Query(None, ge=1), limit: int = Query(100, ge=1, le=1000)):
    # Public endpoint - anyone can view inventory levels for product availability
    query = {"store_id": store_id}
    
    if page is not None:
        skip = (page - 1) * limit
        total = await db.inventory.count_documents(query)
        inventory = await db.inventory.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)

        return PaginatedInventoryResponse(
            items=[InventoryResponse(**inv) for inv in inventory],
            total=total,
            page=page,
            limit=limit,
            pages=ceil(total / limit)
        )
    else:
        inventory = await db.inventory.find(query, {"_id": 0}).to_list(1000)
        return [InventoryResponse(**inv) for inv in inventory]

@api_router.put("/stores/{store_id}/inventory/{inv_id}", response_model=InventoryResponse)
async def update_inventory(store_id: str, inv_id: str, inv_data: InventoryCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update inventory for other stores")

    await db.inventory.update_one(
        {"id": inv_id, "store_id": store_id},
        {"$set": {**inv_data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_inv = await db.inventory.find_one({"id": inv_id, "store_id": store_id}, {"_id": 0})
    if not updated_inv:
        raise HTTPException(status_code=404, detail="Inventory item not found")
        
    return InventoryResponse(**updated_inv)

@api_router.get("/stores/{store_id}/vendors", response_model=Union[List[VendorResponse], PaginatedVendorResponse])
async def get_vendors(
    store_id: str, 
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))
):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view vendors from other stores")
    
    query = {"store_id": store_id, "is_active": True}

    if page is not None:
        skip = (page - 1) * limit
        total = await db.vendors.count_documents(query)
        vendors = await db.vendors.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)

        return PaginatedVendorResponse(
            items=[VendorResponse(**v) for v in vendors],
            total=total,
            page=page,
            limit=limit,
            pages=ceil(total / limit)
        )
    else:
        vendors = await db.vendors.find(query, {"_id": 0}).to_list(1000)
        return [VendorResponse(**v) for v in vendors]

# ==================== VENDOR ENDPOINTS ====================

@api_router.post("/stores/{store_id}/vendors", response_model=VendorResponse)
async def create_vendor(store_id: str, vendor_data: VendorCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot add vendors to other stores")
    
    vendor_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    vendor_doc = {
        "id": vendor_id,
        "store_id": store_id,
        **vendor_data.model_dump(),
        "is_active": True,
        "created_at": now
    }
    
    await db.vendors.insert_one(vendor_doc)
    return VendorResponse(**{k: v for k, v in vendor_doc.items() if k != "_id"})

@api_router.put("/stores/{store_id}/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(store_id: str, vendor_id: str, vendor_data: VendorCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update vendors from other stores")
    
    await db.vendors.update_one({"id": vendor_id, "store_id": store_id}, {"$set": vendor_data.model_dump()})
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    return VendorResponse(**vendor)

@api_router.delete("/stores/{store_id}/vendors/{vendor_id}")
async def delete_vendor(store_id: str, vendor_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot delete vendors from other stores")
    
    await db.vendors.update_one({"id": vendor_id, "store_id": store_id}, {"$set": {"is_active": False}})
    return {"message": "Vendor deleted"}

@api_router.get("/stores/{store_id}/purchase-orders", response_model=Union[List[PurchaseOrderResponse], PaginatedPurchaseOrderResponse])
async def get_purchase_orders(
    store_id: str, 
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))
):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view POs from other stores")
    
    query = {"store_id": store_id}

    if page is not None:
        skip = (page - 1) * limit
        total = await db.purchase_orders.count_documents(query)
        pos = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

        return PaginatedPurchaseOrderResponse(
            items=[PurchaseOrderResponse(**po) for po in pos],
            total=total,
            page=page,
            limit=limit,
            pages=ceil(total / limit)
        )
    else:
        pos = await db.purchase_orders.find(query, {"_id": 0}).to_list(1000)
        return [PurchaseOrderResponse(**po) for po in pos]

# ==================== PURCHASE ORDER ENDPOINTS ====================

@api_router.post("/stores/{store_id}/purchase-orders", response_model=PurchaseOrderResponse)
async def create_purchase_order(store_id: str, po_data: PurchaseOrderCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot create PO for other stores")
    
    po_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    items = [item.model_dump() for item in po_data.items]
    total = sum(item["quantity"] * item["unit_price"] for item in items)
    
    po_doc = {
        "id": po_id,
        "store_id": store_id,
        "vendor_id": po_data.vendor_id,
        "items": items,
        "total_amount": total,
        "status": "pending",
        "notes": po_data.notes,
        "created_at": now
    }
    
    await db.purchase_orders.insert_one(po_doc)
    return PurchaseOrderResponse(**{k: v for k, v in po_doc.items() if k != "_id"})

@api_router.put("/stores/{store_id}/purchase-orders/{po_id}/status")
async def update_po_status(store_id: str, po_id: str, status: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update POs from other stores")
    
    await db.purchase_orders.update_one({"id": po_id, "store_id": store_id}, {"$set": {"status": status}})
    return {"message": "PO status updated"}

# ==================== POS TRANSACTION ENDPOINTS ====================

@api_router.post("/stores/{store_id}/pos-transactions", response_model=POSTransactionResponse)
async def create_pos_transaction(store_id: str, pos_data: POSTransactionCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot create transactions for other stores")
    
    tx_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    items = [item.model_dump() for item in pos_data.items]
    total = sum(item["quantity"] * item["price"] for item in items)
    
    tx_doc = {
        "id": tx_id,
        "store_id": store_id,
        "items": items,
        "total_amount": total,
        "payment_method": pos_data.payment_method,
        "customer_name": pos_data.customer_name,
        "customer_phone": pos_data.customer_phone,
        "created_at": now
    }
    
    await db.pos_transactions.insert_one(tx_doc)
    return POSTransactionResponse(**{k: v for k, v in tx_doc.items() if k != "_id"})

@api_router.get("/stores/{store_id}/pos-transactions", response_model=Union[List[POSTransactionResponse], PaginatedPOSTransactionResponse])
async def get_pos_transactions(
    store_id: str, 
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))
):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view transactions from other stores")
    
    query = {"store_id": store_id}

    if page is not None:
        skip = (page - 1) * limit
        total = await db.pos_transactions.count_documents(query)
        txs = await db.pos_transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

        return PaginatedPOSTransactionResponse(
            items=[POSTransactionResponse(**tx) for tx in txs],
            total=total,
            page=page,
            limit=limit,
            pages=ceil(total / limit)
        )
    else:
        txs = await db.pos_transactions.find(query, {"_id": 0}).to_list(1000)
        return [POSTransactionResponse(**tx) for tx in txs]

@api_router.put("/stores/{store_id}/pos-transactions/{tx_id}", response_model=POSTransactionResponse)
async def update_pos_transaction(store_id: str, tx_id: str, pos_data: POSTransactionCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update transactions for other stores")
    
    items = [item.model_dump() for item in pos_data.items]
    total = sum(item["quantity"] * item["price"] for item in items)
    
    update_data = {
        "items": items,
        "total_amount": total,
        "payment_method": pos_data.payment_method,
        "customer_name": pos_data.customer_name,
        "customer_phone": pos_data.customer_phone
    }
    
    await db.pos_transactions.update_one({"id": tx_id, "store_id": store_id}, {"$set": update_data})
    tx = await db.pos_transactions.find_one({"id": tx_id}, {"_id": 0})
    return POSTransactionResponse(**tx)

@api_router.delete("/stores/{store_id}/pos-transactions/{tx_id}")
async def delete_pos_transaction(store_id: str, tx_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot delete transactions for other stores")
    
    await db.pos_transactions.delete_one({"id": tx_id, "store_id": store_id})
    return {"message": "Transaction deleted"}

@api_router.put("/stores/{store_id}/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(store_id: str, po_id: str, po_data: PurchaseOrderCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update POs for other stores")
    
    items = [item.model_dump() for item in po_data.items]
    total = sum(float(item["quantity"]) * float(item["unit_price"]) for item in items)
    
    update_data = {
        "vendor_id": po_data.vendor_id,
        "items": items,
        "total_amount": total,
        "notes": po_data.notes
    }
    
    await db.purchase_orders.update_one({"id": po_id, "store_id": store_id}, {"$set": update_data})
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    return PurchaseOrderResponse(**po)

@api_router.delete("/stores/{store_id}/purchase-orders/{po_id}")
async def delete_purchase_order(store_id: str, po_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot delete POs for other stores")
    
    await db.purchase_orders.delete_one({"id": po_id, "store_id": store_id})
    return {"message": "Purchase order deleted"}

# ==================== REPORTING ENDPOINTS ====================

@api_router.get("/stores/{store_id}/reports")
async def get_store_reports(store_id: str, start_date: str = None, end_date: str = None, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view reports for other stores")
    
    # Build date filter
    date_filter = {"store_id": store_id}
    if start_date:
        date_filter["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in date_filter:
            date_filter["created_at"]["$lte"] = end_date
        else:
            date_filter["created_at"] = {"$lte": end_date}

    # Calculate Total Sales (Online Orders)
    pipeline = [
        {"$match": date_filter},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    cursor = db.orders.aggregate(pipeline)
    result = await cursor.to_list(length=1)
    online_sales = result[0]["total"] if result else 0.0

    # Calculate POS Sales
    pos_pipeline = [
        {"$match": date_filter},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    cursor = db.pos_transactions.aggregate(pos_pipeline)
    res = await cursor.to_list(length=1)
    pos_sales = res[0]["total"] if res else 0.0
    
    return {
        "total_sales": online_sales + pos_sales,
        "online_sales": online_sales,
        "pos_sales": pos_sales
    }

@api_router.get("/stores/{store_id}/staff", response_model=Union[List[StaffResponse], PaginatedStaffResponse])
async def get_store_staff(
    store_id: str, 
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))
):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view staff for other stores")
    
    query = {"store_id": store_id, "role": UserRole.STORE_USER}

    if page is not None:
        skip = (page - 1) * limit
        total = await db.users.count_documents(query)
        staff = await db.users.find(query, {"_id": 0, "hashed_password": 0}).skip(skip).limit(limit).to_list(limit)

        return PaginatedStaffResponse(
            items=[StaffResponse(**s) for s in staff],
            total=total,
            page=page,
            limit=limit,
            pages=ceil(total / limit)
        )
    else:
        staff = await db.users.find(query, {"_id": 0, "hashed_password": 0}).to_list(1000)
        return [StaffResponse(**s) for s in staff]
    # Get purchase orders (expenditures)
    po_filter = {"store_id": store_id}
    if start_date:
        po_filter["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in po_filter:
            po_filter["created_at"]["$lte"] = end_date
        else:
            po_filter["created_at"] = {"$lte": end_date}
    
    purchase_orders = await db.purchase_orders.find(po_filter, {"_id": 0}).to_list(10000)
    total_expenditures = sum(po.get("total_amount", 0) for po in purchase_orders)
    
    # Get unique customers (users who placed orders)
    unique_customers = len(set(o.get("user_id") for o in orders if o.get("user_id")))
    
    # Get subscriptions
    sub_filter = {"store_id": store_id}
    if start_date:
        sub_filter["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in sub_filter:
            sub_filter["created_at"]["$lte"] = end_date
        else:
            sub_filter["created_at"] = {"$lte": end_date}
    
    subscriptions = await db.user_subscriptions.find(sub_filter, {"_id": 0}).to_list(10000)
    total_subscribers = len(subscriptions)
    subscription_revenue = sum(s.get("total_paid", 0) for s in subscriptions)
    
    return {
        "total_sales": total_sales + pos_sales,
        "online_sales": total_sales,
        "pos_sales": pos_sales,
        "total_orders": total_orders,
        "total_pos_transactions": len(pos_txs),
        "total_expenditures": total_expenditures,
        "total_customers": unique_customers,
        "total_subscribers": total_subscribers,
        "subscription_revenue": subscription_revenue,
        "net_profit": (total_sales + pos_sales + subscription_revenue) - total_expenditures,
        "period": {
            "start": start_date,
            "end": end_date
        }
    }

# ==================== STAFF MANAGEMENT ENDPOINTS ====================

@api_router.get("/stores/{store_id}/staff")
async def get_store_staff(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view staff for other stores")
    
    staff = await db.users.find(
        {"store_id": store_id, "role": UserRole.STORE_USER},
        {"_id": 0, "hashed_password": 0}
    ).to_list(1000)
    
    return staff

@api_router.post("/stores/{store_id}/staff")
async def create_staff(store_id: str, staff_data: StaffCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot create staff for other stores")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": staff_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    now = datetime.now(timezone.utc).isoformat()
    staff_doc = {
        "id": str(uuid.uuid4()),
        "email": staff_data.email,
        "password_hash": hash_password(staff_data.password),
        "name": staff_data.name,
        "phone": staff_data.phone,
        "role": UserRole.STORE_USER,
        "store_id": store_id,
        "menu_access": staff_data.menu_access or ["products", "inventory", "orders", "pos"],
        "is_active": True,
        "created_at": now
    }
    
    await db.users.insert_one(staff_doc)
    
    # Log activity
    try:
        await log_activity(user["id"], store_id, "staff_created", {"staff_id": staff_doc["id"], "staff_name": staff_data.name})
    except Exception:
        pass  # Don't fail if logging fails
    
    del staff_doc["password_hash"]
    return staff_doc

@api_router.put("/stores/{store_id}/staff/{staff_id}")
async def update_staff(store_id: str, staff_id: str, staff_data: StaffUpdate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update staff for other stores")
    
    update_data = {}
    if staff_data.name is not None:
        update_data["name"] = staff_data.name
    if staff_data.phone is not None:
        update_data["phone"] = staff_data.phone
    if staff_data.menu_access is not None:
        update_data["menu_access"] = staff_data.menu_access
    if staff_data.is_active is not None:
        update_data["is_active"] = staff_data.is_active
        
    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided to update")
        
    await db.users.update_one({"id": staff_id, "store_id": store_id}, {"$set": update_data})
    
    updated_staff = await db.users.find_one({"id": staff_id}, {"_id": 0, "hashed_password": 0})
    if not updated_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
        
    return StaffResponse(**updated_staff)

@api_router.get("/stores/{store_id}/customers", response_model=Union[List[CustomerResponse], PaginatedCustomerResponse])
async def get_store_customers(
    store_id: str, 
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))
):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view customers for other stores")
    
    # Get all unique customer IDs from orders and subscriptions
    pipeline = [
        {"$match": {"store_id": store_id}},
        {"$group": {"_id": "$user_id"}}
    ]
    
    order_users = await db.orders.aggregate(pipeline).to_list(10000)
    sub_users = await db.user_subscriptions.aggregate(pipeline).to_list(10000)
    
    customer_ids = set()
    for u in order_users:
        if u.get("_id"):
            customer_ids.add(u["_id"])
    for u in sub_users:
        if u.get("_id"):
            customer_ids.add(u["_id"])
            
    customer_ids_list = list(customer_ids)
    
    if page is not None:
        total = len(customer_ids)
        start = (page - 1) * limit
        end = start + limit
        paged_ids = customer_ids_list[start:end]
        
        users_list = []
        if paged_ids:
             users_list = await db.users.find({"id": {"$in": paged_ids}}, {"_id": 0}).to_list(len(paged_ids))

        # We need to fill in stats for these users
        results = []
        for u in users_list:
            u_id = u["id"]
            # Stats for this specific user in this store
            o_count = await db.orders.count_documents({"store_id": store_id, "user_id": u_id})
            # To get sum, we need aggregation or just sum in python for this page (efficient enough for 20 users)
            o_sum_cur = await db.orders.aggregate([
                {"$match": {"store_id": store_id, "user_id": u_id}},
                {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
            ]).to_list(1)
            spent = o_sum_cur[0]["total"] if o_sum_cur else 0
            
            s_count = await db.user_subscriptions.count_documents({"store_id": store_id, "user_id": u_id})
            
            results.append(CustomerResponse(
                **u,
                order_count=o_count,
                total_spent=spent,
                subscription_count=s_count
            ))

        return PaginatedCustomerResponse(
            items=results,
            total=total,
            page=page,
            limit=limit,
            pages=ceil(total / limit)
        )
    else:
        # Fallback to old inefficient method (but clamped)
        # For simplicity in this non-paginated path, we limit to 100 to avoid crash
        top_ids = customer_ids_list[:100]
        users_list = await db.users.find({"id": {"$in": top_ids}}, {"_id": 0}).to_list(100)
        results = []
        for u in users_list:
            u_id = u["id"]
            o_count = await db.orders.count_documents({"store_id": store_id, "user_id": u_id})
            o_sum_cur = await db.orders.aggregate([
                {"$match": {"store_id": store_id, "user_id": u_id}},
                {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
            ]).to_list(1)
            spent = o_sum_cur[0]["total"] if o_sum_cur else 0
            s_count = await db.user_subscriptions.count_documents({"store_id": store_id, "user_id": u_id})
            results.append(CustomerResponse(
                **u,
                order_count=o_count,
                total_spent=spent,
                subscription_count=s_count
            ))
        return results


@api_router.delete("/stores/{store_id}/staff/{staff_id}")
async def delete_staff(store_id: str, staff_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot delete staff for other stores")
    
    result = await db.users.delete_one({"id": staff_id, "store_id": store_id, "role": UserRole.STORE_USER})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Log activity
    await log_activity(user["id"], store_id, "staff_deleted", {"staff_id": staff_id})
    
    return {"message": "Staff deleted successfully"}

@api_router.get("/stores/{store_id}/staff/{staff_id}/activity")
async def get_staff_activity(store_id: str, staff_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view activity for other stores")
    
    # Get activity logs for the staff member
    activities = await db.activity_logs.find(
        {"user_id": staff_id, "store_id": store_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get POS transactions by staff
    pos_transactions = await db.pos_transactions.find(
        {"store_id": store_id, "created_by": staff_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "activity_logs": activities,
        "pos_transactions": pos_transactions
    }

async def log_activity(user_id: str, store_id: str, action: str, details: dict = None):
    """Helper function to log user activity"""
    log_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "store_id": store_id,
        "action": action,
        "details": details or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log_doc)

# ==================== CUSTOMER MANAGEMENT ENDPOINTS ====================

@api_router.get("/stores/{store_id}/customers")
async def get_store_customers(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view customers for other stores")
    
    # Get all unique customer IDs from orders and subscriptions for this store
    orders = await db.orders.find({"store_id": store_id}, {"_id": 0, "user_id": 1, "total_amount": 1}).to_list(10000)
    subscriptions = await db.user_subscriptions.find({"store_id": store_id}, {"_id": 0, "user_id": 1}).to_list(10000)
    
    customer_ids = set()
    for o in orders:
        if o.get("user_id"):
            customer_ids.add(o["user_id"])
    for s in subscriptions:
        if s.get("user_id"):
            customer_ids.add(s["user_id"])
    
    # Get customer details
    customers = []
    for customer_id in customer_ids:
        customer = await db.users.find_one({"id": customer_id}, {"_id": 0, "hashed_password": 0})
        if customer:
            # Calculate stats
            user_orders = [o for o in orders if o.get("user_id") == customer_id]
            user_subscriptions = [s for s in subscriptions if s.get("user_id") == customer_id]
            
            customer["order_count"] = len(user_orders)
            customer["total_spent"] = sum(o.get("total_amount", 0) for o in user_orders)
            customer["subscription_count"] = len(user_subscriptions)
            customers.append(customer)
    
    return customers

@api_router.get("/stores/{store_id}/customers/{customer_id}")
async def get_customer_details(store_id: str, customer_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view customer for other stores")
    
    customer = await db.users.find_one({"id": customer_id}, {"_id": 0, "hashed_password": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get orders
    orders = await db.orders.find(
        {"store_id": store_id, "user_id": customer_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get subscriptions
    subscriptions = await db.user_subscriptions.find(
        {"store_id": store_id, "user_id": customer_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get subscription plans info
    plan_ids = [s.get("plan_id") for s in subscriptions if s.get("plan_id")]
    plans = await db.subscription_plans.find({"id": {"$in": plan_ids}}, {"_id": 0}).to_list(100)
    plan_map = {p["id"]: p for p in plans}
    
    for sub in subscriptions:
        if sub.get("plan_id") and sub["plan_id"] in plan_map:
            sub["plan_name"] = plan_map[sub["plan_id"]].get("name", "Unknown Plan")
    
    # Get payments
    payments = await db.payments.find(
        {"user_id": customer_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "customer": customer,
        "orders": orders,
        "subscriptions": subscriptions,
        "payments": payments
    }

@api_router.put("/stores/{store_id}/customers/{customer_id}")
async def update_customer(store_id: str, customer_id: str, update_data: dict, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update customer for other stores")
    
    # Only allow updating certain fields
    allowed_fields = ["name", "phone", "is_active"]
    filtered_data = {k: v for k, v in update_data.items() if k in allowed_fields and v is not None}
    
    if not filtered_data:
        raise HTTPException(status_code=400, detail="No valid data to update")
    
    result = await db.users.update_one({"id": customer_id}, {"$set": filtered_data})
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"message": "Customer updated successfully"}

@api_router.delete("/stores/{store_id}/customers/{customer_id}")
async def delete_customer(store_id: str, customer_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] != UserRole.SUPER_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot delete customer for other stores")
    
    # Check if customer exists
    customer = await db.users.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Delete user and related data
    await db.users.delete_one({"id": customer_id})
    
    # Log activity
    await log_activity(user["id"], store_id, "customer_deleted", {"customer_id": customer_id})
    
    return {"message": "Customer deleted successfully"}

# ==================== ORDER ENDPOINTS ====================

async def get_next_order_id(store_id: Optional[str] = None):
    """Generate incrementing order ID with store-specific 3-char prefix.

    If `store_id` is provided, use the store's `order_prefix` (default "VEL").
    The numeric counter is shared globally to keep unique sequence numbers.
    """
    # Global counter (shared)
    counter = await db.counters.find_one_and_update(
        {"_id": "order_counter"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    seq = counter.get("seq", 1)

    # Default prefix
    prefix = "VEL"
    if store_id:
        try:
            store = await db.stores.find_one({"id": store_id}, {"_id": 0})
            if store and store.get("order_prefix"):
                prefix = store.get("order_prefix")
        except Exception:
            pass

    return f"{prefix}{seq:015d}"

@api_router.post("/stores/{store_id}/orders", response_model=OrderResponse)
async def create_order(store_id: str, order_data: OrderCreate, user: dict = Depends(get_current_user)):
    order_id = await get_next_order_id(store_id)
    now = datetime.now(timezone.utc).isoformat()
    
    # Get shipping address
    address = await db.addresses.find_one({"id": order_data.shipping_address_id, "user_id": user["id"]}, {"_id": 0})
    if not address:
        raise HTTPException(status_code=400, detail="Invalid shipping address")
    
    items = []
    total = 0
    for item in order_data.items:
        product = await db.products.find_one({"id": item.product_id, "store_id": store_id}, {"_id": 0})
        if product:
            items.append({
                "product_id": item.product_id,
                "product_name": product["name"],
                "quantity": item.quantity,
                "price": item.price
            })
            total += item.quantity * item.price
    
# Calculate Shipping - Use explicit charge if provided (calculated by frontend), else calculate again
    shipping_charges = order_data.shipping_charges if order_data.shipping_charges is not None else 0.0
    
    # Optional: Re-calculate if security demands, but for now we trust the frontend calculation + display
    ship_config = await db.store_shipping_config.find_one({"store_id": store_id}) 
    if shipping_charges == 0 and ship_config and ship_config.get("is_enabled"):
        pickup_zip = ship_config.get("pickup_pincode")
        dest_zip = address.get("postal_code")
        
        if pickup_zip and dest_zip and ship_config.get("email") and ship_config.get("password"):
            try:
                # Calculate approx weight (Weights in DB are in grams)
                total_weight_grams = 0.0
                for item in order_data.items:
                     prod = await db.products.find_one({"id": item.product_id})
                     w = prod.get("weight") if prod else 0
                     if w: total_weight_grams += (float(w) * item.quantity)
                
                # Convert to KG for Shiprocket
                total_weight_kg = total_weight_grams / 1000.0
                
                # If weight is 0 or tiny, assume 0.5kg
                if total_weight_kg < 0.5: total_weight_kg = 0.5
                
                try:
                    res = {}
                    await log_shiprocket(store_id, "token_request", "pending", {"email": ship_config["email"]})
                    token = await get_shiprocket_token(ship_config["email"], ship_config["password"])
                    await log_shiprocket(store_id, "token_request", "success")

                    # Serviceability Check
                    res = await check_serviceability(token, pickup_zip, dest_zip, total_weight_kg)
                    
                    if res and res.get("status") == 200 and res.get("data") and res.get("data").get("available_courier_companies"):
                        couriers = res.get("data").get("available_courier_companies")
                        if couriers:
                            # Select lowest rate
                            best = min(couriers, key=lambda x: x.get("rate"))
                            shipping_charges = float(best.get("rate"))
                            await log_shiprocket(store_id, "serviceability_check", "success", response=res)
                        else:
                            await log_shiprocket(store_id, "serviceability_check", "failed", error="No rate found", response=res)
                    else:
                        await log_shiprocket(store_id, "serviceability_check", "failed", error="API Check Failed", response=res)

                except Exception as e:
                    logger.error(f"Shiprocket error in create_order: {e}")
                    await log_shiprocket(store_id, "shipping_init_error", "error", error=str(e))
                    shipping_charges = 0.0

            except Exception as e:
                logger.error(f"Shipping calc error: {e}")
                shipping_charges = 0.0

    total += shipping_charges

    order_doc = {
        "id": order_id,
        "store_id": store_id,
        "user_id": user["id"],
        "items": items,
        "shipping_address_id": order_data.shipping_address_id, # Store ID reference
        "shipping_address": address, # Snapshot
        "total_amount": total,
        "shipping_charges": shipping_charges,
        "status": "pending",
        "tracking_number": None,
        "carrier_name": None,
        "carrier_url": None,
        "notes": order_data.notes,
        "created_at": now,
        "updated_at": now
    }
    
    await db.orders.insert_one(order_doc)
    return OrderResponse(**{k: v for k, v in order_doc.items() if k != "_id"})

@api_router.get("/stores/{store_id}/orders", response_model=Union[List[OrderResponse], PaginatedOrderResponse])
async def get_orders(
    store_id: str, 
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    if user["role"] == UserRole.END_USER:
        query = {"store_id": store_id, "user_id": user["id"]}
    elif user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER]:
        if user.get("store_id") != store_id:
            raise HTTPException(status_code=403, detail="Cannot view orders from other stores")
        query = {"store_id": store_id}
    else:
        query = {"store_id": store_id}
    
    if page is not None:
        skip = (page - 1) * limit
        total = await db.orders.count_documents(query)
        orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        return PaginatedOrderResponse(
            items=[OrderResponse(**o) for o in orders],
            total=total,
            page=page,
            limit=limit,
            pages=ceil(total / limit)
        )
    else:
        orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return [OrderResponse(**o) for o in orders]

@api_router.get("/my-orders", response_model=PaginatedOrderResponse)
async def get_my_orders(page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    skip = (page - 1) * limit
    cursor = db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    total = await db.orders.count_documents({"user_id": user["id"]})
    orders = await cursor.skip(skip).limit(limit).to_list(length=limit)
    
    return PaginatedOrderResponse(
        items=[OrderResponse(**o) for o in orders],
        total=total,
        page=page,
        limit=limit,
        pages=(total + limit - 1) // limit
    )

@api_router.put("/stores/{store_id}/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(store_id: str, order_id: str, status_data: OrderStatusUpdate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update orders from other stores")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"status": status_data.status, "updated_at": now}
    if status_data.tracking_number is not None:
        update_data["tracking_number"] = status_data.tracking_number
    if status_data.carrier_name is not None:
        update_data["carrier_name"] = status_data.carrier_name
    if status_data.carrier_url is not None:
        update_data["carrier_url"] = status_data.carrier_url
    
    await db.orders.update_one({"id": order_id, "store_id": store_id}, {"$set": update_data})
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return OrderResponse(**order)

# ==================== ADDRESS ENDPOINTS ====================

@api_router.post("/addresses", response_model=AddressResponse)
async def create_address(address_data: AddressCreate, user: dict = Depends(get_current_user)):
    addr_id = str(uuid.uuid4())
    
    # If this is default, unset other defaults
    if address_data.is_default:
        await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    
    addr_doc = {
        "id": addr_id,
        "user_id": user["id"],
        **address_data.model_dump()
    }
    
    await db.addresses.insert_one(addr_doc)
    return AddressResponse(**{k: v for k, v in addr_doc.items() if k != "_id"})

@api_router.get("/addresses", response_model=List[AddressResponse])
async def get_addresses(user: dict = Depends(get_current_user)):
    addresses = await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return [AddressResponse(**a) for a in addresses]

@api_router.put("/addresses/{addr_id}", response_model=AddressResponse)
async def update_address(addr_id: str, address_data: AddressCreate, user: dict = Depends(get_current_user)):
    if address_data.is_default:
        await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    
    await db.addresses.update_one({"id": addr_id, "user_id": user["id"]}, {"$set": address_data.model_dump()})
    addr = await db.addresses.find_one({"id": addr_id}, {"_id": 0})
    return AddressResponse(**addr)

@api_router.delete("/addresses/{addr_id}")
async def delete_address(addr_id: str, user: dict = Depends(get_current_user)):
    await db.addresses.delete_one({"id": addr_id, "user_id": user["id"]})
    return {"message": "Address deleted"}

# ==================== CART ENDPOINTS ====================

async def enrich_cart_with_tax(cart: dict, store_id: str):
    if not cart or not cart.get("items"):
        cart["total_tax"] = 0.0
        return cart

    # Fetch Tax Config
    tax_config = await db.tax_configs.find_one({"store_id": store_id})
    if not tax_config:
        cart["total_tax"] = 0.0
        return cart

    # Fetch Products
    product_ids = [item["product_id"] for item in cart["items"]]
    products = await db.products.find({"id": {"$in": product_ids}}).to_list(100)
    product_map = {p["id"]: p for p in products}

    total_tax = 0.0
    
    for item in cart["items"]:
        product = product_map.get(item["product_id"])
        if not product:
            continue
            
        rate_cgst = 0.0
        rate_igst = 0.0
        
        # 1. Check Metal Tax
        metal_tax = next((m for m in tax_config.get("metal_taxes", []) if m["metal"] == product.get("metal_type") and m["is_enabled"]), None)
        
        if metal_tax:
            rate_cgst = metal_tax["tax_rate"]["cgst"]
            rate_igst = metal_tax["tax_rate"]["igst"]
        else:
            # 2. Check Category Tax
            cat_tax = next((c for c in tax_config.get("category_taxes", []) if c["category"] == product.get("category")), None)
            if cat_tax:
                rate_cgst = cat_tax["tax_rate"]["cgst"]
                rate_igst = cat_tax["tax_rate"]["igst"]
        
        line_total = item["price"] * item["quantity"]
        tax_cgst = line_total * (rate_cgst / 100)
        tax_igst = line_total * (rate_igst / 100)
        
        item["tax_info"] = {
            "cgst": tax_cgst,
            "igst": tax_igst,
            "rate_cgst": rate_cgst,
            "rate_igst": rate_igst
        }
        total_tax += (tax_cgst + tax_igst)
        
    cart["total_tax"] = total_tax
    return cart

@api_router.post("/stores/{store_id}/cart", response_model=CartResponse)
async def get_or_create_cart(store_id: str, session_id: Optional[str] = Query(None), user: dict = Depends(get_optional_user)):
    """Get or create a cart for the user or session"""
    now = datetime.now(timezone.utc).isoformat()
    
    if user:
        # Logged-in user cart
        cart = await db.carts.find_one({"store_id": store_id, "user_id": user["id"]}, {"_id": 0})
        if not cart:
            cart_id = str(uuid.uuid4())
            cart_doc = {
                "id": cart_id,
                "store_id": store_id,
                "user_id": user["id"],
                "session_id": None,
                "items": [],
                "created_at": now,
                "updated_at": now
            }
            await db.carts.insert_one(cart_doc)
            cart = cart_doc
    else:
        # Guest cart via session
        if not session_id:
            session_id = str(uuid.uuid4())
        cart = await db.carts.find_one({"store_id": store_id, "session_id": session_id}, {"_id": 0})
        if not cart:
            cart_id = str(uuid.uuid4())
            cart_doc = {
                "id": cart_id,
                "store_id": store_id,
                "user_id": None,
                "session_id": session_id,
                "items": [],
                "created_at": now,
                "updated_at": now
            }
            await db.carts.insert_one(cart_doc)
            cart = cart_doc
    
    return CartResponse(**cart)

@api_router.get("/stores/{store_id}/cart", response_model=CartResponse)
async def get_cart(store_id: str, session_id: Optional[str] = Query(None), user: dict = Depends(get_optional_user)):
    """Get cart for user or session"""
    if user:
        cart = await db.carts.find_one({"store_id": store_id, "user_id": user["id"]}, {"_id": 0})
    else:
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required for guest")
        cart = await db.carts.find_one({"store_id": store_id, "session_id": session_id}, {"_id": 0})
    
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    await enrich_cart_with_tax(cart, store_id)
    return CartResponse(**cart)

@api_router.post("/stores/{store_id}/cart/items", response_model=CartResponse)
async def add_cart_item(store_id: str, item_data: CartItemCreate, session_id: Optional[str] = Query(None), user: dict = Depends(get_optional_user)):
    """Add item to cart"""
    now = datetime.now(timezone.utc).isoformat()
    
    if user:
        cart = await db.carts.find_one({"store_id": store_id, "user_id": user["id"]}, {"_id": 0})
    else:
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required for guest")
        cart = await db.carts.find_one({"store_id": store_id, "session_id": session_id}, {"_id": 0})
    
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    # Check if item already in cart, if so update quantity
    existing_item = next((it for it in cart.get("items", []) if it["product_id"] == item_data.product_id), None)
    
    if existing_item:
        existing_item["quantity"] += item_data.quantity
    else:
        new_item = {
            "id": str(uuid.uuid4()),
            "product_id": item_data.product_id,
            "quantity": item_data.quantity,
            "price": item_data.price
        }
        if "items" not in cart:
            cart["items"] = []
        cart["items"].append(new_item)
    
    await db.carts.update_one(
        {"id": cart["id"]},
        {"$set": {"items": cart["items"], "updated_at": now}}
    )
    
    cart["updated_at"] = now
    await enrich_cart_with_tax(cart, store_id)
    return CartResponse(**cart)

@api_router.put("/stores/{store_id}/cart/items/{item_id}", response_model=CartResponse)
async def update_cart_item(store_id: str, item_id: str, update_data: CartItemUpdate, session_id: Optional[str] = Query(None), user: dict = Depends(get_optional_user)):
    """Update item quantity in cart"""
    now = datetime.now(timezone.utc).isoformat()
    quantity = update_data.quantity
    
    if user:
        cart = await db.carts.find_one({"store_id": store_id, "user_id": user["id"]}, {"_id": 0})
    else:
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required for guest")
        cart = await db.carts.find_one({"store_id": store_id, "session_id": session_id}, {"_id": 0})
    
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    item = next((it for it in cart.get("items", []) if it["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not in cart")
    
    if quantity <= 0:
        cart["items"] = [it for it in cart["items"] if it["id"] != item_id]
    else:
        item["quantity"] = quantity
    
    await db.carts.update_one(
        {"id": cart["id"]},
        {"$set": {"items": cart["items"], "updated_at": now}}
    )
    
    cart["updated_at"] = now
    await enrich_cart_with_tax(cart, store_id)
    return CartResponse(**cart)

@api_router.delete("/stores/{store_id}/cart/items/{item_id}", response_model=CartResponse)
async def remove_cart_item(store_id: str, item_id: str, session_id: Optional[str] = Query(None), user: dict = Depends(get_optional_user)):
    """Remove item from cart"""
    now = datetime.now(timezone.utc).isoformat()
    
    if user:
        cart = await db.carts.find_one({"store_id": store_id, "user_id": user["id"]}, {"_id": 0})
    else:
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required for guest")
        cart = await db.carts.find_one({"store_id": store_id, "session_id": session_id}, {"_id": 0})
    
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart["items"] = [it for it in cart.get("items", []) if it["id"] != item_id]
    
    await db.carts.update_one(
        {"id": cart["id"]},
        {"$set": {"items": cart["items"], "updated_at": now}}
    )
    
    cart["updated_at"] = now
    await enrich_cart_with_tax(cart, store_id)
    return CartResponse(**cart)

@api_router.post("/stores/{store_id}/cart/merge")
async def merge_guest_cart_to_user(store_id: str, merge_data: CartMergeRequest, user: dict = Depends(get_current_user)):
    """Migrate guest cart items to user cart on login"""
    session_id = merge_data.session_id
    guest_cart = await db.carts.find_one({"store_id": store_id, "session_id": session_id}, {"_id": 0})
    user_cart = await db.carts.find_one({"store_id": store_id, "user_id": user["id"]}, {"_id": 0})
    
    if not user_cart:
        now = datetime.now(timezone.utc).isoformat()
        cart_id = str(uuid.uuid4())
        user_cart = {
            "id": cart_id,
            "store_id": store_id,
            "user_id": user["id"],
            "session_id": None,
            "items": [],
            "created_at": now,
            "updated_at": now
        }
        await db.carts.insert_one(user_cart)
    
    if guest_cart and guest_cart.get("items"):
        for guest_item in guest_cart["items"]:
            existing = next((it for it in user_cart.get("items", []) if it["product_id"] == guest_item["product_id"]), None)
            if existing:
                existing["quantity"] += guest_item["quantity"]
            else:
                user_cart["items"].append(guest_item)
        
        now = datetime.now(timezone.utc).isoformat()
        await db.carts.update_one(
            {"id": user_cart["id"]},
            {"$set": {"items": user_cart["items"], "updated_at": now}}
        )
        
        # Delete guest cart
        await db.carts.delete_one({"id": guest_cart["id"]})
    
    await enrich_cart_with_tax(user_cart, store_id)
    return CartResponse(**user_cart)

@api_router.delete("/stores/{store_id}/cart")
async def clear_cart(store_id: str, session_id: Optional[str] = Query(None), user: dict = Depends(get_optional_user)):
    """Clear all items from cart"""
    now = datetime.now(timezone.utc).isoformat()
    
    if user:
        cart = await db.carts.find_one({"store_id": store_id, "user_id": user["id"]}, {"_id": 0})
    else:
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required for guest")
        cart = await db.carts.find_one({"store_id": store_id, "session_id": session_id}, {"_id": 0})
    
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    await db.carts.update_one(
        {"id": cart["id"]},
        {"$set": {"items": [], "updated_at": now}}
    )
    
    cart["items"] = []
    cart["updated_at"] = now
    await enrich_cart_with_tax(cart, store_id)
    return CartResponse(**cart)

# ==================== SUBSCRIPTION PLAN ENDPOINTS ====================

@api_router.post("/stores/{store_id}/subscription-plans", response_model=SubscriptionPlanResponse)
async def create_subscription_plan(store_id: str, plan_data: SubscriptionPlanCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot create plans for other stores")
    
    plan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    plan_doc = {
        "id": plan_id,
        "store_id": store_id,
        **plan_data.model_dump(),
        "created_at": now
    }
    
    await db.subscription_plans.insert_one(plan_doc)
    return SubscriptionPlanResponse(**{k: v for k, v in plan_doc.items() if k != "_id"})

@api_router.get("/stores/{store_id}/subscription-plans", response_model=List[SubscriptionPlanResponse])
async def get_subscription_plans(store_id: str):
    plans = await db.subscription_plans.find({"store_id": store_id, "is_active": True, "is_enabled": {"$ne": False}}, {"_id": 0}).to_list(100)
    return [SubscriptionPlanResponse(**p) for p in plans]

@api_router.put("/stores/{store_id}/subscription-plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_subscription_plan(store_id: str, plan_id: str, plan_data: SubscriptionPlanCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update plans for other stores")
    
    existing = await db.subscription_plans.find_one({"id": plan_id, "store_id": store_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    update_data = plan_data.model_dump()
    await db.subscription_plans.update_one({"id": plan_id}, {"$set": update_data})
    
    updated = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    return SubscriptionPlanResponse(**updated)

# Store Admin - Toggle subscription plan enabled/disabled status
@api_router.put("/stores/{store_id}/subscription-plans/{plan_id}/toggle-enabled")
async def toggle_subscription_plan_enabled(store_id: str, plan_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update plans for other stores")
    
    plan = await db.subscription_plans.find_one({"id": plan_id, "store_id": store_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Toggle is_enabled field (default to True if not set)
    current_enabled = plan.get("is_enabled", True)
    new_enabled = not current_enabled
    
    await db.subscription_plans.update_one(
        {"id": plan_id},
        {"$set": {"is_enabled": new_enabled}}
    )
    
    updated = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    return {
        "id": updated["id"],
        "name": updated["name"],
        "is_enabled": updated.get("is_enabled", True),
        "message": f"Plan {'enabled' if new_enabled else 'disabled'} successfully"
    }

@api_router.post("/stores/{store_id}/subscribe", response_model=UserSubscriptionResponse)
async def subscribe_to_plan(store_id: str, sub_data: UserSubscriptionCreate, user: dict = Depends(get_current_user)):
    plan = await db.subscription_plans.find_one({"id": sub_data.plan_id, "store_id": store_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Validate monthly amount is within plan limits
    scheme_type = plan.get("scheme_type", "fixed")
    
    if scheme_type == "fixed":
        min_amount = plan.get("min_amount", 500)
        max_amount = plan.get("max_amount", 100000)
        if sub_data.monthly_amount < min_amount or sub_data.monthly_amount > max_amount:
            raise HTTPException(status_code=400, detail=f"Monthly amount must be between {min_amount} and {max_amount}")
    
    sub_id = str(uuid.uuid4())
    order_id = await get_next_order_id(store_id)  # Generate order ID for subscription
    now = datetime.now(timezone.utc)
    maturity = now + timedelta(days=plan["duration_months"] * 30)
    
    sub_doc = {
        "id": sub_id,
        "order_id": order_id,
        "user_id": user["id"],
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "store_id": store_id,
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "plan_type": plan.get("plan_type", ""),
        "scheme_type": scheme_type,
        "target_metal": plan.get("target_metal"),
        "monthly_amount": sub_data.monthly_amount,
        "payments_made": 0,
        "total_paid": 0,
        "accumulated_weight_grams": 0.0,
        "status": "active",
        "start_date": now.isoformat(),
        "maturity_date": maturity.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.user_subscriptions.insert_one(sub_doc)
    # Read back the stored subscription to ensure fields added by DB or other middleware are included (e.g., order_id)
    stored_sub = await db.user_subscriptions.find_one({"id": sub_id}, {"_id": 0})
    return UserSubscriptionResponse(**stored_sub)

@api_router.get("/my-subscriptions", response_model=List[UserSubscriptionResponse])
async def get_my_subscriptions(user: dict = Depends(get_current_user)):
    subs = await db.user_subscriptions.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    
    # Enrich with scheme_type from plan
    for sub in subs:
        # Ensure order_id
        if not sub.get("order_id"):
            sub_store_id = sub.get("store_id")
            sub["order_id"] = await get_next_order_id(sub_store_id)
            await db.user_subscriptions.update_one({"id": sub["id"]}, {"$set": {"order_id": sub["order_id"]}})
            
        # Get plan details for scheme_type
        if "scheme_type" not in sub:
             plan = await db.subscription_plans.find_one({"id": sub["plan_id"]})
             if plan:
                 sub["scheme_type"] = plan.get("scheme_type", "fixed")
             else:
                 sub["scheme_type"] = "fixed"
                 
    return [UserSubscriptionResponse(**s) for s in subs]


@api_router.get("/subscriptions/{subscription_id}/transactions")
async def get_subscription_transactions(subscription_id: str, user: dict = Depends(get_current_user)):
    sub = await db.user_subscriptions.find_one({"id": subscription_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    # Allow if user owns subscription OR user is admin for that store
    is_owner = sub["user_id"] == user["id"]
    is_admin = user["role"] in [UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN] and (user.get("store_id") == sub["store_id"] or user["role"] == UserRole.SUPER_ADMIN)
    
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    transactions = await db.payments.find(
        {"subscription_id": subscription_id, "status": "completed"}
    ).sort("completed_at", -1).to_list(length=None)
    
    return [
        {
            "id": t["id"],
            "amount": t["amount"],
            "date": t.get("completed_at") or t.get("created_at"),
            "grams": t.get("grams_purchased", 0.0),
            "metal_rate": t.get("market_price_per_gram", 0.0),
            "type": "payment"
        }
        for t in transactions
    ]

# Store Admin - Get all subscribers for store
@api_router.get("/stores/{store_id}/subscribers")
async def get_store_subscribers(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view subscribers for other stores")
    
    subs = await db.user_subscriptions.find({"store_id": store_id}, {"_id": 0}).to_list(1000)
    return subs

# Store Admin - Get subscription details with payment history
@api_router.get("/stores/{store_id}/subscriptions/{subscription_id}")
async def get_subscription_details(store_id: str, subscription_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view subscription for other stores")
    
    sub = await db.user_subscriptions.find_one({"id": subscription_id, "store_id": store_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Get payment history for this subscription
    payments = await db.subscription_payments.find({"subscription_id": subscription_id}, {"_id": 0}).to_list(100)
    
    return {
        "subscription": sub,
        "payments": payments
    }

# End User - Pay monthly subscription
@api_router.post("/subscriptions/{subscription_id}/pay")
async def pay_subscription(subscription_id: str, payment_data: SubscriptionPaymentCreate, user: dict = Depends(get_current_user)):
    sub = await db.user_subscriptions.find_one({"id": subscription_id, "user_id": user["id"]}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    if sub["status"] != "active":
        raise HTTPException(status_code=400, detail="Subscription is not active")
    
    scheme_type = sub.get("scheme_type", "fixed")
    weight_bought = 0.0
    
    if scheme_type == "fixed":
        # Validate payment amount matches monthly amount (Fixed logic)
        if payment_data.amount != sub["monthly_amount"]:
            raise HTTPException(status_code=400, detail=f"Payment amount must be {sub['monthly_amount']}")
        
        # Check duplicate payment for month
        now = datetime.now(timezone.utc)
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        current_month_end = (current_month_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
        
        existing_payment = await db.subscription_payments.find_one({
            "subscription_id": subscription_id,
            "user_id": user["id"],
            "payment_date": {
                "$gte": current_month_start.isoformat(),
                "$lte": current_month_end.isoformat()
            }
        })
        if existing_payment:
            raise HTTPException(
                status_code=400, 
                detail="You have already paid for this month. You can pay again next month."
            )
            
    elif scheme_type == "flexible":
        # Flexible Logic
        store_id = sub["store_id"]
        store = await db.stores.find_one({"id": store_id})
        
        # Determine Tax Rate for Metal
        tax_config = await db.store_tax_config.find_one({"store_id": sub["store_id"]})
        target_metal = sub.get("target_metal", "gold").lower()
        rate_cgst = 0.0
        rate_igst = 0.0
        
        if tax_config:
            metal_tax = next((m for m in tax_config.get("metal_taxes", []) if m["metal"] == target_metal and m["is_enabled"]), None)
            if metal_tax:
                rate_cgst = metal_tax["tax_rate"]["cgst"]
                rate_igst = metal_tax["tax_rate"]["igst"]
            else:
                 # Fallback to category if metals not found (unlikely for flexible plan targeting metal)
                 pass

        total_tax_rate = (rate_cgst + rate_igst) / 100
        # Inclusive calculation: Gross = Net * (1 + Rate) => Net = Gross / (1 + Rate)
        net_amount = payment_data.amount / (1 + total_tax_rate)
        
        # Get Market Price
        market_prices_doc = await db.store_market_prices.find_one({"store_id": sub["store_id"]})
        market_prices = market_prices_doc.get("prices", {}) if market_prices_doc else {}
        
        metal_price_per_gram = 0.0
        if target_metal == 'gold':
            metal_price_per_gram = float(market_prices.get("gold_24") or market_prices.get("gold_22") or 0)
        elif target_metal == 'silver':
            metal_price_per_gram = float(market_prices.get("silver_1g") or 0)
        elif target_metal == 'platinum':
            metal_price_per_gram = float(market_prices.get("platinum_1g") or 0)
        
        if metal_price_per_gram <= 0:
            # Fallback for dev/demo if prices not set
            if target_metal == 'gold': metal_price_per_gram = 5000.0
            else: metal_price_per_gram = 100.0
            print(f"Warning: Market price not set for {target_metal}, using fallback {metal_price_per_gram}")
            
        weight_bought = net_amount / metal_price_per_gram
    
    payment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    payment_doc = {
        "id": payment_id,
        "subscription_id": subscription_id,
        "user_id": user["id"],
        "amount": payment_data.amount,
        "weight_bought": weight_bought,
        "payment_date": now_iso,
        "status": "completed"
    }
    
    await db.subscription_payments.insert_one(payment_doc)
    
    # Update subscription
    new_payments_made = sub["payments_made"] + 1
    new_total_paid = sub["total_paid"] + payment_data.amount
    
    update_ops = {
        "payments_made": new_payments_made,
        "total_paid": new_total_paid
    }
    
    if weight_bought > 0:
        update_ops["accumulated_weight_grams"] = sub.get("accumulated_weight_grams", 0.0) + weight_bought
        
    # Check maturity logic (only for Fixed)
    plan = await db.subscription_plans.find_one({"id": sub["plan_id"]}, {"_id": 0})
    duration_months = plan.get("duration_months", 11)
    
    if scheme_type == "fixed" and new_payments_made >= duration_months:
        update_ops["status"] = "completed"
    
    await db.user_subscriptions.update_one(
        {"id": subscription_id},
        {"$set": update_ops}
    )
    
    return {"message": "Payment successful", "payment_id": payment_id, "payments_made": new_payments_made, "weight_bought": weight_bought}

# Store Admin - Update subscription status
class SubscriptionStatusUpdate(BaseModel):
    status: str  # "active", "partially_closed", "completed", "cancelled"

@api_router.put("/stores/{store_id}/subscriptions/{subscription_id}/status")
async def update_subscription_status(store_id: str, subscription_id: str, status_data: SubscriptionStatusUpdate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update subscriptions for other stores")
    
    valid_statuses = ["active", "partially_closed", "completed", "cancelled"]
    if status_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(valid_statuses)}")
    
    sub = await db.user_subscriptions.find_one({"id": subscription_id, "store_id": store_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    await db.user_subscriptions.update_one(
        {"id": subscription_id},
        {"$set": {"status": status_data.status}}
    )
    
    return {"message": f"Subscription status updated to {status_data.status}"}

# Store Admin - Delete subscription
@api_router.delete("/stores/{store_id}/subscriptions/{subscription_id}")
async def delete_subscription(store_id: str, subscription_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot delete subscriptions for other stores")
    
    sub = await db.user_subscriptions.find_one({"id": subscription_id, "store_id": store_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Delete the subscription
    await db.user_subscriptions.delete_one({"id": subscription_id})
    
    # Also delete related payments
    await db.subscription_payments.delete_many({"subscription_id": subscription_id})
    
    return {"message": "Subscription deleted successfully"}

# ==================== STORE PAYMENT CONFIG (RAZORPAY) ====================

@api_router.put("/stores/{store_id}/payment-config")
async def update_store_payment_config(store_id: str, config: StorePaymentConfigUpdate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    """Super Admin only - Configure Razorpay for a store"""
    store = await db.stores.find_one({"id": store_id})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    update_data = {}
    if config.razorpay_key_id is not None:
        update_data["razorpay_key_id"] = config.razorpay_key_id
    if config.razorpay_key_secret is not None:
        update_data["razorpay_key_secret"] = config.razorpay_key_secret
    
    if update_data:
        await db.stores.update_one({"id": store_id}, {"$set": update_data})

    return {"message": "Payment configuration updated"}

@api_router.get("/stores/{store_id}/payment-config", response_model=StorePaymentConfigResponse)
async def get_store_payment_config(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    """Super Admin only - Get Razorpay config for a store"""
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    return StorePaymentConfigResponse(
        store_id=store_id,
        razorpay_key_id=store.get("razorpay_key_id"),
        has_razorpay_configured=bool(store.get("razorpay_key_id") and store.get("razorpay_key_secret"))
    )

# ==================== TAX CONFIG ENDPOINTS ====================

@api_router.put("/stores/{store_id}/tax-config", response_model=StoreTaxConfig)
async def update_store_tax_config(store_id: str, config: StoreTaxConfigUpdate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update tax config for other stores")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Structure for storage
    tax_doc = {
        "store_id": store_id,
        "category_taxes": [ct.model_dump() for ct in config.category_taxes],
        "metal_taxes": [mt.model_dump() for mt in config.metal_taxes],
        "updated_at": now
    }
    
    # Upsert
    await db.tax_configs.update_one(
        {"store_id": store_id},
        {"$set": tax_doc},
        upsert=True
    )
    
    return StoreTaxConfig(**tax_doc)

@api_router.get("/stores/{store_id}/tax-config", response_model=StoreTaxConfig)
async def get_store_tax_config(store_id: str, user: dict = Depends(get_optional_user)):
    # Allow public access (optional user) so cart can calculate tax for guests
    
    config = await db.tax_configs.find_one({"store_id": store_id}, {"_id": 0})
    if not config:
        # Return default if not found
        return StoreTaxConfig(
            store_id=store_id,
            category_taxes=[],
            metal_taxes=[],
            updated_at=datetime.now(timezone.utc).isoformat()
        )
    return StoreTaxConfig(**config)

# ==================== PAGE CONFIG ENDPOINTS ====================

@api_router.post("/stores/{store_id}/page-config", response_model=PageConfigResponse)
async def create_page_config(store_id: str, config_data: PageConfigCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot create page config for other stores")
    
    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    config_doc = {
        "id": config_id,
        "store_id": store_id,
        "page_name": config_data.page_name,
        "components": config_data.components,
        "is_published": config_data.is_published,
        "updated_at": now
    }
    
    await db.page_configs.insert_one(config_doc)
    return PageConfigResponse(**{k: v for k, v in config_doc.items() if k != "_id"})

@api_router.get("/stores/{store_id}/page-config", response_model=List[PageConfigResponse])
async def get_page_configs(store_id: str):
    configs = await db.page_configs.find({"store_id": store_id}, {"_id": 0}).to_list(100)
    return [PageConfigResponse(**c) for c in configs]

@api_router.get("/stores/{store_id}/page-config/{page_name}", response_model=PageConfigResponse)
async def get_page_config(store_id: str, page_name: str):
    config = await db.page_configs.find_one({"store_id": store_id, "page_name": page_name}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Page config not found")
    return PageConfigResponse(**config)

@api_router.put("/stores/{store_id}/page-config/{config_id}", response_model=PageConfigResponse)
async def update_page_config(store_id: str, config_id: str, config_data: PageConfigCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update page config for other stores")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "page_name": config_data.page_name,
        "components": config_data.components,
        "is_published": config_data.is_published,
        "updated_at": now
    }
    
    await db.page_configs.update_one({"id": config_id, "store_id": store_id}, {"$set": update_data})
    config = await db.page_configs.find_one({"id": config_id}, {"_id": 0})
    return PageConfigResponse(**config)

# ==================== MOCK PAYMENT ENDPOINTS ====================

@api_router.get("/stores/{store_id}/debug-payment-config")
async def debug_payment_config(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    """Debug endpoint - Check store payment configuration"""
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        return {"error": "Store not found", "store_id": store_id}
    
    return {
        "store_id": store_id,
        "store_found": True,
        "store_name": store.get("name"),
        "razorpay_key_id_present": bool(store.get("razorpay_key_id")),
        "razorpay_key_id_value": store.get("razorpay_key_id"),
        "razorpay_key_secret_present": bool(store.get("razorpay_key_secret")),
        "full_store_doc_keys": list(store.keys())
    }

@api_router.post("/payments/create-order", response_model=MockPaymentResponse)
async def create_payment_order(payment_data: MockPaymentCreate, user: dict = Depends(get_current_user)):
    payment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Debug: log incoming payment data
    print(f"[create_payment_order] Received: store_id={payment_data.store_id}, order_id={payment_data.order_id}, subscription_id={payment_data.subscription_id}")

    # If client omitted order_id but supplied subscription_id, try to derive it (server-side convenience)
    if not payment_data.order_id and payment_data.subscription_id:
        sub_lookup = await db.user_subscriptions.find_one({"id": payment_data.subscription_id}, {"_id": 0})
        if sub_lookup and sub_lookup.get("order_id"):
            payment_data.order_id = sub_lookup.get("order_id")
            print(f"[create_payment_order] Derived order_id from subscription_id={payment_data.subscription_id}: order_id={payment_data.order_id}")
        else:
            print(f"[create_payment_order] Could not derive order_id from subscription_id={payment_data.subscription_id}")

    # Get store to fetch Razorpay credentials
    store = None
    store_id = None

    # 1) Explicit store_id provided (preferred for subscriptions)
    if payment_data.store_id:
        store = await db.stores.find_one({"id": payment_data.store_id})
        store_id = payment_data.store_id
        print(f"[create_payment_order] Step 1: Lookup by store_id={payment_data.store_id}, found={store is not None}")
        if store:
            # Log only presence of keys (never log secrets or full store doc)
            has_key = bool(store.get('razorpay_key_id'))
            has_secret = bool(store.get('razorpay_key_secret'))
            print(f"[create_payment_order] Step 1 SUCCESS - Store found: id={store.get('id')}, has_key={has_key}, has_secret={has_secret}")
            if not has_key or not has_secret:
                print(f"[create_payment_order] WARNING: Store found but missing credentials - key_id={store.get('razorpay_key_id')}, key_secret={'***' if store.get('razorpay_key_secret') else 'MISSING'}")
        else:
            print(f"[create_payment_order] Step 1 FAILED - No store found with id={payment_data.store_id}")

    # 2) If not provided, derive from order_id (check both orders and subscriptions)
    if not store and payment_data.order_id:
        print(f"[create_payment_order] Step 2: Trying to derive store from order_id={payment_data.order_id}")
        order = await db.orders.find_one({"id": payment_data.order_id})
        if order:
            store_id = order.get("store_id")
            print(f"[create_payment_order] Step 2a: Found order, store_id={store_id}")
            store = await db.stores.find_one({"id": store_id})
            print(f"[create_payment_order] Step 2a: Lookup by order.store_id, found={store is not None}")
        # Also check if order_id belongs to a subscription
        if not store:
            print(f"[create_payment_order] Step 2b: Order not found, checking subscriptions with order_id={payment_data.order_id}")
            sub = await db.user_subscriptions.find_one({"order_id": payment_data.order_id})
            if sub and sub.get("store_id"):
                store_id = sub.get("store_id")
                print(f"[create_payment_order] Step 2b: Found subscription, store_id={store_id}")
                store = await db.stores.find_one({"id": store_id})
                print(f"[create_payment_order] Step 2b: Lookup by subscription.store_id, found={store is not None}")
            else:
                print(f"[create_payment_order] Step 2b: No subscription found with order_id={payment_data.order_id}")

    # 3) If still not found and subscription_id is given, derive from subscription
    if not store and payment_data.subscription_id:
        print(f"[create_payment_order] Step 3: Trying to derive store from subscription_id={payment_data.subscription_id}")
        sub = await db.user_subscriptions.find_one({"id": payment_data.subscription_id})
        if sub:
            print(f"[create_payment_order] Step 3: Found subscription: {sub}")
            if sub.get("store_id"):
                store_id = sub.get("store_id")
                print(f"[create_payment_order] Step 3: Subscription has store_id={store_id}")
                store = await db.stores.find_one({"id": store_id})
                print(f"[create_payment_order] Step 3: Lookup by subscription.store_id, found={store is not None}")
            else:
                print(f"[create_payment_order] Step 3: Subscription found but has NO store_id")
        else:
            print(f"[create_payment_order] Step 3: No subscription found with id={payment_data.subscription_id}")

    if not store:
        print(f"[create_payment_order] CRITICAL: Store not found after all lookup attempts. store_id={store_id}")
        raise HTTPException(status_code=400, detail="Store not found for payment")
    
    print(f"[create_payment_order] Store lookup successful: id={store.get('id')}, has_key={bool(store.get('razorpay_key_id'))}, has_secret={bool(store.get('razorpay_key_secret'))}")
    
    # Ensure we have Razorpay credentials (from store or environment)
    razorpay_key_id = store.get("razorpay_key_id")
    razorpay_key_secret = store.get("razorpay_key_secret")
    
    print(f"[create_payment_order] Credential check: key_id={'SET' if razorpay_key_id else 'MISSING'}, key_secret={'SET' if razorpay_key_secret else 'MISSING'}")
    
    if not razorpay_key_id or not razorpay_key_secret:
        print(f"[create_payment_order] Store has incomplete credentials. Attempting fallback to environment variables...")
        # Attempt fallback to environment variables (useful for local testing in non-production)
        env_key = os.getenv("RAZORPAY_KEY_ID")
        env_secret = os.getenv("RAZORPAY_KEY_SECRET")
        env = os.getenv("ENVIRONMENT", "development")
        
        print(f"[create_payment_order] Environment: ENV={env}, env_key={'SET' if env_key else 'NOT SET'}, env_secret={'SET' if env_secret else 'NOT SET'}")
        
        if env_key and env_secret and env != "production":
            print(f"[create_payment_order] Using environment variable fallback (ENV={env})")
            razorpay_key_id = env_key
            razorpay_key_secret = env_secret
        else:
            print(f"[create_payment_order] FAILURE: No valid Razorpay credentials found")
            print(f"[create_payment_order] Store credentials: key_id={razorpay_key_id}, key_secret={razorpay_key_secret}")
            print(f"[create_payment_order] Environment fallback failed: env={env}, has_env_key={bool(env_key)}, has_env_secret={bool(env_secret)}")
            raise HTTPException(status_code=400, detail=f"Store payment configuration not found. Please configure Razorpay for store {store_id}")
    
    # Create real Razorpay order
    try:
        razorpay_auth = (razorpay_key_id, razorpay_key_secret)
        # Ensure receipt length <= 40 characters (Razorpay requirement)
        receipt_base = (payment_data.order_id or payment_id)
        max_receipt_len = 40 - len("order_")
        receipt = f"order_{receipt_base[:max_receipt_len]}"
        if len(receipt_base) > max_receipt_len:
            print(f"[create_payment_order] Trimming receipt base from {len(receipt_base)} to {max_receipt_len} chars: {receipt}")
        
        # Consistent rounding for currency
        amount_paise = int(round(payment_data.amount * 100))
        
        razorpay_url = "https://api.razorpay.com/v1/orders"
        razorpay_request = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
        }
        razorpay_response = requests.post(
            razorpay_url,
            auth=razorpay_auth,
            json=razorpay_request
        )
        print(f"[create_payment_order] Razorpay API call: URL={razorpay_url}, status={razorpay_response.status_code}")
        print(f"[create_payment_order] Razorpay request: {razorpay_request}")
        print(f"[create_payment_order] Razorpay response: {razorpay_response.text}")
        
        # Log the Razorpay order creation API call
        await log_razorpay(
            store_id=store_id,
            action="create_order",
            status="success" if razorpay_response.status_code == 200 else "failed",
            url=razorpay_url,
            request=razorpay_request,
            response=razorpay_response.json() if razorpay_response.content else None,
            error=None if razorpay_response.status_code == 200 else razorpay_response.text
        )
        if razorpay_response.status_code != 200:
            print(f"[create_payment_order] ERROR: Razorpay order creation failed with status {razorpay_response.status_code}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to create Razorpay order: {razorpay_response.text}"
            )
        razorpay_order = razorpay_response.json()
        razorpay_order_id = razorpay_order["id"]
        print(f"[create_payment_order] SUCCESS: Created Razorpay order {razorpay_order_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment gateway error: {str(e)}")
    
    payment_doc = {
        "id": payment_id,
        "user_id": user["id"],
        "amount": payment_data.amount,
        "razorpay_amount": amount_paise,
        "description": payment_data.description,
        "subscription_id": payment_data.subscription_id,
        "order_id": payment_data.order_id,
        "status": "created",
        "razorpay_order_id": razorpay_order_id,
        "razorpay_key_id": razorpay_key_id,
        "created_at": now
    }
    
    await db.payments.insert_one(payment_doc)
    return MockPaymentResponse(**{k: v for k, v in payment_doc.items() if k != "_id"})

@api_router.post("/payments/{payment_id}/complete")
async def complete_payment(payment_id: str, user: dict = Depends(get_current_user)):
    payment = await db.payments.find_one({"id": payment_id, "user_id": user["id"]})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    await db.payments.update_one({"id": payment_id}, {"$set": {"status": "completed"}})
    
    # If subscription payment, update subscription
    if payment.get("subscription_id"):
        sub = await db.user_subscriptions.find_one({"id": payment["subscription_id"]})
        if sub:
            new_payments = sub["payments_made"] + 1
            new_total = sub["total_paid"] + payment["amount"]
            await db.user_subscriptions.update_one(
                {"id": payment["subscription_id"]},
                {"$set": {"payments_made": new_payments, "total_paid": new_total}}
            )
    
    return {"message": "Payment completed successfully", "status": "completed"}


async def trigger_shiprocket_shipment(store_id: str, order_id: str):
    try:
        # Get Config
        ship_config = await db.store_shipping_config.find_one({"store_id": store_id})
        if not ship_config or not ship_config.get("is_enabled"):
            return

        order = await db.orders.find_one({"id": order_id})
        if not order: return

        address = order.get("shipping_address") or {}
        user = await db.users.find_one({"id": order["user_id"]})
        
        # Prepare specific items
        order_items = []
        total_weight = 0.0
        
        for item in order.get("items", []):
             prod_id = item.get("product_id")
             # If it's a redemption coin, it might not be in products db fully, or is dynamic
             if prod_id == "redemption_coin":
                 weight = item.get("weight_grams", 0.0) / 1000.0 # Convert g to kg
                 sku = f"REDEMPTION-{order_id}"
                 selling_price = item.get("price", 0) # usually 0 for redemption
             else:
                 prod = await db.products.find_one({"id": prod_id})
                 weight = float(prod.get("weight", 0.5)) if prod else 0.5
                 sku = prod.get("sku") or prod_id
                 selling_price = item.get("price", 0)
             
             total_weight += (weight * item.get("quantity", 1))
             
             order_items.append({
                 "name": item.get("product_name", "Item"),
                 "sku": sku,
                 "units": item.get("quantity", 1),
                 "selling_price": selling_price,
                 "discount": 0,
                 "tax": 0,
                 "hsn": 7113 # Jewellery HSN
             })

        if total_weight < 0.1: total_weight = 0.5
        
        # Parse Date
        order_date = datetime.now().strftime("%Y-%m-%d %H:%M") # Current time as shipment creation time
        
        # Ensure address fields are correctly mapped
        billing_name = address.get("full_name") or address.get("name") or user.get("name", "Customer")
        billing_address = address.get("address_line1") or address.get("street1") or ""
        if address.get("address_line2") or address.get("street2"):
            billing_address += " " + (address.get("address_line2") or address.get("street2"))
        
        payload = {
            "order_id": order_id,
            "order_date": order_date,
            "pickup_location": "Primary", # User might need to configure this in settings but "Primary" is default
            "billing_customer_name": billing_name,
            "billing_last_name": "",
            "billing_address": billing_address,
            "billing_city": address.get("city"),
            "billing_pincode": address.get("postal_code"),
            "billing_state": address.get("state"),
            "billing_country": address.get("country", "India"),
            "billing_email": user.get("email"),
            "billing_phone": address.get("phone") or "9999999999",
            "shipping_is_billing": True,
            "order_items": order_items,
            "payment_method": "Prepaid",
            "shipping_charges": order.get("shipping_charges", 0),
            "giftwrap_charges": 0,
            "transaction_charges": 0,
            "total_discount": 0,
            "sub_total": order.get("total_amount", 0),
            "length": 10,
            "breadth": 10,
            "height": 10,
            "weight": total_weight
        }
        
        await log_shiprocket(store_id, "create_order_request", "pending", payload)
        
        token = await get_shiprocket_token(ship_config["email"], ship_config["password"])
        res = await create_shiprocket_order(token, payload)
        
        if res and res.get("order_id"): # Shiprocket Order ID
             await log_shiprocket(store_id, "create_order_success", "success", response=res)
             
             # Update Order with tracking info
             await db.orders.update_one(
                 {"id": order_id},
                 {"$set": {
                     "tracking_number": str(res.get("shipment_id", "")), # Using shipment_id as ref
                     "carrier_name": "Shiprocket",
                     "notes": (order.get("notes") or "") + f" | Shiprocket ID: {res.get('order_id')}"
                 }}
             )
        else:
             await log_shiprocket(store_id, "create_order_failed", "failed", response=res)

    except Exception as e:
        logger.error(f"Failed to trigger shiprocket: {e}")
        await log_shiprocket(store_id, "trigger_error", "error", error=str(e))

@api_router.post("/payments/verify")
async def verify_payment(verification: PaymentVerification, user: dict = Depends(get_current_user)):
    """Verify Razorpay payment signature"""
    payment = await db.payments.find_one({"id": verification.payment_id, "user_id": user["id"]})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Verify signature - find store for this payment
    store_id = None
    store = None
    
    # Try to find store from order_id first
    if payment.get("order_id"):
        order = await db.orders.find_one({"id": payment["order_id"]})
        if order:
            store_id = order["store_id"]
            store = await db.stores.find_one({"id": store_id})
            
            # --- UPDATE: Verify and Update Order Status for Standard E-commerce ---
            if store:
                # Update Order to Paid
                await db.orders.update_one(
                    {"id": payment["order_id"]},
                    {"$set": {
                        "status": "placed",
                        "payment_status": "paid",
                        "payment_method": "online"
                    }}
                )
                # Trigger Shiprocket
                try:
                    await trigger_shiprocket_shipment(store_id, payment["order_id"])
                except Exception as e:
                    logger.error(f"Async shiprocket trigger failed: {e}")
            # ---------------------------------------------------------------------
    
    # If not found via order, try subscription
    if not store and payment.get("subscription_id"):
        sub = await db.user_subscriptions.find_one({"id": payment["subscription_id"]})
        if sub:
            store_id = sub.get("store_id")
            store = await db.stores.find_one({"id": store_id})
    
    # Verify signature if we have store credentials
    verification_result = "success"
    verification_error = None
    if store and store.get("razorpay_key_secret"):
        secret = store["razorpay_key_secret"]
        # Verify signature: HMAC(order_id|payment_id, secret) should equal signature
        message = f"{verification.razorpay_order_id}|{verification.razorpay_payment_id}"
        signature_generated = hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        if signature_generated != verification.razorpay_signature:
            verification_result = "failed"
            verification_error = "Invalid payment signature"
            await log_razorpay(
                store_id=store_id,
                action="verify_payment",
                status="failed",
                url=None,
                request={
                    "razorpay_order_id": verification.razorpay_order_id,
                    "razorpay_payment_id": verification.razorpay_payment_id,
                    "razorpay_signature": verification.razorpay_signature,
                },
                response=None,
                error=verification_error
            )
            raise HTTPException(status_code=400, detail=verification_error)
    else:
        # If no store found or no secret, try environment variable (for testing)
        env_secret = os.getenv("RAZORPAY_KEY_SECRET")
        if env_secret:
            message = f"{verification.razorpay_order_id}|{verification.razorpay_payment_id}"
            signature_generated = hmac.new(
                env_secret.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()
            if signature_generated != verification.razorpay_signature:
                verification_result = "failed"
                verification_error = "Invalid payment signature"
                await log_razorpay(
                    store_id=store_id,
                    action="verify_payment",
                    status="failed",
                    url=None,
                    request={
                        "razorpay_order_id": verification.razorpay_order_id,
                        "razorpay_payment_id": verification.razorpay_payment_id,
                        "razorpay_signature": verification.razorpay_signature,
                    },
                    response=None,
                    error=verification_error
                )
                raise HTTPException(status_code=400, detail=verification_error)
        else:
            print(f"[verify_payment] Warning: Could not verify signature for payment {verification.payment_id} - no store or env secret found")
    # Log successful verification
    if verification_result == "success":
        await log_razorpay(
            store_id=store_id,
            action="verify_payment",
            status="success",
            url=None,
            request={
                "razorpay_order_id": verification.razorpay_order_id,
                "razorpay_payment_id": verification.razorpay_payment_id,
                "razorpay_signature": verification.razorpay_signature,
            },
            response={"message": "Payment verified"},
            error=None
        )
    
    # Update payment as completed
    await db.payments.update_one(
        {"id": verification.payment_id},
        {"$set": {
            "status": "completed",
            "razorpay_payment_id": verification.razorpay_payment_id,
            "razorpay_signature": verification.razorpay_signature,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If subscription payment, update subscription
    if payment.get("subscription_id"):
        sub = await db.user_subscriptions.find_one({"id": payment["subscription_id"]})
        if sub:
            # Handle Closure Payment
            if payment.get("type") == "closure":
                metadata = payment.get("metadata", {})
                needed_grams = metadata.get("needed_grams", 0.0)
                
                # Update Subscription
                current_accumulated = sub.get("accumulated_weight_grams", 0.0)
                final_accumulated = current_accumulated + needed_grams
                
                await db.user_subscriptions.update_one(
                    {"id": payment["subscription_id"]},
                    {"$set": {
                        "status": "completed",
                        "accumulated_weight_grams": final_accumulated,
                        "closed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Redemption Order
                order_id = await get_next_order_id(sub.get("store_id"))
                plan_name = sub.get("plan_name", "Gold Plan")
                
                # Fetch address snapshot
                address_snapshot = {}
                if metadata.get("address_id"):
                     addr = await db.addresses.find_one({"id": metadata.get("address_id")})
                     if addr:
                         address_snapshot = {k: v for k, v in addr.items() if k != "_id"}

                order_doc = {
                    "id": order_id,
                    "store_id": sub.get("store_id"),
                    "user_id": user["id"],
                    "items": [{
                        "product_id": "redemption_coin",
                        "product_name": f"{plan_name} Redemption Coin ({final_accumulated:.3f}g)",
                        "quantity": 1,
                        "price": 0, # Already paid via subscription
                        "weight_grams": final_accumulated,
                        "image": None 
                    }],
                    "total_amount": payment["amount"], # The closure payment amount (includes shipping)
                    "status": "placed", 
                    "payment_status": "paid",
                    "payment_method": "online", # Razorpay
                    "shipping_address_id": metadata.get("address_id"),
                    "shipping_address": address_snapshot,
                    "shipping_charges": metadata.get("shipping_charges", 0.0),
                    "notes": f"Subscription Closure for {payment['subscription_id']}",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.orders.insert_one(order_doc)
                
                # --- UPDATE: Trigger Shiprocket for Redempion ---
                try:
                    await trigger_shiprocket_shipment(sub.get("store_id"), order_id)
                except Exception as e:
                    logger.error(f"Async shiprocket trigger failed: {e}")
                # -----------------------------------------------
                
                return {"message": "Subscription closed and order placed", "status": "completed", "order_id": order_id}

            # Calculate grams for ALL plans (Fixed or Flexible)
            grams_purchased = 0.0
            price_per_gram_used = 0.0
            plan = await db.subscription_plans.find_one({"id": sub["plan_id"]})
            
            if plan:
                # Get market prices
                market_prices_doc = await db.store_market_prices.find_one({"store_id": sub["store_id"]})
                market_prices = market_prices_doc.get("prices", {}) if market_prices_doc else {}
                
                # Get tax config
                tax_config = await db.store_tax_config.find_one({"store_id": sub["store_id"]})
                target_metal = (plan.get("target_metal") or "gold").lower()
                
                rate_cgst = 0.0
                rate_igst = 0.0
                
                if tax_config:
                    metal_tax = next((m for m in tax_config.get("metal_taxes", []) if m["metal"] == target_metal and m["is_enabled"]), None)
                    if metal_tax:
                        rate_cgst = metal_tax["tax_rate"]["cgst"]
                        rate_igst = metal_tax["tax_rate"]["igst"]
                
                total_tax_rate = (rate_cgst + rate_igst) / 100
                
                # Get Price
                if target_metal == 'gold':
                     price_per_gram_used = float(market_prices.get("gold_24") or market_prices.get("gold_22") or 0)
                elif target_metal == 'silver':
                     price_per_gram_used = float(market_prices.get("silver_1g") or 0)
                elif target_metal == 'platinum':
                     price_per_gram_used = float(market_prices.get("platinum_1g") or 0)
                
                # Fallback for dev/demo if prices not set
                if price_per_gram_used <= 0:
                    if target_metal == 'gold': price_per_gram_used = 5000.0
                    else: price_per_gram_used = 100.0

                if price_per_gram_used > 0:
                    # Inclusive calculation: Gross = Net * (1 + Rate) => Net = Gross / (1 + Rate)
                    net_amount = payment["amount"] / (1 + total_tax_rate)
                    grams_purchased = net_amount / price_per_gram_used

            new_payments = sub["payments_made"] + 1
            new_total = sub["total_paid"] + payment["amount"]
            
            update_fields = {
                "payments_made": new_payments, 
                "total_paid": new_total
            }
            
            if grams_purchased > 0:
                current_grams = sub.get("accumulated_weight_grams") or 0.0
                update_fields["accumulated_weight_grams"] = current_grams + grams_purchased
                
                # Update the payment record with weight and rate stats
                await db.payments.update_one(
                    {"id": verification.payment_id},
                    {"$set": {
                        "grams_purchased": grams_purchased,
                        "market_price_per_gram": price_per_gram_used,
                        "metal_type": target_metal
                    }}
                )

            # Check maturity logic (Fixed Plans)
            if plan and plan.get("scheme_type") == "fixed":
                 duration_months = plan.get("duration_months", 11)
                 if new_payments >= duration_months:
                     update_fields["status"] = "completed"

            await db.user_subscriptions.update_one(
                {"id": payment["subscription_id"]},
                {"$set": update_fields}
            )
    
    return {"message": "Payment verified successfully", "status": "completed"}

class PaymentLinkCreate(BaseModel):
    amount: float
    description: str
    customer_name: str
    customer_email: str
    customer_contact: str
    subscription_id: Optional[str] = None
    order_id: Optional[str] = None
    store_id: Optional[str] = None
    callback_url: Optional[str] = None
    callback_method: Optional[str] = "get"

class PaymentLinkResponse(BaseModel):
    id: str
    payment_link_id: str
    short_url: str
    amount: float
    description: str
    status: str
    created_at: str

@api_router.post("/payments/create-link", response_model=PaymentLinkResponse)
async def create_payment_link(payment_data: PaymentLinkCreate, user: dict = Depends(get_current_user)):
    """Create a Razorpay payment link"""
    payment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Check database connection
    if not db:
        raise HTTPException(status_code=500, detail="Database connection not available")
    
    print(f"[create_payment_link] Received: store_id={payment_data.store_id}, order_id={payment_data.order_id}, subscription_id={payment_data.subscription_id}")
    
    # Get store to fetch Razorpay credentials
    store = None
    store_id = None
    
    # 1) Explicit store_id provided
    if payment_data.store_id:
        store = await db.stores.find_one({"id": payment_data.store_id})
        store_id = payment_data.store_id
        print(f"[create_payment_link] Step 1: Lookup by store_id={payment_data.store_id}, found={store is not None}")
    
    # 2) Derive from order_id
    if not store and payment_data.order_id:
        order = await db.orders.find_one({"id": payment_data.order_id})
        if order:
            store_id = order.get("store_id")
            store = await db.stores.find_one({"id": store_id})
            print(f"[create_payment_link] Step 2: Lookup by order.store_id, found={store is not None}")
    
    # 3) Derive from subscription_id
    if not store and payment_data.subscription_id:
        sub = await db.user_subscriptions.find_one({"id": payment_data.subscription_id})
        if sub:
            store_id = sub.get("store_id")
            store = await db.stores.find_one({"id": store_id})
            print(f"[create_payment_link] Step 3: Lookup by subscription.store_id, found={store is not None}")
    
    if not store:
        raise HTTPException(status_code=400, detail="Store not found for payment")
    
    # Ensure we have Razorpay credentials
    razorpay_key_id = store.get("razorpay_key_id")
    razorpay_key_secret = store.get("razorpay_key_secret")
    
    if not razorpay_key_id or not razorpay_key_secret:
        # Fallback to environment variables
        env_key = os.getenv("RAZORPAY_KEY_ID")
        env_secret = os.getenv("RAZORPAY_KEY_SECRET")
        env = os.getenv("ENVIRONMENT", "development")
        
        if env_key and env_secret and env != "production":
            razorpay_key_id = env_key
            razorpay_key_secret = env_secret
        else:
            raise HTTPException(status_code=400, detail=f"Store payment configuration not found. Please configure Razorpay for store {store_id}")
    
    # Create Razorpay payment link
    try:
        razorpay_auth = (razorpay_key_id, razorpay_key_secret)
        amount_paise = int(round(payment_data.amount * 100))
        
        # Build callback URL
        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        callback_url = payment_data.callback_url or f"{base_url}/payment/callback"
        
        razorpay_url = "https://api.razorpay.com/v1/payment_links"
        razorpay_request = {
            "amount": amount_paise,
            "currency": "INR",
            "expire_by": int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()),
            "reference_id": payment_id,
            "description": payment_data.description,
            "customer": {
                "name": payment_data.customer_name,
                "email": payment_data.customer_email,
                "contact": payment_data.customer_contact or ""
            },
            "notify": {
                "sms": True,
                "email": True
            },
            "notes": {
                "store_id": store_id,
                "order_id": payment_data.order_id,
                "subscription_id": payment_data.subscription_id,
                "user_id": user["id"]
            },
            "callback_url": callback_url,
            "callback_method": payment_data.callback_method
        }
        
        razorpay_response = requests.post(
            razorpay_url,
            auth=razorpay_auth,
            json=razorpay_request
        )
        
        print(f"[create_payment_link] Razorpay API call: URL={razorpay_url}, status={razorpay_response.status_code}")
        print(f"[create_payment_link] Razorpay request: {razorpay_request}")
        print(f"[create_payment_link] Razorpay response: {razorpay_response.text}")
        
        # Log the API call
        await log_razorpay(
            store_id=store_id,
            action="create_payment_link",
            status="success" if razorpay_response.status_code == 200 else "failed",
            url=razorpay_url,
            request=razorpay_request,
            response=razorpay_response.json() if razorpay_response.content else None,
            error=None if razorpay_response.status_code == 200 else razorpay_response.text
        )
        
        if razorpay_response.status_code != 200:
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to create Razorpay payment link: {razorpay_response.text}"
            )
        
        payment_link_data = razorpay_response.json()
        
        # Store payment link info in database
        payment_link_doc = {
            "id": payment_id,
            "user_id": user["id"],
            "amount": payment_data.amount,
            "razorpay_amount": amount_paise,
            "description": payment_data.description,
            "subscription_id": payment_data.subscription_id,
            "order_id": payment_data.order_id,
            "store_id": store_id,
            "status": "created",
            "razorpay_payment_link_id": payment_link_data["id"],
            "short_url": payment_link_data["short_url"],
            "razorpay_key_id": razorpay_key_id,
            "customer_name": payment_data.customer_name,
            "customer_email": payment_data.customer_email,
            "customer_contact": payment_data.customer_contact,
            "created_at": now
        }
        
        await db.payment_links.insert_one(payment_link_doc)
        
        return PaymentLinkResponse(
            id=payment_id,
            payment_link_id=payment_link_data["id"],
            short_url=payment_link_data["short_url"],
            amount=payment_data.amount,
            description=payment_data.description,
            status="created",
            created_at=now
        )
        
    except Exception as e:
        print(f"[create_payment_link] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment gateway error: {str(e)}")

@api_router.post("/payments/links/verify")
async def verify_payment_link(request: Request):
    """Verify Razorpay payment link webhook"""
    try:
        # Get raw body for signature verification
        body = await request.body()
        signature = request.headers.get("X-Razorpay-Signature")
        
        if not signature:
            raise HTTPException(status_code=400, detail="Missing signature")
        
        # For now, we'll trust the webhook and process the payment
        # In production, you should verify the webhook signature
        webhook_data = await request.json()
        
        print(f"[verify_payment_link] Webhook received: {webhook_data}")
        
        # Extract payment information
        payment_entity = webhook_data.get("payment", {})
        payment_link_entity = webhook_data.get("payment_link", {})
        
        if not payment_entity or not payment_link_entity:
            return {"status": "ignored"}
        
        payment_link_id = payment_link_entity.get("id")
        payment_id = payment_entity.get("id")
        amount = payment_entity.get("amount", 0) / 100  # Convert from paise
        status = payment_entity.get("status")
        
        # Find the payment link in our database
        payment_link_doc = await db.payment_links.find_one({"razorpay_payment_link_id": payment_link_id})
        if not payment_link_doc:
            print(f"[verify_payment_link] Payment link not found: {payment_link_id}")
            return {"status": "ignored"}
        
        # Update payment link status
        await db.payment_links.update_one(
            {"razorpay_payment_link_id": payment_link_id},
            {"$set": {
                "status": "paid" if status == "captured" else "failed",
                "razorpay_payment_id": payment_id,
                "paid_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If payment was successful, create/update payment record and trigger business logic
        if status == "captured":
            # Create or update payment record
            payment_doc = {
                "id": payment_link_doc["id"],
                "user_id": payment_link_doc["user_id"],
                "amount": amount,
                "razorpay_amount": payment_entity.get("amount", 0),
                "description": payment_link_doc["description"],
                "subscription_id": payment_link_doc.get("subscription_id"),
                "order_id": payment_link_doc.get("order_id"),
                "status": "completed",
                "razorpay_payment_id": payment_id,
                "razorpay_payment_link_id": payment_link_id,
                "razorpay_key_id": payment_link_doc["razorpay_key_id"],
                "created_at": payment_link_doc["created_at"],
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Check if payment already exists
            existing_payment = await db.payments.find_one({"id": payment_link_doc["id"]})
            if existing_payment:
                await db.payments.update_one(
                    {"id": payment_link_doc["id"]},
                    {"$set": payment_doc}
                )
            else:
                await db.payments.insert_one(payment_doc)
            
            # Trigger business logic (same as verify_payment)
            await trigger_payment_completion_logic(payment_link_doc["id"])
        
        return {"status": "ok"}
        
    except Exception as e:
        print(f"[verify_payment_link] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing error: {str(e)}")

async def trigger_payment_completion_logic(payment_id: str):
    """Trigger the same business logic as verify_payment"""
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        return
    
    # Update order status if it's an order payment
    if payment.get("order_id"):
        order = await db.orders.find_one({"id": payment["order_id"]})
        if order:
            await db.orders.update_one(
                {"id": payment["order_id"]},
                {"$set": {
                    "status": "placed",
                    "payment_status": "paid",
                    "payment_method": "online"
                }}
            )
            # Trigger Shiprocket
            try:
                await trigger_shiprocket_shipment(order["store_id"], payment["order_id"])
            except Exception as e:
                print(f"Async shiprocket trigger failed: {e}")
    
    # Update subscription if it's a subscription payment
    if payment.get("subscription_id"):
        sub = await db.user_subscriptions.find_one({"id": payment["subscription_id"]})
        if sub:
            # Handle different subscription payment types
            if payment.get("type") == "closure":
                # Handle closure payment logic (same as verify_payment)
                pass
            else:
                # Handle regular subscription payment
                new_payments = sub["payments_made"] + 1
                new_total = sub["total_paid"] + payment["amount"]
                
                update_fields = {
                    "payments_made": new_payments, 
                    "total_paid": new_total
                }
                
                # Add weight calculation logic here if needed
                # (Same logic as in verify_payment)
                
                await db.user_subscriptions.update_one(
                    {"id": payment["subscription_id"]},
                    {"$set": update_fields}
                )

# ==================== PROFILE ENDPOINTS ====================

@api_router.put("/profile", response_model=UserResponse)
async def update_profile(name: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"name": name}})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return UserResponse(**updated)


@api_router.put("/profile/password")
async def update_profile_password(payload: PasswordUpdateRequest, user: dict = Depends(get_current_user)):
    # Verify current password
    if not verify_password(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    new_hash = hash_password(payload.new_password)
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": new_hash}})
    return {"message": "Password updated"}

@api_router.put("/profile/store", response_model=UserResponse)
async def set_profile_store(store_id: str, user: dict = Depends(get_current_user)):
    # Allow an authenticated user to associate themselves with a store
    # Useful when an end user signs in via a specific store
    await db.users.update_one({"id": user["id"]}, {"$set": {"store_id": store_id}})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return UserResponse(**updated)


class StoreShippingConfig(BaseModel):
    store_id: str
    is_enabled: bool = False
    provider: str = "shiprocket"
    email: Optional[str] = None
    password: Optional[str] = None
    pickup_pincode: Optional[str] = None

class StoreShippingConfigResponse(BaseModel):
    store_id: str
    is_enabled: bool
    provider: str
    email: Optional[str] = None
    # Do not expose password
    pickup_pincode: Optional[str] = None

class ClosurePreviewResponse(BaseModel):
    subscription_id: str
    accumulated_grams: float
    target_grams: float
    needed_grams: float
    gold_rate: float
    gold_cost: float
    tax_amount: float
    shipping_charges: float
    total_amount: float
    breakdown: dict

class ShiprocketLog(BaseModel):
    id: str
    store_id: str
    action: str
    status: str
    payload: Optional[dict] = None
    response: Optional[dict] = None
    error: Optional[str] = None
    created_at: str

class PaginatedShiprocketLogResponse(BaseModel):
    items: List[ShiprocketLog]
    total: int
    page: int
    limit: int
    pages: int

async def log_shiprocket(store_id: str, action: str, status: str, payload: dict = None, response: dict = None, error: str = None):
    try:
        # Sanitize sensitive data from payload if needed (like password)
        safe_payload = payload.copy() if payload else {}
        if "password" in safe_payload:
            safe_payload["password"] = "***"
            
        await db.shiprocket_logs.insert_one({
            "store_id": store_id,
            "action": action,
            "status": status,
            "payload": safe_payload,
            "response": response,
            "error": error,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        print(f"Failed to write shiprocket log: {e}")

# ==================== SHIPPING ENDPOINTS ====================

@api_router.get("/stores/{store_id}/shiprocket-logs", response_model=PaginatedShiprocketLogResponse)
async def get_shiprocket_logs(store_id: str, page: int = 1, limit: int = 20, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    skip = (page - 1) * limit
    total = await db.shiprocket_logs.count_documents({"store_id": store_id})
    logs = await db.shiprocket_logs.find({"store_id": store_id}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    items = [ShiprocketLog(id=str(l["_id"]), **{k:v for k,v in l.items() if k != "_id"}) for l in logs]
    pages = ceil(total / limit)
    
    return PaginatedShiprocketLogResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@api_router.get("/stores/{store_id}/shipping-config", response_model=StoreShippingConfigResponse)
async def get_store_shipping_config(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    config = await db.store_shipping_config.find_one({"store_id": store_id})
    if not config:
        return StoreShippingConfigResponse(store_id=store_id, is_enabled=False, provider="shiprocket")
    
    return StoreShippingConfigResponse(
        store_id=store_id,
        is_enabled=config.get("is_enabled", False),
        provider=config.get("provider", "shiprocket"),
        email=config.get("email"),
        pickup_pincode=config.get("pickup_pincode")
    )

@api_router.put("/stores/{store_id}/shipping-config")
async def update_store_shipping_config(store_id: str, payload: StoreShippingConfig, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    update_data = {
        "store_id": store_id,
        "is_enabled": payload.is_enabled,
        "provider": payload.provider,
        "email": payload.email,
        "pickup_pincode": payload.pickup_pincode,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if payload.password:
        update_data["password"] = payload.password
        
    await db.store_shipping_config.update_one(
        {"store_id": store_id},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Shipping configuration updated"}

class ShippingEstimateRequest(BaseModel):
    items: List[dict] # {product_id, quantity}
    postal_code: str

class ShippingEstimateResponse(BaseModel):
    shipping_charges: float
    courier_name: Optional[str] = None
    etd: Optional[str] = None

@api_router.post("/stores/{store_id}/shipping/estimate", response_model=ShippingEstimateResponse)
async def estimate_shipping_charges(store_id: str, payload: ShippingEstimateRequest):
    # Get Shipping Config
    ship_config = await db.store_shipping_config.find_one({"store_id": store_id})
    shipping_charges = 0.0
    courier_name = None
    etd = None
    
    if ship_config and ship_config.get("is_enabled"):
        pickup_zip = ship_config.get("pickup_pincode")
        dest_zip = payload.postal_code
        
        if pickup_zip and dest_zip and ship_config.get("email") and ship_config.get("password"):
            try:
                # Calculate approx weight (Weights in DB are in grams)
                total_weight_grams = 0.0
                for item in payload.items:
                     prod = await db.products.find_one({"id": item.get("product_id")})
                     w = prod.get("weight") if prod else 0
                     if w: total_weight_grams += (float(w) * item.get("quantity", 1))
                
                # Convert to KG for Shiprocket
                total_weight_kg = total_weight_grams / 1000.0
                
                # Shiprocket minimum is usually 0.5kg or 0.1kg depending on plan
                if total_weight_kg < 0.5: total_weight_kg = 0.5
                
                # Check Cache
                cache_key = f"{pickup_zip}-{dest_zip}-{total_weight_kg}"
                cached_rate = await db.shipping_rate_cache.find_one({"key": cache_key})
                
                if cached_rate and datetime.fromisoformat(cached_rate["expires_at"]) > datetime.now(timezone.utc):
                    shipping_charges = cached_rate["rate"]
                    courier_name = cached_rate.get("courier_name")
                    etd = cached_rate.get("etd")
                else:
                    await log_shiprocket(store_id, "rate_check_cart", "pending", {"pickup": pickup_zip, "dest": dest_zip, "weight": total_weight_kg})
                    token = await get_shiprocket_token(ship_config["email"], ship_config["password"])
                    res = await check_serviceability(token, pickup_zip, dest_zip, total_weight_kg)
                    
                    if res and "rate" in res:
                        shipping_charges = float(res["rate"])
                        courier_name = res.get("courier_name")
                        etd = res.get("etd")
                        await log_shiprocket(store_id, "rate_check_cart", "success", response=res)
                        
                        # Save to Cache (1 hour)
                        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
                        await db.shipping_rate_cache.update_one(
                            {"key": cache_key},
                            {"$set": {
                                "rate": shipping_charges,
                                "courier_name": courier_name,
                                "etd": etd,
                                "expires_at": expires_at
                            }},
                            upsert=True
                        )
                    else:
                        await log_shiprocket(store_id, "rate_check_cart", "failed", error="No rate found", response=res)
                        # If we expected a rate but got none, return error to frontend so it doesn't show 0
                        raise HTTPException(status_code=400, detail="Shipping not available for this location")
            except HTTPException as he:
                raise he
            except Exception as e:
                logger.error(f"Shipping calc failed: {e}")
                await log_shiprocket(store_id, "rate_check_cart", "error", error=str(e))
                raise HTTPException(status_code=400, detail="Unable to calculate shipping")
                
    return ShippingEstimateResponse(
        shipping_charges=shipping_charges,
        courier_name=courier_name,
        etd=etd
    )

@api_router.get("/stores/{store_id}/shipping-logs")
async def get_store_shipping_logs(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    logs = await db.shipping_logs.find({"store_id": store_id}).sort("timestamp", -1).limit(100).to_list(100)
    for log in logs:
        log["id"] = str(log["_id"])
        del log["_id"]
    return logs

@api_router.post("/subscriptions/{subscription_id}/preview-closure", response_model=ClosurePreviewResponse)
async def preview_subscription_closure(subscription_id: str, payload: dict, user: dict = Depends(get_current_user)):
    # payload: { "address_id": "xxx" }
    address_id = payload.get("address_id")
    if not address_id:
        raise HTTPException(status_code=400, detail="Address ID is required")
        
    sub = await db.user_subscriptions.find_one({"id": subscription_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    # Verify User
    if sub["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get Address for delivery zip
    address = await db.addresses.find_one({"id": address_id})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    customer_zip = address.get("postal_code")
    if not customer_zip:
        raise HTTPException(status_code=400, detail="Address must have a postal code")

    # Get Shipping Config
    ship_config = await db.store_shipping_config.find_one({"store_id": sub["store_id"]})
    shipping_charges = 0.0
    
    if ship_config and ship_config.get("is_enabled"):
        pickup_zip = ship_config.get("pickup_pincode")
        if pickup_zip and ship_config.get("email") and ship_config.get("password"):
            # Call Shiprocket
            try:
                weight = 0.5
                cache_key = f"{pickup_zip}-{customer_zip}-{weight}"
                cached_rate = await db.shipping_rate_cache.find_one({"key": cache_key})
                
                if cached_rate and datetime.fromisoformat(cached_rate["expires_at"]) > datetime.now(timezone.utc):
                    shipping_charges = cached_rate["rate"]
                else:
                    # await log_shiprocket(sub["store_id"], "token_request", "pending", {"email": ship_config["email"]})
                    token = await get_shiprocket_token(ship_config["email"], ship_config["password"])
                    
                    await log_shiprocket(sub["store_id"], "rate_check_closure", "pending", {"pickup": pickup_zip, "dest": customer_zip, "weight": weight})
                    res = await check_serviceability(token, pickup_zip, customer_zip, weight)
                    
                    if res and "rate" in res:
                        shipping_charges = float(res["rate"])
                        await log_shiprocket(sub["store_id"], "rate_check_closure", "success", response=res)
                        
                        # Cache
                        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
                        await db.shipping_rate_cache.update_one(
                            {"key": cache_key},
                            {"$set": {
                                "rate": shipping_charges,
                                "expires_at": expires_at
                            }},
                            upsert=True
                        )
                    else:
                        logger.warning(f"No shipping rate found for {pickup_zip} -> {customer_zip}")
                        await log_shiprocket(sub["store_id"], "rate_check_closure", "failed", error="No rate found", response=res)
                        shipping_charges = 150.0  # Safe default?
            except Exception as e:
                logger.error(f"Shipping calc failed: {e}")
                await log_shiprocket(sub["store_id"], "rate_check_closure", "error", error=str(e))
                shipping_charges = 0.0 # Or error out
        else:
            shipping_charges = 0.0 # Config incomplete
            
    # Calculate Metal Rounding
    current_grams = sub.get("accumulated_weight_grams", 0.0)
    # Valid steps: 0.25
    step = 0.25
    # Python floating point math might be tricky.
    target_grams = ceil(current_grams / step) * step
    needed_grams = target_grams - current_grams
    
    # Tiny epsilon check
    if needed_grams < 0.0001: 
        needed_grams = 0.0
        target_grams = current_grams

    gold_cost = 0.0
    tax_amount = 0.0
    rate_used = 0.0
    
    if needed_grams > 0:
        # Get Market Price
        market_prices = await db.store_market_prices.find_one({"store_id": sub["store_id"]})
        prices = market_prices.get("prices", {}) if market_prices else {}
        
        # Determine Metal from Plan
        plan = await db.subscription_plans.find_one({"id": sub["plan_id"]})
        target_metal = (plan.get("target_metal") or "gold").lower()
        
        if target_metal == 'gold':
             rate_used = float(prices.get("gold_24") or prices.get("gold_22") or 0)
        elif target_metal == 'silver':
             rate_used = float(prices.get("silver_1g") or 0)
        elif target_metal == 'platinum':
             rate_used = float(prices.get("platinum_1g") or 0)
             
        # Fallback price
        if rate_used <= 0: rate_used = 5000.0

        base_gold_cost = needed_grams * rate_used
        
        # Calculate Tax
        tax_config = await db.store_tax_config.find_one({"store_id": sub["store_id"]})
        tax_rate = 0.03 # Default 3%
        if tax_config:
             metal_tax = next((m for m in tax_config.get("metal_taxes", []) if m["metal"] == target_metal and m["is_enabled"]), None)
             if metal_tax:
                 tax_rate = (metal_tax["tax_rate"]["cgst"] + metal_tax["tax_rate"]["igst"]) / 100
        
        gold_cost = base_gold_cost
        tax_amount = base_gold_cost * tax_rate
        
    total_amount = gold_cost + tax_amount + shipping_charges
    
    return ClosurePreviewResponse(
        subscription_id=subscription_id,
        accumulated_grams=current_grams,
        target_grams=target_grams,
        needed_grams=needed_grams,
        gold_rate=rate_used,
        gold_cost=gold_cost,
        tax_amount=tax_amount,
        shipping_charges=shipping_charges,
        total_amount=total_amount,
        breakdown={
            "base_cost": gold_cost,
            "tax": tax_amount,
            "shipping": shipping_charges,
            "metal_needed": needed_grams
        }
    )

@api_router.post("/subscriptions/{subscription_id}/initiate-closure", response_model=MockPaymentResponse)
async def initiate_subscription_closure(subscription_id: str, payload: dict, user: dict = Depends(get_current_user)):
    # payload: { "address_id": "xxx" }
    # Re-run preview logic to confirm amount
    preview = await preview_subscription_closure(subscription_id, payload, user)
    
    total_amount = preview.total_amount
    amount_in_paise = int(round(total_amount * 100))
    
    # Get Key ID
    sub = await db.user_subscriptions.find_one({"id": subscription_id})
    store_conf = await db.stores.find_one({"id": sub["store_id"]})
    
    key_id = "rzp_test_123456789" # Fallback
    key_secret = "dummy"

    if store_conf and store_conf.get("razorpay_key_id"):
        key_id = store_conf["razorpay_key_id"]
        key_secret = store_conf.get("razorpay_key_secret", "dummy")

    if amount_in_paise == 0:
        # If amount is 0 (exact grams + free shipping?), just complete it?
        # For security, let's treat it as a free "payment" or direct action.
        # But usually Razorpay needs > 1 INR.
        # If total is 0, we can skip payment logic and just complete.
        # But assume shipping always costs.
        pass

    # Create Razorpay Order
    import razorpay
    
    try:
        if key_id != "rzp_test_123456789":
             client = razorpay.Client(auth=(key_id, key_secret))
             order_data = {
                 "amount": amount_in_paise,
                 "currency": "INR",
                 "receipt": f"closure_{subscription_id}"[:40],
                 "notes": {
                     "type": "subscription_closure",
                     "subscription_id": subscription_id,
                     "address_id": payload["address_id"],
                     "needed_grams": preview.needed_grams,
                     "shipping_charges": preview.shipping_charges
                 }
             }
             razorpay_order = client.order.create(data=order_data)
             rp_order_id = razorpay_order["id"]
        else:
             rp_order_id = f"order_mock_{uuid.uuid4().hex}"
    except Exception as e:
         logger.error(f"Razorpay Order Failed: {e}")
         raise HTTPException(status_code=500, detail="Payment Gateway Error")

    # Create local payment record
    payment_id = str(uuid.uuid4())
    payment_doc = {
        "id": payment_id,
        "user_id": user["id"],
        "subscription_id": subscription_id,
        "amount": total_amount,
        "currency": "INR",
        "status": "pending",
        "razorpay_order_id": rp_order_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "type": "closure",
        "metadata": {
            "address_id": payload["address_id"],
            "needed_grams": preview.needed_grams,
            "target_grams": preview.target_grams,
            "shipping_charges": preview.shipping_charges
        }
    }
    await db.payments.insert_one(payment_doc)
    
    return MockPaymentResponse(
        id=payment_id,
        user_id=user["id"],
        amount=total_amount,
        razorpay_amount=amount_in_paise,
        description="Subscription Closure & Coin Purchase",
        status="pending",
        razorpay_order_id=rp_order_id,
        razorpay_key_id=key_id,
        created_at=payment_doc["created_at"]
    )

# ==================== SETTINGS ENDPOINTS ====================

@api_router.put("/stores/{store_id}/settings")
async def update_store_settings(store_id: str, request: Request, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    print(f"--- DEBUG: update_store_settings called for {store_id} ---")
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        print("--- DEBUG: Permission denied ---")
        raise HTTPException(status_code=403, detail="Cannot update settings for other stores")

    # Read incoming JSON body once
    payload = {}
    try:
        payload = await request.json()
        print(f"--- DEBUG: payload={payload} ---")
    except Exception as e:
        print(f"--- DEBUG: Failed to parse json: {e} ---")
        payload = {}

    update_data = {}
    if payload.get("currency") is not None:
        update_data["currency"] = payload.get("currency")
    if payload.get("order_prefix") is not None:
        # ensure uppercase and trimmed to 3 chars
        pref = str(payload.get("order_prefix") or "").upper().strip()[:3]
        if pref:
            update_data["order_prefix"] = pref

    if update_data:
        await db.stores.update_one({"id": store_id}, {"$set": update_data})

    # Persist market_prices separately into `store_market_prices` collection if provided
    market_prices = payload.get("market_prices")
    if market_prices is not None:
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "store_id": store_id,
            "enabled": bool(market_prices.get("enabled", False)),
            "prices": market_prices.get("prices", {}) if isinstance(market_prices, dict) else {},
            "updated_at": now
        }
        await db.store_market_prices.update_one({"store_id": store_id}, {"$set": doc}, upsert=True)

    return {"message": "Settings updated"}

# Include router
app.include_router(api_router)

origins_env = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in origins_env.split(",")] if origins_env else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

print("--- DEBUG: LOADED BACKEND/SERVER.PY ---")

# Create default super admin on startup
@app.on_event("startup")
async def create_default_admin():
    # Create indexes for better query performance
    await db.carts.create_index([("store_id", 1), ("user_id", 1)], unique=False)
    await db.carts.create_index([("store_id", 1), ("session_id", 1)], unique=False)
    # Index for domain lookup and uniqueness
    await db.store_domain_configs.create_index([("domain", 1)], unique=True, sparse=True)
    
    existing = await db.users.find_one({"email": "admin@admin.com"})
    if not existing:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "email": "admin@admin.com",
            "password_hash": hash_password("admin123"),
            "name": "Super Admin",
            "role": UserRole.SUPER_ADMIN,
            "store_id": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        logger.info("Default super admin created: admin@admin.com / admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
