from decimal import Decimal

from pydantic import BaseModel


class NetWorthSummary(BaseModel):
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal


class AccountBalance(BaseModel):
    id: str
    name: str
    institution_name: str
    type: str
    balance: Decimal
    currency: str
    is_manual: bool


class AccountBalancesByType(BaseModel):
    checking: list[AccountBalance] = []
    savings: list[AccountBalance] = []
    credit: list[AccountBalance] = []
    loan: list[AccountBalance] = []
    investment: list[AccountBalance] = []


class RecentTransaction(BaseModel):
    id: str
    date: str
    description: str
    merchant_name: str | None
    amount: Decimal
    category_name: str
    category_color: str
    account_name: str
    account_type: str
    is_pending: bool


class BudgetStatus(BaseModel):
    id: str
    category_name: str
    category_color: str
    category_icon: str
    amount_limit: Decimal
    amount_spent: Decimal
    percent_spent: float
    period: str


class UpcomingBill(BaseModel):
    id: str
    name: str
    amount: Decimal
    next_due_date: str
    is_auto_pay: bool
    days_until_due: int
    category_name: str | None


class SpendingComparison(BaseModel):
    current_month_total: Decimal
    previous_month_total: Decimal
    difference: Decimal
    percent_change: float | None  # None if previous month was zero


class DashboardResponse(BaseModel):
    net_worth: NetWorthSummary
    accounts_by_type: AccountBalancesByType
    recent_transactions: list[RecentTransaction]
    top_budgets: list[BudgetStatus]
    upcoming_bills: list[UpcomingBill]
    spending_comparison: SpendingComparison
