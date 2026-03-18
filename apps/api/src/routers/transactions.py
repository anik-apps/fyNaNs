import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.transaction import Transaction
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.transaction import (
    ImportResponse,
    TransactionCreateRequest,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdateRequest,
)
from src.services.transaction import (
    TransactionError,
    create_manual_transaction,
    import_csv,
    import_ofx,
    list_transactions,
)

MAX_IMPORT_SIZE = 5 * 1024 * 1024  # 5MB

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _txn_to_response(txn: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=txn.id,
        account_id=txn.account_id,
        amount=str(txn.amount),
        date=txn.date,
        description=txn.description,
        merchant_name=txn.merchant_name,
        category_id=txn.category_id,
        is_pending=txn.is_pending,
        is_manual=txn.is_manual,
        notes=txn.notes,
        created_at=txn.created_at,
        updated_at=txn.updated_at,
    )


@router.get("", response_model=TransactionListResponse)
async def list_transactions_endpoint(
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    account_id: uuid.UUID | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    search: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transactions, next_cursor = await list_transactions(
        db, user.id,
        cursor=cursor,
        limit=limit,
        account_id=account_id,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )
    return TransactionListResponse(
        items=[_txn_to_response(t) for t in transactions],
        next_cursor=next_cursor,
    )


@router.post("/import", response_model=ImportResponse)
async def import_transactions(
    account_id: uuid.UUID = Query(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload CSV or OFX file (max 5MB). Auto-detects format."""
    content = await file.read()

    if len(content) > MAX_IMPORT_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    filename = file.filename or ""

    try:
        if filename.lower().endswith((".ofx", ".qfx")):
            result = await import_ofx(db, user.id, account_id, content)
        else:
            result = await import_csv(db, user.id, account_id, content)
    except TransactionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    return ImportResponse(**result)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user.id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _txn_to_response(txn)


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    request: TransactionCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        txn = await create_manual_transaction(
            db, user.id,
            account_id=request.account_id,
            amount=request.amount,
            txn_date=request.date,
            description=request.description,
            merchant_name=request.merchant_name,
            category_id=request.category_id,
            notes=request.notes,
        )
        return _txn_to_response(txn)
    except TransactionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: uuid.UUID,
    request: TransactionUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user.id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "amount" and value is not None:
            from decimal import Decimal
            value = Decimal(value)
        setattr(txn, key, value)

    await db.commit()
    await db.refresh(txn)
    return _txn_to_response(txn)


@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user.id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await db.delete(txn)
    await db.commit()
    return {"detail": "Transaction deleted"}
