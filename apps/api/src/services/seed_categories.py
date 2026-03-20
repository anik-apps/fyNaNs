"""Seed system categories on startup. Idempotent — skips if already seeded."""

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.category import Category

logger = logging.getLogger(__name__)

# (name, icon, color, subcategories)
# subcategories: list of (name, icon, color)
SYSTEM_CATEGORIES: list[tuple[str, str, str, list[tuple[str, str, str]]]] = [
    ("Income", "banknote", "#10B981", [
        ("Salary", "banknote", "#10B981"),
        ("Freelance", "banknote", "#10B981"),
        ("Investments", "trending-up", "#10B981"),
        ("Other Income", "banknote", "#10B981"),
    ]),
    ("Food & Drink", "utensils", "#F59E0B", [
        ("Groceries", "shopping-bag", "#F59E0B"),
        ("Restaurants", "coffee", "#F59E0B"),
    ]),
    ("Transportation", "truck", "#3B82F6", [
        ("Gas", "zap", "#3B82F6"),
        ("Public Transit", "truck", "#3B82F6"),
        ("Rideshare", "truck", "#3B82F6"),
    ]),
    ("Housing", "home", "#8B5CF6", [
        ("Rent", "home", "#8B5CF6"),
        ("Mortgage", "home", "#8B5CF6"),
        ("Utilities", "zap", "#8B5CF6"),
    ]),
    ("Shopping", "shopping-bag", "#EC4899", [
        ("Clothing", "shopping-bag", "#EC4899"),
        ("Electronics", "package", "#EC4899"),
        ("General", "package", "#EC4899"),
    ]),
    ("Entertainment", "film", "#F97316", [
        ("Streaming", "film", "#F97316"),
        ("Events", "film", "#F97316"),
        ("Hobbies", "film", "#F97316"),
    ]),
    ("Health", "heart", "#EF4444", [
        ("Doctor", "heart", "#EF4444"),
        ("Pharmacy", "heart", "#EF4444"),
        ("Fitness", "heart", "#EF4444"),
    ]),
    ("Education", "graduation-cap", "#6366F1", []),
    ("Personal", "wallet", "#14B8A6", []),
    ("Gifts & Donations", "gift", "#D946EF", []),
    ("Fees & Charges", "receipt", "#6B7280", []),
    ("Transfer", "arrow-left-right", "#6B7280", []),
    ("Insurance", "credit-card", "#0EA5E9", []),
    ("Uncategorized", "package", "#6B7280", []),
]


async def seed_system_categories(db: AsyncSession) -> None:
    """Insert system categories if none exist. Idempotent and safe with multiple workers."""
    from sqlalchemy import text

    # Advisory lock prevents race condition when multiple uvicorn workers start
    await db.execute(text("SELECT pg_advisory_lock(42)"))
    try:
        result = await db.execute(
            select(func.count()).where(Category.is_system.is_(True))
        )
        count = result.scalar() or 0
        if count > 0:
            logger.debug("System categories already seeded (%d found), skipping", count)
            return

        logger.info("Seeding system categories...")
        for name, icon, color, subcategories in SYSTEM_CATEGORIES:
            parent = Category(
                user_id=None,
                name=name,
                icon=icon,
                color=color,
                is_system=True,
                parent_id=None,
            )
            db.add(parent)
            await db.flush()  # Get parent.id for subcategories

            for sub_name, sub_icon, sub_color in subcategories:
                child = Category(
                    user_id=None,
                    name=sub_name,
                    icon=sub_icon,
                    color=sub_color,
                    is_system=True,
                    parent_id=parent.id,
                )
                db.add(child)

        await db.commit()
        logger.info("Seeded %d system categories", len(SYSTEM_CATEGORIES))
    finally:
        await db.execute(text("SELECT pg_advisory_unlock(42)"))
