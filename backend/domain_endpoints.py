# Domain Management Endpoints
# Add these endpoints to your api_router in server.py

"""
Domain Management Endpoints for Multi-Tenant Store Support

These endpoints handle:
- Custom domain configuration per store
- Domain verification
- Store lookup by domain (for frontend routing)
- Domain validation and uniqueness checks
"""

import re
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

# Add these imports to server.py:
# import re
# from datetime import datetime, timezone

# ==================== CUSTOM DOMAIN MANAGEMENT ====================

async def setup_domain_endpoints(api_router, db, UserRole, require_roles):
    """Initialize domain management endpoints"""
    
    @api_router.put("/stores/{store_id}/domain")
    async def update_store_domain(store_id: str, domain_data: dict, 
                                  user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
        """
        Update store's custom domain with validation
        
        Example request:
        {
            "custom_domain": "mystore.com"
        }
        """
        if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
            raise HTTPException(status_code=403, detail="Cannot update other stores")
        
        store = await db.stores.find_one({"id": store_id})
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        custom_domain = domain_data.get("custom_domain", "").lower().strip()
        
        # Validate domain format if provided
        if custom_domain:
            # Check if domain is already in use by another store
            existing = await db.stores.find_one({"custom_domain": custom_domain, "id": {"$ne": store_id}})
            if existing:
                raise HTTPException(status_code=400, detail="Custom domain already in use by another store")
            
            # Validate domain format
            domain_pattern = r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?([.][a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
            if not re.match(domain_pattern, custom_domain):
                raise HTTPException(status_code=400, detail="Invalid domain name format. Use format: example.com")
        
        # Update domain and reset verification status
        update_data = {
            "custom_domain": custom_domain if custom_domain else None,
            "custom_domain_verified": False
        }
        
        await db.stores.update_one({"id": store_id}, {"$set": update_data})
        
        store = await db.stores.find_one({"id": store_id}, {"_id": 0})
        # Return updated store (adapt response model as needed)
        return {
            "id": store["id"],
            "name": store.get("name"),
            "custom_domain": store.get("custom_domain"),
            "custom_domain_verified": store.get("custom_domain_verified", False)
        }
    
    @api_router.get("/stores/{store_id}/domain-verification-status")
    async def get_domain_verification_status(store_id: str):
        """
        Get domain verification status and setup instructions
        
        Response:
        {
            "status": "verified|pending|no_domain",
            "domain": "mystore.com",
            "verified": true/false,
            "instructions": {...}
        }
        """
        store = await db.stores.find_one({"id": store_id}, {"_id": 0})
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        if not store.get("custom_domain"):
            return {
                "status": "no_domain",
                "message": "No custom domain configured"
            }
        
        return {
            "status": "verified" if store.get("custom_domain_verified") else "pending",
            "domain": store.get("custom_domain"),
            "verified": store.get("custom_domain_verified", False),
            "instructions": {
                "step_1": "Add DNS CNAME record",
                "dns_cname": "CNAME appstores-pink.vercel.app",
                "step_2": "Configure domain in Vercel project settings",
                "step_3": "Wait 5-30 minutes for DNS propagation",
                "step_4": "Click verify button below to confirm",
                "docs": "See DOMAIN_SETUP_GUIDE.md for detailed instructions"
            }
        }
    
    @api_router.post("/stores/{store_id}/verify-domain")
    async def verify_domain(store_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
        """
        Manually verify domain (admin only)
        Marks domain as verified without DNS check
        (In production, implement actual DNS verification)
        """
        if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
            raise HTTPException(status_code=403, detail="Cannot update other stores")
        
        store = await db.stores.find_one({"id": store_id})
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        if not store.get("custom_domain"):
            raise HTTPException(status_code=400, detail="No custom domain configured")
        
        # TODO: In production, verify DNS records before marking as verified
        # 1. Resolve custom_domain CNAME
        # 2. Check if it points to appstores-pink.vercel.app
        # 3. Also verify Vercel SSL cert is valid
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Mark as verified
        await db.stores.update_one(
            {"id": store_id}, 
            {"$set": {
                "custom_domain_verified": True,
                "domain_verified_at": now
            }}
        )
        
        store = await db.stores.find_one({"id": store_id}, {"_id": 0})
        return {
            "message": "Domain verified successfully",
            "domain": store.get("custom_domain"),
            "verified": True
        }
    
    @api_router.get("/stores/by-domain/{domain}")
    async def get_store_by_domain(domain: str):
        """
        Get store by custom domain - used by frontend for domain-based routing
        
        Frontend calls this when loading from custom domain to get store ID and config
        
        Example:
        GET /api/stores/by-domain/mystore.com
        Response: { "id": "uuid", "name": "My Store", ... }
        """
        domain = domain.lower().strip()
        
        # Find store with this domain
        store = await db.stores.find_one(
            {"custom_domain": domain, "is_active": True}, 
            {"_id": 0}
        )
        
        if not store:
            raise HTTPException(
                status_code=404, 
                detail=f"Store not found for domain: {domain}"
            )
        
        # Return full store info
        return {
            "id": store.get("id"),
            "name": store.get("name"),
            "description": store.get("description"),
            "logo_url": store.get("logo_url"),
            "custom_domain": store.get("custom_domain"),
            "currency": store.get("currency", "INR")
        }
    
    @api_router.delete("/stores/{store_id}/domain")
    async def remove_store_domain(store_id: str, 
                                  user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
        """
        Remove custom domain from store
        Store will only be accessible via default Vercel domain
        """
        if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
            raise HTTPException(status_code=403, detail="Cannot update other stores")
        
        store = await db.stores.find_one({"id": store_id})
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        await db.stores.update_one(
            {"id": store_id},
            {"$set": {
                "custom_domain": None,
                "custom_domain_verified": False
            }}
        )
        
        return {"message": "Custom domain removed"}

    return [
        update_store_domain,
        get_domain_verification_status,
        verify_domain,
        get_store_by_domain,
        remove_store_domain
    ]
