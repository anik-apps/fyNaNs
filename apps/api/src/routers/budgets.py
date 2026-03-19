import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.budget import Budget
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.budget import (
    BudgetCreateRequest,
    BudgetOverviewItem,
    BudgetResponse,
    BudgetUpdateRequest,
)
from src.services.budget import (
    BudgetError,
    compute_current_spend,
    create_budget,
    get_budgets_with_spend,
)

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetResponse])
async def list_budgets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budgets_data = await get_budgets_with_spend(db, user.id)
    return [
        BudgetResponse(
            id=b["id"],
            category_id=b["category_id"],
            category_name=b["category_name"],
            amount_limit=b["amount_limit"],
            period=b["period"],
            current_spend=b["current_spend"],
            created_at=b["created_at"],
            updated_at=b["updated_at"],
        )
        for b in budgets_data
    ]


@router.post("", response_model=BudgetResponse, status_code=201)
async def create_budget_endpoint(
    request: BudgetCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        budget = await create_budget(
            db,
            user.id,
            category_id=request.category_id,
            amount_limit=request.amount_limit,
            period=request.period,
        )
        return BudgetResponse(
            id=budget.id,
            category_id=budget.category_id,
            amount_limit=str(budget.amount_limit),
            period=budget.period,
            current_spend="0.00",
            created_at=budget.created_at,
            updated_at=budget.updated_at,
        )
    except BudgetError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from None


@router.get("/overview", response_model=list[BudgetOverviewItem])
async def budget_overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All budgets with % spent for dashboard."""
    budgets_data = await get_budgets_with_spend(db, user.id)
    return [
        BudgetOverviewItem(
            id=b["id"],
            category_id=b["category_id"],
            category_name=b["category_name"],
            category_color=b["category_color"],
            amount_limit=b["amount_limit"],
            period=b["period"],
            current_spend=b["current_spend"],
            percent_spent=b["percent_spent"],
        )
        for b in budgets_data
    ]


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    request: BudgetUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "amount_limit" and value is not None:
            value = Decimal(value)
        setattr(budget, key, value)

    await db.commit()
    await db.refresh(budget)

    current_spend = await compute_current_spend(
        db, user.id, budget.category_id, budget.period
    )

    return BudgetResponse(
        id=budget.id,
        category_id=budget.category_id,
        amount_limit=str(budget.amount_limit),
        period=budget.period,
        current_spend=str(current_spend),
        created_at=budget.created_at,
        updated_at=budget.updated_at,
    )


@router.delete("/{budget_id}")
async def delete_budget(
    budget_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    await db.delete(budget)
    await db.commit()
    return {"detail": "Budget deleted"}
