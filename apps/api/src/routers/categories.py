import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.category import Category
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.category import (
    CategoryCreateRequest,
    CategoryResponse,
    CategoryUpdateRequest,
)
from src.services.category import (
    CategoryError,
    create_category,
    delete_category,
    list_categories,
)

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories_endpoint(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    categories = await list_categories(db, user.id)
    return categories


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category_endpoint(
    request: CategoryCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        category = await create_category(
            db, user.id,
            name=request.name,
            icon=request.icon,
            color=request.color,
            parent_id=request.parent_id,
        )
        return category
    except CategoryError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category_endpoint(
    category_id: uuid.UUID,
    request: CategoryUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            or_(Category.user_id == user.id, Category.is_system.is_(True)),
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if category.is_system:
        raise HTTPException(status_code=403, detail="Cannot modify system categories")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)

    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}")
async def delete_category_endpoint(
    category_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            or_(Category.user_id == user.id, Category.is_system.is_(True)),
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    try:
        await delete_category(db, category, user.id)
        return {"detail": "Category deleted"}
    except CategoryError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
