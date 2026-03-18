import uuid

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.category import Category
from src.models.transaction import Transaction


class CategoryError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


async def list_categories(db: AsyncSession, user_id: uuid.UUID) -> list[Category]:
    """List system categories + user's custom categories."""
    result = await db.execute(
        select(Category).where(
            or_(Category.is_system.is_(True), Category.user_id == user_id)
        ).order_by(Category.name)
    )
    return list(result.scalars().all())


async def create_category(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    icon: str,
    color: str,
    parent_id: uuid.UUID | None = None,
) -> Category:
    # Check for duplicate (user_id, name, parent_id)
    query = select(Category).where(
        Category.user_id == user_id,
        Category.name == name,
    )
    if parent_id:
        query = query.where(Category.parent_id == parent_id)
    else:
        query = query.where(Category.parent_id.is_(None))

    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise CategoryError("Category with this name already exists", 409)

    category = Category(
        user_id=user_id,
        name=name,
        icon=icon,
        color=color,
        parent_id=parent_id,
        is_system=False,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(
    db: AsyncSession,
    category: Category,
    user_id: uuid.UUID,
) -> None:
    """Delete category.

    Reassigns transactions to parent category, or 'Uncategorized' if no parent.
    """
    if category.is_system:
        raise CategoryError("Cannot delete system categories", 403)
    if category.user_id != user_id:
        raise CategoryError("Category not found", 404)

    # Find replacement category
    replacement_id = category.parent_id
    if not replacement_id:
        # Find Uncategorized
        result = await db.execute(
            select(Category).where(
                Category.name == "Uncategorized",
                Category.is_system.is_(True),
            )
        )
        uncat = result.scalar_one_or_none()
        replacement_id = uncat.id if uncat else None

    # Reassign transactions
    await db.execute(
        update(Transaction)
        .where(Transaction.category_id == category.id)
        .values(category_id=replacement_id)
    )

    await db.delete(category)
    await db.commit()
