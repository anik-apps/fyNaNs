import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.bill import Bill
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.bill import BillCreateRequest, BillResponse, BillUpdateRequest
from src.services.bill import BillError, create_bill, get_upcoming_bills

router = APIRouter(prefix="/bills", tags=["bills"])


def _bill_to_response(bill: Bill) -> BillResponse:
    return BillResponse(
        id=bill.id,
        name=bill.name,
        amount=str(bill.amount),
        frequency=bill.frequency,
        day_of_week=bill.day_of_week,
        day_of_month=bill.day_of_month,
        month_of_year=bill.month_of_year,
        category_id=bill.category_id,
        account_id=bill.account_id,
        next_due_date=bill.next_due_date,
        reminder_days=bill.reminder_days,
        is_auto_pay=bill.is_auto_pay,
        is_active=bill.is_active,
        source=bill.source,
        min_payment=str(bill.min_payment) if bill.min_payment else None,
        statement_balance=(
            str(bill.statement_balance) if bill.statement_balance else None
        ),
        created_at=bill.created_at,
        updated_at=bill.updated_at,
    )


@router.get("", response_model=list[BillResponse])
async def list_bills(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bill).where(Bill.user_id == user.id).order_by(Bill.next_due_date)
    )
    bills = result.scalars().all()
    return [_bill_to_response(b) for b in bills]


@router.post("", response_model=BillResponse, status_code=201)
async def create_bill_endpoint(
    request: BillCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        bill = await create_bill(
            db,
            user.id,
            name=request.name,
            amount=request.amount,
            frequency=request.frequency,
            next_due_date=request.next_due_date,
            day_of_week=request.day_of_week,
            day_of_month=request.day_of_month,
            month_of_year=request.month_of_year,
            category_id=request.category_id,
            account_id=request.account_id,
            reminder_days=request.reminder_days,
            is_auto_pay=request.is_auto_pay,
        )
        return _bill_to_response(bill)
    except BillError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from None


@router.get("/upcoming", response_model=list[BillResponse])
async def upcoming_bills(
    days: int = Query(30, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bills = await get_upcoming_bills(db, user.id, days=days)
    return [_bill_to_response(b) for b in bills]


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: uuid.UUID,
    request: BillUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bill).where(Bill.id == bill_id, Bill.user_id == user.id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "amount" and value is not None:
            value = Decimal(value)
        setattr(bill, key, value)

    await db.commit()
    await db.refresh(bill)
    return _bill_to_response(bill)


@router.delete("/{bill_id}")
async def delete_bill(
    bill_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bill).where(Bill.id == bill_id, Bill.user_id == user.id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    await db.delete(bill)
    await db.commit()
    return {"detail": "Bill deleted"}
