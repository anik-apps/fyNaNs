"""Seed default system categories. Run with: cd apps/api && poetry run python ../../scripts/seed-categories.py"""
import asyncio
import sys
from pathlib import Path

# Add the api app to path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from src.core.database import async_session_factory  # noqa: E402
from src.models.category import Category  # noqa: E402

SYSTEM_CATEGORIES = [
    {"name": "Income", "icon": "dollar-sign", "color": "#10B981", "children": [
        {"name": "Salary", "icon": "briefcase", "color": "#10B981", "plaid": "Income > Payroll"},
        {"name": "Freelance", "icon": "laptop", "color": "#10B981"},
        {"name": "Investments", "icon": "trending-up", "color": "#10B981"},
        {"name": "Other Income", "icon": "plus-circle", "color": "#10B981"},
    ]},
    {"name": "Food & Drink", "icon": "utensils", "color": "#F59E0B", "children": [
        {"name": "Groceries", "icon": "shopping-cart", "color": "#F59E0B",
         "plaid": "Food and Drink > Groceries"},
        {"name": "Restaurants", "icon": "coffee", "color": "#F59E0B",
         "plaid": "Food and Drink > Restaurants"},
    ]},
    {"name": "Transportation", "icon": "car", "color": "#3B82F6", "children": [
        {"name": "Gas", "icon": "fuel", "color": "#3B82F6", "plaid": "Transportation > Gas"},
        {"name": "Public Transit", "icon": "train", "color": "#3B82F6"},
        {"name": "Rideshare", "icon": "navigation", "color": "#3B82F6"},
    ]},
    {"name": "Housing", "icon": "home", "color": "#8B5CF6", "children": [
        {"name": "Rent", "icon": "key", "color": "#8B5CF6", "plaid": "Rent"},
        {"name": "Mortgage", "icon": "building", "color": "#8B5CF6"},
        {"name": "Utilities", "icon": "zap", "color": "#8B5CF6", "plaid": "Utilities"},
    ]},
    {"name": "Shopping", "icon": "shopping-bag", "color": "#EC4899", "children": [
        {"name": "Clothing", "icon": "shirt", "color": "#EC4899"},
        {"name": "Electronics", "icon": "monitor", "color": "#EC4899"},
        {"name": "General", "icon": "package", "color": "#EC4899"},
    ]},
    {"name": "Entertainment", "icon": "film", "color": "#F97316", "children": [
        {"name": "Streaming", "icon": "tv", "color": "#F97316"},
        {"name": "Events", "icon": "ticket", "color": "#F97316"},
        {"name": "Hobbies", "icon": "gamepad", "color": "#F97316"},
    ]},
    {"name": "Health", "icon": "heart", "color": "#EF4444", "children": [
        {"name": "Doctor", "icon": "stethoscope", "color": "#EF4444"},
        {"name": "Pharmacy", "icon": "pill", "color": "#EF4444"},
        {"name": "Fitness", "icon": "dumbbell", "color": "#EF4444"},
    ]},
    {"name": "Insurance", "icon": "shield", "color": "#6366F1"},
    {"name": "Education", "icon": "book", "color": "#14B8A6"},
    {"name": "Personal", "icon": "user", "color": "#A855F7"},
    {"name": "Gifts & Donations", "icon": "gift", "color": "#F43F5E"},
    {"name": "Fees & Charges", "icon": "alert-circle", "color": "#64748B", "plaid": "Bank Fees"},
    {"name": "Transfer", "icon": "arrow-right-left", "color": "#94A3B8", "plaid": "Transfer"},
    {"name": "Uncategorized", "icon": "help-circle", "color": "#9CA3AF"},
]


async def seed():
    async with async_session_factory() as session:
        # Check if already seeded
        result = await session.execute(
            select(Category).where(Category.is_system.is_(True)).limit(1)
        )
        if result.scalar_one_or_none():
            print("Categories already seeded, skipping.")
            return

        for cat_data in SYSTEM_CATEGORIES:
            parent = Category(
                name=cat_data["name"],
                icon=cat_data["icon"],
                color=cat_data["color"],
                is_system=True,
                plaid_category=cat_data.get("plaid"),
            )
            session.add(parent)
            await session.flush()  # Get parent ID

            for child_data in cat_data.get("children", []):
                child = Category(
                    name=child_data["name"],
                    icon=child_data["icon"],
                    color=child_data["color"],
                    parent_id=parent.id,
                    is_system=True,
                    plaid_category=child_data.get("plaid"),
                )
                session.add(child)

        await session.commit()
        print("System categories seeded successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
