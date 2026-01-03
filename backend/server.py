from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

app = FastAPI(title="Dynamic Web App Configurator")
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

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

class StoreResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    currency: str
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool
    created_at: str

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
    created_at: str

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
    is_default: bool

class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int
    price: float

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    shipping_address_id: str
    notes: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    store_id: str
    user_id: str
    items: List[dict]
    shipping_address: dict
    total_amount: float
    status: str
    tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    carrier_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str

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

class SubscriptionPlanCreate(BaseModel):
    name: str
    plan_type: str  # Text input - e.g., "Gold", "Silver", "Platinum"
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
    duration_months: int
    min_amount: float
    max_amount: float
    bonus_percentage: float
    benefits: List[str]
    description: Optional[str] = None
    is_active: bool
    created_at: str

class UserSubscriptionCreate(BaseModel):
    plan_id: str
    monthly_amount: float  # User chooses the amount within plan limits

class UserSubscriptionResponse(BaseModel):
    id: str
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    store_id: str
    plan_id: str
    plan_name: str
    plan_type: str
    monthly_amount: float
    payments_made: int
    total_paid: float
    status: str
    start_date: str
    maturity_date: str
    created_at: str

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

# Mock Payment
class MockPaymentCreate(BaseModel):
    amount: float
    description: str
    subscription_id: Optional[str] = None
    order_id: Optional[str] = None

class MockPaymentResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    description: str
    status: str
    razorpay_order_id: str
    created_at: str

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
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

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
            created_at=user["created_at"]
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
        created_at=user["created_at"]
    )

# ==================== STORE ENDPOINTS ====================

@api_router.post("/stores", response_model=StoreResponse)
async def create_store(store_data: StoreCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    store_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
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
        "created_at": now
    }
    
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
    
    update_data = store_data.model_dump()
    await db.stores.update_one({"id": store_id}, {"$set": update_data})
    
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    return StoreResponse(**store)

@api_router.delete("/stores/{store_id}")
async def delete_store(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    await db.stores.update_one({"id": store_id}, {"$set": {"is_active": False}})
    return {"message": "Store deactivated"}

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
        "created_at": now
    }
    
    await db.products.insert_one(product_doc)
    return ProductResponse(**{k: v for k, v in product_doc.items() if k != "_id"})

@api_router.get("/stores/{store_id}/products", response_model=List[ProductResponse])
async def get_products(store_id: str, category: Optional[str] = None, active_only: bool = True):
    query = {"store_id": store_id}
    if active_only:
        query["is_active"] = True
    if category:
        query["category"] = category
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
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
    
    inv_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    inv_doc = {
        "id": inv_id,
        "store_id": store_id,
        **inv_data.model_dump(),
        "updated_at": now
    }
    
    await db.inventory.insert_one(inv_doc)
    return InventoryResponse(**{k: v for k, v in inv_doc.items() if k != "_id"})

@api_router.get("/stores/{store_id}/inventory", response_model=List[InventoryResponse])
async def get_inventory(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view inventory for other stores")
    
    inventory = await db.inventory.find({"store_id": store_id}, {"_id": 0}).to_list(1000)
    return [InventoryResponse(**inv) for inv in inventory]

@api_router.put("/stores/{store_id}/inventory/{inv_id}", response_model=InventoryResponse)
async def update_inventory(store_id: str, inv_id: str, inv_data: InventoryCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update inventory for other stores")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {**inv_data.model_dump(), "updated_at": now}
    await db.inventory.update_one({"id": inv_id, "store_id": store_id}, {"$set": update_data})
    
    inv = await db.inventory.find_one({"id": inv_id}, {"_id": 0})
    return InventoryResponse(**inv)

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

@api_router.get("/stores/{store_id}/vendors", response_model=List[VendorResponse])
async def get_vendors(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view vendors from other stores")
    
    vendors = await db.vendors.find({"store_id": store_id, "is_active": True}, {"_id": 0}).to_list(1000)
    return [VendorResponse(**v) for v in vendors]

@api_router.put("/stores/{store_id}/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(store_id: str, vendor_id: str, vendor_data: VendorCreate, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update vendors from other stores")
    
    await db.vendors.update_one({"id": vendor_id, "store_id": store_id}, {"$set": vendor_data.model_dump()})
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    return VendorResponse(**vendor)

@api_router.delete("/stores/{store_id}/vendors/{vendor_id}")
async def delete_vendor(store_id: str, vendor_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot delete vendors from other stores")
    
    await db.vendors.update_one({"id": vendor_id, "store_id": store_id}, {"$set": {"is_active": False}})
    return {"message": "Vendor deactivated"}

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

@api_router.get("/stores/{store_id}/purchase-orders", response_model=List[PurchaseOrderResponse])
async def get_purchase_orders(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view POs from other stores")
    
    pos = await db.purchase_orders.find({"store_id": store_id}, {"_id": 0}).to_list(1000)
    return [PurchaseOrderResponse(**po) for po in pos]

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

@api_router.get("/stores/{store_id}/pos-transactions", response_model=List[POSTransactionResponse])
async def get_pos_transactions(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN, UserRole.STORE_USER]))):
    if user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER] and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot view transactions from other stores")
    
    txs = await db.pos_transactions.find({"store_id": store_id}, {"_id": 0}).to_list(1000)
    return [POSTransactionResponse(**tx) for tx in txs]

# ==================== ORDER ENDPOINTS ====================

async def get_next_order_id():
    """Generate VEL + 15 digit incrementing order ID"""
    counter = await db.counters.find_one_and_update(
        {"_id": "order_counter"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    seq = counter.get("seq", 1)
    return f"VEL{seq:015d}"

@api_router.post("/stores/{store_id}/orders", response_model=OrderResponse)
async def create_order(store_id: str, order_data: OrderCreate, user: dict = Depends(get_current_user)):
    order_id = await get_next_order_id()
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
    
    order_doc = {
        "id": order_id,
        "store_id": store_id,
        "user_id": user["id"],
        "items": items,
        "shipping_address": address,
        "total_amount": total,
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

@api_router.get("/stores/{store_id}/orders", response_model=List[OrderResponse])
async def get_orders(store_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == UserRole.END_USER:
        orders = await db.orders.find({"store_id": store_id, "user_id": user["id"]}, {"_id": 0}).to_list(1000)
    elif user["role"] in [UserRole.STORE_ADMIN, UserRole.STORE_USER]:
        if user.get("store_id") != store_id:
            raise HTTPException(status_code=403, detail="Cannot view orders from other stores")
        orders = await db.orders.find({"store_id": store_id}, {"_id": 0}).to_list(1000)
    else:
        orders = await db.orders.find({"store_id": store_id}, {"_id": 0}).to_list(1000)
    
    return [OrderResponse(**o) for o in orders]

@api_router.get("/my-orders", response_model=List[OrderResponse])
async def get_my_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return [OrderResponse(**o) for o in orders]

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
    plans = await db.subscription_plans.find({"store_id": store_id, "is_active": True}, {"_id": 0}).to_list(100)
    return [SubscriptionPlanResponse(**p) for p in plans]

@api_router.post("/stores/{store_id}/subscribe", response_model=UserSubscriptionResponse)
async def subscribe_to_plan(store_id: str, sub_data: UserSubscriptionCreate, user: dict = Depends(get_current_user)):
    plan = await db.subscription_plans.find_one({"id": sub_data.plan_id, "store_id": store_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    sub_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    maturity = now + timedelta(days=plan["duration_months"] * 30)
    
    monthly_amount = sub_data.monthly_amount or plan["monthly_amount"]
    
    sub_doc = {
        "id": sub_id,
        "user_id": user["id"],
        "store_id": store_id,
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "payment_type": sub_data.payment_type,
        "monthly_amount": monthly_amount,
        "gold_weight_grams": sub_data.gold_weight_grams,
        "payments_made": 0,
        "total_paid": 0,
        "status": "active",
        "start_date": now.isoformat(),
        "maturity_date": maturity.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.user_subscriptions.insert_one(sub_doc)
    return UserSubscriptionResponse(**{k: v for k, v in sub_doc.items() if k != "_id"})

@api_router.get("/my-subscriptions", response_model=List[UserSubscriptionResponse])
async def get_my_subscriptions(user: dict = Depends(get_current_user)):
    subs = await db.user_subscriptions.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return [UserSubscriptionResponse(**s) for s in subs]

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

@api_router.post("/payments/create-order", response_model=MockPaymentResponse)
async def create_payment_order(payment_data: MockPaymentCreate, user: dict = Depends(get_current_user)):
    payment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Mock Razorpay order ID
    razorpay_order_id = f"order_mock_{uuid.uuid4().hex[:16]}"
    
    payment_doc = {
        "id": payment_id,
        "user_id": user["id"],
        "amount": payment_data.amount,
        "description": payment_data.description,
        "subscription_id": payment_data.subscription_id,
        "order_id": payment_data.order_id,
        "status": "created",
        "razorpay_order_id": razorpay_order_id,
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

# ==================== PROFILE ENDPOINTS ====================

@api_router.put("/profile", response_model=UserResponse)
async def update_profile(name: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"name": name}})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return UserResponse(**updated)

# ==================== SETTINGS ENDPOINTS ====================

@api_router.put("/stores/{store_id}/settings")
async def update_store_settings(store_id: str, currency: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update settings for other stores")
    
    await db.stores.update_one({"id": store_id}, {"$set": {"currency": currency}})
    return {"message": "Settings updated"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create default super admin on startup
@app.on_event("startup")
async def create_default_admin():
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
