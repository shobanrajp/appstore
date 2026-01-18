from fastapi import HTTPException, Depends
from typing import List
import uuid
from datetime import datetime, timezone


def register_subscription_plan_routes(router, db, require_roles, UserRole, SubscriptionPlanCreate, SubscriptionPlanResponse, get_current_user):
    """Register subscription plan related routes on the provided router.
    This avoids circular imports by receiving dependencies from the main server module.
    """

    @router.post("/stores/{store_id}/subscription-plans", response_model=SubscriptionPlanResponse)
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

    @router.get("/stores/{store_id}/subscription-plans", response_model=List[SubscriptionPlanResponse])
    async def get_subscription_plans(store_id: str):
        plans = await db.subscription_plans.find({"store_id": store_id, "is_active": True, "is_enabled": {"$ne": False}}, {"_id": 0}).to_list(100)
        return [SubscriptionPlanResponse(**p) for p in plans]

    @router.put("/stores/{store_id}/subscription-plans/{plan_id}", response_model=SubscriptionPlanResponse)
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

    @router.put("/stores/{store_id}/subscription-plans/{plan_id}/toggle-enabled")
    async def toggle_subscription_plan_enabled(store_id: str, plan_id: str, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
        if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
            raise HTTPException(status_code=403, detail="Cannot update plans for other stores")

        plan = await db.subscription_plans.find_one({"id": plan_id, "store_id": store_id})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

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
