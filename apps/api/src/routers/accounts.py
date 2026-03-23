import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.database import get_db
from src.models.account import Account
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.account import (
    AccountBalanceResponse,
    AccountCreateRequest,
    AccountResponse,
    AccountUpdateRequest,
)
from src.services.account import AccountError, create_manual_account, delete_account, update_account

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _account_to_response(account: Account) -> AccountResponse:
    last_synced = None
    if account.plaid_item:
        last_synced = account.plaid_item.last_synced_at
    return AccountResponse(
        id=account.id,
        institution_name=account.institution_name,
        name=account.name,
        type=account.type,
        balance=str(account.balance),
        currency=account.currency,
        mask=account.mask,
        is_manual=account.is_manual,
        plaid_item_id=account.plaid_item_id,
        last_synced_at=last_synced,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.user_id == user.id).options(selectinload(Account.plaid_item))
    )
    accounts = result.scalars().all()
    return [_account_to_response(a) for a in accounts]


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    request: AccountCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        account = await create_manual_account(
            db, user.id,
            institution_name=request.institution_name,
            name=request.name,
            account_type=request.type,
            balance=request.balance,
            currency=request.currency,
            mask=request.mask,
        )
        return _account_to_response(account)
    except AccountError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account_endpoint(
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user.id)
        .options(selectinload(Account.plaid_item))
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return _account_to_response(account)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account_endpoint(
    account_id: uuid.UUID,
    request: AccountUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user.id)
        .options(selectinload(Account.plaid_item))
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    updated = await update_account(
        db, account, **request.model_dump(exclude_unset=True)
    )
    return _account_to_response(updated)


@router.delete("/{account_id}")
async def delete_account_endpoint(
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    await delete_account(db, account)
    return {"detail": "Account deleted"}


@router.get("/{account_id}/balance", response_model=AccountBalanceResponse)
async def get_account_balance(
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns stored balance (from last sync). Does NOT trigger a live Plaid fetch."""
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return AccountBalanceResponse(
        account_id=account.id,
        balance=str(account.balance),
        currency=account.currency,
        last_updated=account.updated_at,
    )
